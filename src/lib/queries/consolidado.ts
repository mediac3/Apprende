import { db } from "@/lib/db";
import { getActiveStudentsOfGroup } from "@/lib/teaching-rules";

// === [F2] Consolidado anual: query agregada (sin N+1) ===
// Fuente de asignaturas: Plan de estudios del grado (CurriculumPlanItem), igual
// que la vista Plan de estudios. Fuente de estudiantes: getActiveStudentsOfGroup
// (invariante [R2] de teaching-rules). Fórmula DEF replicada de
// use-grades-calculations.ts (módulo "use client", no importable desde servidor):
// DEF = Σ(conceptAvg × %concepto) renormalizado sobre conceptos con notas.
// DEF final = Σ(DEF_periodo × peso_periodo) renormalizado (Period.weight).
// Los cálculos internos usan precisión completa; se redondea a 1 decimal
// solo en la salida (mismo criterio que round1 del módulo Calificaciones).

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface ConsolidadoSubject {
  id: string;
  name: string;
  abbreviation: string | null;
  areaName: string | null;
  areaAbbreviation: string | null;
  percentage: number; // % dentro del área (Subject.percentage)
  averages: boolean; // si false no entra al promedio (ej. Comportamiento)
}

export interface ConsolidadoPeriod {
  id: string;
  name: string;
  order: number | null;
  weight: number;
}

export interface ConsolidadoStudentRow {
  id: string;
  fullName: string;
  code: string;
  /** DEF por asignatura × periodo (crudo redondeado a 1 decimal) */
  def: Record<string, Record<string, number | null>>;
  /** DEF final por asignatura (ponderada por peso de periodos) */
  defFinal: Record<string, number | null>;
  /** Promedio del estudiante en cada periodo (ponderado por % asignatura) */
  promPeriod: Record<string, number | null>;
  promFinal: number | null;
  /** asignaturas (averages=true) con DEF final < umbral */
  dbj: number;
  /** inasistencias (status "ausente") del año en el grupo */
  inas: number;
  /** puesto dentro del grupo por promedio final (1 = mejor) */
  pt: number | null;
  estado: "promovido" | "no_promovido" | "sin_datos";
  /** false si a algún (asignatura, periodo) del grupo le faltan notas propias */
  defCompleta: boolean;
}

export interface ConsolidadoResult {
  group: {
    id: string;
    name: string;
    gradeLevelName: string | null;
    gradeLevelCode: string | null;
    year: number | null;
    institutionName: string;
    branchName: string | null;
  };
  umbral: number;
  periods: ConsolidadoPeriod[];
  subjects: ConsolidadoSubject[];
  students: ConsolidadoStudentRow[];
  /** resumen por asignatura: Prom (promedio del grupo) y NM (nivel mínimo) */
  resumen: Record<string, { prom: number | null; nm: number | null }>;
}

