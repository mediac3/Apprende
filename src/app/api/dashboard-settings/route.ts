import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserRoleCodes } from "@/lib/teaching-rules";

// === [Dashboard directivo] Umbrales de alertas configurables por institución ===
// GET: devuelve la fila (o defaults on-read, sin crear) — usado por el dashboard y Configuración.
// PATCH: solo rector/administrador (roles frescos de BD); upsert de los 3 umbrales.

export async function GET(req: NextRequest) {
  const institutionId = req.nextUrl.searchParams.get("institutionId");
  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }
  const row = await db.dashboardSetting.findUnique({ where: { institutionId } });
  return NextResponse.json({
    ok: true,
    settings: row ?? { riskThreshold: 3.0, attendanceThreshold: 90, pendingTasksLimit: 20 },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId = String(body.institutionId || "");
    const userId = String(body.userId || "");
    if (!institutionId || !userId) {
      return NextResponse.json({ ok: false, error: "institutionId y userId requeridos" }, { status: 400 });
    }
    // [Seguridad] roles frescos de BD: solo rector o administrador configuran umbrales
    const roles = await getUserRoleCodes(userId);
    if (!roles.some((r) => r === "rector" || r === "administrador")) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Solo rector o administrador pueden configurar los umbrales" },
        { status: 403 }
      );
    }
    const riskThreshold = Number(body.riskThreshold);
    const attendanceThreshold = Number(body.attendanceThreshold);
    const pendingTasksLimit = Number(body.pendingTasksLimit);
    if (
      !Number.isFinite(riskThreshold) || riskThreshold < 1 || riskThreshold > 5 ||
      !Number.isFinite(attendanceThreshold) || attendanceThreshold < 50 || attendanceThreshold > 100 ||
      !Number.isFinite(pendingTasksLimit) || pendingTasksLimit < 1 || pendingTasksLimit > 500
    ) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION", message: "Umbrales fuera de rango (riesgo 1–5, asistencia 50–100, tareas 1–500)" },
        { status: 400 }
      );
    }
    const settings = await db.dashboardSetting.upsert({
      where: { institutionId },
      create: { institutionId, riskThreshold, attendanceThreshold, pendingTasksLimit },
      update: { riskThreshold, attendanceThreshold, pendingTasksLimit },
    });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    console.error("[dashboard-settings]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
