import { db } from "@/lib/db";

// === Reglas transversales [R1] y [R2] — helpers centralizados de servidor ===
// Cualquier módulo que escriba notas/actividades o liste estudiantes de un grupo
// DEBE usar estos helpers. No duplicar la lógica.

// Roles con permiso elevado: pueden editar la matriz de asignación académica y
// pueden modificar notas/actividades de cualquier par (grupo, asignatura) — [R1].
// (Decisión de negocio 2026-09-22: rector + coordinador + administrativo.)
export const ELEVATED_ROLES = ["rector", "coordinador", "administrativo"] as const;

// Único estado de matrícula que cuenta como estudiante activo para planillas y
// listados por grupo — [R2]. "renovado" = matrícula del año activa.
export const ACTIVE_ENROLLMENT_STATUSES = ["matriculado", "renovado"] as const;

export function hasElevatedRole(roleCodes: string[]): boolean {
  return roleCodes.some((r) => (ELEVATED_ROLES as readonly string[]).includes(r));
}

/** Códigos de rol de un usuario (UserRole; fallback al espejo User.role). */
export async function getUserRoleCodes(userId: string): Promise<string[]> {
  const rows = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true } } },
  });
  if (rows.length > 0) return rows.map((r) => r.role.code);
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user ? [user.role] : [];
}

/** Año académico activo de la institución (AcademicYear.active; fallback Institution.academicYear). */
export async function getActiveYear(institutionId: string): Promise<number> {
  const ay = await db.academicYear.findFirst({
    where: { institutionId, active: true },
    select: { year: true },
  });
  if (ay) return ay.year;
  const inst = await db.institution.findUnique({
    where: { id: institutionId },
    select: { academicYear: true },
  });
  const parsed = inst ? parseInt(inst.academicYear, 10) : NaN;
  return Number.isNaN(parsed) ? new Date().getFullYear() : parsed;
}

/** Docente asignado a un par (grupo, asignatura) en un año — [M1]. null si no hay. */
export async function getAssignedTeacher(
  groupId: string,
  subjectId: string,
  year: number
): Promise<string | null> {
  const sa = await db.subjectAssignment.findUnique({
    where: { groupId_subjectId_year: { groupId, subjectId, year } },
    select: { teacherId: true },
  });
  return sa?.teacherId ?? null;
}

/**
 * [R1] ¿Puede este usuario modificar notas/actividades del par (grupo, asignatura) en el año?
 * true si tiene rol elevado o es el docente asignado. Validar SIEMPRE en servidor
 * antes de escribir en Grade/Activity.
 */
export async function canUserEditGrades(
  userId: string,
  groupId: string,
  subjectId: string,
  year: number
): Promise<boolean> {
  const roles = await getUserRoleCodes(userId);
  if (hasElevatedRole(roles)) return true;
  const assigned = await getAssignedTeacher(groupId, subjectId, year);
  return assigned !== null && assigned === userId;
}

/**
 * [R2] INVARIANTE: esta es la ÚNICA fuente de verdad para listar estudiantes activos
 * de un grupo. Lee la matrícula del año (StudentEnrollment de Gestión de Estudiantes)
 * filtrando por año académico y estados de matrícula activa. NO usar Student.groupId,
 * NO derivar la lista de registros Grade, NO usar mocks.
 */
export async function getActiveStudentsOfGroup(groupId: string, academicYearId: string) {
  return db.studentEnrollment.findMany({
    where: {
      groupId,
      academicYearId,
      status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
    },
    include: { student: true },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
}
