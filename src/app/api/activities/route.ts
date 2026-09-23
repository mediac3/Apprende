import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { canUserEditGrades, getActiveYear } from "@/lib/teaching-rules";

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

    // [R1] Solo el docente asignado al par (grupo, asignatura) o un rol elevado
    // puede crear actividades. userId es obligatorio en el body.
    const editorUserId = typeof body.userId === "string" ? body.userId : "";
    if (!editorUserId) {
      return NextResponse.json({ ok: false, error: "userId requerido" }, { status: 400 });
    }
    const year = await getActiveYear(institutionId);
    if (!(await canUserEditGrades(editorUserId, groupId, subjectId, year))) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Solo el docente asignado puede modificar las actividades de este grupo" },
        { status: 403 }
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
    const defaultName = `N${nextOrder}`;

    // [UX] Título por defecto POR CONCEPTO: cada concepto lleva su propia
    // secuencia N1, N2, N3… El nombre en DB debe ser único en el periodo;
    // si "N#" ya existe (otro concepto lo tomó), se genera un nombre interno
    // único ("N1 Saber") y el título visual (label) se mantiene en "N1".
    let name = defaultName;
    let label: string | null = null;
    if (rawName !== "") {
      // Nombre manual: lo escrito es a la vez nombre y título visual
      name = rawName;
      label = rawName;
    } else {
      const taken = await db.activity.findFirst({
        where: { groupId, subjectId, periodId, name: defaultName },
        select: { id: true },
      });
      if (taken) {
        label = defaultName;
        name = `${defaultName} ${concept.name}`;
        let suffix = 2;
        while (
          await db.activity.findFirst({
            where: { groupId, subjectId, periodId, name },
            select: { id: true },
          })
        ) {
          name = `${defaultName} ${concept.name} ${suffix}`;
          suffix++;
        }
      }
    }

    const activity = await db.activity.create({
      data: {
        institutionId,
        groupId,
        subjectId,
        periodId,
        evaluativeConceptId,
        name,
        label,
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
      include: { period: true, evaluativeConcept: true },
    });
    if (!activity) {
      return NextResponse.json({ ok: false, error: "Actividad no encontrada" }, { status: 404 });
    }
    if (activity.period.closed) {
      return NextResponse.json({ ok: false, error: "El periodo está cerrado" }, { status: 409 });
    }

    // [R1] Solo el docente asignado al par de la actividad (o rol elevado).
    const editorUserId = typeof body?.userId === "string" ? body.userId : "";
    if (!editorUserId) {
      return NextResponse.json({ ok: false, error: "userId requerido" }, { status: 400 });
    }
    const year = await getActiveYear(activity.institutionId);
    if (!(await canUserEditGrades(editorUserId, activity.groupId, activity.subjectId, year))) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Solo el docente asignado puede modificar las actividades de este grupo" },
        { status: 403 }
      );
    }

    const data: {
      name?: string;
      label?: string | null;
      isGeneral?: boolean;
      evaluativeConceptId?: string;
      order?: number;
    } = {};

    if (typeof body.name === "string" && body.name.trim() !== "") {
      const name = body.name.trim();
      if (name.length > 60) {
        return NextResponse.json({ ok: false, error: "Nombre demasiado largo (máx. 60)" }, { status: 400 });
      }
      // [UX] lo escrito es el título visual (label); el nombre interno se
      // mantiene único con fallback "… <concepto>" si hay colisión
      data.name = name;
      data.label = name;
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

    let updated;
    try {
      updated = await db.activity.update({
        where: { id },
        data,
        include: { evaluativeConcept: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && data.name) {
        // Colisión de nombre: nombre interno único, mismo título visual (label)
        const targetConceptId =
          (typeof data.evaluativeConceptId === "string" ? data.evaluativeConceptId : null) ??
          activity.evaluativeConceptId;
        const concept = await db.evaluativeConcept.findUnique({
          where: { id: targetConceptId },
          select: { name: true },
        });
        updated = await db.activity.update({
          where: { id },
          data: { ...data, name: `${data.name} ${concept?.name ?? ""}`.trim() },
          include: { evaluativeConcept: true },
        });
      } else {
        throw e;
      }
    }
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

    // [R1] El usuario debe poder editar TODOS los pares (grupo, asignatura) de las
    // actividades a borrar; si alguno se le escapa, no se borra ninguna.
    const editorUserId = searchParams.get("userId") ?? "";
    if (!editorUserId) {
      return NextResponse.json({ ok: false, error: "userId requerido" }, { status: 400 });
    }
    const year = await getActiveYear(activities[0].institutionId);
    const pairs = Array.from(new Set(activities.map((a) => `${a.groupId}:${a.subjectId}`)));
    const allowed = await Promise.all(
      pairs.map((p) => {
        const [groupId, subjectId] = p.split(":");
        return canUserEditGrades(editorUserId, groupId, subjectId, year);
      })
    );
    if (allowed.some((v) => !v)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Solo el docente asignado puede modificar las actividades de este grupo" },
        { status: 403 }
      );
    }

    const recordsCount = activities.reduce((n, a) => n + a._count.records, 0);
    const deleted = await db.activity.deleteMany({ where: { id: { in: activities.map((a) => a.id) } } });
    return NextResponse.json({ ok: true, deleted: deleted.count, recordsDeleted: recordsCount });
  } catch (e) {
    console.error("[activities.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
