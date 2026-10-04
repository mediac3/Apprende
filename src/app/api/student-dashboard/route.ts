// [F1] API del dashboard del estudiante — GET ?userId=
// Gate: solo usuarios con rol 'estudiante' (verificado en servidor por id).
import { NextRequest, NextResponse } from "next/server";
import { getStudentDashboard } from "@/lib/queries/student-dashboard";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }
  try {
    const data = await getStudentDashboard(userId);
    if (!data.ok) {
      return NextResponse.json({ error: data.reason }, { status: 403 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" }, // datos vivos: XP, racha y misión cambian por día
    });
  } catch (e) {
    console.error("[student-dashboard]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
