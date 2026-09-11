import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// PATCH: publicar / aprobar / rechazar módulo
// body: { id, institutionId, action, userId, reason? }
// action: "publish" | "unpublish" | "approve" | "reject" | "submit_review"
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, action, userId, reason } = body;

    if (!id || !institutionId || !action) {
      return NextResponse.json({ ok: false, error: "id, institutionId, action requeridos" }, { status: 400 });
    }

    const existing = await db.customModule.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 });
    }

    const update: any = {};
    switch (action) {
      case "submit_review":
        update.status = "pending_review";
        break;
      case "approve":
      case "publish":
        update.status = "published";
        update.published = true;
        update.publishedAt = new Date();
        update.publishedById = userId || null;
        update.rejectionReason = null;
        break;
      case "unpublish":
        update.status = "draft";
        update.published = false;
        break;
      case "reject":
        update.status = "rejected";
        update.rejectionReason = reason || "Rechazado sin razón especificada";
        break;
      default:
        return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
    }

    await db.customModule.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action,
        module: "custom_modules",
        entityType: "CustomModule",
        entityId: id,
        details: JSON.stringify({ name: existing.name, action, reason }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[custom-modules.publish]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
