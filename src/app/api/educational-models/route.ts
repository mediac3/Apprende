import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Conceptos base sembrados al crear un modelo educativo (PDF: Conceptos evaluativos)
const BASE_CONCEPTS = [
  { name: "Ser", percentage: 20 },
  { name: "Saber", percentage: 40 },
  { name: "Hacer", percentage: 40 },
  { name: "Autoevaluación", percentage: 0 },
];

// --- Tipos del payload unificado (Modelos educativos) ---
type PeriodInput = { id?: string; name: string; percentage: number; open: boolean; startDate?: string; endDate?: string };
type ConceptInput = { id?: string; name: string; percentage: number; open: boolean };

// Sanitización defensiva básica del HTML de "Detalles" (origen: Tiptap, usuarios con rol restringido).
// Sin dependencias externas: elimina tags peligrosos, handlers on* y URLs javascript:.
function sanitizeDetails(html: string): string {
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

// Validación compartida de periodos y conceptos del formulario unificado.
// Regla aprobada: los porcentajes deben sumar exactamente 100 (bloqueante).
function validateItems(
  items: { name: string; percentage: number }[],
  label: string
): string | null {
  if (!Array.isArray(items)) return `${label}: formato inválido`;
  for (const it of items) {
    if (!it || !String(it.name ?? "").trim()) return `${label}: cada elemento requiere nombre`;
    const p = Number(it.percentage);
    if (!Number.isFinite(p) || p < 0 || p > 100) return `${label}: porcentaje de "${it.name}" debe estar entre 0 y 100`;
  }
  const total = items.reduce((s, it) => s + Number(it.percentage || 0), 0);
  if (total !== 100) return `${label}: los porcentajes deben sumar exactamente 100 (total actual: ${total})`;
  return null;
}

function validatePeriods(periods: PeriodInput[]): string | null {
  const err = validateItems(periods, "Periodos");
  if (err) return err;
  for (const p of periods) {
    if (!p.startDate || !p.endDate || isNaN(Date.parse(p.startDate)) || isNaN(Date.parse(p.endDate))) {
      return `Periodos: "${p.name}" requiere fecha de inicio y fin válidas`;
    }
    if (Date.parse(p.endDate) <= Date.parse(p.startDate)) {
      return `Periodos: "${p.name}" la fecha fin debe ser posterior a la de inicio`;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const models = await db.educationalModel.findMany({
      where: { institutionId },
      orderBy: { createdAt: "asc" },
      include: {
        concepts: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, percentage: true, open: true, order: true } },
        periods: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, weight: true, active: true, closed: true, order: true, startDate: true, endDate: true } },
      },
    });
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    console.error("[edu-models.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, userId } = body;
    const name = String(body.name ?? "").trim();
    if (!institutionId || !name) {
      return NextResponse.json({ ok: false, error: "institutionId y name requeridos" }, { status: 400 });
    }

    // Modo unificado: el formulario envía periods+concepts completos.
    // Modo legacy (sin arreglos): mantiene el comportamiento anterior (semillas base).
    const hasUnified = Array.isArray(body.periods) || Array.isArray(body.concepts);

    if (hasUnified) {
      const periods: PeriodInput[] = body.periods ?? [];
      const concepts: ConceptInput[] = body.concepts ?? BASE_CONCEPTS;
      const periodCount = Number(body.periodCount ?? periods.length);

      if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 12) {
        return NextResponse.json({ ok: false, error: "Cantidad de periodos debe ser entero entre 1 y 12" }, { status: 400 });
      }
      if (periods.length !== periodCount) {
        return NextResponse.json({ ok: false, error: `Se esperaban ${periodCount} periodos, llegaron ${periods.length}` }, { status: 400 });
      }
      const errP = validatePeriods(periods);
      if (errP) return NextResponse.json({ ok: false, error: errP }, { status: 400 });
      const errC = validateItems(concepts, "Conceptos");
      if (errC) return NextResponse.json({ ok: false, error: errC }, { status: 400 });

      const details = body.details ? sanitizeDetails(String(body.details)) : null;

      const m = await db.$transaction(async (tx) => {
        const created = await tx.educationalModel.create({
          data: { institutionId, name, periodCount, details },
        });
        if (periods.length) {
          await tx.period.createMany({
            data: periods.map((p, i) => ({
              institutionId,
              educationalModelId: created.id,
              name: String(p.name).trim(),
              startDate: new Date(p.startDate as string),
              endDate: new Date(p.endDate as string),
              weight: Number(p.percentage),
              active: false,
              closed: !p.open,
              order: i + 1,
            })),
          });
        }
        if (concepts.length) {
          await tx.evaluativeConcept.createMany({
            data: concepts.map((c, i) => ({
              institutionId,
              educationalModelId: created.id,
              name: String(c.name).trim(),
              percentage: Math.round(Number(c.percentage)),
              open: Boolean(c.open),
              order: i + 1,
            })),
          });
        }
        return created;
      });

      await db.auditLog.create({
        data: { institutionId, userId, action: "create", module: "educational_models", entityType: "EducationalModel", entityId: m.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
      });
      return NextResponse.json({ ok: true, id: m.id });
    }

    // --- Legacy: crear modelo con semillas base (comportamiento previo intacto) ---
    const m = await db.educationalModel.create({
      data: { institutionId, name },
    });
    // Semillas: Ser/Saber/Hacer/Autoevaluación con porcentajes por defecto
    await db.evaluativeConcept.createMany({
      data: BASE_CONCEPTS.map((c) => ({ institutionId, educationalModelId: m.id, ...c })),
    });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "educational_models", entityType: "EducationalModel", entityId: m.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: m.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un modelo educativo con ese nombre" }, { status: 400 });
    console.error("[edu-models.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    // Modo unificado: reemplazo atómico de periods y concepts.
    if (Array.isArray(body.periods) && Array.isArray(body.concepts)) {
      const periods: PeriodInput[] = body.periods;
      const concepts: ConceptInput[] = body.concepts;
      const periodCount = Number(body.periodCount ?? periods.length);
      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      if (name !== undefined && !name) return NextResponse.json({ ok: false, error: "name no puede estar vacío" }, { status: 400 });

      if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 12) {
        return NextResponse.json({ ok: false, error: "Cantidad de periodos debe ser entero entre 1 y 12" }, { status: 400 });
      }
      if (periods.length !== periodCount) {
        return NextResponse.json({ ok: false, error: `Se esperaban ${periodCount} periodos, llegaron ${periods.length}` }, { status: 400 });
      }
      const errP = validatePeriods(periods);
      if (errP) return NextResponse.json({ ok: false, error: errP }, { status: 400 });
      const errC = validateItems(concepts, "Conceptos");
      if (errC) return NextResponse.json({ ok: false, error: errC }, { status: 400 });

      const existing = await db.educationalModel.findFirst({
        where: { id, institutionId },
        include: {
          periods: { select: { id: true } },
          concepts: {
            select: { id: true, name: true, _count: { select: { activities: true } } },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!existing) return NextResponse.json({ ok: false, error: "Modelo educativo no encontrado" }, { status: 404 });

      // [C1] Upsert por id: un concepto que el payload ya no incluye solo puede
      // eliminarse si no tiene actividades (Activity→EvaluativeConcept es Cascade
      // y arrastraría GradeRecord (notas)).
      const referencedConceptIds = new Set(
        concepts.map((c) => c.id).filter((x): x is string => Boolean(x))
      );
      const leftoverConcepts = existing.concepts.filter((ec) => !referencedConceptIds.has(ec.id));
      const leftoverWithActivities = leftoverConcepts.filter((c) => c._count.activities > 0);
      if (leftoverWithActivities.length) {
        const names = leftoverWithActivities.map((c) => `"${c.name}"`).join(", ");
        return NextResponse.json({ ok: false, error: `No se puede guardar: el concepto ${names} tiene actividades con notas asociadas. Elimina primero sus actividades.` }, { status: 400 });
      }

      const details = body.details !== undefined ? (body.details ? sanitizeDetails(String(body.details)) : null) : undefined;

      await db.$transaction(async (tx) => {
        await tx.educationalModel.update({
          where: { id },
          data: {
            ...(name !== undefined ? { name } : {}),
            periodCount,
            ...(details !== undefined ? { details } : {}),
          },
        });

        // --- Periods: update de existentes, create de nuevas ---
        const currentPeriodIds = new Set(existing.periods.map((p) => p.id));
        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          const data = {
            name: String(p.name).trim(),
            startDate: new Date(p.startDate as string),
            endDate: new Date(p.endDate as string),
            weight: Number(p.percentage),
            closed: !p.open,
            order: i + 1,
          };
          if (p.id && currentPeriodIds.has(p.id)) {
            await tx.period.update({ where: { id: p.id }, data });
          } else {
            await tx.period.create({ data: { ...data, institutionId, educationalModelId: id, active: false } });
          }
        }
        // Periods que sobran: los que tienen Grades se huérfanan (SetNull protege calificaciones); el resto se borra.
        const keptPeriodIds = new Set(periods.filter((p) => p.id).map((p) => p.id as string));
        const removedIds = existing.periods.map((p) => p.id).filter((pid) => !keptPeriodIds.has(pid));
        if (removedIds.length) {
          const withGrades = await tx.grade.findMany({ where: { periodId: { in: removedIds } }, select: { periodId: true } });
          const graded = new Set(withGrades.map((g) => g.periodId));
          const deletable = removedIds.filter((pid) => !graded.has(pid));
          if (deletable.length) await tx.period.deleteMany({ where: { id: { in: deletable } } });
          const orphan = removedIds.filter((pid) => graded.has(pid));
          if (orphan.length) await tx.period.updateMany({ where: { id: { in: orphan } }, data: { educationalModelId: null, order: null } });
        }

        // --- Concepts: upsert por id [C1] — conserva los ids para no perder
        // Activities/GradeRecords (FKs en cascada). Ítems sin id = nuevos.
        // Sobrantes: sin actividades (validado antes de la tx), se eliminan.
        const leftoverConceptIds = leftoverConcepts.map((c) => c.id);
        if (leftoverConceptIds.length) {
          await tx.evaluativeConcept.deleteMany({ where: { id: { in: leftoverConceptIds } } });
        }
        const ownConceptIds = new Set(existing.concepts.map((ec) => ec.id));
        // Renombrar los existentes conservados a un nombre temporal para esquivar
        // la restricción única (educationalModelId, name) en renombres/intercambios.
        for (const ec of existing.concepts) {
          if (!referencedConceptIds.has(ec.id)) continue;
          await tx.evaluativeConcept.update({ where: { id: ec.id }, data: { name: `__tmp_${ec.id}` } });
        }
        for (let i = 0; i < concepts.length; i++) {
          const c = concepts[i];
          const data = {
            name: String(c.name).trim(),
            percentage: Math.round(Number(c.percentage)),
            open: Boolean(c.open),
            order: i + 1,
          };
          if (c.id && ownConceptIds.has(c.id)) {
            await tx.evaluativeConcept.update({ where: { id: c.id }, data });
          } else {
            await tx.evaluativeConcept.create({ data: { ...data, institutionId, educationalModelId: id } });
          }
        }
      });

      await db.auditLog.create({
        data: { institutionId, userId, action: "update", module: "educational_models", entityType: "EducationalModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
      });
      return NextResponse.json({ ok: true });
    }

    // --- Legacy: solo name/active (comportamiento previo intacto) ---
    const { name, active } = body;
    const update: any = {};
    if (name !== undefined) update.name = String(name).trim();
    if (active !== undefined) update.active = Boolean(active);

    await db.educationalModel.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "educational_models", entityType: "EducationalModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un modelo educativo con ese nombre" }, { status: 400 });
    console.error("[edu-models.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");
  if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

  try {
    // El cascade elimina los conceptos asociados; los periods quedan huérfanos
    // (SetNull) para no perder sus calificaciones asociadas.
    await db.educationalModel.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "educational_models", entityType: "EducationalModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[edu-models.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
