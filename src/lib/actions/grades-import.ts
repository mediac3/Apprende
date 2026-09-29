"use server";

// Server actions del wizard de importación Excel (actividades + notas + asistencias).
// Misma política de permisos que grades-chat.ts (rol desde BD + asignación del docente).
// Transacción atómica: o se aplica todo el plan válido o no se aplica nada.
// Consultas 100% parametrizadas vía Prisma.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { normalizeText } from "@/lib/nlu/synonyms";
import type { ChatStudent } from "@/lib/nlu/types";
import type { ImportCell } from "@/components/panel/views/grades/import-wizard/xlsx-parse";

const ALLOWED_ROLES = ["docente", "director_grupo", "coordinador", "rector"];
const ELEVATED_ROLES = ["director_grupo", "coordinador", "rector"];

// Match ESTRICTO por tokens normalizados (sin fuzzy): una importación masiva con
// similitud difusa cruzó apellidos repetidos y asignó notas a estudiantes equivocados
// (incidente 10°A). Cualquier token distinto → sin match → fila omitida.
// Se ignoran anotaciones entre paréntesis del Excel, p. ej. "(BAP)".
function strictMatchStudent(
  name: string,
  students: ChatStudent[]
): { student: ChatStudent | null; reason: "none" | "ambiguous" } {
  const qTokens = normalizeText(name.replace(/\([^)]*\)/g, " "))
    .split(" ")
    .filter(Boolean)
    .sort();
  const hits = students.filter((s) => {
    const sTokens = normalizeText(
      [s.firstName, s.firstName2, s.lastName, s.lastName2].filter(Boolean).join(" ")
    )
      .split(" ")
      .filter(Boolean)
      .sort();
    return sTokens.length === qTokens.length && sTokens.every((t, i) => t === qTokens[i]);
  });
  if (hits.length === 1) return { student: hits[0], reason: "none" };
  return { student: null, reason: hits.length > 1 ? "ambiguous" : "none" };
}

export type ImportInput = {
  userId: string;
  groupId: string;
  subjectId: string;
  periodId: string;
  sheet: {
    columns: { concept: string; activityName: string; dateIso: string | null }[];
    rows: { name: string; cells: ImportCell[] }[];
  };
};

export type ImportPlan = {
  activities: {
    index: number;
    concept: string;
    activityName: string;
    conceptId: string | null;
    activityId: string | null; // null → se creará
    willCreate: boolean;
    error: string | null;
  }[];
  students: {
    name: string;
    studentId: string | null;
    matchedName: string | null;
  }[];
  warnings: string[];
  errors: string[];
};

export type ImportSummary = {
  activitiesCreated: number;
  activitiesReused: number;
  gradesUpserted: number;
  attendanceCreated: number;
  attendanceUpdated: number;
  skippedStudents: string[];
};

async function assertImportPermission(userId: string, groupId: string, subjectId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    throw new Error("Sin permisos para importar notas.");
  }
  if (ELEVATED_ROLES.includes(user.role)) return;
  const [assignment, isHeadTeacher] = await Promise.all([
    db.subjectAssignment.findFirst({ where: { teacherId: userId, groupId, subjectId }, select: { id: true } }),
    db.group.findFirst({ where: { id: groupId, headTeacherId: userId }, select: { id: true } }),
  ]);
  if (!assignment && !isHeadTeacher) {
    throw new Error("No eres el docente asignado a este grupo/asignatura.");
  }
}

function matchConcept(
  conceptName: string,
  concepts: { id: string; name: string }[]
): string | null {
  const norm = normalizeText(conceptName);
  const exact = concepts.find((c) => normalizeText(c.name) === norm);
  if (exact) return exact.id;
  // Fuzzy tolerante a tildes/errores (igual que el chat).
  let best: { id: string; score: number } | null = null;
  for (const c of concepts) {
    const cn = normalizeText(c.name);
    const score = 1 - levenshtein(norm, cn) / Math.max(norm.length, cn.length);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best && best.score >= 0.8 ? best.id : null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let lastDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, lastDiag + (a[i - 1] === b[j - 1] ? 0 : 1));
      lastDiag = temp;
    }
  }
  return prev[b.length];
}

