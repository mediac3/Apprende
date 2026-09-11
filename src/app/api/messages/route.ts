import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const otherUserId = searchParams.get("otherUserId");

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "userId requerido" },
      { status: 400 }
    );
  }

  try {
    if (otherUserId) {
      // Return messages between the two users
      const messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true } },
          receiver: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      });

      // Mark messages received by current user as read
      await db.message.updateMany({
        where: { receiverId: userId, senderId: otherUserId, readAt: null },
        data: { readAt: new Date() },
      });

      return NextResponse.json({ ok: true, messages, mode: "conversation" });
    }

    // Recent threads grouped by conversation partner
    const sent = await db.message.findMany({
      where: { senderId: userId, receiverId: { not: null } },
      include: {
        receiver: { select: { id: true, fullName: true, avatarUrl: true, role: true, jobTitle: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const received = await db.message.findMany({
      where: { receiverId: userId },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true, jobTitle: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byPartner = new Map<string, any>();
    for (const m of [...sent, ...received]) {
      const partnerId = m.senderId === userId ? m.receiverId : m.senderId;
      if (!partnerId) continue;
      const partner = m.senderId === userId ? m.receiver : m.sender;
      const existing = byPartner.get(partnerId);
      if (!existing || new Date(m.createdAt) > new Date(existing.lastMessage.createdAt)) {
        byPartner.set(partnerId, {
          partnerId,
          partner,
          lastMessage: m,
          unreadCount: 0,
        });
      }
    }

    // Count unread messages from each partner
    const unread = await db.message.groupBy({
      by: ["senderId"],
      where: { receiverId: userId, readAt: null },
      _count: { _all: true },
    });
    for (const u of unread) {
      const entry = byPartner.get(u.senderId);
      if (entry) entry.unreadCount = u._count._all;
    }

    const threads = Array.from(byPartner.values()).sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    return NextResponse.json({ ok: true, threads, mode: "threads" });
  } catch (e) {
    console.error("[messages]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderId, receiverId, content } = body;

    if (!senderId || !receiverId || !content) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        senderId,
        receiverId,
        content,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Optional: create audit log
    try {
      const sender = await db.user.findUnique({
        where: { id: senderId },
        select: { institutionId: true },
      });
      if (sender) {
        await db.auditLog.create({
          data: {
            institutionId: sender.institutionId,
            userId: senderId,
            action: "create",
            module: "messages",
            entityType: "Message",
            entityId: message.id,
            details: JSON.stringify({ receiverId }),
            hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
          },
        });
      }
    } catch {
      // Audit log is optional; ignore errors
    }

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("[messages.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
