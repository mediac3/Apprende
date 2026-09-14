import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Conceptos base sembrados al crear un modelo educativo (PDF: Conceptos evaluativos)
const BASE_CONCEPTS = [
  { name: "Ser", percentage: 20 },
  { name: "Saber", percentage: 40 },
  { name: "Hacer", percentage: 40 },
  { name: "Autoevaluación", percentage: 0 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const models = await db.educationalModel.findMany({
      where: { institutionId },
      orderBy: { createdAt: "asc" },
      include: {
        concepts: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, percentage: true, open: true } },
      },
    });
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    console.error("[edu-models.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, userId } = body;
    if (!institutionId || !name || !String(name).trim()) {
      return NextResponse.json({ ok: false, error: "institutionId y name requeridos" }, { status: 400 });
    }

    const m = await db.educationalModel.create({
      data: { institutionId, name: String(name).trim() },
    });
    // Semillas: Ser/Saber/Hacer/Autoevaluación con porcentajes por defecto
    await db.evaluativeConcept.createMany({
      data: BASE_CONCEPTS.map((c) => ({ institutionId, educationalModelId: m.id, ...c })),
    });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "educational_models", entityType: "EducationalModel", entityId: m.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: m.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un modelo educativo con ese nombre" }, { status: 400 });
    console.error("[edu-models.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, name, active, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (name !== undefined) update.name = String(name).trim();
    if (active !== undefined) update.active = Boolean(active);

    await db.educationalModel.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "educational_models", entityType: "EducationalModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un modelo educativo con ese nombre" }, { status: 400 });
    console.error("[edu-models.update]", e);
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
    // El cascade elimina los conceptos asociados
    await db.educationalModel.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "educational_models", entityType: "EducationalModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[edu-models.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
