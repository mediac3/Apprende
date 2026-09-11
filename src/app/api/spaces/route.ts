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
    const spaces = await db.space.findMany({
      where: { institutionId },
      include: {
        _count: { select: { members: true, posts: true } },
      },
      orderBy: { name: "asc" },
    });

    const result = spaces.map((s) => ({
      ...s,
      memberCount: s._count.members,
      postCount: s._count.posts,
      _count: undefined,
    }));

    return NextResponse.json({ ok: true, spaces: result });
  } catch (e) {
    console.error("[spaces]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, slug, description, type, visibility, userId } = body;

    if (!institutionId || !name || !slug) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const space = await db.space.create({
      data: {
        institutionId,
        name,
        slug,
        description: description || null,
        type: type || "group",
        visibility: visibility || "public",
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "spaces",
        entityType: "Space",
        entityId: space.id,
        details: JSON.stringify({ name, slug, type }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, space });
  } catch (e) {
    console.error("[spaces.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
