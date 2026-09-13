/**
 * Migración de normalización — Gestión de usuarios (one-time)
 *
 * 1. Crea el catálogo Role por institución: los 8 roles canónicos de la
 *    aplicación + los roles del módulo de usuarios de referencia (PDF)
 * 2. Backfill: crea la fila UserRole correspondiente al rol actual de cada
 *    usuario (User.role texto → relación N:M normalizada)
 * 3. Sincroniza User.role con el rol principal (menor sortOrder de UserRole)
 *    para mantener compatibilidad con la sesión y el filtrado del menú
 *
 * Idempotente: puede ejecutarse varias veces sin duplicar datos.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Catálogo de roles: code = clave canónica (sistema de permisos del menú),
// name = etiqueta visible en el módulo de usuarios (PDF de referencia).
const DEFAULT_ROLES: { code: string; name: string; sortOrder: number }[] = [
  // Roles canónicos de la aplicación
  { code: "rector", name: "Rector", sortOrder: 1 },
  { code: "coordinador", name: "Coordinador", sortOrder: 2 },
  { code: "director_grupo", name: "Director de grupo", sortOrder: 3 },
  { code: "docente", name: "Docente", sortOrder: 4 },
  { code: "orientador", name: "PSI - Docente Orientador", sortOrder: 5 },
  { code: "acudiente", name: "Contacto familiar", sortOrder: 6 },
  { code: "estudiante", name: "Estudiante", sortOrder: 7 },
  { code: "administrativo", name: "Administrador", sortOrder: 8 },
  // Roles adicionales del módulo de usuarios (PDF de referencia)
  { code: "supervisor", name: "Supervisor", sortOrder: 9 },
  { code: "auxiliar_principal", name: "Auxiliar principal", sortOrder: 10 },
  { code: "asistente_matricula", name: "Asistente de matrícula", sortOrder: 11 },
  { code: "tesoreria", name: "Tesorería", sortOrder: 12 },
  { code: "pta_docente_tutor", name: "PTA - Docente tutor", sortOrder: 13 },
  { code: "escuela_nueva", name: "Escuela nueva", sortOrder: 14 },
  { code: "tercero", name: "Tercero", sortOrder: 15 },
];

async function main() {
  const institutions = await db.institution.findMany();
  if (institutions.length === 0) {
    console.log("ℹ No hay instituciones. Nada que migrar.");
    return;
  }

  for (const inst of institutions) {
    console.log(`\n→ Institución: ${inst.name} (${inst.id})`);

    // ---------- 1. Catálogo de roles ----------
    for (const r of DEFAULT_ROLES) {
      await db.role.upsert({
        where: { institutionId_code: { institutionId: inst.id, code: r.code } },
        create: { institutionId: inst.id, ...r },
        update: { name: r.name, sortOrder: r.sortOrder },
      });
    }
    console.log(`   Roles del catálogo: ${DEFAULT_ROLES.length} creados/verificados`);

    // ---------- 2. Backfill User.role → UserRole ----------
    const users = await db.user.findMany({
      where: { institutionId: inst.id },
      include: { userRoles: { include: { role: true } } },
    });

    let linked = 0;
    let unknownCodes = new Set<string>();
    for (const u of users) {
      const existingCodes = new Set(u.userRoles.map((ur) => ur.role.code));
      if (!existingCodes.has(u.role)) {
        // Asegurar que el código exista en el catálogo (rol legacy desconocido)
        let role = await db.role.findFirst({
          where: { institutionId: inst.id, code: u.role },
        });
        if (!role) {
          unknownCodes.add(u.role);
          role = await db.role.create({
            data: {
              institutionId: inst.id,
              code: u.role,
              name: u.role.charAt(0).toUpperCase() + u.role.slice(1),
              sortOrder: 90 + unknownCodes.size,
            },
          });
          console.log(`   ⚠ Rol legacy desconocido creado en catálogo: "${u.role}"`);
        }
        await db.userRole.create({ data: { userId: u.id, roleId: role.id } });
        existingCodes.add(u.role);
        linked++;
      }
    }
    console.log(`   Backfill: ${linked} usuario(s) enlazados a su rol actual`);

    // ---------- 3. Sincronizar rol principal ----------
    // User.role = el rol asignado con menor sortOrder (compatibilidad sesión/menú)
    const roles = await db.role.findMany({ where: { institutionId: inst.id } });
    const roleByCode = new Map(roles.map((r) => [r.code, r]));
    let synced = 0;
    for (const u of users) {
      const urs = await db.userRole.findMany({
        where: { userId: u.id },
        include: { role: true },
      });
      if (urs.length === 0) continue;
      urs.sort((a, b) => a.role.sortOrder - b.role.sortOrder);
      const primary = urs[0].role.code;
      if (primary !== u.role) {
        await db.user.update({ where: { id: u.id }, data: { role: primary } });
        synced++;
      }
    }
    if (synced > 0) console.log(`   Rol principal sincronizado en ${synced} usuario(s)`);
  }

  const totals = await Promise.all([
    db.role.count(),
    db.userRole.count(),
  ]);
  console.log(`\n✔ Migración completada. Total: ${totals[0]} roles, ${totals[1]} asignaciones usuario↔rol.`);
}

main()
  .catch((e) => {
    console.error("✖ Error en migración:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
