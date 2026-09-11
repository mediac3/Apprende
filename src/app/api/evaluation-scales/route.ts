import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const scales = await db.evaluationScale.findMany({
      where: { institutionId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { adjectives: true, evalModels: true } } },
    });
    return NextResponse.json({ ok: true, scales });
  } catch (e) {
    console.error("[eval-scales.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, minValue, maxValue, color, sortOrder, active, userId } = body;
    if (!institutionId || !name) return NextResponse.json({ ok: false, error: "institutionId y name requeridos" }, { status: 400 });

    const s = await db.evaluationScale.create({
      data: { institutionId, name, minValue: Number(minValue) || 0, maxValue: Number(maxValue) || 0, color, sortOrder: Number(sortOrder) || 0, active: active !== false },
    });

    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "evaluation_scales", entityType: "EvaluationScale", entityId: s.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });

    return NextResponse.json({ ok: true, id: s.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe una escala con ese nombre" }, { status: 400 });
    console.error("[eval-scales.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, name, minValue, maxValue, color, sortOrder, active, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (minValue !== undefined) update.minValue = Number(minValue);
    if (maxValue !== undefined) update.maxValue = Number(maxValue);
    if (color !== undefined) update.color = color;
    if (sortOrder !== undefined) update.sortOrder = Number(sortOrder);
    if (active !== undefined) update.active = !!active;

    await db.evaluationScale.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "evaluation_scales", entityType: "EvaluationScale", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[eval-scales.update]", e);
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
    await db.evaluationScale.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "evaluation_scales", entityType: "EvaluationScale", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[eval-scales.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
