// [Dashboard Docente] API — GET ?userId= (datos agregados) | POST (guardar umbrales IA)
// Gate: solo rol 'docente' activo, verificado en servidor por id (patrón student-dashboard).
import { NextRequest, NextResponse } from "next/server";
import { getTeacherDashboard, saveTeacherDashboardConfig } from "@/lib/queries/teacher-dashboard";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }
  const periodId = req.nextUrl.searchParams.get("periodId"); // opcional: periodo del selector
  try {
    const result = await getTeacherDashboard(userId, { periodId });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }
    return NextResponse.json(result.data, {
      headers: { "Cache-Control": "no-store" }, // datos operativos vivos (KPIs, alertas)
    });
  } catch (e) {
    console.error("[teacher-dashboard]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, declineThreshold, inactivityDays, riskThreshold } = body ?? {};
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }
    const result = await saveTeacherDashboardConfig(userId, {
      declineThreshold: Number(declineThreshold),
      inactivityDays: Number(inactivityDays),
      riskThreshold: Number(riskThreshold),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[teacher-dashboard:config]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
