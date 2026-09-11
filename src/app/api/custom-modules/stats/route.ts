import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: estadísticas del módulo
// ?moduleId=...&institutionId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  const institutionId = searchParams.get("institutionId");

  if (!moduleId || !institutionId) {
    return NextResponse.json({ ok: false, error: "Parámetros requeridos" }, { status: 400 });
  }

  try {
    const mod = await db.customModule.findFirst({ where: { id: moduleId, institutionId } });
    if (!mod) {
      return NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 });
    }

    const records = await db.customModuleRecord.findMany({
      where: { moduleId, institutionId },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const fields = JSON.parse(mod.fieldsJson) as any[];

    // Conteos por estado
    const byStatus: Record<string, number> = {};
    records.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    // Estadísticas por campo (solo para selects, radios, checkboxes)
    const fieldStats: Record<string, Record<string, number>> = {};
    fields.forEach((f) => {
      if (["select", "radio", "checkbox"].includes(f.type) && f.options) {
        const counts: Record<string, number> = {};
        f.options.forEach((o: any) => {
          counts[o.value || o.label] = 0;
        });
        records.forEach((r) => {
          const data = JSON.parse(r.dataJson);
          const val = data[f.id] ?? data[f.name];
          if (val !== undefined && val !== null && val !== "") {
            const vals = Array.isArray(val) ? val : [val];
            vals.forEach((v) => {
              counts[v] = (counts[v] || 0) + 1;
            });
          }
        });
        fieldStats[f.id || f.name] = counts;
      }
    });

    // Tendencia últimos 30 días
    const trend: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      const count = records.filter((r) => r.createdAt.toISOString().slice(0, 10) === dayKey).length;
      trend.push({ date: dayKey, count });
    }

    return NextResponse.json({
      ok: true,
      stats: {
        total: records.length,
        byStatus,
        fieldStats,
        trend,
        fields: fields.map((f) => ({ id: f.id || f.name, label: f.label, type: f.type })),
      },
    });
  } catch (e) {
    console.error("[custom-modules.stats]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
