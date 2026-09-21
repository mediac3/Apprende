import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// === Módulo Calificaciones: actividades evaluativas (sub-columnas N1, N2...) ===
// Toda consulta usa el cliente Prisma (consultas parametrizadas).

// GET /api/activities?groupId=&subjectId=&periodId= → actividades del
// grupo+asignatura+periodo, con su concepto, ordenadas por order
// GET /api/activities?institutionId=&periodId= (sin grupo/asignatura) →
// listado institucional para "Gestión de Actividades": incluye grupo,
// asignatura, concepto y conteo de notas por actividad.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const subjectId = searchParams.get("subjectId");
  const periodId = searchParams.get("periodId");
  const institutionId = searchParams.get("institutionId");

  if (groupId && subjectId && periodId) {
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

  if (institutionId && periodId) {
    try {
      const [activities, studentCounts] = await Promise.all([
        db.activity.findMany({
          where: { institutionId, periodId },
          include: {
            evaluativeConcept: true,
            group: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            _count: { select: { records: true } },
          },
          orderBy: [
            { group: { name: "asc" } },
            { subject: { name: "asc" } },
            { evaluativeConcept: { order: "asc" } },
            { order: "asc" },
          ],
        }),
        db.student.groupBy({
          by: ["groupId"],
          where: { institutionId, status: "activo" },
          _count: { _all: true },
        }),
      ]);
      const countsByGroup: Record<string, number> = {};
      for (const g of studentCounts) {
        if (g.groupId) countsByGroup[g.groupId] = g._count._all;
      }
      return NextResponse.json({ ok: true, activities, countsByGroup });
    } catch (e) {
      console.error("[activities.listInstitution]", e);
      return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { ok: false, error: "groupId+subjectId+periodId o institutionId+periodId requeridos" },
    { status: 400 }
  );
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

// PUT /api/activities → editar actividad (nombre, concepto y/o Act. General)
// Body: { id, name?, evaluativeConceptId?, isGeneral? }
// Reglas: el periodo no debe estar cerrado; el concepto debe pertenecer a la
// misma institución. Si cambia de concepto, la actividad pasa al final del
// orden del concepto destino.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
    }

    const activity = await db.activity.findUnique({
      where: { id },
      include: { period: true },
    });
    if (!activity) {
      return NextResponse.json({ ok: false, error: "Actividad no encontrada" }, { status: 404 });
    }
    if (activity.period.closed) {
      return NextResponse.json({ ok: false, error: "El periodo está cerrado" }, { status: 409 });
    }

    const data: { name?: string; isGeneral?: boolean; evaluativeConceptId?: string; order?: number } = {};

    if (typeof body.name === "string" && body.name.trim() !== "") {
      const name = body.name.trim();
      if (name.length > 60) {
        return NextResponse.json({ ok: false, error: "Nombre demasiado largo (máx. 60)" }, { status: 400 });
      }
      data.name = name;
    }

    if (typeof body.isGeneral === "boolean") {
      data.isGeneral = body.isGeneral;
    }

    if (
      typeof body.evaluativeConceptId === "string" &&
      body.evaluativeConceptId !== activity.evaluativeConceptId
    ) {
      const concept = await db.evaluativeConcept.findFirst({
        where: { id: body.evaluativeConceptId, institutionId: activity.institutionId },
      });
      if (!concept) {
        return NextResponse.json({ ok: false, error: "Concepto evaluativo no encontrado" }, { status: 404 });
      }
      data.evaluativeConceptId = concept.id;
      // Al mover de concepto, la actividad pasa al final del concepto destino
      const last = await db.activity.findFirst({
        where: {
          groupId: activity.groupId,
          subjectId: activity.subjectId,
          periodId: activity.periodId,
          evaluativeConceptId: concept.id,
        },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      data.order = (last?.order ?? 0) + 1;
    }

    const updated = await db.activity.update({
      where: { id },
      data,
      include: { evaluativeConcept: true },
    });
    return NextResponse.json({ ok: true, activity: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Ya existe una actividad con ese nombre en este periodo" },
        { status: 409 }
      );
    }
    console.error("[activities.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/activities?id=… (o ?ids=a,b,c para borrado masivo)
// Elimina la actividad y EN CASCADA sus notas (GradeRecord, onDelete: Cascade).
// El periodo no debe estar cerrado.
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") ?? searchParams.get("id") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "id o ids requerido" }, { status: 400 });
  }

  try {
    const activities = await db.activity.findMany({
      where: { id: { in: ids } },
      include: { period: { select: { closed: true } }, _count: { select: { records: true } } },
    });
    if (activities.length === 0) {
      return NextResponse.json({ ok: false, error: "Actividad(es) no encontrada(s)" }, { status: 404 });
    }
    if (activities.some((a) => a.period.closed)) {
      return NextResponse.json({ ok: false, error: "El periodo está cerrado" }, { status: 409 });
    }

    const recordsCount = activities.reduce((n, a) => n + a._count.records, 0);
    const deleted = await db.activity.deleteMany({ where: { id: { in: activities.map((a) => a.id) } } });
    return NextResponse.json({ ok: true, deleted: deleted.count, recordsDeleted: recordsCount });
  } catch (e) {
    console.error("[activities.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
