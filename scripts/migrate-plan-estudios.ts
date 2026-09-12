/**
 * Migración de normalización — Plan de estudios (one-time)
 *
 * 1. Convierte Subject.area (texto libre, columna legacy) en catálogo KnowledgeArea
 *    y enlaza Subject.areaId
 * 2. Crea catálogo GradeLevel (grados) y enlaza Group.gradeLevelId a partir de
 *    Group.grade (columna legacy)
 * 3. Crea un plan de estudios inicial por institución y lo pre-pobla con los items
 *    derivados de SubjectAssignment (asignatura × grado con intensidad horaria)
 *
 * Nota: las columnas legacy se leen con SQL crudo porque el esquema actual ya
 * no las expone en el cliente de Prisma. Este script solo es necesario sobre
 * bases de datos anteriores a la normalización.
 *
 * Idempotente: puede ejecutarse varias veces sin duplicar datos.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Catálogo base de grados colombiano
const DEFAULT_GRADES: { code: string; name: string; sortOrder: number }[] = [
  { code: "PJ", name: "Prejardín", sortOrder: 1 },
  { code: "J", name: "Jardín", sortOrder: 2 },
  { code: "T", name: "Transición", sortOrder: 3 },
  ...Array.from({ length: 11 }, (_, i) => ({
    code: String(i + 1),
    name: `Grado ${i + 1}°`,
    sortOrder: i + 4,
  })),
];

// Normaliza un valor de grado (texto libre de Group.grade) al código del catálogo
function normalizeGradeCode(raw: string): string {
  let v = raw.trim().toLowerCase();
  v = v.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // sin acentos
  v = v.replace(/grado/g, "").replace(/[\s°º]+/g, "");
  const map: Record<string, string> = {
    prejardin: "PJ",
    jardin: "J",
    preescolar: "T",
    kinder: "J",
    k: "J",
    parvulos: "PJ",
    transicion: "T",
  };
  if (map[v]) return map[v];
  if (/^\d{1,2}$/.test(v)) return v; // "6", "11"
  return raw.trim(); // valor desconocido: se crea como código propio
}

async function legacyColumnExists(table: string, column: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("${table}")`
  );
  return rows.some((r) => r.name === column);
}

async function main() {
  const hasLegacyArea = await legacyColumnExists("Subject", "area");
  const hasLegacyGrade = await legacyColumnExists("Group", "grade");
  if (!hasLegacyArea && !hasLegacyGrade) {
    console.log("ℹ Sin columnas legacy: la base ya está normalizada. Nada que migrar.");
  }

  const institutions = await db.institution.findMany({
    include: {
      curriculumPlans: { include: { _count: { select: { items: true } } } },
    },
  });

  for (const inst of institutions) {
    console.log(`\n→ Institución: ${inst.name} (${inst.id})`);

    // ---------- 1. Áreas del conocimiento ----------
    if (hasLegacyArea) {
      const subjects = await db.$queryRawUnsafe<
        { id: string; area: string | null; areaId: string | null }[]
      >(`SELECT id, area, areaId FROM Subject WHERE institutionId = '${inst.id}'`);
      const areaNames = [
        ...new Set(
          subjects.map((s) => (s.area || "").trim()).filter((a) => a.length > 0)
        ),
      ].sort((a, b) => a.localeCompare(b, "es"));

      const areaByName = new Map<string, string>();
      for (let i = 0; i < areaNames.length; i++) {
        const name = areaNames[i];
        const area = await db.knowledgeArea.upsert({
          where: { institutionId_name: { institutionId: inst.id, name } },
          create: {
            institutionId: inst.id,
            name,
            abbreviation: name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 6),
            sortOrder: i + 1,
          },
          update: {},
        });
        areaByName.set(name, area.id);
      }
      console.log(`   Áreas: ${areaByName.size} creadas/verificadas`);

      for (const s of subjects) {
        const name = (s.area || "").trim();
        const newAreaId = name ? areaByName.get(name) ?? null : null;
        if (s.areaId !== newAreaId) {
          await db.subject.update({ where: { id: s.id }, data: { areaId: newAreaId } });
        }
      }
    }

    // ---------- 2. Grados ----------
    for (const g of DEFAULT_GRADES) {
      await db.gradeLevel.upsert({
        where: { institutionId_code: { institutionId: inst.id, code: g.code } },
        create: { institutionId: inst.id, ...g },
        update: { name: g.name, sortOrder: g.sortOrder },
      });
    }
    // Grados extra encontrados en grupos (no están en el catálogo base)
    const groups = await db.group.findMany({ where: { institutionId: inst.id } });
    const legacyGrades = hasLegacyGrade
      ? await db.$queryRawUnsafe<{ id: string; grade: string | null }[]>(
          `SELECT id, grade FROM "Group" WHERE institutionId = '${inst.id}'`
        )
      : groups.map((g) => ({ id: g.id, grade: null as string | null }));
    const gradeByGroup = new Map(legacyGrades.map((g) => [g.id, g.grade]));

    const groupGrades = [
      ...new Set(
        legacyGrades.map((g) => (g.grade || "").trim()).filter(Boolean)
      ),
    ];
    const levels = await db.gradeLevel.findMany({
      where: { institutionId: inst.id },
    });
    const levelByCode = new Map(levels.map((l) => [l.code, l.id]));
    let extra = 0;
    for (const raw of groupGrades) {
      const code = normalizeGradeCode(raw);
      if (levelByCode.has(code)) continue;
      const created = await db.gradeLevel.create({
        data: {
          institutionId: inst.id,
          code,
          name: `Grado ${raw.trim()}`,
          sortOrder: 100 + extra,
          active: true,
        },
      });
      levelByCode.set(code, created.id);
      extra++;
    }
    // Enlazar grupos → gradeLevelId
    let linked = 0;
    for (const g of groups) {
      if (g.gradeLevelId) continue;
      const raw = gradeByGroup.get(g.id) || "";
      const code = normalizeGradeCode(raw);
      const levelId = code ? levelByCode.get(code) ?? null : null;
      await db.group.update({
        where: { id: g.id },
        data: { gradeLevelId: levelId },
      });
      if (levelId) linked++;
    }
    console.log(
      `   Grados: ${DEFAULT_GRADES.length + extra} en catálogo, ${linked} grupos enlazados`
    );

    // ---------- 3. Plan de estudios inicial ----------
    const existingPlan = inst.curriculumPlans[0];
    const plan =
      existingPlan ??
      (await db.curriculumPlan.create({
        data: {
          institutionId: inst.id,
          name: "Plan de estudios general",
          description:
            "Plan general de la institución. Estructura preservada entre años académicos.",
          active: true,
        },
      }));
    const planItemCount = existingPlan?._count.items ?? 0;
    if (!existingPlan) {
      console.log(`   Plan inicial creado: ${plan.name}`);
    } else {
      console.log(`   Plan existente: ${plan.name} (${planItemCount} items)`);
    }

    if (planItemCount > 0) continue; // ya tiene contenido

    // Pre-poblar desde SubjectAssignment: asignatura × grado del grupo
    const assignments = await db.subjectAssignment.findMany({
      where: { institutionId: inst.id },
      include: { group: true },
    });
    // Agregar: tomar la intensidad mayor observada por (subject, gradeLevel)
    const agg = new Map<
      string,
      { subjectId: string; gradeLevelId: string; hours: number }
    >();
    for (const a of assignments) {
      const levelId = a.group.gradeLevelId;
      if (!levelId) continue;
      const key = `${a.subjectId}:${levelId}`;
      const prev = agg.get(key);
      if (!prev || a.weeklyHours > prev.hours) {
        agg.set(key, {
          subjectId: a.subjectId,
          gradeLevelId: levelId,
          hours: a.weeklyHours,
        });
      }
    }
    let order = 0;
    for (const item of agg.values()) {
      order++;
      await db.curriculumPlanItem.upsert({
        where: {
          planId_subjectId_gradeLevelId: {
            planId: plan.id,
            subjectId: item.subjectId,
            gradeLevelId: item.gradeLevelId,
          },
        },
        create: {
          planId: plan.id,
          subjectId: item.subjectId,
          gradeLevelId: item.gradeLevelId,
          weeklyHours: item.hours,
          sortOrder: order,
        },
        update: {},
      });
    }
    console.log(`   Items precargados desde asignación académica: ${order}`);
  }

  console.log(
    "\n✔ Migración completada. Si aún existen las columnas legacy (Subject.area, Group.grade), elimínelas con: bunx prisma db push --accept-data-loss"
  );
}

main()
  .catch((e) => {
    console.error("✖ Error en migración:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