export async function getConsolidadoAnual(params: {
  groupId: string;
  /** incluir sólo periodos con order <= hastaOrder (vista acumulada) */
  hastaOrder?: number;
}): Promise<ConsolidadoResult | null> {
  const { groupId, hastaOrder } = params;

  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      gradeLevelId: true,
      academicYearId: true,
      gradeLevel: { select: { name: true, code: true } },
      academicYear: { select: { year: true } },
      branch: { select: { name: true } },
      institution: { select: { id: true, name: true } },
    },
  });
  if (!group) return null;

  // Año académico efectivo (fallback: año activo de la institución)
  let academicYearId = group.academicYearId;
  if (!academicYearId) {
    const ay = await db.academicYear.findFirst({
      where: { institutionId: group.institution.id, active: true },
      select: { id: true },
    });
    academicYearId = ay?.id ?? null;
  }

  // Asignaturas: plan de estudios del grado (dedupe por subject si hubiera
  // más de un plan con items en el mismo grado)
  const planItems = group.gradeLevelId
    ? await db.curriculumPlanItem.findMany({
        where: { gradeLevelId: group.gradeLevelId },
        select: {
          subjectId: true,
          weeklyHours: true,
          subject: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              percentage: true,
              averages: true,
              area: { select: { name: true, abbreviation: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      })
    : [];
  const seenSubject = new Set<string>();
  const subjects: ConsolidadoSubject[] = [];
  for (const it of planItems) {
    if (seenSubject.has(it.subjectId)) continue;
    seenSubject.add(it.subjectId);
    subjects.push({
      id: it.subject.id,
      name: it.subject.name,
      abbreviation: it.subject.abbreviation,
      areaName: it.subject.area?.name ?? null,
      areaAbbreviation: it.subject.area?.abbreviation ?? null,
      percentage: it.subject.percentage,
      averages: it.subject.averages,
    });
  }

  // Actividades y periodos del grupo
  const activities = await db.activity.findMany({
    where: { groupId },
    select: { id: true, subjectId: true, periodId: true, evaluativeConceptId: true },
  });
  const allPeriods = await db.period.findMany({
    where: { id: { in: [...new Set(activities.map((a) => a.periodId))] } },
    select: { id: true, name: true, order: true, weight: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const periods =
    typeof hastaOrder === "number"
      ? allPeriods.filter((p) => (p.order ?? Infinity) <= hastaOrder)
      : allPeriods;
  const periodIdSet = new Set(periods.map((p) => p.id));
  const relevant = activities.filter(
    (a) => periodIdSet.has(a.periodId) && seenSubject.has(a.subjectId)
  );

  // % de cada concepto evaluativo (para la DEF)
  const conceptIds = [...new Set(relevant.map((a) => a.evaluativeConceptId))];
  const concepts = conceptIds.length
    ? await db.evaluativeConcept.findMany({
        where: { id: { in: conceptIds } },
        select: { id: true, percentage: true },
      })
    : [];
  const conceptPct = new Map(concepts.map((c) => [c.id, c.percentage]));

  // Estudiantes activos (invariante R2) e inasistencias agregadas
  const enrollments = academicYearId
    ? await getActiveStudentsOfGroup(groupId, academicYearId)
    : [];
  const studentIds = enrollments.map((e) => e.studentId);
  const inasRows = studentIds.length
    ? await db.attendance.groupBy({
        by: ["studentId"],
        where: { groupId, studentId: { in: studentIds }, status: "ausente" },
        _count: { _all: true },
      })
    : [];
  const inasByStudent = new Map(inasRows.map((r) => [r.studentId, r._count._all]));

  // Notas en una sola consulta
  const records =
    relevant.length && studentIds.length
      ? await db.gradeRecord.findMany({
          where: {
            activityId: { in: relevant.map((a) => a.id) },
            studentId: { in: studentIds },
          },
          select: { studentId: true, activityId: true, value: true },
        })
      : [];

  // Umbral de promoción: tope de la escala más baja + salto (2ª escala por
  // minValue). Con Bajo[0–2.9] / Básico[3–3.9]… → 3.0. Fallback 3.0.
  const scales = await db.evaluationScale.findMany({
    where: { institutionId: group.institution.id },
    select: { minValue: true },
    orderBy: { minValue: "asc" },
  });
  const umbral = scales.length >= 2 ? scales[1].minValue : 3.0;

  // === Cálculos ===
  const actById = new Map(relevant.map((a) => [a.id, a]));
  // estudiante → asignatura → periodo → concepto → valores[]
  const cell = new Map<
    string,
    Map<string, Map<string, Map<string, number[]>>>
  >();
  for (const r of records) {
    const act = actById.get(r.activityId);
    if (!act) continue;
    let bySubject = cell.get(r.studentId);
    if (!bySubject) cell.set(r.studentId, (bySubject = new Map()));
    let byPeriod = bySubject.get(act.subjectId);
    if (!byPeriod) bySubject.set(act.subjectId, (byPeriod = new Map()));
    let byConcept = byPeriod.get(act.periodId);
    if (!byConcept) byPeriod.set(act.periodId, (byConcept = new Map()));
    const arr = byConcept.get(act.evaluativeConceptId);
    if (arr) arr.push(r.value);
    else byConcept.set(act.evaluativeConceptId, [r.value]);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  /** DEF de una celda (estudiante, asignatura, periodo) con renormalización */
  function defOf(byConcept: Map<string, number[]> | undefined): number | null {
    if (!byConcept || byConcept.size === 0) return null;
    let weighted = 0;
    let weightSum = 0;
    for (const [conceptId, values] of byConcept) {
      const pct = conceptPct.get(conceptId) ?? 0;
      weighted += avg(values) * pct;
      weightSum += pct;
    }
    return weightSum > 0 ? weighted / weightSum : null;
  }

  // celdas (asignatura, periodo) que el grupo tiene con actividades
  const groupCells = new Set(
    relevant.map((a) => `${a.subjectId}|${a.periodId}`)
  );

  const rows: ConsolidadoStudentRow[] = [];
  for (const e of enrollments) {
    const s = e.student;
    const bySubject = cell.get(s.id) ?? new Map();

    const def: Record<string, Record<string, number | null>> = {};
    const defFinal: Record<string, number | null> = {};
    for (const subj of subjects) {
      const byPeriod = bySubject.get(subj.id) ?? new Map();
      def[subj.id] = {};
      for (const p of periods) {
        def[subj.id][p.id] = defOf(byPeriod.get(p.id));
        def[subj.id][p.id] =
          def[subj.id][p.id] === null ? null : round1(def[subj.id][p.id] as number);
      }
      // DEF final ponderada por peso de periodo (renormalizada)
      let wSum = 0;
      let acc = 0;
      for (const p of periods) {
        const d = defOf(byPeriod.get(p.id));
        if (d !== null) {
          const w = p.weight > 0 ? p.weight : 0;
          acc += d * w;
          wSum += w;
        }
      }
      if (wSum === 0) {
        // pesos todos 0 → promedio simple de periodos con DEF
        const ds = periods
          .map((p) => defOf(byPeriod.get(p.id)))
          .filter((d): d is number => d !== null);
        defFinal[subj.id] = ds.length ? avg(ds) : null;
      } else {
        defFinal[subj.id] = acc / wSum;
      }
      defFinal[subj.id] =
        defFinal[subj.id] === null ? null : round1(defFinal[subj.id] as number);
    }

    // promedio por periodo y final: ponderado por % de asignatura, sólo
    // asignaturas que promedian (averages=true), renormalizado
    const promPeriod: Record<string, number | null> = {};
    for (const p of periods) {
      let acc = 0;
      let wSum = 0;
      for (const subj of subjects) {
        if (!subj.averages) continue;
        const d = def[subj.id][p.id];
        if (d !== null) {
          acc += d * subj.percentage;
          wSum += subj.percentage;
        }
      }
      promPeriod[p.id] = wSum > 0 ? round1(acc / wSum) : null;
    }
    let fAcc = 0;
    let fSum = 0;
    let dbj = 0;
    for (const subj of subjects) {
      if (!subj.averages) continue;
      const d = defFinal[subj.id];
      if (d !== null) {
        fAcc += d * subj.percentage;
        fSum += subj.percentage;
        if (d < umbral) dbj++;
      }
    }
    const promFinal = fSum > 0 ? round1(fAcc / fSum) : null;

    // DEF completa: tiene nota propia en todas las celdas del grupo
    let defCompleta = groupCells.size > 0;
    for (const key of groupCells) {
      const [subjectId, periodId] = key.split("|");
      if (def[subjectId]?.[periodId] == null) {
        defCompleta = false;
        break;
      }
    }

    rows.push({
      id: s.id,
      fullName: [s.lastName, s.lastName2].filter(Boolean).join(" ") + " " + [s.firstName, s.firstName2].filter(Boolean).join(" "),
      code: s.code,
      def,
      defFinal,
      promPeriod,
      promFinal,
      dbj,
      inas: inasByStudent.get(s.id) ?? 0,
      pt: null,
      estado:
        promFinal === null
          ? "sin_datos"
          : promFinal >= umbral
            ? "promovido"
            : "no_promovido",
      defCompleta,
    });
  }

  // Puesto (PT): orden por promedio final desc; empates → orden alfabético
  const ranked = [...rows]
    .filter((r) => r.promFinal !== null)
    .sort((a, b) => (b.promFinal as number) - (a.promFinal as number) || a.fullName.localeCompare(b.fullName));
  ranked.forEach((r, i) => {
    r.pt = i + 1;
  });

  // Resumen por asignatura: Prom (grupo) y NM (mínimo)
  const resumen: Record<string, { prom: number | null; nm: number | null }> = {};
  for (const subj of subjects) {
    const vals = rows
      .map((r) => r.defFinal[subj.id])
      .filter((v): v is number => v !== null);
    resumen[subj.id] = {
      prom: vals.length ? round1(avg(vals)) : null,
      nm: vals.length ? round1(Math.min(...vals)) : null,
    };
  }

  return {
    group: {
      id: group.id,
      name: group.name,
      gradeLevelName: group.gradeLevel?.name ?? null,
      gradeLevelCode: group.gradeLevel?.code ?? null,
      year: group.academicYear?.year ?? null,
      institutionName: group.institution.name,
      branchName: group.branch?.name ?? null,
    },
    umbral,
    periods,
    subjects,
    students: rows,
    resumen,
  };
}
