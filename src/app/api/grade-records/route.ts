import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canUserEditGrades, getActiveYear } from "@/lib/teaching-rules";

// === Módulo Calificaciones: notas (GradeRecord) ===
// Toda consulta usa el cliente Prisma (consultas parametrizadas).
// PROM / DEF / conceptAvg NO se persisten: se calculan al vuelo.

// GET /api/grade-records?groupId=&subjectId=&periodId=
// → datos completos de la planilla: estudiantes del grupo, actividades
//   (con concepto) y registros de notas.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const subjectId = searchParams.get("subjectId");
  const periodId = searchParams.get("periodId");
  const userId = searchParams.get("userId") ?? "";

  if (!groupId || !subjectId || !periodId) {
    return NextResponse.json(
      { ok: false, error: "groupId, subjectId y periodId requeridos" },
      { status: 400 }
    );
  }

  try {
    const [students, activities, records, group] = await Promise.all([
      db.student.findMany({
        where: { groupId, status: "activo" },
        select: { id: true, code: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.activity.findMany({
        where: { groupId, subjectId, periodId },
        include: { evaluativeConcept: true },
        orderBy: [{ evaluativeConcept: { order: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
      }),
      db.gradeRecord.findMany({
        where: { activity: { groupId, subjectId, periodId } },
        select: { studentId: true, activityId: true, value: true },
      }),
      db.group.findUnique({ where: { id: groupId }, select: { institutionId: true } }),
    ]);
    // [R1] El cliente resuelve canEdit para pintar la planilla en solo lectura;
    // la validación real se hace en el POST al guardar.
    const canEdit = userId && group
      ? await canUserEditGrades(userId, groupId, subjectId, await getActiveYear(group.institutionId))
      : false;
    return NextResponse.json({ ok: true, students, activities, records, canEdit });
  } catch (e) {
    console.error("[grade-records.sheet]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST /api/grade-records → guardado en lote (transacción)
// Body: { records: [{ studentId, activityId, value: number | null }] }
// value null o ausente = limpiar la celda (se elimina el registro).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: Array<{ studentId?: unknown; activityId?: unknown; value?: unknown }> =
      Array.isArray(body?.records) ? body.records : [];

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "records requerido" }, { status: 400 });
    }

    // Validación de rango 0.0 - 5.0 y tipado
    const toSave: { studentId: string; activityId: string; value: number }[] = [];
    const toDelete: { studentId: string; activityId: string }[] = [];
    for (const it of items) {
      const studentId = typeof it.studentId === "string" ? it.studentId : "";
      const activityId = typeof it.activityId === "string" ? it.activityId : "";
      if (!studentId || !activityId) {
        return NextResponse.json(
          { ok: false, error: "studentId y activityId requeridos por registro" },
          { status: 400 }
        );
      }
      if (it.value === null || it.value === undefined || it.value === "") {
        toDelete.push({ studentId, activityId });
        continue;
      }
      const value = typeof it.value === "number" ? it.value : Number(it.value);
      if (isNaN(value) || value < 0 || value > 5) {
        return NextResponse.json(
          { ok: false, error: `Nota fuera de rango (0.0 - 5.0): ${String(it.value)}` },
          { status: 400 }
        );
      }
      toSave.push({ studentId, activityId, value: Math.round(value * 10) / 10 });
    }

    // El periodo de las actividades no debe estar cerrado
    const first = await db.activity.findFirst({
      where: { id: toSave[0]?.activityId ?? toDelete[0]?.activityId ?? "" },
      select: { institutionId: true, period: { select: { closed: true } } },
    });
    if (first?.period.closed) {
      return NextResponse.json({ ok: false, error: "El periodo está cerrado" }, { status: 409 });
    }

    // [R1] Solo el docente asignado al par (grupo, asignatura) de CADA actividad
    // del lote (o un rol elevado) puede guardar. userId es obligatorio en el body.
    const editorUserId = typeof body?.userId === "string" ? body.userId : "";
    if (!editorUserId) {
      return NextResponse.json({ ok: false, error: "userId requerido" }, { status: 400 });
    }
    if (first) {
      const activityIds = Array.from(
        new Set([...toSave.map((s) => s.activityId), ...toDelete.map((d) => d.activityId)])
      );
      const acts = await db.activity.findMany({
        where: { id: { in: activityIds } },
        select: { groupId: true, subjectId: true },
      });
      const year = await getActiveYear(first.institutionId);
      const pairs = Array.from(new Set(acts.map((a) => `${a.groupId}:${a.subjectId}`)));
      const allowed = await Promise.all(
        pairs.map((p) => {
          const [g, s] = p.split(":");
          return canUserEditGrades(editorUserId, g, s, year);
        })
      );
      if (allowed.some((v) => !v)) {
        return NextResponse.json(
          { ok: false, error: "FORBIDDEN", message: "Solo el docente asignado puede modificar las notas de este grupo" },
          { status: 403 }
        );
      }
    }

    await db.$transaction(async (tx) => {
      for (const d of toDelete) {
        await tx.gradeRecord.deleteMany({
          where: { studentId: d.studentId, activityId: d.activityId },
        });
      }
      for (const s of toSave) {
        await tx.gradeRecord.upsert({
          where: { studentId_activityId: { studentId: s.studentId, activityId: s.activityId } },
          create: s,
          update: { value: s.value },
        });
      }
    });

    return NextResponse.json({ ok: true, saved: toSave.length, deleted: toDelete.length });
  } catch (e) {
    console.error("[grade-records.save]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
