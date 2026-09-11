import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const groupId = searchParams.get("groupId");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const activePeriod = await db.period.findFirst({
      where: { institutionId, active: true },
    });

    if (!activePeriod) {
      return NextResponse.json({
        ok: true,
        students: [],
        message: "No hay periodo activo",
      });
    }

    const where: any = {
      institutionId,
      grades: {
        some: {
          periodId: activePeriod.id,
          performance: { in: ["bajo", "basico"] },
        },
      },
    };
    if (groupId) where.groupId = groupId;

    const students = await db.student.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, grade: true, section: true } },
        grades: {
          where: { periodId: activePeriod.id },
          include: {
            subject: { select: { id: true, name: true, area: true } },
          },
        },
      },
      orderBy: { firstName: "asc" },
    });

    const result = students.map((s) => {
      const failing = s.grades.filter(
        (g) => g.performance === "bajo" || g.performance === "basico"
      );
      const failingSubjects = failing.map((g) => ({
        subjectId: g.subjectId,
        subjectName: g.subject.name,
        subjectArea: g.subject.area,
        value: g.value,
        performance: g.performance,
      }));
      const totalValue = s.grades.reduce((sum, g) => sum + (g.value || 0), 0);
      const average =
        s.grades.length > 0 ? totalValue / s.grades.length : 0;

      return {
        id: s.id,
        code: s.code,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.firstName} ${s.lastName}`,
        status: s.status,
        group: s.group,
        period: { id: activePeriod.id, name: activePeriod.name },
        failingSubjects,
        average: Math.round(average * 100) / 100,
        gradesCount: s.grades.length,
      };
    });

    return NextResponse.json({ ok: true, students: result, period: activePeriod });
  } catch (e) {
    console.error("[dashboard.students-at-risk]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
