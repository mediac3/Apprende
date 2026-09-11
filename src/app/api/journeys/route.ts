import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const journeys = await db.journey.findMany({ where: { institutionId }, orderBy: { name: "asc" } });
    const safe = journeys.map((j) => ({
      ...j,
      educationalModels: j.educationalModelsJson ? JSON.parse(j.educationalModelsJson) : [],
    }));
    return NextResponse.json({ ok: true, journeys: safe });
  } catch (e) {
    console.error("[journeys.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, educationalModels, active, userId } = body;
    if (!institutionId || !name) return NextResponse.json({ ok: false, error: "institutionId y name requeridos" }, { status: 400 });

    const j = await db.journey.create({
      data: {
        institutionId,
        name,
        educationalModelsJson: Array.isArray(educationalModels) ? JSON.stringify(educationalModels) : null,
        active: active !== false,
      },
    });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "journeys", entityType: "Journey", entityId: j.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: j.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe una jornada con ese nombre" }, { status: 400 });
    console.error("[journeys.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, name, educationalModels, active, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (educationalModels !== undefined) update.educationalModelsJson = Array.isArray(educationalModels) ? JSON.stringify(educationalModels) : null;
    if (active !== undefined) update.active = !!active;

    await db.journey.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "journeys", entityType: "Journey", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[journeys.update]", e);
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
    await db.journey.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "journeys", entityType: "Journey", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[journeys.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
