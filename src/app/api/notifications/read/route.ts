import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId requerido" },
        { status: 400 }
      );
    }

    const result = await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (e) {
    console.error("[notifications.read]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
