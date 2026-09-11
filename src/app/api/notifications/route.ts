import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const read = searchParams.get("read");

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "userId requerido" },
      { status: 400 }
    );
  }

  try {
    const where: any = { userId };
    if (read !== null && read !== undefined && read !== "") {
      where.read = read === "true";
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ ok: true, notifications });
  } catch (e) {
    console.error("[notifications]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
