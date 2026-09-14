import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Gestión de Estudiantes (PDF pág 6/12) — contactos familiares del estudiante

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

    const contacts = await db.studentContact.findMany({
      where,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ ok: true, contacts });
  } catch (e) {
    console.error("[student-contacts]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, studentId, userId, fullName, relationship, phone, email, occupation, isPrimary } = body;

    if (!institutionId || !studentId || !fullName || !relationship) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    // Solo un contacto principal por estudiante
    if (isPrimary) {
      await db.studentContact.updateMany({
        where: { studentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await db.studentContact.create({
      data: {
        institutionId,
        studentId,
        fullName,
        relationship,
        phone: phone || null,
        email: email || null,
        occupation: occupation || null,
        isPrimary: Boolean(isPrimary),
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "student-contacts",
        entityType: "StudentContact",
        entityId: contact.id,
        details: JSON.stringify({ studentId, fullName, relationship }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (e) {
    console.error("[student-contacts.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId, fullName, relationship, phone, email, occupation, isPrimary } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    // Solo un contacto principal por estudiante
    if (isPrimary) {
      const current = await db.studentContact.findUnique({ where: { id }, select: { studentId: true } });
      if (current) {
        await db.studentContact.updateMany({
          where: { studentId: current.studentId, isPrimary: true, NOT: { id } },
          data: { isPrimary: false },
        });
      }
    }

    const data: any = {};
    if ("fullName" in body) data.fullName = fullName;
    if ("relationship" in body) data.relationship = relationship;
    if ("phone" in body) data.phone = phone || null;
    if ("email" in body) data.email = email || null;
    if ("occupation" in body) data.occupation = occupation || null;
    if ("isPrimary" in body) data.isPrimary = Boolean(isPrimary);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const contact = await db.studentContact.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "student-contacts",
        entityType: "StudentContact",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(data) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (e) {
    console.error("[student-contacts.update]", e);
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
    await db.studentContact.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "student-contacts",
        entityType: "StudentContact",
        entityId: id,
        details: null,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[student-contacts.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
