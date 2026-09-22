import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// [theme-options] Comentarios por celda de la planilla de Notas parciales.
// GET  ?groupId&subjectId&periodId → mapa "studentId::activityId" → texto.
// PUT  { institutionId, studentId, activityId, text, userId } → upsert;
//      texto vacío elimina el comentario.
// Prisma parametriza todas las consultas (sin SQL por concatenación).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const subjectId = searchParams.get("subjectId");
  const periodId = searchParams.get("periodId");
  if (!groupId || !subjectId || !periodId) {
    return NextResponse.json({ ok: false, error: "groupId, subjectId y periodId requeridos" }, { status: 400 });
  }

  try {
    const activities = await db.activity.findMany({
      where: { groupId, subjectId, periodId },
      select: { id: true },
    });
    if (activities.length === 0) return NextResponse.json({ ok: true, comments: {} });

    const rows = await db.gradeCellComment.findMany({
      where: { activityId: { in: activities.map((a) => a.id) } },
      select: { studentId: true, activityId: true, text: true },
    });
    const comments: Record<string, string> = {};
    for (const r of rows) {
      if (r.text) comments[`${r.studentId}::${r.activityId}`] = r.text;
    }
    return NextResponse.json({ ok: true, comments });
  } catch (e) {
    console.error("[grade-comments.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId: string | undefined = body?.institutionId;
    const studentId: string | undefined = body?.studentId;
    const activityId: string | undefined = body?.activityId;
    const text: string = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
    if (!institutionId || !studentId || !activityId) {
      return NextResponse.json({ ok: false, error: "institutionId, studentId y activityId requeridos" }, { status: 400 });
    }

    if (text === "") {
      await db.gradeCellComment.deleteMany({ where: { studentId, activityId } });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const saved = await db.gradeCellComment.upsert({
      where: { studentId_activityId: { studentId, activityId } },
      create: { institutionId, studentId, activityId, text, updatedBy: body?.userId ?? null },
      update: { text, updatedBy: body?.userId ?? null },
    });
    return NextResponse.json({ ok: true, comment: { key: `${saved.studentId}::${saved.activityId}`, text: saved.text } });
  } catch (e) {
    console.error("[grade-comments.put]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
