import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// === Módulo Calificaciones: actividades evaluativas (sub-columnas N1, N2...) ===
// Toda consulta usa el cliente Prisma (consultas parametrizadas).

// GET /api/activities?groupId=&subjectId=&periodId= → actividades del
// grupo+asignatura+periodo, con su concepto, ordenadas por order
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const subjectId = searchParams.get("subjectId");
  const periodId = searchParams.get("periodId");

  if (!groupId || !subjectId || !periodId) {
    return NextResponse.json(
      { ok: false, error: "groupId, subjectId y periodId requeridos" },
      { status: 400 }
    );
  }

  try {
    const activities = await db.activity.findMany({
      where: { groupId, subjectId, periodId },
      include: { evaluativeConcept: true },
      orderBy: [{ evaluativeConcept: { order: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ ok: true, activities });
  } catch (e) {
    console.error("[activities.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST /api/activities → crea la siguiente sub-columna (N1 → N2 → N3...)
// Body: { institutionId, groupId, subjectId, periodId, evaluativeConceptId, name?, isGeneral? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, groupId, subjectId, periodId, evaluativeConceptId } = body;
    const isGeneral = Boolean(body.isGeneral);
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    if (!institutionId || !groupId || !subjectId || !periodId || !evaluativeConceptId) {
      return NextResponse.json(
        { ok: false, error: "institutionId, groupId, subjectId, periodId y evaluativeConceptId requeridos" },
        { status: 400 }
      );
    }

    // Validar que periodo y concepto pertenecen a la institución y no está cerrado
    const period = await db.period.findFirst({
      where: { id: periodId, institutionId },
    });
    if (!period) {
      return NextResponse.json({ ok: false, error: "Periodo no encontrado" }, { status: 404 });
    }
    if (period.closed) {
      return NextResponse.json({ ok: false, error: "El periodo está cerrado" }, { status: 409 });
    }
    const concept = await db.evaluativeConcept.findFirst({
      where: { id: evaluativeConceptId, institutionId },
    });
    if (!concept) {
      return NextResponse.json({ ok: false, error: "Concepto evaluativo no encontrado" }, { status: 404 });
    }

    // Siguiente orden dentro del concepto (sub-columnas N1..N por concepto)
    const existing = await db.activity.findMany({
      where: { groupId, subjectId, periodId, evaluativeConceptId },
      select: { order: true, name: true },
    });
    const nextOrder =
      existing.reduce((max, a) => Math.max(max, a.order), 0) + 1;
    const name = rawName !== "" ? rawName : `N${nextOrder}`;

    const activity = await db.activity.create({
      data: {
        institutionId,
        groupId,
        subjectId,
        periodId,
        evaluativeConceptId,
        name,
        isGeneral,
        order: nextOrder,
      },
      include: { evaluativeConcept: true },
    });

    return NextResponse.json({ ok: true, activity });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Ya existe una actividad con ese nombre en este periodo" },
        { status: 409 }
      );
    }
    console.error("[activities.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
