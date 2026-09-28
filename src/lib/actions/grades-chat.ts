"use server";

// Server actions del asistente de notas (chat voz/texto).
// Reglas duras: transacción atómica, rango 0.0–5.0, solo estudiantes matriculados
// en el grupo activo, permisos resueltos en el servidor (rol desde BD, no del cliente).
// Consultas 100% parametrizadas vía Prisma.

import { db } from "@/lib/db";
import type { ApplyChangesResult, GradeChange } from "@/lib/nlu/types";

const ALLOWED_ROLES = ["docente", "director_grupo", "coordinador", "rector"];
const ELEVATED_ROLES = ["director_grupo", "coordinador", "rector"];

export type ApplyGradeInput = {
  userId: string;
  studentIds: string[];
  activityIds: string[];
  value: number;
};

// Igual que la planilla manual (decisión 2/10): los 4 roles del módulo pueden escribir;
// para docente se exige asignación (SubjectAssignment) o dirección de grupo.
async function assertPermission(userId: string, groupId: string, subjectId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    throw new Error("Sin permisos para registrar notas.");
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

export async function applyGradeChanges(input: ApplyGradeInput): Promise<ApplyChangesResult> {
  try {
    const { userId, studentIds, activityIds, value } = input;
    if (!userId) return { success: false, error: "Sesión no válida." };
    if (studentIds.length === 0 || activityIds.length === 0) {
      return { success: false, error: "No hay estudiantes o actividades para aplicar." };
    }
    if (typeof value !== "number" || isNaN(value) || value < 0 || value > 5) {
      return { success: false, error: "La nota debe estar entre 0.0 y 5.0." };
    }

    // Actividades → grupo/asignatura únicos.
    const activities = await db.activity.findMany({
      where: { id: { in: activityIds } },
      select: { id: true, groupId: true, subjectId: true },
    });
    if (activities.length !== activityIds.length) {
      return { success: false, error: "Alguna actividad no existe. No se aplicó ningún cambio." };
    }
    const groupIds = [...new Set(activities.map((a) => a.groupId))];
    const subjectIds = [...new Set(activities.map((a) => a.subjectId))];
    if (groupIds.length !== 1 || subjectIds.length !== 1) {
      return {
        success: false,
        error: "Las actividades deben pertenecer al mismo grupo y asignatura.",
      };
    }

    await assertPermission(userId, groupIds[0], subjectIds[0]);

    // Matrícula: todos los estudiantes deben estar en el grupo activo.
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, groupId: true },
    });
    if (
      students.length !== studentIds.length ||
      students.some((s) => s.groupId !== groupIds[0])
    ) {
      return {
        success: false,
        error:
          "Hay estudiantes que no están matriculados en el grupo activo. No se aplicó ningún cambio.",
      };
    }

    // Snapshot previo + upserts, todo en UNA transacción atómica (sin cambios parciales).
    const changes: GradeChange[] = await db.$transaction(async (tx) => {
      const existing = await tx.gradeRecord.findMany({
        where: { studentId: { in: studentIds }, activityId: { in: activityIds } },
        select: { studentId: true, activityId: true, value: true },
      });
      const beforeMap = new Map(existing.map((r) => [`${r.studentId}::${r.activityId}`, r.value]));

      const pending: GradeChange[] = [];
      for (const studentId of studentIds) {
        for (const activityId of activityIds) {
          const before = beforeMap.get(`${studentId}::${activityId}`) ?? null;
          if (before === value) continue; // celda sin cambio real
          pending.push({ studentId, activityId, before, after: value });
        }
      }
      // Secuencial dentro de la transacción (SQLite, una escritura a la vez).
      for (const c of pending) {
        await tx.gradeRecord.upsert({
          where: { studentId_activityId: { studentId: c.studentId, activityId: c.activityId } },
          create: { studentId: c.studentId, activityId: c.activityId, value: c.after },
          update: { value: c.after },
        });
      }
      return pending;
    });

    return { success: true, updated: changes.length, changes };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error inesperado al aplicar los cambios. No se modificó nada.",
    };
  }
}

export async function undoGradeChanges(
  changes: GradeChange[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!changes || changes.length === 0) {
      return { success: false, error: "No hay cambios para deshacer." };
    }
    // Transacción inversa: restaurar valor previo o eliminar el registro creado.
    await db.$transaction(async (tx) => {
      for (const c of changes) {
        if (c.before === null) {
          await tx.gradeRecord.deleteMany({
            where: { studentId: c.studentId, activityId: c.activityId },
          });
        } else {
          await tx.gradeRecord.update({
            where: {
              studentId_activityId: { studentId: c.studentId, activityId: c.activityId },
            },
            data: { value: c.before },
          });
        }
      }
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error inesperado al deshacer los cambios.",
    };
  }
}
