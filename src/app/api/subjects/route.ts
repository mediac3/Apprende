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
    const subjects = await db.subject.findMany({
      where: { institutionId },
      orderBy: [{ area: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ ok: true, subjects });
  } catch (e) {
    console.error("[subjects]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
