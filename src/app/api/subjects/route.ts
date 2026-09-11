import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// GET: lista de asignaturas por institución (orden asc por area, name)
// Incluye campos nuevos: abbreviation, averages, active
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
      orderBy: [{ area: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ ok: true, subjects });
  } catch (e) {
    console.error("[subjects.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: crear asignatura
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      name,
      code,
      area,
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

    const subject = await db.subject.create({
      data: {
        institutionId,
        name,
        code: code || null,
        area: area || null,
        abbreviation: abbreviation || null,
        averages: averages !== undefined ? Boolean(averages) : true,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "subjects",
        entityType: "Subject",
        entityId: subject.id,
        details: JSON.stringify({ name, area: area || null }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, subject });
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
      area,
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
    if (area !== undefined) update.area = area;
    if (abbreviation !== undefined) update.abbreviation = abbreviation;
    if (averages !== undefined) update.averages = Boolean(averages);
    if (active !== undefined) update.active = Boolean(active);

    const updated = await db.subject.update({ where: { id }, data: update });

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

    return NextResponse.json({ ok: true, subject: updated });
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
