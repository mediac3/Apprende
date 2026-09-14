import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Gestión de Estudiantes (PDF pág 7) — checklist de requisitos pendientes de matrícula

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const studentId = searchParams.get("studentId");

  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }

  try {
    const where: any = { institutionId };
    if (studentId) where.studentId = studentId;

    const requirements = await db.studentRequirement.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, requirements });
  } catch (e) {
    console.error("[student-requirements]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, studentId, userId, name, notes, fulfilled } = body;

    if (!institutionId || !studentId || !name) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const requirement = await db.studentRequirement.create({
      data: {
        institutionId,
        studentId,
        name,
        notes: notes || null,
        fulfilled: Boolean(fulfilled),
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "student-requirements",
        entityType: "StudentRequirement",
        entityId: requirement.id,
        details: JSON.stringify({ studentId, name }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, requirement });
  } catch (e) {
    console.error("[student-requirements.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId, name, notes, fulfilled } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const data: any = {};
    if ("name" in body) data.name = name;
    if ("notes" in body) data.notes = notes || null;
    if ("fulfilled" in body) data.fulfilled = Boolean(fulfilled);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const requirement = await db.studentRequirement.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "student-requirements",
        entityType: "StudentRequirement",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(data) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, requirement });
  } catch (e) {
    console.error("[student-requirements.update]", e);
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
    await db.studentRequirement.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "student-requirements",
        entityType: "StudentRequirement",
        entityId: id,
        details: null,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[student-requirements.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
