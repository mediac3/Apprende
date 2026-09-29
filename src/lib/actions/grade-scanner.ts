"use server";

import { db } from "@/lib/db";
import { canUserEditGrades, getActiveYear, getActiveStudentsOfGroup } from "@/lib/teaching-rules";

// === [F2] Scanner Wizard: registro de notas detectadas (FASE 9, creada en FASE 7) ===
// Reglas duras: rango 0.0–5.0, estudiante matriculado en el grupo, permisos de
// docente asignado (o rol elevado), periodo abierto, transacción atómica y
// snapshot previo para deshacer. Todo con Prisma parametrizado.

export interface ScannedGradeInput {
  studentId: string;
  activityId: string;
  value: number;
}

export interface ScanSnapshotEntry {
  studentId: string;
  activityId: string;
  prevValue: number | null; // null = no existía registro
}

export interface RegisterScannedInput {
  userId: string;
  institutionId: string;
  groupId: string;
  subjectId: string;
  periodId: string;
  grades: ScannedGradeInput[];
}

export interface RegisterScannedResult {
  success: boolean;
  error?: string;
  registered?: number;
  snapshot?: ScanSnapshotEntry[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const MAX_GRADES = 5000;
const MAX_SNAPSHOT = 5000;

export async function registerScannedGrades(
  input: RegisterScannedInput
): Promise<RegisterScannedResult> {
  try {
    const { userId, institutionId, groupId, subjectId, periodId } = input;
    const grades = input.grades ?? [];
    if (!userId || !institutionId || !groupId || !subjectId || !periodId) {
      return { success: false, error: "Faltan datos de contexto." };
    }
    if (grades.length === 0) {
      return { success: false, error: "No hay notas para registrar." };
    }
    if (grades.length > MAX_GRADES) {
      return { success: false, error: "Demasiadas notas en un solo registro." };
    }

    // Regla dura: rango 0.0–5.0 y deduplicación (última edición gana).
    const clean = new Map<string, ScannedGradeInput>();
    for (const g of grades) {
      if (!g?.studentId || !g?.activityId) {
        return { success: false, error: "Registro sin studentId/activityId." };
      }
      const v = typeof g.value === "number" ? g.value : Number(g.value);
      if (!Number.isFinite(v) || v < 0 || v > 5) {
        return { success: false, error: `Nota fuera de rango (0.0–5.0): ${String(g.value)}` };
      }
      clean.set(`${g.studentId}:${g.activityId}`, { studentId: g.studentId, activityId: g.activityId, value: round1(v) });
    }
    const list = Array.from(clean.values());

    // Regla dura: estudiante matriculado/activo en el grupo (año activo).
    const activeAy = await db.academicYear.findFirst({
      where: { institutionId, active: true },
      select: { id: true, year: true },
    });
    const enrollments = await getActiveStudentsOfGroup(groupId, activeAy?.id ?? "");
    const validStudentIds = new Set(enrollments.map((e) => e.studentId));
    for (const g of list) {
      if (!validStudentIds.has(g.studentId)) {
        return { success: false, error: "Hay notas de estudiantes no matriculados en el grupo." };
      }
    }

    // Regla dura: solo actividades del contexto (grupo, asignatura, periodo) y periodo abierto.
    const activityIds = Array.from(new Set(list.map((g) => g.activityId)));
    const acts = await db.activity.findMany({
      where: { id: { in: activityIds }, groupId, subjectId, periodId },
      select: { id: true, period: { select: { closed: true } } },
    });
    const validActivityIds = new Set<string>();
    for (const a of acts) {
      if (a.period.closed) {
        return { success: false, error: "El periodo está cerrado: no se pueden registrar notas." };
      }
      validActivityIds.add(a.id);
    }
    for (const g of list) {
      if (!validActivityIds.has(g.activityId)) {
        return { success: false, error: "Hay actividades que no pertenecen al grupo/asignatura/periodo." };
      }
    }

    // Permisos: docente asignado o rol elevado.
    const year = await getActiveYear(institutionId);
    const allowed = await canUserEditGrades(userId, groupId, subjectId, year);
    if (!allowed) {
      return { success: false, error: "Solo el docente asignado puede registrar notas de este grupo." };
    }

    // Snapshot previo (para deshacer) + upsert atómico.
    const keys = list.map((g) => ({ studentId: g.studentId, activityId: g.activityId }));
    const existing = await db.gradeRecord.findMany({
      where: { OR: keys },
      select: { studentId: true, activityId: true, value: true },
    });
    const prevMap = new Map(existing.map((e) => [`${e.studentId}:${e.activityId}`, e.value]));
    const snapshot: ScanSnapshotEntry[] = list.map((g) => ({
      studentId: g.studentId,
      activityId: g.activityId,
      prevValue: prevMap.get(`${g.studentId}:${g.activityId}`) ?? null,
    }));

    await db.$transaction(async (tx) => {
      for (const g of list) {
        await tx.gradeRecord.upsert({
          where: { studentId_activityId: { studentId: g.studentId, activityId: g.activityId } },
          create: { studentId: g.studentId, activityId: g.activityId, value: g.value },
          update: { value: g.value },
        });
      }
    });

    return { success: true, registered: list.length, snapshot };
  } catch (error) {
    console.error("[grade-scanner] register error:", error instanceof Error ? error.message : error);
    return { success: false, error: "No se pudieron registrar las notas." };
  }
}

export interface UndoScannedInput {
  userId: string;
  institutionId: string;
  groupId: string;
  subjectId: string;
  snapshot: ScanSnapshotEntry[];
}

export async function undoScannedGrades(input: UndoScannedInput): Promise<{ success: boolean; error?: string; restored?: number }> {
  try {
    const { userId, institutionId, groupId, subjectId } = input;
    const snapshot = input.snapshot ?? [];
    if (!userId || !groupId || !subjectId) return { success: false, error: "Faltan datos de contexto." };
    if (snapshot.length === 0) return { success: true, restored: 0 };
    if (snapshot.length > MAX_SNAPSHOT) return { success: false, error: "Snapshot demasiado grande." };

    const year = await getActiveYear(institutionId);
    const allowed = await canUserEditGrades(userId, groupId, subjectId, year);
    if (!allowed) return { success: false, error: "Sin permisos para deshacer." };

    await db.$transaction(async (tx) => {
      for (const s of snapshot) {
        if (s.prevValue === null) {
          await tx.gradeRecord.deleteMany({
            where: { studentId: s.studentId, activityId: s.activityId },
          });
        } else {
          await tx.gradeRecord.upsert({
            where: { studentId_activityId: { studentId: s.studentId, activityId: s.activityId } },
            create: { studentId: s.studentId, activityId: s.activityId, value: s.prevValue },
            update: { value: s.prevValue },
          });
        }
      }
    });
    return { success: true, restored: snapshot.length };
  } catch (error) {
    console.error("[grade-scanner] undo error:", error instanceof Error ? error.message : error);
    return { success: false, error: "No se pudo deshacer." };
  }
}
