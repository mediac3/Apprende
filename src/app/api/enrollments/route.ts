import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { institutionId };
    if (status) where.status = status;
    if (type) where.type = type;

    const enrollments = await db.enrollment.findMany({
      where,
      include: {
        processedBy: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, enrollments });
  } catch (e) {
    console.error("[enrollments]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      applicantName,
      applicantBirthDate,
      applicantGrade,
      guardianName,
      guardianPhone,
      guardianEmail,
      type,
      notes,
      userId,
    } = body;

    if (!institutionId || !applicantName || !guardianName || !guardianPhone) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const enrollment = await db.enrollment.create({
      data: {
        institutionId,
        applicantName,
        applicantBirthDate: applicantBirthDate ? new Date(applicantBirthDate) : null,
        applicantGrade: applicantGrade || null,
        guardianName,
        guardianPhone,
        guardianEmail: guardianEmail || null,
        type: type || "matricula",
        notes: notes || null,
      },
      include: {
        processedBy: { select: { id: true, fullName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "enrollments",
        entityType: "Enrollment",
        entityId: enrollment.id,
        details: JSON.stringify({ applicantName, type }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, enrollment });
  } catch (e) {
    console.error("[enrollments.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
