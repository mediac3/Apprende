import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const yearId = searchParams.get("yearId"); // filtro opcional por año académico

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const groups = await db.group.findMany({
      where: { institutionId, ...(yearId ? { academicYearId: yearId } : {}) },
      include: {
        headTeacher: {
          select: { id: true, fullName: true, avatarUrl: true, username: true, jobTitle: true },
        },
        gradeLevel: true,
        branch: true,
        journey: true,
        academicYear: { select: { id: true, year: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    });

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      otherName: g.otherName, // Otro nombre (código SIMAT, ej. "601" para "6°A")
      gradeLevelId: g.gradeLevelId,
      grade: g.gradeLevel?.code ?? null, // compat: código del grado (catálogo GradeLevel)
      gradeLevel: g.gradeLevel,
      section: g.section,
      headTeacherId: g.headTeacherId,
      headTeacher: g.headTeacher,
      studentCount: g._count.students,
      createdAt: g.createdAt,
      // Gestión de Grupos (campos normalizados)
      academicYearId: g.academicYearId,
      academicYear: g.academicYear,
      branchId: g.branchId,
      branch: g.branch,
      journeyId: g.journeyId,
      journey: g.journey,
    }));

    return NextResponse.json({ ok: true, groups: result });
  } catch (e) {
    console.error("[groups]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId, name, otherName, gradeLevelId, academicYearId, branchId, journeyId,
      headTeacherId, userId,
    } = body;

    if (!institutionId || !name?.trim() || !gradeLevelId || !academicYearId) {
      return NextResponse.json(
        { ok: false, error: "institutionId, nombre, grado y año son obligatorios" },
        { status: 400 }
      );
    }

    // Duplicado: mismo nombre + grado + año en la institución
    const dup = await db.group.findFirst({
      where: { institutionId, name: name.trim(), gradeLevelId, academicYearId },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un grupo con ese nombre para el grado y año seleccionados" },
        { status: 400 }
      );
    }
    // "Otro nombre" (código SIMAT) único por año en la institución
    if (otherName?.trim()) {
      const dupOther = await db.group.findFirst({
        where: { institutionId, otherName: otherName.trim(), academicYearId },
        select: { id: true },
      });
      if (dupOther) {
        return NextResponse.json(
          { ok: false, error: `Ya existe un grupo con el otro nombre "${otherName.trim()}" para el año seleccionado` },
          { status: 400 }
        );
      }
    }

    const g = await db.group.create({
      data: {
        institutionId,
        name: name.trim(),
        otherName: otherName?.trim() || null,
        gradeLevelId,
        academicYearId,
        branchId: branchId || null,
        journeyId: journeyId || null,
        headTeacherId: headTeacherId || null,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId, userId,
        action: "create", module: "groups", entityType: "Group", entityId: g.id,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, id: g.id });
  } catch (e) {
    console.error("[groups.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, institutionId, name, otherName, branchId, journeyId,
      headTeacherId, userId,
    } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const update: any = {};
    if (name !== undefined) update.name = String(name).trim();
    if (otherName !== undefined) update.otherName = String(otherName || "").trim() || null;
    if (branchId !== undefined) update.branchId = branchId || null;
    if (journeyId !== undefined) update.journeyId = journeyId || null;
    if (headTeacherId !== undefined) update.headTeacherId = headTeacherId || null;

    await db.group.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: {
        institutionId, userId,
        action: "update", module: "groups", entityType: "Group", entityId: id,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[groups.update]", e);
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
    await db.group.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        institutionId, userId,
        action: "delete", module: "groups", entityType: "Group", entityId: id,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[groups.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
