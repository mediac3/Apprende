/**
 * [F1] Seed de documentNumber en estudiantes sin documento — one-time, idempotente.
 *
 * Fuente: Enrollment (admisiones) — campo documentsJson (JSON con documentos
 * cargados; se extraen claves tipo documento/cédula/identificación cuyo valor
 * sea un número limpio). El emparejamiento Enrollment→Student es por nombre
 * normalizado (Enrollment no tiene studentId en el schema).
 *
 * Reglas duras:
 *  - No sobreescribe documentos existentes (solo rellena vacíos/null).
 *  - documentNumber es @unique: colisión → conflicto (K), se omite y reporta.
 *  - Idempotente: la 2ª ejecución no hace nada.
 *
 * Uso:
 *  - Dry-run (default):  bun scripts/seed-student-documents.ts
 *  - Aplicar cambios:    bun scripts/seed-student-documents.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BATCH = 100;

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrae un número de documento de un JSON de documentos cargados. */
function extractDocument(documentsJson: string | null): string | null {
  if (!documentsJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(documentsJson);
  } catch {
    return null;
  }
  const docKey = /doc|cedul|ident|documento/i;
  const cleanVal = /^\d{5,15}$/; // solo dígitos, 5-15 (CC/TI/RC; PPT sin letras largas)
  const out: string[] = [];

  const walk = (node: unknown, depth: number, key: string | null) => {
    if (out.length > 0 || depth > 3) return;
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      const v = node.replace(/[\s.]/g, "");
      if (key && docKey.test(key) && cleanVal.test(v)) out.push(v);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, key);
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, depth + 1, k);
      }
    }
  };
  walk(parsed, 0, null);
  return out[0] ?? null;
}

async function main() {
  const sinDoc = await db.student.findMany({
    where: { OR: [{ documentNumber: null }, { documentNumber: "" }] },
    select: {
      id: true, code: true, firstName: true, lastName: true,
      firstName2: true, lastName2: true,
    },
  });

  // Mapa nombre normalizado → documento, desde admisiones con documentsJson
  const enrollments = await db.enrollment.findMany({
    where: { documentsJson: { not: null } },
    select: { applicantName: true, documentsJson: true },
  });
  const docByName = new Map<string, string>();
  for (const e of enrollments) {
    const doc = extractDocument(e.documentsJson);
    if (!doc) continue;
    const name = normalizeName(e.applicantName);
    if (name && !docByName.has(name)) docByName.set(name, doc);
  }

  // Documentos ya ocupados por otros estudiantes (regla de unicidad)
  const taken = new Set(
    (await db.student.findMany({
      where: { documentNumber: { not: null, notIn: [""] } },
      select: { documentNumber: true },
    })).map((s) => s.documentNumber as string)
  );

  const updates: { id: string; code: string; doc: string }[] = [];
  const orphans: string[] = []; // M — sin fuente
  const conflicts: string[] = []; // K — duplicados/colisión
  const claimed = new Set<string>();

  for (const s of sinDoc) {
    const variants = [
      normalizeName(`${s.firstName} ${s.lastName}`),
      normalizeName(`${s.lastName} ${s.firstName}`),
    ];
    if (s.firstName2) variants.push(normalizeName(`${s.firstName2} ${s.firstName} ${s.lastName}`));
    if (s.lastName2) variants.push(normalizeName(`${s.firstName} ${s.lastName} ${s.lastName2}`));
    const doc = variants.map((v) => docByName.get(v)).find(Boolean);

    if (!doc) {
      orphans.push(`${s.code}`);
      continue;
    }
    if (taken.has(doc) || claimed.has(doc)) {
      conflicts.push(`${s.code} → ${doc} (ya asignado)`);
      continue;
    }
    claimed.add(doc);
    updates.push({ id: s.id, code: s.code, doc });
  }

  // Aplicar en transacciones por lotes de 100
  let applied = 0;
  if (APPLY && updates.length > 0) {
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await db.$transaction(
        batch.map((u) =>
          db.student.update({
            where: { id: u.id },
            data: { documentNumber: u.doc },
          })
        )
      );
      applied += batch.length;
    }
  }

  console.log(JSON.stringify({
    dryRun: !APPLY,
    estudiantesSinDocumento: sinDoc.length,
    actualizados: APPLY ? applied : 0,
    aActualizarSiApply: updates.length,
    huerfanos_M: orphans.length,
    conflictos_K: conflicts.length,
    muestras: { updates: updates.slice(0, 10), huerfanos: orphans.slice(0, 10), conflictos: conflicts.slice(0, 10) },
  }, null, 2));
}

main()
  .catch((e) => { console.error("[seed-student-documents]", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
