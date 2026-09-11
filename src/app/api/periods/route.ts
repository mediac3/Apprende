import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const periods = await db.period.findMany({
      where: { institutionId },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ ok: true, periods });
  } catch (e) {
    console.error("[periods]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
