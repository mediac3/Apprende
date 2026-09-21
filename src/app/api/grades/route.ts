import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const groupId = searchParams.get("groupId");
  const subjectId = searchParams.get("subjectId");
  const periodId = searchParams.get("periodId");
  const studentId = searchParams.get("studentId");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (periodId) where.periodId = periodId;
    if (studentId) where.studentId = studentId;
    if (groupId) where.student = { groupId };

    // Filter by institution through relations
    where.OR = [
      { subject: { institutionId } },
      { period: { institutionId } },
      { student: { institutionId } },
    ];

    const grades = await db.grade.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, code: true, groupId: true } },
        subject: { select: { id: true, name: true, area: true } },
        period: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, grades });
  } catch (e) {
    console.error("[grades]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      studentId,
      subjectId,
      periodId,
      teacherId,
      value,
      performance,
      observations,
      isSelfEval,
      userId,
    } = body;

    if (!institutionId || !studentId || !subjectId || !periodId || value === undefined) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    // Grade no tiene restricción única compuesta en el schema: upsert manual
    // (findFirst → update | create) con semántica equivalente.
    const existing = await db.grade.findFirst({
      where: { studentId, subjectId, periodId, isSelfEval: !!isSelfEval },
      orderBy: { createdAt: "desc" },
    });
    const payload = {
      teacherId: teacherId || null,
      value: Number(value),
      performance: performance || null,
      observations: observations || null,
      isSelfEval: !!isSelfEval,
    };
    const grade = existing
      ? await db.grade.update({ where: { id: existing.id }, data: payload, include: {
          student: { select: { id: true, firstName: true, lastName: true, code: true } },
          subject: { select: { id: true, name: true } },
          period: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
        } })
      : await db.grade.create({
          data: { studentId, subjectId, periodId, ...payload },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, code: true } },
            subject: { select: { id: true, name: true } },
            period: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true } },
          },
        });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || teacherId || null,
        action: "upsert",
        module: "grades",
        entityType: "Grade",
        entityId: grade.id,
        details: JSON.stringify({ value, performance, isSelfEval }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, grade });
  } catch (e) {
    console.error("[grades.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
