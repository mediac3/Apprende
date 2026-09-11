import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const reportTemplateId = searchParams.get("reportTemplateId");
  if (!institutionId || !reportTemplateId) return NextResponse.json({ ok: false, error: "institutionId y reportTemplateId requeridos" }, { status: 400 });

  try {
    const variables = await db.reportVariable.findMany({
      where: { reportTemplateId },
      orderBy: { variable: "asc" },
    });
    return NextResponse.json({ ok: true, variables });
  } catch (e) {
    console.error("[report-variables.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportTemplateId, variable, value, description, userId, institutionId } = body;
    if (!reportTemplateId || !variable) return NextResponse.json({ ok: false, error: "reportTemplateId y variable requeridos" }, { status: 400 });

    const v = await db.reportVariable.create({ data: { reportTemplateId, variable, value: value || "", description } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "create", module: "report_variables", entityType: "ReportVariable", entityId: v.id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true, id: v.id });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ ok: false, error: "Ya existe esa variable en el reporte" }, { status: 400 });
    console.error("[report-variables.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, variable, value, description, userId } = body;
    if (!id || !institutionId) return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });

    const update: any = {};
    if (variable !== undefined) update.variable = variable;
    if (value !== undefined) update.value = value;
    if (description !== undefined) update.description = description;

    await db.reportVariable.update({ where: { id }, data: update });
    await db.auditLog.create({
      data: { institutionId, userId, action: "update", module: "report_variables", entityType: "ReportVariable", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[report-variables.update]", e);
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
    await db.reportVariable.delete({ where: { id } });
    await db.auditLog.create({
      data: { institutionId, userId, action: "delete", module: "report_variables", entityType: "ReportVariable", entityId: id, hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[report-variables.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
