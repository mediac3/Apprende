import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Gestión de Estudiantes (PDF pág 11) — novedades de matrícula (retiro, traslado, repitente...)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const enrollmentId = searchParams.get("enrollmentId");

  if (!enrollmentId) {
    return NextResponse.json({ ok: false, error: "enrollmentId requerido" }, { status: 400 });
  }

  try {
    const events = await db.enrollmentEvent.findMany({
      where: { enrollmentId },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    console.error("[enrollment-events]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { enrollmentId, institutionId, userId, type, reason, date } = body;

    if (!enrollmentId || !institutionId || !type) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const event = await db.enrollmentEvent.create({
      data: {
        enrollmentId,
        type,
        reason: reason || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "enrollment-events",
        entityType: "EnrollmentEvent",
        entityId: event.id,
        details: JSON.stringify({ enrollmentId, type }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, event });
  } catch (e) {
    console.error("[enrollment-events.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId, type, reason, date } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const data: any = {};
    if ("type" in body) data.type = type;
    if ("reason" in body) data.reason = reason || null;
    if ("date" in body) data.date = date ? new Date(date) : new Date();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const event = await db.enrollmentEvent.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "enrollment-events",
        entityType: "EnrollmentEvent",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(data) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, event });
  } catch (e) {
    console.error("[enrollment-events.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");

  if (!id || !institutionId) {
    return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
  }

  try {
    await db.enrollmentEvent.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "enrollment-events",
        entityType: "EnrollmentEvent",
        entityId: id,
        details: null,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[enrollment-events.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
