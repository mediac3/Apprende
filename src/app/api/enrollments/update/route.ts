import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/api-guard";
import { forbiddenUnless } from "@/lib/permissions/server";

export async function PATCH(req: NextRequest) {
  try {
    // [Seguridad] Procesamiento de solicitudes = gestión de matrícula (matriz de permisos)
    const actor = await getSessionUser(req);
    if (!actor) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    const body = await req.json();
    const { id, status, processedById, notes } = body;
    const denied = await forbiddenUnless(actor.id, actor.institutionId, "matricula", "canEdit", "procesar solicitudes de matrícula");
    if (denied) return denied;
    const processedActor = processedById || actor.id;

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
        processedById: processedActor || null,
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
