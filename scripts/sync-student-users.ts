/**
 * [F2] Sincronización documento → User para login de estudiante — one-time, idempotente.
 *
 * Decisión de negocio aprobada (2026-10-04): los usuarios de estudiantes ya
 * existían (seed demo username=código, 0 logins) → se MIGRAN a login=documento:
 *   - Estudiante CON documento y User con lastLoginAt=null, role estudiante:
 *       username=documento, passwordHash=sha256(documento), mustChangePassword=true
 *   - Estudiante CON documento sin User → se crea (User + UserRole estudiante)
 *   - User con logins registrados → NO se toca (solo reporte)
 *   - Estudiante sin documento → NO se toca
 * Reglas duras:
 *  - username único global: documento ya usado por otro user → conflicto (K), se omite.
 *  - Idempotente: username===documento && hash ok → yaSincronizado, sin cambios.
 *  - Transacción por lotes de 100.
 *
 * Uso:  bun scripts/sync-student-users.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BATCH = 100;

const hashPassword = (p: string): string =>
  crypto.createHash("sha256").update(p).digest("hex"); // mismo algoritmo que api/auth/login

async function main() {
  const students = await db.student.findMany({
    where: { documentNumber: { not: null, notIn: [""] } },
    select: {
      id: true, code: true, institutionId: true,
      firstName: true, lastName: true, lastName2: true, documentNumber: true,
      user: { select: { id: true, username: true, role: true, lastLoginAt: true, passwordHash: true } },
    },
  });

  const sinDocumento = (await db.student.count({
    where: { OR: [{ documentNumber: null }, { documentNumber: "" }] },
  }));

  // Usernames ocupados por usuarios que NO son el propio estudiante (colisión global)
  const usernames = new Set(
    (await db.user.findMany({ select: { username: true } })).map((u) => u.username)
  );

  const migrar: { id: string; doc: string }[] = [];
  const crear: typeof students = [];
  let yaSincronizados = 0;
  let conLogins = 0;
  const conflicts: string[] = [];

  for (const s of students) {
    const doc = s.documentNumber as string;
    if (!s.user) { crear.push(s); continue; }
    const u = s.user;
    if (u.lastLoginAt) { conLogins++; continue; }
    if (u.username === doc && u.passwordHash === hashPassword(doc)) { yaSincronizados++; continue; }
    if (usernames.has(doc) && u.username !== doc) {
      conflicts.push(`${s.code} → ${doc} (username de otro user)`);
      continue;
    }
    // reservar username para validaciones del propio lote
    usernames.delete(u.username);
    usernames.add(doc);
    migrar.push({ id: u.id, doc });
  }

  // Para creaciones: username=documento tampoco debe existir
  const crearValidos: typeof crear = [];
  for (const s of crear) {
    const doc = s.documentNumber as string;
    if (usernames.has(doc)) { conflicts.push(`${s.code} → ${doc} (username de otro user)`); continue; }
    usernames.add(doc);
    crearValidos.push(s);
  }

  let migrados = 0;
  let creados = 0;
  if (APPLY) {
    for (let i = 0; i < migrar.length; i += BATCH) {
      const batch = migrar.slice(i, i + BATCH);
      await db.$transaction(
        batch.map((m) =>
          db.user.update({
            where: { id: m.id },
            data: {
              username: m.doc,
              passwordHash: hashPassword(m.doc),
              mustChangePassword: true,
            },
          })
        )
      );
      migrados += batch.length;
    }
    for (const s of crearValidos) {
      const doc = s.documentNumber as string;
      const nombre = [s.firstName, s.firstName2, s.lastName, s.lastName2].filter(Boolean).join(" ").trim();
      const role = await db.role.findFirst({
        where: { institutionId: s.institutionId, code: "estudiante" },
      });
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            institutionId: s.institutionId,
            username: doc,
            passwordHash: hashPassword(doc),
            fullName: nombre || s.code,
            role: "estudiante",
            mustChangePassword: true,
          },
        });
        if (role) {
          await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
        }
        await tx.student.update({ where: { id: s.id }, data: { userId: user.id } });
      });
      creados++;
    }
  }

  console.log(JSON.stringify({
    dryRun: !APPLY,
    estudiantesConDocumento: students.length,
    migrados: APPLY ? migrados : 0,
    aMigrarSiApply: migrar.length,
    aCrearSiApply: crearValidos.length,
    creados: APPLY ? creados : 0,
    yaSincronizados,
    conLogins_noTocados: conLogins,
    conflictos_K: conflicts.length,
    estudiantesSinDocumento: sinDocumento,
    muestras: { migrar: migrar.slice(0, 10), conflictos: conflicts.slice(0, 10) },
  }, null, 2));
}

main()
  .catch((e) => { console.error("[sync-student-users]", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
