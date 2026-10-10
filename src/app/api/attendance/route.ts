import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireModule, forbidden } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const groupId = searchParams.get("groupId");
  const date = searchParams.get("date");
  const mode = searchParams.get("mode"); // "summary" = agregado por estudiante

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    // Resumen agregado por estudiante (contexto del asistente IA en Notas
    // parciales): ausencias/tardes/total sin traer el detalle completo.
    if (mode === "summary") {
      if (!groupId) {
        return NextResponse.json({ ok: false, error: "groupId requerido en modo summary" }, { status: 400 });
      }
      const rows = await db.attendance.groupBy({
        by: ["studentId", "status"],
        where: { group: { institutionId }, groupId },
        _count: { _all: true },
      });
      const byStudent = new Map<string, { studentId: string; ausentes: number; tardes: number; total: number }>();
      for (const r of rows) {
        const cur = byStudent.get(r.studentId) ?? { studentId: r.studentId, ausentes: 0, tardes: 0, total: 0 };
        cur.total += r._count._all;
        if (r.status === "ausente") cur.ausentes += r._count._all;
        if (r.status === "tarde") cur.tardes += r._count._all;
        byStudent.set(r.studentId, cur);
      }
      return NextResponse.json({ ok: true, summary: [...byStudent.values()] });
    }

    const where: any = { group: { institutionId } };
    if (groupId) where.groupId = groupId;
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.date = { gte: start, lte: end };
    }
    // [Asistencia por asignatura] subjectId=<id> filtra por clase; subjectId=none
    // trae solo la jornada general (sin asignatura); ausente = todas (compatibilidad).
    const subjectIdFilter = searchParams.get("subjectId");
    if (subjectIdFilter === "none") where.subjectId = null;
    else if (subjectIdFilter) where.subjectId = subjectIdFilter;

    const attendances = await db.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            code: true,
            group: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, attendances });
  } catch (e) {
    console.error("[attendance]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // [Seguridad] Control de asistencia: lo registra el personal (el acudiente solo consulta)
  if (!(await requireModule(req, "asistencia"))) return forbidden();
  try {
    const body = await req.json();
    const {
      institutionId,
      studentId,
      groupId,
      date,
      status,
      excuseReason,
      recordedById,
      subjectId, // [Asistencia por asignatura] opcional; null = jornada general
    } = body;

    if (!institutionId || !studentId || !groupId || !date || !status) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha inválida" }, { status: 400 });
    }

    const start = new Date(parsedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(parsedDate);
    end.setHours(23, 59, 59, 999);

    const notifiedAt = status !== "presente" ? new Date() : null;

    const existing = await db.attendance.findFirst({
      where: { studentId, groupId, subjectId: subjectId ?? null, date: { gte: start, lte: end } },
    });

    let attendance;
    if (existing) {
      attendance = await db.attendance.update({
        where: { id: existing.id },
        data: {
          status,
          excuseReason: excuseReason || null,
          recordedById: recordedById || null,
          notifiedAt,
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, code: true } },
        },
      });
    } else {
      attendance = await db.attendance.create({
        data: {
          studentId,
          groupId,
          subjectId: subjectId ?? null,
          date: parsedDate,
          status,
          excuseReason: excuseReason || null,
          recordedById: recordedById || null,
          notifiedAt,
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, code: true } },
        },
      });
    }

    await db.auditLog.create({
      data: {
        institutionId,
        userId: recordedById || null,
        action: existing ? "update" : "create",
        module: "attendance",
        entityType: "Attendance",
        entityId: attendance.id,
        details: JSON.stringify({ status, date: parsedDate, studentId }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, attendance });
  } catch (e) {
    console.error("[attendance.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
