import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// GET: lista de asignaturas por institución (orden asc por área, nombre)
// Devuelve `area` como texto (nombre del área) para compatibilidad con las vistas
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
    const subjects = await db.subject.findMany({
      where: { institutionId },
      include: { area: true },
    });

    const result = subjects
      .map((s) => ({
        ...s,
        area: s.area?.name ?? null, // compat: nombre del área
        areaId: s.areaId,
      }))
      .sort(
        (a, b) =>
          (a.area ?? "").localeCompare(b.area ?? "", "es") ||
          a.name.localeCompare(b.name, "es")
      );

    return NextResponse.json({ ok: true, subjects: result });
  } catch (e) {
    console.error("[subjects.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Resuelve el área: acepta areaId directo o nombre (crea el área si no existe)
async function resolveAreaId(
  institutionId: string,
  areaId: string | null | undefined,
  areaName: string | null | undefined
): Promise<string | null> {
  if (areaId) {
    const found = await db.knowledgeArea.findFirst({
      where: { id: areaId, institutionId },
    });
    if (found) return found.id;
  }
  const name = (areaName || "").trim();
  if (!name) return null;
  const existing = await db.knowledgeArea.findFirst({
    where: { institutionId, name },
  });
  if (existing) return existing.id;
  const last = await db.knowledgeArea.findFirst({
    where: { institutionId },
    orderBy: { sortOrder: "desc" },
  });
  const created = await db.knowledgeArea.create({
    data: {
      institutionId,
      name,
      abbreviation: name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 6),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  return created.id;
}

// POST: crear asignatura
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      name,
      code,
      areaId,
      area, // compat: nombre del área
      abbreviation,
      averages,
      active,
      userId,
    } = body;

    if (!institutionId || !name) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, name" },
        { status: 400 }
      );
    }

    const resolvedAreaId = await resolveAreaId(institutionId, areaId, area);

    const subject = await db.subject.create({
      data: {
        institutionId,
        name,
        code: code || null,
        areaId: resolvedAreaId,
        abbreviation: abbreviation || null,
        averages: averages !== undefined ? Boolean(averages) : true,
        active: active !== undefined ? Boolean(active) : true,
      },
      include: { area: true },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "subjects",
        entityType: "Subject",
        entityId: subject.id,
        details: JSON.stringify({ name, areaId: resolvedAreaId }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({
      ok: true,
      subject: { ...subject, area: subject.area?.name ?? null },
    });
  } catch (e: any) {
    console.error("[subjects.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar asignatura
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      institutionId,
      name,
      code,
      areaId,
      area, // compat: nombre del área
      abbreviation,
      averages,
      active,
      userId,
    } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.subject.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Asignatura no encontrada" },
        { status: 404 }
      );
    }

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (code !== undefined) update.code = code;
    if (abbreviation !== undefined) update.abbreviation = abbreviation;
    if (averages !== undefined) update.averages = Boolean(averages);
    if (active !== undefined) update.active = Boolean(active);
    // área: solo se toca si llega areaId o area en el body
    if (areaId !== undefined || area !== undefined) {
      update.areaId = await resolveAreaId(institutionId, areaId, area);
    }

    const updated = await db.subject.update({
      where: { id },
      data: update,
      include: { area: true },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "subjects",
        entityType: "Subject",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({
      ok: true,
      subject: { ...updated, area: updated.area?.name ?? null },
    });
  } catch (e: any) {
    console.error("[subjects.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar asignatura
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

    const existing = await db.subject.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Asignatura no encontrada" },
        { status: 404 }
      );
    }

    await db.subject.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "subjects",
        entityType: "Subject",
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[subjects.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
