import { NextRequest, NextResponse } from "next/server";
import { getDirectivoDashboard } from "@/lib/queries/directivo-dashboard";

// === [Dashboard directivo] KPIs, alertas, tendencias y drill-down para Rector/Coordinador ===
// Seguridad: el alcance se resuelve EN SERVIDOR con los roles frescos de la BD.
// Un coordinador solo recibe datos de sus scopeBranchIds/scopeGradeLevelIds;
// los params de drill-down fuera de su alcance → 403 OUT_OF_SCOPE.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const institutionId = sp.get("institutionId");
  const userId = sp.get("userId");
  if (!institutionId || !userId) {
    return NextResponse.json({ ok: false, error: "institutionId y userId requeridos" }, { status: 400 });
  }

  try {
    const result = await getDirectivoDashboard({
      institutionId,
      userId,
      periodId: sp.get("periodId"),
      sedeId: sp.get("sede"),
      gradoId: sp.get("grado"),
      grupoId: sp.get("grupo"),
    });

    if (result.error === "FORBIDDEN_ROLE") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_ROLE", message: "Este panel es solo para rector, coordinador o administrador" },
        { status: 403 }
      );
    }
    if (result.error === "OUT_OF_SCOPE") {
      return NextResponse.json(
        { ok: false, error: "OUT_OF_SCOPE", message: "Esa sede o grado está fuera de tu alcance asignado" },
        { status: 403 }
      );
    }
    if (result.error === "NO_GROUPS") {
      return NextResponse.json({
        ok: true,
        empty: true,
        institution: result.institution,
        year: result.year,
        message: "Sin datos disponibles para el periodo",
      });
    }
    return NextResponse.json({ ok: true, empty: false, ...result });
  } catch (e) {
    console.error("[directivo-dashboard]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
