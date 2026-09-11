import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Resumen para el dashboard
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const role = searchParams.get("role");
  const institutionId = searchParams.get("institutionId");

  if (!userId || !institutionId) {
    return NextResponse.json(
      { ok: false, error: "Faltan parámetros" },
      { status: 400 }
    );
  }

  try {
    const [
      studentsCount,
      groupsCount,
      teachersCount,
      periods,
      recentAudits,
      recentMeetings,
      openEnrollments,
      pendingObservations,
      studentsAtRisk,
      activeSpaces,
      recentPosts,
    ] = await Promise.all([
      db.student.count({ where: { institutionId, status: "activo" } }),
      db.group.count({ where: { institutionId } }),
      db.user.count({ where: { institutionId, role: "docente", active: true } }),
      db.period.findMany({ where: { institutionId }, orderBy: { startDate: "asc" } }),
      db.auditLog.findMany({
        where: { institutionId },
        include: { user: { select: { fullName: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.meeting.findMany({
        where: { institutionId },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.enrollment.count({
        where: { institutionId, status: { in: ["solicitada", "en_revision"] } },
      }),
      db.observation.count({
        where: {
          student: { institutionId },
          status: { in: ["abierta", "en_seguimiento"] },
        },
      }),
      db.grade.findMany({
        where: {
          period: { institutionId, closed: false },
          performance: { in: ["bajo", "basico"] },
        },
        include: { student: true, subject: true },
        distinct: ["studentId"],
        take: 30,
      }),
      db.space.count({ where: { institutionId } }),
      db.post.findMany({
        where: { institutionId },
        include: {
          author: { select: { fullName: true, avatarUrl: true, role: true } },
          space: { select: { name: true, slug: true } },
          _count: { select: { comments: true, reactions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Estadísticas por desempeño (periodo activo)
    const gradesInActivePeriod = await db.grade.findMany({
      where: { period: { institutionId, active: true } },
      select: { performance: true, value: true },
    });
    const performanceStats = {
      superior: gradesInActivePeriod.filter(g => g.performance === "superior").length,
      alto: gradesInActivePeriod.filter(g => g.performance === "alto").length,
      basico: gradesInActivePeriod.filter(g => g.performance === "basico").length,
      bajo: gradesInActivePeriod.filter(g => g.performance === "bajo").length,
    };

    // Asistencia hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const attendancesToday = await db.attendance.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      select: { status: true },
    });
    const attendanceStats = {
      presente: attendancesToday.filter(a => a.status === "presente").length,
      ausente: attendancesToday.filter(a => a.status === "ausente").length,
      tarde: attendancesToday.filter(a => a.status === "tarde").length,
      excusa: attendancesToday.filter(a => a.status === "excusa").length,
    };

    return NextResponse.json({
      ok: true,
      stats: {
        students: studentsCount,
        groups: groupsCount,
        teachers: teachersCount,
        activeSpaces,
        openEnrollments,
        pendingObservations,
        studentsAtRisk: studentsAtRisk.length,
      },
      periods,
      performanceStats,
      attendanceStats,
      recentAudits,
      recentMeetings,
      studentsAtRisk: studentsAtRisk.slice(0, 12),
      recentPosts,
    });
  } catch (e) {
    console.error("[dashboard]", e);
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
