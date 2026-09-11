import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const studentId = searchParams.get("studentId");
  const type = searchParams.get("type");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { student: { institutionId } };
    if (studentId) where.studentId = studentId;
    if (type) where.type = type;

    const observations = await db.observation.findMany({
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
        recordedBy: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, observations });
  } catch (e) {
    console.error("[observations]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      studentId,
      recordedById,
      date,
      category,
      type,
      description,
      severity,
      status,
    } = body;

    if (!institutionId || !studentId || !date || !category || !description) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha inválida" }, { status: 400 });
    }

    const observation = await db.observation.create({
      data: {
        studentId,
        recordedById: recordedById || null,
        date: parsedDate,
        category,
        type: type || null,
        description,
        severity: severity || null,
        status: status || "abierta",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, code: true } },
        recordedBy: { select: { id: true, fullName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: recordedById || null,
        action: "create",
        module: "observations",
        entityType: "Observation",
        entityId: observation.id,
        details: JSON.stringify({ category, type, severity }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, observation });
  } catch (e) {
    console.error("[observations.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
