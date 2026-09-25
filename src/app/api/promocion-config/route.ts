import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// === [F3] Parámetros de promoción escolar (1 fila por institución) ===
// GET  /api/promocion-config?institutionId= → config guardada o defaults
// PUT  /api/promocion-config { institutionId, umbralArea|null,
//        umbralInasistencia, maxAreasNivelacion, preescolarCodes, userId }
//
// Defaults (cuando no hay fila guardada — se resuelven en el código):
//   umbralArea: null → derivar de Escalas valorativas (tope de "Bajo", fallback 3.0)
//   umbralInasistencia: 25 (% ausencias injustificadas, causal de no promoción)
//   maxAreasNivelacion: 2 (≤ N áreas en bajo → promovido condicionado; > N → no promovido)
//   preescolarCodes: "PJ,J,T" (promoción automática — Pár. 1, Decreto 1411 de 2022)

const DEFAULTS = {
  umbralArea: null as number | null,
  umbralInasistencia: 25,
  maxAreasNivelacion: 2,
  preescolarCodes: "PJ,J,T",
};

/** Normaliza "pj, j ; T" → "PJ,J,T" */
function normalizarCodigos(raw: string): string {
  return raw
    .split(/[,;/]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .join(",");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }
  try {
    const cfg = await db.promotionConfig.findUnique({ where: { institutionId } });
    return NextResponse.json({
      ok: true,
      config: cfg ?? { institutionId, ...DEFAULTS },
      porDefecto: cfg === null,
    });
  } catch (e) {
    console.error("[promocion-config.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId = body?.institutionId as string | undefined;
    if (!institutionId) {
      return NextResponse.json(
        { ok: false, error: "institutionId requerido" },
        { status: 400 }
      );
    }

    // Validaciones de rango
    const umbralArea =
      body?.umbralArea === null || body?.umbralArea === "" || body?.umbralArea === undefined
        ? null
        : Number(body.umbralArea);
    if (umbralArea !== null && (Number.isNaN(umbralArea) || umbralArea < 0 || umbralArea > 5)) {
      return NextResponse.json(
        { ok: false, error: "El umbral de áreas debe estar entre 0.0 y 5.0 (o vacío para derivar de escalas)" },
        { status: 400 }
      );
    }
    const umbralInasistencia = Number(body?.umbralInasistencia);
    if (!Number.isInteger(umbralInasistencia) || umbralInasistencia < 1 || umbralInasistencia > 100) {
      return NextResponse.json(
        { ok: false, error: "El umbral de inasistencia debe ser un entero entre 1 y 100" },
        { status: 400 }
      );
    }
    const maxAreasNivelacion = Number(body?.maxAreasNivelacion);
    if (!Number.isInteger(maxAreasNivelacion) || maxAreasNivelacion < 0 || maxAreasNivelacion > 20) {
      return NextResponse.json(
        { ok: false, error: "El máximo de áreas con nivelación debe ser un entero entre 0 y 20" },
        { status: 400 }
      );
    }
    const preescolarCodes = normalizarCodigos(String(body?.preescolarCodes ?? DEFAULTS.preescolarCodes));
    if (!preescolarCodes) {
      return NextResponse.json(
        { ok: false, error: "Indica al menos un código de preescolar (ej. PJ,J,T) o deja el default" },
        { status: 400 }
      );
    }

    const config = await db.promotionConfig.upsert({
      where: { institutionId },
      update: { umbralArea, umbralInasistencia, maxAreasNivelacion, preescolarCodes },
      create: { institutionId, umbralArea, umbralInasistencia, maxAreasNivelacion, preescolarCodes },
    });
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    console.error("[promocion-config.put]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
