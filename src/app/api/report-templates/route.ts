import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const templates = await db.reportTemplate.findMany({
      where: { institutionId },
      orderBy: { name: "asc" },
      include: { _count: { select: { variables: true } } },
    });
    return NextResponse.json({ ok: true, templates });
  } catch (e) {
    console.error("[report-templates.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, slug, type, headerHtml, bodyHtml, footerHtml, active, userId } = body;
    if (!institutionId || !name || !slug) return NextResponse.json({ ok: false, error: "institutionId, name, slug requeridos" }, { status: 400 });

    const t = await db.reportTemplate.create({
      data: { institutionId, name, slug, type: type || "constancia", headerHtml, bodyHtml, footerHtml, active: active !== false },
    });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "report_templates", entityType: "ReportTemplate", entityId: t.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: t.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe una plantilla con ese slug" }, { status: 400 });
    console.error("[report-templates.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, name, slug, type, headerHtml, bodyHtml, footerHtml, active, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (slug !== undefined) update.slug = slug;
    if (type !== undefined) update.type = type;
    if (headerHtml !== undefined) update.headerHtml = headerHtml;
    if (bodyHtml !== undefined) update.bodyHtml = bodyHtml;
    if (footerHtml !== undefined) update.footerHtml = footerHtml;
    if (active !== undefined) update.active = !!active;

    await db.reportTemplate.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "report_templates", entityType: "ReportTemplate", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[report-templates.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");
  if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

  try {
    await db.reportTemplate.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "report_templates", entityType: "ReportTemplate", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[report-templates.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
