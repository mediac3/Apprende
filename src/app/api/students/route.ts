import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const groupId = searchParams.get("groupId");
  const status = searchParams.get("status");
  const atRisk = searchParams.get("atRisk");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { institutionId };
    if (groupId) where.groupId = groupId;
    if (status) where.status = status;

    // Find active period for at-risk filtering
    let activePeriod: { id: string } | null = null;
    if (atRisk === "true") {
      activePeriod = await db.period.findFirst({
        where: { institutionId, active: true },
        select: { id: true },
      });
      if (!activePeriod) {
        return NextResponse.json({ ok: true, students: [] });
      }
    }

    const students = await db.student.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, section: true, gradeLevel: { select: { code: true, name: true } } } },
        grades: {
          where: activePeriod ? { periodId: activePeriod.id } : undefined,
          include: {
            subject: { select: { id: true, name: true } },
            period: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        observations: {
          orderBy: { date: "desc" },
          take: 5,
          include: {
            recordedBy: { select: { id: true, fullName: true } },
          },
        },
        attendances: {
          orderBy: { date: "desc" },
          take: 10,
        },
      },
      orderBy: { firstName: "asc" },
    });

    if (atRisk === "true" && activePeriod) {
      const filtered = students.filter(
        (s) =>
          s.grades.some(
            (g) => g.performance === "bajo" || g.performance === "basico"
          )
      );
      return NextResponse.json({ ok: true, students: filtered });
    }

    return NextResponse.json({ ok: true, students });
  } catch (e) {
    console.error("[students]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      groupId,
      code,
      firstName,
      lastName,
      birthDate,
      gender,
      address,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelation,
      status,
      enrollmentDate,
      userId,
    } = body;

    if (!institutionId || !code || !firstName || !lastName) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const data: any = {
      institutionId,
      groupId: groupId || null,
      code,
      firstName,
      lastName,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
      address: address || null,
      guardianName: guardianName || null,
      guardianPhone: guardianPhone || null,
      guardianEmail: guardianEmail || null,
      guardianRelation: guardianRelation || null,
      status: status || "activo",
      enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
    };

    const student = await db.student.create({
      data,
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "students",
        entityType: "Student",
        entityId: student.id,
        details: JSON.stringify({ code, firstName, lastName }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, student });
  } catch (e) {
    console.error("[students.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Gestión de Estudiantes (PDF) — actualización parcial de la ficha del estudiante.
// Solo aplica los campos presentes en el body; no altera el comportamiento de GET/POST.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId } = body;
    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const data: any = {};
    const textFields = [
      "firstName", "lastName", "gender", "address",
      "documentType", "documentNumber", "birthPlace",
      "photoUrl", "identityDocUrl",
      "simatEstrato", "simatEps", "simatMunicipioExp",
      "guardianName", "guardianPhone", "guardianEmail", "guardianRelation",
      "status", "code",
    ];
    const dateFields = ["birthDate", "enrollmentDate"];
    const boolFields = ["baptized", "overage"];

    for (const f of textFields) if (f in body) data[f] = body[f] === "" ? null : body[f];
    for (const f of dateFields) if (f in body) data[f] = body[f] ? new Date(body[f]) : null;
    for (const f of boolFields) if (f in body) data[f] = body[f] === null ? null : Boolean(body[f]);
    if ("groupId" in body) data.groupId = body.groupId || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const student = await db.student.update({
      where: { id },
      data,
      include: { group: { select: { id: true, name: true } } },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "students",
        entityType: "Student",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(data) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, student });
  } catch (e) {
    console.error("[students.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Gestión de Estudiantes (PDF) — eliminar estudiante (borrado en cascada de sus registros)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");

  if (!id || !institutionId) {
    return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
  }

  try {
    const student = await db.student.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "students",
        entityType: "Student",
        entityId: id,
        details: JSON.stringify({ code: student.code, firstName: student.firstName, lastName: student.lastName }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[students.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
