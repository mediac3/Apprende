import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// CRUD de desempeños/logros por asignatura y periodo [F3]
// GET    ?institutionId=&year=&subjectId=&periodId=  (filtros opcionales)
// POST   { institutionId, subjectId, periodId, year, description, bajo?, basico?, alto?, superior? }
// PUT    { id, ...campos }
// DELETE ?id=

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }
  const year = searchParams.get("year");
  const subjectId = searchParams.get("subjectId");
  const periodId = searchParams.get("periodId");

  try {
    const where: any = { institutionId };
    if (year) where.year = parseInt(year, 10);
    if (subjectId) where.subjectId = subjectId;
    if (periodId) where.periodId = periodId;

    const indicators = await db.performanceIndicator.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        subject: { select: { id: true, name: true } },
        period: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ ok: true, indicators });
  } catch (e) {
    console.error("GET /api/performance-indicators", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, subjectId, periodId, year, description } = body ?? {};
    if (!institutionId || !subjectId || !periodId || !year || !description) {
      return NextResponse.json(
        { ok: false, error: "institutionId, subjectId, periodId, year y description son requeridos" },
        { status: 400 }
      );
    }
    const indicator = await db.performanceIndicator.create({
      data: {
        institutionId,
        subjectId,
        periodId,
        year: parseInt(String(year), 10),
        description,
        bajo: body.bajo || null,
        basico: body.basico || null,
        alto: body.alto || null,
        superior: body.superior || null,
      },
    });
    return NextResponse.json({ ok: true, indicator });
  } catch (e) {
    console.error("POST /api/performance-indicators", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body ?? {};
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }
    const data: any = {};
    for (const k of ["description", "bajo", "basico", "alto", "superior"]) {
      if (k in body) data[k] = body[k] || null;
    }
    const indicator = await db.performanceIndicator.update({ where: { id }, data });
    return NextResponse.json({ ok: true, indicator });
  } catch (e) {
    console.error("PUT /api/performance-indicators", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }
  try {
    await db.performanceIndicator.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/performance-indicators", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
