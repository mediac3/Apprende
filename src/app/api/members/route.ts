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
    const users = await db.user.findMany({
      where: { institutionId },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        email: true,
        phone: true,
        jobTitle: true,
        avatarUrl: true,
        active: true,
        badges: { select: { badgeId: true, badge: { select: { id: true, name: true, iconUrl: true } } } },
      },
      orderBy: { fullName: "asc" },
    });

    const members = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      email: u.email,
      phone: u.phone,
      jobTitle: u.jobTitle,
      avatarUrl: u.avatarUrl,
      active: u.active,
      badgeCount: u.badges.length,
      badges: u.badges,
    }));

    return NextResponse.json({ ok: true, members });
  } catch (e) {
    console.error("[members]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
