import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// === Agente de IA — configuración por institución (Parámetros → Inteligencia artificial) ===
// GET  /api/ai/config?institutionId= → configuración con clave enmascarada
// POST { institutionId, provider, apiKey, model } → upsert de la configuración

function maskKey(key: string): string {
  if (!key) return "";
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const cfg = await db.aiConfig.findUnique({ where: { institutionId } });
    return NextResponse.json({
      ok: true,
      config: {
        provider: cfg?.provider ?? "gemini",
        model: cfg?.model ?? "gemini-flash-latest",
        apiKeyMasked: cfg ? maskKey(cfg.apiKey) : "",
        configured: !!cfg?.apiKey,
      },
    });
  } catch (e) {
    console.error("[ai.config.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, provider, apiKey, model, userId } = body;
    if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

    const data = {
      provider: provider === "gemini" ? "gemini" : "gemini",
      apiKey: typeof apiKey === "string" ? apiKey.trim() : "",
      model: typeof model === "string" && model.trim() ? model.trim() : "gemini-flash-latest",
    };

    const cfg = await db.aiConfig.upsert({
      where: { institutionId },
      create: { institutionId, ...data },
      update: data,
    });

    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "ai_config", entityType: "AiConfig", entityId: cfg.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });

    return NextResponse.json({
      ok: true,
      config: { provider: cfg.provider, model: cfg.model, apiKeyMasked: maskKey(cfg.apiKey), configured: !!cfg.apiKey },
    });
  } catch (e) {
    console.error("[ai.config.save]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