// Resuelve conceptos, actividades (existente o por crear) y estudiantes del grupo.
async function resolvePlan(input: ImportInput): Promise<ImportPlan> {
  const plan: ImportPlan = { activities: [], students: [], warnings: [], errors: [] };

  const group = await db.group.findUnique({
    where: { id: input.groupId },
    select: { id: true, institutionId: true },
  });
  if (!group) {
    plan.errors.push("El grupo seleccionado no existe.");
    return plan;
  }

  await assertImportPermission(input.userId, input.groupId, input.subjectId);

  const [subject, period] = await Promise.all([
    db.subject.findUnique({ where: { id: input.subjectId }, select: { id: true } }),
    db.period.findUnique({ where: { id: input.periodId }, select: { id: true } }),
  ]);
  if (!subject) plan.errors.push("La asignatura seleccionada no existe.");
  if (!period) plan.errors.push("El periodo seleccionado no existe.");
  if (plan.errors.length) return plan;

  // Conceptos evaluativos de la institución (match por nombre normalizado).
  const conceptRows = await db.evaluativeConcept.findMany({
    where: { institutionId: group.institutionId },
    select: { id: true, name: true },
  });

  // Actividades existentes en el alcance (reutilización por nombre, @@unique).
  const existingActivities = await db.activity.findMany({
    where: { groupId: input.groupId, subjectId: input.subjectId, periodId: input.periodId },
    select: { id: true, name: true, evaluativeConceptId: true },
  });
  const maxOrder = await db.activity.aggregate({
    where: { groupId: input.groupId, subjectId: input.subjectId, periodId: input.periodId },
    _max: { order: true },
  });
  let nextOrder = (maxOrder._max.order ?? 0) + 1;

  for (const [index, col] of input.sheet.columns.entries()) {
    if (!col.concept || !col.activityName) {
      plan.activities.push({
        index, concept: col.concept, activityName: col.activityName,
        conceptId: null, activityId: null, willCreate: false,
        error: "Encabezado inválido.",
      });
      continue;
    }
    const conceptId = matchConcept(col.concept, conceptRows);
    if (!conceptId) {
      plan.activities.push({
        index, concept: col.concept, activityName: col.activityName,
        conceptId: null, activityId: null, willCreate: false,
        error: `El concepto evaluativo "${col.concept}" no existe en la institución.`,
      });
      continue;
    }
    const normName = normalizeText(col.activityName);
    const existing = existingActivities.find((a) => normalizeText(a.name) === normName);
    if (existing) {
      const conceptNote =
        existing.evaluativeConceptId !== conceptId
          ? ` (ojo: ya existía con otro concepto; se reutiliza por nombre)`
          : "";
      plan.activities.push({
        index, concept: col.concept, activityName: col.activityName,
        conceptId: existing.evaluativeConceptId, activityId: existing.id,
        willCreate: false, error: null,
      });
      if (conceptNote) plan.warnings.push(`Actividad "${col.activityName}"${conceptNote}.`);
    } else {
      plan.activities.push({
        index, concept: col.concept, activityName: col.activityName,
        conceptId, activityId: null, willCreate: true, error: null,
      });
      existingActivities.push({
        id: `new-${index}`,
        name: col.activityName,
        evaluativeConceptId: conceptId,
      });
      nextOrder += 1;
    }
  }

  // Estudiantes matriculados en el grupo + matching difuso por nombre.
  const studentRows = await db.student.findMany({
    where: { groupId: input.groupId },
    select: { id: true, firstName: true, firstName2: true, lastName: true, lastName2: true },
  });
  const chatStudents: ChatStudent[] = studentRows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    firstName2: s.firstName2,
    lastName: s.lastName,
    lastName2: s.lastName2,
  }));
  for (const row of input.sheet.rows) {
    const match = strictMatchStudent(row.name, chatStudents);
    if (match.student) {
      const hit = match.student;
      plan.students.push({
        name: row.name,
        studentId: hit.id,
        matchedName: [hit.firstName, hit.firstName2, hit.lastName, hit.lastName2]
          .filter(Boolean)
          .join(" "),
      });
    } else if (match.reason === "ambiguous") {
      plan.students.push({ name: row.name, studentId: null, matchedName: null });
      plan.warnings.push(
        `"${row.name}" coincide con más de un estudiante del grupo; se omite su fila.`
      );
    } else {
      plan.students.push({ name: row.name, studentId: null, matchedName: null });
      plan.warnings.push(
        `"${row.name}" no coincide exactamente con ningún estudiante del grupo; se omite su fila.`
      );
    }
  }

  return plan;
}

async function resolvePlanOrFail(input: ImportInput): Promise<ImportPlan> {
  const plan = await resolvePlan(input);
  if (plan.errors.length) throw new Error(plan.errors.join(" "));
  const badColumns = plan.activities.filter((a) => a.error);
  if (badColumns.length) {
    throw new Error(
      `No se puede aplicar: ${badColumns.map((a) => a.error).join(" ")}`
    );
  }
  const unmatched = plan.students.filter((s) => !s.studentId);
  if (unmatched.length > 0) {
    // Bloqueo duro (decisión post-incidente): no aplicar si hay filas sin reconocer.
    throw new Error(
      `No se aplica: ${unmatched.length} fila(s) sin reconocer (${unmatched
        .slice(0, 5)
        .map((s) => s.name)
        .join(", ")}${unmatched.length > 5 ? "…" : ""}). Corrige el Excel o verifica el grupo seleccionado.`
    );
  }
  return plan;
}

// Preview: resuelve el plan sin escribir nada.
export async function previewGradeImport(
  input: ImportInput
): Promise<{ success: boolean; error?: string; plan?: ImportPlan }> {
  try {
    const plan = await resolvePlan(input);
    return { success: true, plan };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error en el preview." };
  }
}

