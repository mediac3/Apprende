import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, processedById, notes } = body;

    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const existing = await db.enrollment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Matrícula no encontrada" }, { status: 404 });
    }

    const enrollment = await db.enrollment.update({
      where: { id },
      data: {
        status,
        processedById: processedById || null,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: {
        processedBy: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId: existing.institutionId,
        userId: processedById || null,
        action: "update",
        module: "enrollments",
        entityType: "Enrollment",
        entityId: enrollment.id,
        details: JSON.stringify({ status, notes }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, enrollment });
  } catch (e) {
    console.error("[enrollments.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
