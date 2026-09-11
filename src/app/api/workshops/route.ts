import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const subjectId = searchParams.get("subjectId");
  const level = searchParams.get("level");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { institutionId };
    if (subjectId) where.subjectId = subjectId;
    if (level) where.level = level;

    const workshops = await db.workshop.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, area: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, workshops });
  } catch (e) {
    console.error("[workshops]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      subjectId,
      title,
      description,
      level,
      duration,
      tags,
      userId,
    } = body;

    if (!institutionId || !title) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const workshop = await db.workshop.create({
      data: {
        institutionId,
        subjectId: subjectId || null,
        title,
        description: description || null,
        level: level || null,
        duration: duration ? Number(duration) : null,
        tags: tags || null,
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "workshops",
        entityType: "Workshop",
        entityId: workshop.id,
        details: JSON.stringify({ title, level }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, workshop });
  } catch (e) {
    console.error("[workshops.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
