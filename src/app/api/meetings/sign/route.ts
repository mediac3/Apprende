import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingId, userId, signatureData } = body;

    if (!meetingId || !userId) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: { institution: true, signers: true },
    });

    if (!meeting) {
      return NextResponse.json({ ok: false, error: "Acta no encontrada" }, { status: 404 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    // If user already signed, update signature; otherwise create
    const existing = meeting.signers.find((s) => s.userId === userId);
    let signer;
    if (existing) {
      signer = await db.meetingSigner.update({
        where: { id: existing.id },
        data: { signatureData: signatureData || null, signedAt: new Date() },
      });
    } else {
      signer = await db.meetingSigner.create({
        data: {
          meetingId,
          userId,
          signatureData: signatureData || null,
        },
      });
    }

    const hash = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const updatedMeeting = await db.meeting.update({
      where: { id: meetingId },
      data: {
        signed: true,
        signedAt: new Date(),
        signedBy: user.fullName,
        hash,
      },
      include: {
        signers: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });

    await db.auditLog.create({
      data: {
        institutionId: meeting.institutionId,
        userId,
        action: "sign",
        module: "meetings",
        entityType: "Meeting",
        entityId: meeting.id,
        details: JSON.stringify({ signerId: userId, signerName: user.fullName }),
        hash,
      },
    });

    return NextResponse.json({ ok: true, meeting: updatedMeeting, signer });
  } catch (e) {
    console.error("[meetings.sign]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
