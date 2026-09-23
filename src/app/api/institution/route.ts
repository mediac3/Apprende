import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const institution = await db.institution.findUnique({ where: { id: institutionId } });
    if (!institution) return NextResponse.json({ ok: false, error: "Institución no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, institution });
  } catch (e) {
    console.error("[institution.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId, ...fields } = body;
    if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

    const allowed = ["name", "shortName", "nit", "dane", "logoUrl", "address", "phone", "email", "academicYear", "resolution", "city", "icfesCode", "decree", "etc", "calendario", "sector", "zonaSede", "jornada"];
    const update: any = {};
    for (const k of allowed) {
      if (fields[k] !== undefined) update[k] = fields[k];
    }

    await db.institution.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId: id, userId, action: "update", module: "institution", entityType: "Institution", entityId: id, details: JSON.stringify({ updatedFields: Object.keys(update) }), hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[institution.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
