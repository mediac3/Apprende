import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Grados (catálogo — normaliza el grado de los grupos y del plan de estudios)

// GET: lista de grados por institución
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const gradeLevels = await db.gradeLevel.findMany({
      where: { institutionId },
      include: { _count: { select: { groups: true, planItems: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, gradeLevels });
  } catch (e) {
    console.error("[grade-levels.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: crear grado
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, code, name, sortOrder, active, userId } = body;

    if (!institutionId || !code || !name) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, code, name" },
        { status: 400 }
      );
    }

    const dup = await db.gradeLevel.findFirst({
      where: { institutionId, code },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un grado con ese código" },
        { status: 400 }
      );
    }

    const last = await db.gradeLevel.findFirst({
      where: { institutionId },
      orderBy: { sortOrder: "desc" },
    });

    const gradeLevel = await db.gradeLevel.create({
      data: {
        institutionId,
        code: String(code).trim(),
        name,
        sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "grade_levels",
        entityType: "GradeLevel",
        entityId: gradeLevel.id,
        details: JSON.stringify({ code, name }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, gradeLevel });
  } catch (e) {
    console.error("[grade-levels.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar grado
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, code, name, sortOrder, active, userId } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.gradeLevel.findFirst({
      where: { id, institutionId },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Grado no encontrado" },
        { status: 404 }
      );
    }

    if (code && code !== existing.code) {
      const dup = await db.gradeLevel.findFirst({
        where: { institutionId, code, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json(
          { ok: false, error: "Ya existe un grado con ese código" },
          { status: 400 }
        );
      }
    }

    const update: any = {};
    if (code !== undefined) update.code = String(code).trim();
    if (name !== undefined) update.name = name;
    if (sortOrder !== undefined) update.sortOrder = Number(sortOrder);
    if (active !== undefined) update.active = Boolean(active);

    const updated = await db.gradeLevel.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "grade_levels",
        entityType: "GradeLevel",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, gradeLevel: updated });
  } catch (e) {
    console.error("[grade-levels.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar grado (los grupos quedan sin grado: SetNull; los items del plan se eliminan en cascada)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const institutionId = searchParams.get("institutionId");
    const userId = searchParams.get("userId");

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.gradeLevel.findFirst({
      where: { id, institutionId },
      include: { _count: { select: { groups: true, planItems: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Grado no encontrado" },
        { status: 404 }
      );
    }

    if (existing._count.groups > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se puede eliminar: hay ${existing._count.groups} grupo(s) asociados a este grado. Reasigne los grupos primero.`,
        },
        { status: 400 }
      );
    }

    await db.gradeLevel.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "grade_levels",
        entityType: "GradeLevel",
        entityId: id,
        details: JSON.stringify({ code: existing.code, name: existing.name }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[grade-levels.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
