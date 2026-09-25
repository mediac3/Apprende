import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const years = await db.academicYear.findMany({
      where: { institutionId },
      orderBy: { year: "desc" },
      include: { _count: { select: { evalModels: true, groups: true } } },
    });
    return NextResponse.json({ ok: true, years });
  } catch (e) {
    console.error("[academic-years.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, year, decree, startDate, endDate, active, userId } = body;
    if (!institutionId || !year) return NextResponse.json({ ok: false, error: "institutionId y year requeridos" }, { status: 400 });

    // Si active=true, desactivar otros años primero
    if (active) {
      await db.academicYear.updateMany({ where: { institutionId, active: true }, data: { active: false } });
    }

    const y = await db.academicYear.create({
      data: { institutionId, year: Number(year), decree, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, active: !!active },
    });

    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "academic_years", entityType: "AcademicYear", entityId: y.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });

    return NextResponse.json({ ok: true, yearId: y.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe ese año para la institución" }, { status: 400 });
    console.error("[academic-years.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, year, decree, startDate, endDate, active, closed, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    if (active) {
      await db.academicYear.updateMany({ where: { institutionId, active: true, NOT: { id } }, data: { active: false } });
    }

    const update: any = {};
    if (year !== undefined) update.year = Number(year);
    if (decree !== undefined) update.decree = decree;
    if (startDate !== undefined) update.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) update.endDate = endDate ? new Date(endDate) : null;
    if (active !== undefined) update.active = !!active;
    if (closed !== undefined) update.closed = !!closed;

    await db.academicYear.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "academic_years", entityType: "AcademicYear", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[academic-years.update]", e);
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
    await db.academicYear.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "academic_years", entityType: "AcademicYear", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[academic-years.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
