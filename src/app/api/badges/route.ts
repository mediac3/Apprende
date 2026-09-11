import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  try {
    const where: any = {};
    if (institutionId) {
      where.users = { user: { institutionId } };
    }

    const badges = await db.badge.findMany({
      include: {
        _count: {
          select: {
            users: institutionId
              ? { where: { user: { institutionId } } }
              : true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      criteria: b.criteria,
      userCount: b._count.users,
    }));

    return NextResponse.json({ ok: true, badges: result });
  } catch (e) {
    console.error("[badges]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
