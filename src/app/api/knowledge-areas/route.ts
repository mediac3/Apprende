import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Áreas del conocimiento (catálogo — normaliza el área de las asignaturas)

// GET: lista de áreas por institución
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
    const areas = await db.knowledgeArea.findMany({
      where: { institutionId },
      include: { _count: { select: { subjects: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, areas });
  } catch (e) {
    console.error("[knowledge-areas.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: crear área
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, abbreviation, sortOrder, active, userId } = body;

    if (!institutionId || !name) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, name" },
        { status: 400 }
      );
    }

    const dup = await db.knowledgeArea.findFirst({
      where: { institutionId, name },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un área con ese nombre" },
        { status: 400 }
      );
    }

    const last = await db.knowledgeArea.findFirst({
      where: { institutionId },
      orderBy: { sortOrder: "desc" },
    });

    const area = await db.knowledgeArea.create({
      data: {
        institutionId,
        name,
        abbreviation: abbreviation || null,
        sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "knowledge_areas",
        entityType: "KnowledgeArea",
        entityId: area.id,
        details: JSON.stringify({ name }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, area });
  } catch (e) {
    console.error("[knowledge-areas.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar área
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, name, abbreviation, sortOrder, active, userId } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.knowledgeArea.findFirst({
      where: { id, institutionId },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Área no encontrada" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const dup = await db.knowledgeArea.findFirst({
        where: { institutionId, name, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json(
          { ok: false, error: "Ya existe un área con ese nombre" },
          { status: 400 }
        );
      }
    }

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (abbreviation !== undefined) update.abbreviation = abbreviation || null;
    if (sortOrder !== undefined) update.sortOrder = Number(sortOrder);
    if (active !== undefined) update.active = Boolean(active);

    const updated = await db.knowledgeArea.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "knowledge_areas",
        entityType: "KnowledgeArea",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, area: updated });
  } catch (e) {
    console.error("[knowledge-areas.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar área (las asignaturas quedan sin área: SetNull)
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

    const existing = await db.knowledgeArea.findFirst({
      where: { id, institutionId },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Área no encontrada" },
        { status: 404 }
      );
    }

    await db.knowledgeArea.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "knowledge_areas",
        entityType: "KnowledgeArea",
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[knowledge-areas.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
