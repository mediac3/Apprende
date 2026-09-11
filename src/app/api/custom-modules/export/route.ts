import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: exportar registros a CSV
// ?moduleId=...&institutionId=...&format=csv|xlsx
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
      take: 10000,
    });

    const fields = JSON.parse(mod.fieldsJson) as any[];
    const dataFields = fields.filter((f) => !["section", "column"].includes(f.type));

    // Build CSV
    const headers = ["ID", "Fecha", "Usuario", "Estado", ...dataFields.map((f) => f.label || f.name)];
    const rows = records.map((r) => {
      const data = JSON.parse(r.dataJson);
      return [
        r.id,
        r.createdAt.toISOString(),
        r.userId || "",
        r.status,
        ...dataFields.map((f) => {
          const v = data[f.id] ?? data[f.name];
          if (v === undefined || v === null) return "";
          if (Array.isArray(v)) return v.join("; ");
          if (typeof v === "object") return JSON.stringify(v);
          return String(v).replace(/"/g, '""');
        }),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${c}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${mod.slug}-export.csv"`,
      },
    });
  } catch (e) {
    console.error("[custom-modules.export]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
