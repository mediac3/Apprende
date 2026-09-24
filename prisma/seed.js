/**
 * [F1] Seed idempotente — Plan de estudios grados 6° a 11°.
 * Replica los CurriculumPlanItem del Grado 6° en 7°–11° dentro de cada plan
 * que tenga estructura en 6° (mismas asignaturas, horas/semana y orden).
 * El % de cada asignatura vive en Subject.percentage y se comparte solo.
 * Idempotente: la unique [planId, subjectId, gradeLevelId] hace que una
 * segunda ejecución no duplique nada (skip de existentes).
 * Uso: npx prisma db seed
 */
const { PrismaClient } = require("@prisma/client"); // eslint-disable-line @typescript-eslint/no-require-imports -- seed CJS, se ejecuta con `node`
const prisma = new PrismaClient();

const SOURCE_CODE = "6";
const TARGET_CODES = ["7", "8", "9", "10", "11"];

async function main() {
  const institutions = await prisma.institution.findMany({ select: { id: true, name: true } });
  let created = 0;
  let skipped = 0;

  for (const inst of institutions) {
    const levels = await prisma.gradeLevel.findMany({ where: { institutionId: inst.id } });
    const byCode = new Map(levels.map((g) => [g.code, g]));
    const source = byCode.get(SOURCE_CODE);
    if (!source) {
      console.log(`(${inst.name}) sin GradeLevel "${SOURCE_CODE}" — nada que replicar.`);
      continue;
    }

    // Asegurar gradeLevels destino (crear solo si falta)
    const targets = [];
    for (let i = 0; i < TARGET_CODES.length; i++) {
      const code = TARGET_CODES[i];
      let gl = byCode.get(code);
      if (!gl) {
        gl = await prisma.gradeLevel.create({
          data: {
            institutionId: inst.id,
            code,
            name: `Grado ${code}°`,
            sortOrder: source.sortOrder + 1 + i,
            active: true,
          },
        });
        console.log(`  + GradeLevel creado: ${gl.name} (${inst.name})`);
      }
      targets.push(gl);
    }

    // Planes de la institución con estructura cargada en 6°
    const plans = await prisma.curriculumPlan.findMany({
      where: { institutionId: inst.id, items: { some: { gradeLevelId: source.id } } },
      select: { id: true, name: true },
    });

    for (const plan of plans) {
      const sourceItems = await prisma.curriculumPlanItem.findMany({
        where: { planId: plan.id, gradeLevelId: source.id },
        orderBy: { sortOrder: "asc" },
      });
      if (sourceItems.length === 0) continue;
      console.log(
        `Plan "${plan.name}" (${inst.name}): ${sourceItems.length} asignaturas en ${SOURCE_CODE}° → replicar a ${targets.length} grados`
      );

      for (const gl of targets) {
        const before = await prisma.curriculumPlanItem.count({
          where: { planId: plan.id, gradeLevelId: gl.id },
        });
        for (const it of sourceItems) {
          const existing = await prisma.curriculumPlanItem.findUnique({
            where: {
              planId_subjectId_gradeLevelId: {
                planId: plan.id,
                subjectId: it.subjectId,
                gradeLevelId: gl.id,
              },
            },
          });
          if (existing) {
            skipped++;
            continue;
          }
          await prisma.curriculumPlanItem.create({
            data: {
              planId: plan.id,
              subjectId: it.subjectId,
              gradeLevelId: gl.id,
              weeklyHours: it.weeklyHours,
              sortOrder: it.sortOrder,
            },
          });
          created++;
        }
        const after = await prisma.curriculumPlanItem.count({
          where: { planId: plan.id, gradeLevelId: gl.id },
        });
        console.log(`  Grado ${gl.code}°: ${before} → ${after} items`);
      }
    }
  }
  console.log(`Seed [F1] completado: ${created} creados, ${skipped} ya existían (skip).`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