function validIso(iso: string | null | undefined): iso is string {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

// Aplica el plan resuelto en UNA transacción atómica.
export async function applyGradeImport(
  input: ImportInput
): Promise<{ success: boolean; error?: string; summary?: ImportSummary }> {
  try {
    const plan = await resolvePlanOrFail(input);
    const summary: ImportSummary = {
      activitiesCreated: 0,
      activitiesReused: 0,
      gradesUpserted: 0,
      attendanceCreated: 0,
      attendanceUpdated: 0,
      skippedStudents: plan.students.filter((s) => !s.studentId).map((s) => s.name),
    };

    await db.$transaction(async (tx) => {
      // 1) Crear actividades nuevas (orden secuencial dentro del alcance).
      const groupRow = await tx.group.findUnique({
        where: { id: input.groupId },
        select: { institutionId: true },
      });
      if (!groupRow) throw new Error("El grupo seleccionado no existe.");
      const columnToActivityId = new Map<number, string>();
      let createOrder =
        (
          await tx.activity.aggregate({
            where: { groupId: input.groupId, subjectId: input.subjectId, periodId: input.periodId },
            _max: { order: true },
          }).then((r) => r._max.order ?? 0)
        ) + 1;
      for (const col of plan.activities) {
        if (col.error || !col.conceptId) continue;
        if (col.activityId) {
          columnToActivityId.set(col.index, col.activityId);
          summary.activitiesReused += 1;
          continue;
        }
        const created = await tx.activity.create({
          data: {
            institutionId: groupRow.institutionId,
            groupId: input.groupId,
            subjectId: input.subjectId,
            periodId: input.periodId,
            evaluativeConceptId: col.conceptId,
            name: col.activityName,
            label: null,
            isGeneral: false,
            order: createOrder++,
          },
          select: { id: true },
        });
        columnToActivityId.set(col.index, created.id);
        summary.activitiesCreated += 1;
      }

      // 2) Celdas → GradeRecord y/o Attendance.
      for (const [rowIdx, row] of input.sheet.rows.entries()) {
        const studentId = plan.students[rowIdx]?.studentId;
        if (!studentId) continue; // fila omitida (sin match)
        for (const [colIdx, cell] of row.cells.entries()) {
          const activityId = columnToActivityId.get(colIdx);
          await applyCell(tx, studentId, activityId ?? null, input.userId, input.groupId, cell, summary);
        }
      }
    });

    return { success: true, summary };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error inesperado al importar. No se aplicó nada.",
    };
  }
}

type Tx = Prisma.TransactionClient;

async function applyCell(
  tx: Tx,
  studentId: string,
  activityId: string | null,
  userId: string,
  groupId: string,
  cell: ImportCell,
  summary: ImportSummary
) {
  switch (cell.kind) {
    case "empty":
    case "invalid":
      return;
    case "grade": {
      if (!activityId) return;
      await tx.gradeRecord.upsert({
        where: { studentId_activityId: { studentId, activityId } },
        create: { studentId, activityId, value: cell.value },
        update: { value: cell.value },
      });
      summary.gradesUpserted += 1;
      return;
    }
    case "late_with_grade": {
      if (activityId) {
        await tx.gradeRecord.upsert({
          where: { studentId_activityId: { studentId, activityId } },
          create: { studentId, activityId, value: cell.grade },
          update: { value: cell.grade },
        });
        summary.gradesUpserted += 1;
      }
      if (validIso(cell.dateIso)) {
        await upsertAttendance(tx, studentId, groupId, userId, "tarde", cell.dateIso, summary);
      }
      return;
    }
    case "present": {
      await upsertAttendance(tx, studentId, groupId, userId, "presente", cell.dateIso, summary);
      return;
    }
    case "attendance": {
      if (!validIso(cell.dateIso)) return; // sin fecha (columna sin fecha) → solo aviso del preview
      await upsertAttendance(tx, studentId, groupId, userId, cell.status, cell.dateIso, summary);
      return;
    }
  }
}

async function upsertAttendance(
  tx: Tx,
  studentId: string,
  groupId: string,
  userId: string,
  status: "presente" | "ausente" | "tarde" | "excusa",
  dateIso: string,
  summary: ImportSummary
) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const existing = await tx.attendance.findFirst({
    where: { studentId, date },
    select: { id: true },
  });
  if (existing) {
    await tx.attendance.update({
      where: { id: existing.id },
      data: { status, groupId, excuseReason: status === "excusa" ? "Excusa (importación Excel)" : null },
    });
    summary.attendanceUpdated += 1;
    return;
  }
  await tx.attendance.create({
    data: {
      studentId,
      groupId,
      date,
      status,
      excuseReason: status === "excusa" ? "Excusa (importación Excel)" : null,
      recordedById: userId,
    },
  });
  summary.attendanceCreated += 1;
}
