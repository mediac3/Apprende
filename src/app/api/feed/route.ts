import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forbiddenUnless } from "@/lib/permissions/server";
import { getSessionUser } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const spaceId = searchParams.get("spaceId");

  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }

  try {
    const where: any = { institutionId };
    if (spaceId && spaceId !== "all") where.spaceId = spaceId;

    const posts = await db.post.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, role: true, jobTitle: true } },
        space: { select: { id: true, name: true, slug: true, type: true } },
        comments: {
          include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
        reactions: { select: { id: true, userId: true, emoji: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    const spaces = await db.space.findMany({
      where: { institutionId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, posts, spaces });
  } catch (e) {
    console.error("[feed]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, spaceId, content, pollQuestion, pollOptions } = body;

    // [Seguridad] identidad forzada: nadie publica en nombre de otro (el actor
    // viene de la cookie; el authorId del body se ignora). Roles de comunidad
    // configurables en la matriz de permisos (forbiddenUnless ya existente).
    const author = await getSessionUser(req);
    if (!author) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    const authorId = author.id;

    if (!institutionId || !authorId || !content) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    // [F1] Validación de permisos en servidor (regla dura, no solo UI)
    const deniedPost = await forbiddenUnless(authorId, institutionId, "comunidad", "canCreate", "publicar en la comunidad");
    if (deniedPost) return deniedPost;

    const post = await db.post.create({
      data: {
        institutionId,
        authorId,
        spaceId: spaceId || null,
        content,
        pollQuestion: pollQuestion || null,
        pollOptionsJson: pollOptions ? JSON.stringify(pollOptions) : null,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, role: true, jobTitle: true } },
        space: { select: { id: true, name: true, slug: true, type: true } },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: authorId,
        action: "create",
        module: "feed",
        entityType: "Post",
        entityId: post.id,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, post });
  } catch (e) {
    console.error("[feed.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
