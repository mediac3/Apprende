import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRoles, forbidden } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  // [Seguridad] la auditoría es del módulo rector/administrador (NAV) y expone
  // trazabilidad sensible: identidad real desde la cookie de sesión.
  const actor = await requireRoles(req, ["rector", "administrador"]);
  if (!actor) return forbidden();
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const moduleFilter = searchParams.get("module");
  const userId = searchParams.get("userId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { institutionId };
    if (moduleFilter) where.module = moduleFilter;
    if (userId) where.userId = userId;

    const audits = await db.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ ok: true, audits });
  } catch (e) {
    console.error("[audits]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
