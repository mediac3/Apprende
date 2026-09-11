import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const studentId = searchParams.get("studentId");
  const status = searchParams.get("status");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    // Orientations don't have direct institutionId. We filter through student / orientedBy.
    const where: any = {
      OR: [
        { student: { institutionId } },
        { orientedBy: { institutionId } },
      ],
    };
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    const orientations = await db.orientation.findMany({
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
        orientedBy: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, orientations });
  } catch (e) {
    console.error("[orientations]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      studentId,
      orientedById,
      date,
      modality,
      reason,
      notes,
      referral,
      followUp,
      status,
    } = body;

    if (!institutionId || !date || !modality || !reason) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha inválida" }, { status: 400 });
    }

    const orientation = await db.orientation.create({
      data: {
        studentId: studentId || null,
        orientedById: orientedById || null,
        date: parsedDate,
        modality,
        reason,
        notes: notes || null,
        referral: referral || null,
        followUp: followUp || null,
        status: status || "abierta",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, code: true } },
        orientedBy: { select: { id: true, fullName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: orientedById || null,
        action: "create",
        module: "orientations",
        entityType: "Orientation",
        entityId: orientation.id,
        details: JSON.stringify({ modality, reason, studentId }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, orientation });
  } catch (e) {
    console.error("[orientations.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
