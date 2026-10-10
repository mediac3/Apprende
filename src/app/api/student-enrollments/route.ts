import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/api-guard";
import { forbiddenUnless } from "@/lib/permissions/server";

// Gestión de Estudiantes (PDF) — fichas de matrícula por año (libro/folio, renovaciones)
// [Seguridad] escrituras vía matriz de permisos (módulo "matricula", roles configurables;
// el administrador siempre pasa).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const studentId = searchParams.get("studentId");
  const academicYearId = searchParams.get("academicYearId");

  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }

  try {
    const where: any = { institutionId };
    if (studentId) where.studentId = studentId;
    if (academicYearId) where.academicYearId = academicYearId;

    const enrollments = await db.studentEnrollment.findMany({
      where,
      include: {
        academicYear: { select: { id: true, year: true } },
        group: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
        student: { select: { id: true, firstName: true, lastName: true, code: true } },
        events: { orderBy: { date: "desc" } },
      },
      orderBy: [{ academicYearId: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ ok: true, enrollments });
  } catch (e) {
    console.error("[student-enrollments]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // [Seguridad] matrícula interna vía matriz de permisos (identidad desde sesión)
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  try {
    const body = await req.json();
    const {
      institutionId, studentId, userId,
      academicYearId, groupId, status, libro, folio, code, enrolledAt,
    } = body;

    // [Seguridad] roles configurables en la matriz (módulo "matricula")
    const denied = await forbiddenUnless(actor.id, actor.institutionId, "matricula", "canCreate", "crear fichas de matrícula");
    if (denied) return denied;

    if (!institutionId || !studentId) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const enrollment = await db.studentEnrollment.create({
      data: {
        institutionId,
        studentId,
        academicYearId: academicYearId || null,
        groupId: groupId || null,
        status: status || "matriculado",
        libro: libro ?? null,
        folio: folio ?? null,
        code: code || null,
        enrolledAt: enrolledAt ? new Date(enrolledAt) : null,
      },
      include: {
        academicYear: { select: { id: true, year: true } },
        group: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
        events: true,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "student-enrollments",
        entityType: "StudentEnrollment",
        entityId: enrollment.id,
        details: JSON.stringify({ studentId, academicYearId, folio }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, enrollment });
  } catch (e) {
    console.error("[student-enrollments.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // [Seguridad] matrícula interna vía matriz de permisos (identidad desde sesión)
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  try {
    const body = await req.json();
    const { id, institutionId, userId, academicYearId, groupId, status, libro, folio, code, enrolledAt } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }
    const denied = await forbiddenUnless(actor.id, institutionId, "matricula", "canEdit", "editar fichas de matrícula");
    if (denied) return denied;

    const data: any = {};
    if ("academicYearId" in body) data.academicYearId = academicYearId || null;
    if ("groupId" in body) data.groupId = groupId || null;
    if ("status" in body) data.status = status || "matriculado";
    if ("libro" in body) data.libro = libro ?? null;
    if ("folio" in body) data.folio = folio ?? null;
    if ("code" in body) data.code = code || null;
    if ("enrolledAt" in body) data.enrolledAt = enrolledAt ? new Date(enrolledAt) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const enrollment = await db.studentEnrollment.update({
      where: { id },
      data,
      include: {
        academicYear: { select: { id: true, year: true } },
        group: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
        events: { orderBy: { date: "desc" } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "student-enrollments",
        entityType: "StudentEnrollment",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(data) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, enrollment });
  } catch (e) {
    console.error("[student-enrollments.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // [Seguridad] matrícula interna vía matriz de permisos (identidad desde sesión)
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId") || actor.institutionId;
  const userId = searchParams.get("userId");

  if (!id || !institutionId) {
    return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
  }
  const denied = await forbiddenUnless(actor.id, institutionId, "matricula", "canDelete", "eliminar fichas de matrícula");
  if (denied) return denied;

  try {
    await db.studentEnrollment.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "student-enrollments",
        entityType: "StudentEnrollment",
        entityId: id,
        details: null,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[student-enrollments.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
