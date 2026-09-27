import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/planner/report — informe de planeación docente [F2]
// Bloques por (grupo, asignatura) que el docente tiene asignados en el año.
// El periodo define rango de fechas y semanas. Desempeños: se integrarán
// cuando exista el modelo de descriptores [F3-FASE 8].
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const teacherId = searchParams.get("teacherId");
  const periodId = searchParams.get("periodId");
  const yearParam = searchParams.get("year");

  if (!institutionId || !teacherId || !periodId || !yearParam) {
    return NextResponse.json(
      { ok: false, error: "institutionId, teacherId, periodId y year son requeridos" },
      { status: 400 }
    );
  }
  const year = parseInt(yearParam, 10);
  if (Number.isNaN(year)) {
    return NextResponse.json({ ok: false, error: "year inválido" }, { status: 400 });
  }

  try {
    const [period, teacher, institution, teacherAssignments] = await Promise.all([
      db.period.findUnique({ where: { id: periodId } }),
      db.user.findUnique({ where: { id: teacherId }, select: { id: true, fullName: true } }),
      db.institution.findUnique({
        where: { id: institutionId },
        select: { name: true, logoUrl: true, resolution: true, city: true },
      }),
      db.subjectAssignment.findMany({
        where: { teacherId, year },
        orderBy: { groupId: "asc" },
        include: {
          subject: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      }),
    ]);

    if (!period || !teacher || !institution) {
      return NextResponse.json(
        { ok: false, error: "Periodo, docente o institución no encontrados" },
        { status: 404 }
      );
    }

    // Horas semanales totales por grupo (todas las asignaturas, cualquier docente)
    const groupIds = Array.from(new Set(teacherAssignments.map((a) => a.groupId)));
    const groupTotals = groupIds.length
      ? await db.subjectAssignment.groupBy({
          by: ["groupId"],
          where: { groupId: { in: groupIds }, year },
          _sum: { weeklyHours: true },
        })
      : [];
    const totalByGroup = new Map(groupTotals.map((g) => [g.groupId, g._sum.weeklyHours ?? 0]));

    // Semanas del periodo (mínimo 1)
    const days = Math.max(0, period.endDate.getTime() - period.startDate.getTime()) / 86400000;
    const weeks = Math.max(1, Math.ceil(days / 7));

    const blocks = teacherAssignments.map((a) => {
      const groupWeeklyHours = totalByGroup.get(a.groupId) ?? 0;
      return {
        groupId: a.groupId,
        groupName: a.group.name,
        subjectId: a.subject.id,
        subjectName: a.subject.name,
        weeklyHours: a.weeklyHours,
        groupWeeklyHours,
        plannedHours: a.weeklyHours * weeks,
      };
    });

    return NextResponse.json({
      ok: true,
      report: {
        year,
        institution,
        teacher: { fullName: teacher.fullName },
        period: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
        weeks,
        blocks,
        resumen: {
          secciones: blocks.length,
          horasPlaneadas: blocks.reduce((acc, b) => acc + b.plannedHours, 0),
          horasTotales:
            blocks.reduce((acc, b) => acc + b.groupWeeklyHours, 0) * weeks,
        },
      },
    });
  } catch (e) {
    console.error("GET /api/planner/report", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
