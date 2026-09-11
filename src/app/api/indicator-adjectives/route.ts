import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const scaleId = searchParams.get("scaleId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const where: any = { institutionId };
    if (scaleId) where.scaleId = scaleId;
    const adjectives = await db.indicatorAdjective.findMany({
      where,
      orderBy: { name: "asc" },
      include: { scale: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ ok: true, adjectives });
  } catch (e) {
    console.error("[adjectives.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, scaleId, name, userId } = body;
    if (!institutionId || !scaleId || !name) return NextResponse.json({ ok: false, error: "institutionId, scaleId, name requeridos" }, { status: 400 });

    const a = await db.indicatorAdjective.create({ data: { institutionId, scaleId, name } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "indicator_adjectives", entityType: "IndicatorAdjective", entityId: a.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: a.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe ese adjetivo para la escala" }, { status: 400 });
    console.error("[adjectives.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, scaleId, name, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (scaleId !== undefined) update.scaleId = scaleId;
    if (name !== undefined) update.name = name;

    await db.indicatorAdjective.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "indicator_adjectives", entityType: "IndicatorAdjective", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[adjectives.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");
  if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

  try {
    await db.indicatorAdjective.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "indicator_adjectives", entityType: "IndicatorAdjective", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[adjectives.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
