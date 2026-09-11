import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const signed = searchParams.get("signed");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { institutionId };
    if (signed !== null && signed !== undefined && signed !== "") {
      where.signed = signed === "true";
    }

    const meetings = await db.meeting.findMany({
      where,
      include: {
        signers: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, role: true, jobTitle: true } },
          },
          orderBy: { signedAt: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ ok: true, meetings });
  } catch (e) {
    console.error("[meetings]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, title, type, date, location, agenda, minutes, userId } = body;

    if (!institutionId || !title || !type || !date) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha inválida" }, { status: 400 });
    }

    const meeting = await db.meeting.create({
      data: {
        institutionId,
        title,
        type,
        date: parsedDate,
        location: location || null,
        agenda: agenda || null,
        minutes: minutes || null,
      },
      include: {
        signers: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "meetings",
        entityType: "Meeting",
        entityId: meeting.id,
        details: JSON.stringify({ title, type }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, meeting });
  } catch (e) {
    console.error("[meetings.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
