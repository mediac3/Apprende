import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const academicYearId = searchParams.get("academicYearId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const where: any = { institutionId };
    if (academicYearId) where.academicYearId = academicYearId;
    const models = await db.evaluationModel.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        scale: { select: { id: true, name: true, color: true } },
        academicYear: { select: { id: true, year: true } },
      },
    });
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    console.error("[eval-models.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, academicYearId, scaleId, minNote, maxNote, userId } = body;
    if (!institutionId || !scaleId || minNote === undefined || maxNote === undefined) {
      return NextResponse.json({ ok: false, error: "institutionId, scaleId, minNote, maxNote requeridos" }, { status: 400 });
    }

    const m = await db.evaluationModel.create({
      data: { institutionId, academicYearId: academicYearId || null, scaleId, minNote: Number(minNote), maxNote: Number(maxNote) },
    });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "evaluation_models", entityType: "EvaluationModel", entityId: m.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: m.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe un modelo evaluativo para esa combinación año+escala" }, { status: 400 });
    console.error("[eval-models.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, academicYearId, scaleId, minNote, maxNote, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (academicYearId !== undefined) update.academicYearId = academicYearId || null;
    if (scaleId !== undefined) update.scaleId = scaleId;
    if (minNote !== undefined) update.minNote = Number(minNote);
    if (maxNote !== undefined) update.maxNote = Number(maxNote);

    await db.evaluationModel.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "evaluation_models", entityType: "EvaluationModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[eval-models.update]", e);
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
    await db.evaluationModel.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "evaluation_models", entityType: "EvaluationModel", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[eval-models.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
