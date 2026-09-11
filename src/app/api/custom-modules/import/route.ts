import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// POST: importar registros desde CSV
// body: { moduleId, institutionId, userId, rows: [{fieldId: value, ...}] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { moduleId, institutionId, userId, rows } = body;

    if (!moduleId || !institutionId || !Array.isArray(rows)) {
      return NextResponse.json({ ok: false, error: "Parámetros inválidos" }, { status: 400 });
    }

    const mod = await db.customModule.findFirst({ where: { id: moduleId, institutionId } });
    if (!mod) {
      return NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 });
    }

    const created = await Promise.all(
      rows.map((data: any) =>
        db.customModuleRecord.create({
          data: {
            moduleId,
            institutionId,
            userId: userId || null,
            dataJson: JSON.stringify(data),
            status: "submitted",
          },
        })
      )
    );

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "import",
        module: "custom_module_record",
        entityType: "CustomModuleRecord",
        entityId: moduleId,
        details: JSON.stringify({ count: created.length, moduleName: mod.name }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, imported: created.length });
  } catch (e) {
    console.error("[custom-modules.import]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
