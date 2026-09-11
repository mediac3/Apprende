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
        group: { select: { id: true, name: true, grade: true, section: true } },
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
