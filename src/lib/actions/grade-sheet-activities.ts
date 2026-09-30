"use server";

import { db } from "@/lib/db";
import { canUserEditGrades, getActiveYear } from "@/lib/teaching-rules";

// === [F1] Creación de actividades nuevas desde el generador de planillas ===
// El docente define cuántas actividades quiere por concepto; las que falten se
// crean reales en la BD (misma regla que el import wizard) para que el scanner
// pueda registrar TODAS las celdas impresas. Prisma parametrizado.

const ALLOWED_ROLES = ["docente", "director_grupo", "coordinador", "rector"];
const ELEVATED_ROLES = ["director_grupo", "coordinador", "rector"];
const MAX_PER_CONCEPT = 10; // N1..N10 según boceto
const MAX_TOTAL = 40;

export interface CreateSheetActivitiesInput {
  userId: string;
  institutionId: string;
  groupId: string;
  subjectId: string;
  periodId: string;
  /** Cantidad NUEVAS a crear por concepto (0 = no crear) */
  perConcept: Array<{ conceptId: string; count: number }>;
}

export interface CreatedActivityInfo {
  conceptId: string;
  activityId: string;
  order: number;
  name: string;
}

export interface CreateSheetActivitiesResult {
  success: boolean;
  error?: string;
  created?: CreatedActivityInfo[];
}

async function assertEditPermission(userId: string, groupId: string, subjectId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    throw new Error("Sin permisos para crear actividades.");
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

export async function createSheetActivities(
  input: CreateSheetActivitiesInput
): Promise<CreateSheetActivitiesResult> {
  try {
    const { userId, institutionId, groupId, subjectId, periodId } = input;
    const perConcept = (input.perConcept ?? []).filter((p) => p.count > 0);
    if (!userId || !institutionId || !groupId || !subjectId || !periodId) {
      return { success: false, error: "Faltan datos de contexto." };
    }
    if (perConcept.length === 0) return { success: true, created: [] };
    if (perConcept.some((p) => p.count > MAX_PER_CONCEPT)) {
      return { success: false, error: `Máximo ${MAX_PER_CONCEPT} actividades nuevas por concepto.` };
    }
    if (perConcept.reduce((a, p) => a + p.count, 0) > MAX_TOTAL) {
      return { success: false, error: `Máximo ${MAX_TOTAL} actividades nuevas en total.` };
    }

    await assertEditPermission(userId, groupId, subjectId);

    // El periodo debe estar abierto para crear actividades.
    const period = await db.period.findFirst({
      where: { id: periodId, institutionId },
      select: { closed: true },
    });
    if (!period) return { success: false, error: "El periodo no existe." };
    if (period.closed) return { success: false, error: "El periodo está cerrado: no se pueden crear actividades." };

    // Los conceptos deben pertenecer a la institución.
    const conceptIds = perConcept.map((p) => p.conceptId);
    const concepts = await db.evaluativeConcept.findMany({
      where: { id: { in: conceptIds }, institutionId },
      select: { id: true },
    });
    const validConcepts = new Set(concepts.map((c) => c.id));
    if (conceptIds.some((id) => !validConcepts.has(id))) {
      return { success: false, error: "Hay conceptos que no pertenecen a la institución." };
    }

    const groupRow = await db.group.findUnique({
      where: { id: groupId },
      select: { institutionId: true },
    });
    if (!groupRow) return { success: false, error: "El grupo no existe." };

    const created: CreatedActivityInfo[] = [];
    await db.$transaction(async (tx) => {
      let order =
        (
          await tx.activity.aggregate({
            where: { groupId, subjectId, periodId },
            _max: { order: true },
          }).then((r) => r._max.order ?? 0)
        ) + 1;
      for (const p of perConcept) {
        for (let i = 0; i < p.count; i++) {
          const row = await tx.activity.create({
            data: {
              institutionId: groupRow.institutionId,
              groupId,
              subjectId,
              periodId,
              evaluativeConceptId: p.conceptId,
              name: `Actividad N${order}`,
              label: null,
              isGeneral: false,
              order,
            },
            select: { id: true, order: true, name: true },
          });
          created.push({ conceptId: p.conceptId, activityId: row.id, order: row.order, name: row.name });
          order += 1;
        }
      }
    });

    return { success: true, created };
  } catch (error) {
    console.error("[grade-sheet-activities] error:", error instanceof Error ? error.message : error);
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron crear las actividades." };
  }
}

// Año activo disponible por si se requiere validar contra canUserEditGrades
// con firma (userId, groupId, subjectId, year) en integraciones futuras.
export async function assertSheetEditAllowed(
  userId: string,
  institutionId: string,
  groupId: string,
  subjectId: string
): Promise<boolean> {
  const year = await getActiveYear(institutionId);
  return canUserEditGrades(userId, groupId, subjectId, year);
}
