import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const groupId = searchParams.get("groupId");
  const date = searchParams.get("date");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { group: { institutionId } };
    if (groupId) where.groupId = groupId;
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.date = { gte: start, lte: end };
    }

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
      where: { studentId, groupId, date: { gte: start, lte: end } },
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
