import { NextRequest, NextResponse } from "next/server";
import { getConsolidadoResumenInstitucion } from "@/lib/queries/consolidado";

// === [F1] Consolidado anual — vista "Todos los años" ===
// GET /api/consolidado/resumen?institutionId=
//   Resumen por año → grupo (estudiantes, promedio del grupo, estados de
//   promoción). Reutiliza getConsolidadoAnual por grupo. Años sin grupos
//   se omiten (el dropdown los marca aparte).

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
    const years = await getConsolidadoResumenInstitucion({ institutionId });
    return NextResponse.json({ ok: true, years });
  } catch (e) {
    console.error("[consolidado.resumen]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
