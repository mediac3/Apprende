import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
      include: {
        _count: { select: { subjects: true } },
        subjects: { orderBy: { name: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, areas });
  } catch (e) {
    console.error("[knowledge-areas.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// --- Asignaturas hijas (gestión desde el modal de área) ---

interface SubjectInput {
  id?: string;
  name: string;
  abbreviation: string | null;
  averages: boolean;
  active: boolean;
  percentage: number;
}

// Normaliza el payload: undefined/null => no tocar asignaturas; array => sincronizar.
function parseSubjects(raw: unknown): SubjectInput[] | null | "invalid" {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return "invalid";
  return raw.map((r: any) => ({
    id: typeof r?.id === "string" && r.id ? r.id : undefined,
    name: String(r?.name ?? "").trim(),
    abbreviation: r?.abbreviation ? String(r.abbreviation).trim() : null,
    averages: r?.averages !== undefined ? Boolean(r.averages) : true,
    active: r?.active !== undefined ? Boolean(r.active) : true,
    percentage: Math.max(0, Math.min(100, Math.round(Number(r?.percentage) || 0))),
  }));
}

function validateSubjects(rows: SubjectInput[]): string | null {
  if (rows.some((r) => !r.name)) return "Cada asignatura requiere nombre";
  const names = rows.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length) return "Hay asignaturas duplicadas en el área";
  const total = rows.reduce((s, r) => s + r.percentage, 0);
  if (rows.length > 0 && total !== 100) {
    return `Los porcentajes deben sumar 100% (actual: ${total}%)`;
  }
  return null;
}

// Sincroniza las asignaturas hijas preservando los id existentes
// (un deleteMany + createMany ciego rompería por cascade los
// CurriculumPlanItem/SubjectAssignment/Grade asociados).
async function syncSubjects(
  tx: Prisma.TransactionClient,
  institutionId: string,
  areaId: string,
  rows: SubjectInput[]
) {
  const existing = await tx.subject.findMany({ where: { areaId }, select: { id: true } });
  const keepIds = new Set(rows.filter((r) => r.id).map((r) => r.id as string));
  const deleteIds = existing.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
  if (deleteIds.length > 0) {
    await tx.subject.deleteMany({ where: { id: { in: deleteIds }, institutionId } });
  }
  for (const r of rows) {
    const data = {
      name: r.name,
      abbreviation: r.abbreviation,
      averages: r.averages,
      active: r.active,
      percentage: r.percentage,
    };
    if (r.id) {
      await tx.subject.updateMany({ where: { id: r.id, areaId, institutionId }, data });
    } else {
      await tx.subject.create({ data: { ...data, institutionId, areaId } });
    }
  }
}

// POST: crear área
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, abbreviation, sortOrder, active, userId, subjects } = body;

    if (!institutionId || !name) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, name" },
        { status: 400 }
      );
    }

    const rows = parseSubjects(subjects);
    if (rows === "invalid") {
      return NextResponse.json(
        { ok: false, error: "Formato de asignaturas inválido" },
        { status: 400 }
      );
    }
    if (rows) {
      const err = validateSubjects(rows);
      if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
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

    const area = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeArea.create({
        data: {
          institutionId,
          name,
          abbreviation: abbreviation || null,
          sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1,
          active: active !== undefined ? Boolean(active) : true,
        },
      });
      if (rows) await syncSubjects(tx, institutionId, created.id, rows);
      return created;
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
    const { id, institutionId, name, abbreviation, sortOrder, active, userId, subjects } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const rows = parseSubjects(subjects);
    if (rows === "invalid") {
      return NextResponse.json(
        { ok: false, error: "Formato de asignaturas inválido" },
        { status: 400 }
      );
    }
    if (rows) {
      const err = validateSubjects(rows);
      if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
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

    const updated = await db.$transaction(async (tx) => {
      const upd = await tx.knowledgeArea.update({ where: { id }, data: update });
      if (rows) await syncSubjects(tx, institutionId, id, rows);
      return upd;
    });

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
