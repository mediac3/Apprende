import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ADDON_DEFAULT, ADDON_KEYS, isValidAddonKey, isValidAddonTargets } from "@/lib/addons";

// === [F1] Gestor de complementos: API de configuración por institución ===
// GET  → lista completa (claves sin fila = defaults activos/both, fail-open).
// PUT  → solo administrador; upsert transaccional de las filas enviadas.

export async function GET(req: NextRequest) {
  const institutionId = new URL(req.url).searchParams.get("institutionId") ?? "";
  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }
  const rows = await db.addonConfig.findMany({ where: { institutionId } });
  const byKey = new Map(rows.map((r) => [r.featureKey, r]));
  const addons = ADDON_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      featureKey: key,
      enabled: row?.enabled ?? ADDON_DEFAULT.enabled,
      targets: row?.targets ?? ADDON_DEFAULT.targets,
    };
  });
  return NextResponse.json({ ok: true, addons });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId = typeof body?.institutionId === "string" ? body.institutionId : "";
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const addons = Array.isArray(body?.addons) ? body.addons : [];
    if (!institutionId || !userId) {
      return NextResponse.json({ ok: false, error: "institutionId y userId requeridos" }, { status: 400 });
    }
    // Solo administrador edita complementos (patrón del módulo Permisos).
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || user.role !== "administrador") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const parsed: Array<{ featureKey: string; enabled: boolean; targets: string }> = [];
    for (const a of addons) {
      const featureKey = typeof a?.featureKey === "string" ? a.featureKey : "";
      const enabled = a?.enabled === true;
      const targets = typeof a?.targets === "string" ? a.targets : "both";
      if (!isValidAddonKey(featureKey) || !isValidAddonTargets(targets)) {
        return NextResponse.json({ ok: false, error: `Complemento o versión inválida: ${featureKey}` }, { status: 400 });
      }
      parsed.push({ featureKey, enabled, targets });
    }

    await db.$transaction(async (tx) => {
      for (const p of parsed) {
        await tx.addonConfig.upsert({
          where: { institutionId_featureKey: { institutionId, featureKey: p.featureKey } },
          create: { institutionId, featureKey: p.featureKey, enabled: p.enabled, targets: p.targets },
          update: { enabled: p.enabled, targets: p.targets },
        });
      }
    });

    return NextResponse.json({ ok: true, updated: parsed.length });
  } catch (e) {
    console.error("[addons] PUT error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la configuración." }, { status: 500 });
  }
}
