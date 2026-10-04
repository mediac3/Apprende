/**
 * [F1] Semilla de documentos aleatorios para estudiantes SIN documento.
 *
 * Reglas del negocio (2026-10-04):
 *  - 10 caracteres, inician con "1" → "1" + 9 dígitos aleatorios.
 *  - Únicos: contra documentNumber existentes, contra TODOS los username de
 *    User (el acceso se normaliza al documento) y entre sí.
 *  - Solo rellena vacíos; idempotente (2ª corrida no hace nada).
 *  - Transacción por lotes de 100.
 *
 * Tras sembrar, ejecutar `bun scripts/sync-student-users.ts --apply` para
 * normalizar el acceso (username=contraseña=documento) de los sin logins.
 *
 * Uso:  bun scripts/seed-random-documents.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BATCH = 100;

/** Documento aleatorio: "1" + 9 dígitos (10 caracteres). */
function randomDoc(): string {
  let rest = "";
  for (let i = 0; i < 9; i++) rest += Math.floor(Math.random() * 10);
  return "1" + rest;
}

async function main() {
  const sinDoc = await db.student.findMany({
    where: { OR: [{ documentNumber: null }, { documentNumber: "" }] },
    select: { id: true, code: true, firstName: true, lastName: true },
  });

  // Espacio ocupado: documentos de estudiantes + usernames de usuarios
  const taken = new Set<string>();
  (await db.student.findMany({
    where: { documentNumber: { not: null, notIn: [""] } },
    select: { documentNumber: true },
  })).forEach((s) => taken.add(s.documentNumber as string));
  (await db.user.findMany({ select: { username: true } })).forEach((u) => taken.add(u.username));

  const asignaciones: { id: string; code: string; doc: string }[] = [];
  for (const s of sinDoc) {
    let doc = randomDoc();
    while (taken.has(doc)) doc = randomDoc(); // anti-colisión
    taken.add(doc);
    asignaciones.push({ id: s.id, code: s.code, doc });
  }

  let aplicados = 0;
  if (APPLY && asignaciones.length > 0) {
    for (let i = 0; i < asignaciones.length; i += BATCH) {
      const batch = asignaciones.slice(i, i + BATCH);
      await db.$transaction(
        batch.map((a) =>
          db.student.update({ where: { id: a.id }, data: { documentNumber: a.doc } })
        )
      );
      aplicados += batch.length;
    }
  }

  // Verificación de unicidad post-asignación (doble control)
  const unicos = new Set(asignaciones.map((a) => a.doc));

  console.log(JSON.stringify({
    dryRun: !APPLY,
    estudiantesSinDocumento: sinDoc.length,
    asignados: APPLY ? aplicados : 0,
    aAsignarSiApply: asignaciones.length,
    todosUnicosY10DigitosIniciandoEn1: asignaciones.every((a) => a.doc.length === 10 && a.doc.startsWith("1")) && unicos.size === asignaciones.length,
    muestras: asignaciones.slice(0, 12).map((a) => `${a.code} → ${a.doc}`),
  }, null, 2));
}

main()
  .catch((e) => { console.error("[seed-random-documents]", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
