// [Dashboard Padre] API — GET ?userId=&childId= (datos agregados del hijo activo)
// Gate: solo rol 'acudiente' activo, verificado en servidor por id (patrón student-dashboard).
// Seguridad: el childId se valida DENTRO de la query contra los hijos del acudiente (403 si es ajeno).
import { NextRequest, NextResponse } from "next/server";
import { getParentDashboard } from "@/lib/queries/parent-dashboard";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }
  const childId = req.nextUrl.searchParams.get("childId"); // opcional: hijo activo del selector
  const periodId = req.nextUrl.searchParams.get("periodId"); // opcional: periodo del selector (default: activo)
  try {
    const result = await getParentDashboard(userId, childId, periodId);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" }, // datos vivos: notas, asistencia y mensajes cambian a diario
    });
  } catch (e) {
    console.error("[parent-dashboard]", e instanceof Error ? `${e.message}\n${e.stack}` : e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
