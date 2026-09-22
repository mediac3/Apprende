import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { normalizeThemeData, serializeThemeData, themeDataSchema } from "@/lib/theme-options";

// [theme-options] API del módulo Opciones de Tema.
// GET  ?institutionId=... → configuración normalizada (o defaults si no existe fila).
// PUT  { institutionId, userId, data } → upsert. Solo rector/administrativo (verificado en BD).
// Prisma parametriza todas las consultas (sin SQL por concatenación).

const EDITOR_ROLES = ["rector", "administrativo"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const row = await db.themeOptions.findUnique({ where: { institutionId } });
    return NextResponse.json({
      ok: true,
      data: normalizeThemeData(row?.data),
      exists: Boolean(row),
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (e) {
    console.error("[theme-options.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId: string | undefined = body?.institutionId;
    const userId: string | undefined = body?.userId;
    if (!institutionId || !userId) {
      return NextResponse.json({ ok: false, error: "institutionId y userId requeridos" }, { status: 400 });
    }

    // Solo rector/administrativo pueden guardar el tema (validación en BD, no confiar en el cliente).
    const user = await db.user.findFirst({
      where: { id: userId, institutionId, role: { in: EDITOR_ROLES }, active: true },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Sin permisos para editar el tema" }, { status: 403 });
    }

    const parsed = themeDataSchema.safeParse(body?.data);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Estructura de tema inválida" }, { status: 400 });
    }

    const data = serializeThemeData(parsed.data);
    const saved = await db.themeOptions.upsert({
      where: { institutionId },
      create: { institutionId, data, updatedBy: userId },
      update: { data, updatedBy: userId, version: { increment: 1 } },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId,
        action: "update",
        module: "theme-options",
        entityType: "ThemeOptions",
        entityId: saved.id,
        details: JSON.stringify({ version: saved.version }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, data: normalizeThemeData(saved.data), version: saved.version });
  } catch (e) {
    console.error("[theme-options.put]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
