import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

function invalidPercentage(p: any): boolean {
  const n = Number(p);
  return !Number.isInteger(n) || n < 0 || n > 100;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const educationalModelId = searchParams.get("educationalModelId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const where: any = { institutionId };
    if (educationalModelId) where.educationalModelId = educationalModelId;
    const concepts = await db.evaluativeConcept.findMany({
      where,
      orderBy: [{ educationalModel: { createdAt: "asc" } }, { createdAt: "asc" }],
      include: {
        educationalModel: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ ok: true, concepts });
  } catch (e) {
    console.error("[eval-concepts.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, educationalModelId, name, percentage, open, userId } = body;
    if (!institutionId || !educationalModelId || !name || !String(name).trim()) {
      return NextResponse.json({ ok: false, error: "institutionId, educationalModelId y name requeridos" }, { status: 400 });
    }
    if (percentage === undefined || invalidPercentage(percentage)) {
      return NextResponse.json({ ok: false, error: "El porcentaje debe ser un entero entre 0 y 100" }, { status: 400 });
    }

    const model = await db.educationalModel.findFirst({ where: { id: educationalModelId, institutionId } });
    if (!model) return NextResponse.json({ ok: false, error: "Modelo educativo no válido" }, { status: 400 });

    const c = await db.evaluativeConcept.create({
      data: {
        institutionId,
        educationalModelId,
        name: String(name).trim(),
        percentage: Number(percentage),
        open: open === undefined ? true : Boolean(open),
      },
    });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "evaluative_concepts", entityType: "EvaluativeConcept", entityId: c.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: c.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un concepto con ese nombre en ese modelo educativo" }, { status: 400 });
    console.error("[eval-concepts.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, educationalModelId, name, percentage, open, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    if (percentage !== undefined && invalidPercentage(percentage)) {
      return NextResponse.json({ ok: false, error: "El porcentaje debe ser un entero entre 0 y 100" }, { status: 400 });
    }

    const update: any = {};
    if (educationalModelId !== undefined) {
      const model = await db.educationalModel.findFirst({ where: { id: educationalModelId, institutionId } });
      if (!model) return NextResponse.json({ ok: false, error: "Modelo educativo no válido" }, { status: 400 });
      update.educationalModelId = educationalModelId;
    }
    if (name !== undefined) update.name = String(name).trim();
    if (percentage !== undefined) update.percentage = Number(percentage);
    if (open !== undefined) update.open = Boolean(open);

    await db.evaluativeConcept.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "evaluative_concepts", entityType: "EvaluativeConcept", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un concepto con ese nombre en ese modelo educativo" }, { status: 400 });
    console.error("[eval-concepts.update]", e);
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
    await db.evaluativeConcept.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "evaluative_concepts", entityType: "EvaluativeConcept", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[eval-concepts.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
