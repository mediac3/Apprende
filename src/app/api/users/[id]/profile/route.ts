import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// [F4.1] Perfil universal de usuario (no solo estudiantes) — payload agregado
// para los tabs dinámicos. La UI solo muestra tabs con datos (regla dura).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, fullName: true, email: true, phone: true,
        jobTitle: true, role: true, active: true, avatarUrl: true,
        lastLoginAt: true, mustChangePassword: true, createdAt: true,
        institutionId: true,
        userRoles: { include: { role: { select: { id: true, code: true, name: true, sortOrder: true } } } },
      },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const roleIds = user.userRoles.map((ur) => ur.role.id);
    const isTeacher = user.userRoles.some((ur) => ["docente", "director_grupo", "coordinador"].includes(ur.role.code));

    const [assignments, grades, observations, groups, dependents, permissions, audits, impersonations] =
      await Promise.all([
        db.subjectAssignment.findMany({
          where: { teacherId: id },
          select: {
            id: true, year: true, weeklyHours: true,
            group: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
          orderBy: { year: "desc" },
        }),
        isTeacher
          ? db.grade.findMany({
              where: { teacherId: id },
              select: {
                id: true, value: true, performance: true, updatedAt: true,
                student: { select: { firstName: true, lastName: true } },
                subject: { select: { name: true } },
                period: { select: { name: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 50,
            })
          : [],
        isTeacher
          ? db.observation.findMany({
              where: { recordedById: id },
              select: {
                id: true, date: true, title: true, category: true,
                severity: true, status: true,
                student: { select: { firstName: true, lastName: true } },
              },
              orderBy: { date: "desc" },
              take: 50,
            })
          : [],
        db.group.findMany({
          where: { headTeacherId: id },
          select: {
            id: true, name: true,
            gradeLevel: { select: { name: true } },
            academicYear: { select: { year: true } },
          },
        }),
        // Acudiente: contactos familiares con el mismo email que el usuario
        user.email
          ? db.studentContact.findMany({
              where: { email: user.email },
              select: {
                id: true, relationship: true, phone: true,
                student: {
                  select: {
                    id: true, code: true, firstName: true, lastName: true,
                    group: { select: { name: true } },
                  },
                },
              },
            })
          : [],
        roleIds.length
          ? db.rolePermission.findMany({
              where: { roleId: { in: roleIds } },
              select: {
                moduleKey: true, canView: true, canCreate: true, canEdit: true, canDelete: true,
                role: { select: { name: true } },
              },
              orderBy: { moduleKey: "asc" },
            })
          : [],
        db.auditLog.findMany({
          where: { userId: id },
          select: { id: true, action: true, module: true, createdAt: true, entityId: true },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        db.impersonationLog.findMany({
          where: { adminId: id },
          select: {
            id: true, startedAt: true, endedAt: true,
            target: { select: { fullName: true, role: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 20,
        }),
      ]);

    return NextResponse.json({
      ok: true,
      user,
      roles: user.userRoles
        .slice()
        .sort((a, b) => a.role.sortOrder - b.role.sortOrder)
        .map((ur) => ({ id: ur.role.id, code: ur.role.code, name: ur.role.name })),
      assignments,
      grades,
      observations,
      groups,
      dependents,
      permissions,
      audits,
      impersonations,
    });
  } catch (e) {
    console.error("GET /api/users/[id]/profile", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
