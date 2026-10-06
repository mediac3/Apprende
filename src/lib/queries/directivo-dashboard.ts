import { db } from "@/lib/db";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  getActiveYear,
  getUserRoleCodes,
} from "@/lib/teaching-rules";

// ============================================================
// [Dashboard directivo] Capa de consulta para Rector/Coordinador.
// Responde "¿Cómo está la institución?" con KPIs macro, alertas
// jerarquizadas, tendencias, distribución, comparativa temporal y
// actividad reciente — respetando el alcance del rol en SERVIDOR.
// Todas las consultas usan el query builder de Prisma (parámetros
// ligados); las agregaciones finas se resuelven en memoria.
// ============================================================

export type DirectivoScope = {
  allInstitution: boolean; // true = rector/administrador (toda la institución)
  branchIds: string[] | null; // null = sin restricción de sede
  gradeLevelIds: string[] | null; // null = sin restricción de grado
};

export type DirectivoDashboardParams = {
  institutionId: string;
  userId: string;
  periodId?: string | null;
  sedeId?: string | null;
  gradoId?: string | null;
  grupoId?: string | null;
};

export type DirectivoError =
  | "FORBIDDEN_ROLE"
  | "OUT_OF_SCOPE"
  | "NO_GROUPS";

const DIRECTIVO_ROLES = ["rector", "coordinador", "administrador"];

function parseIdArray(raw: string | null | undefined): string[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : null;
  } catch {
    return null;
  }
}

/** Alcance efectivo del usuario: rector/admin = todo; coordinador = sus scopeIds (null = sin restricción). */
export async function resolveDirectivoScope(
  userId: string
): Promise<DirectivoScope | { error: DirectivoError }> {
  const roles = await getUserRoleCodes(userId);
  if (!roles.some((r) => DIRECTIVO_ROLES.includes(r))) return { error: "FORBIDDEN_ROLE" };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { scopeBranchIds: true, scopeGradeLevelIds: true },
  });
  if (!user) return { error: "FORBIDDEN_ROLE" };
  const branchIds = parseIdArray(user.scopeBranchIds);
  const gradeLevelIds = parseIdArray(user.scopeGradeLevelIds);
  const allInstitution =
    roles.includes("rector") ||
    roles.includes("administrador") ||
    (branchIds === null && gradeLevelIds === null);
  return { allInstitution, branchIds, gradeLevelIds };
}

function pct(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10; // 1 decimal
}

/** % de asistencia: todo estado menos "ausente" cuenta como asistido (tarde/excusa justificadas). */
function attendancePct(statuses: string[]): number | null {
  if (statuses.length === 0) return null;
  const ausentes = statuses.filter((s) => s === "ausente").length;
  return pct(statuses.length - ausentes, statuses.length);
}

type AlertItem = {
  severity: "critico" | "medio" | "info";
  message: string;
  context: string;
  action: "ver-detalle" | "intervenir";
  module: string; // módulo del panel donde se interviene (navegación del botón)
};

export async function getDirectivoDashboard(params: DirectivoDashboardParams) {
  const { institutionId, userId } = params;
  const scope = await resolveDirectivoScope(userId);
  if ("error" in scope) return { error: scope.error as DirectivoError };

  // --- Fase A: base (institución, año, periodos, grupos del alcance) ---
  const [institution, yearNum, periods, settings, branches] = await Promise.all([
    db.institution.findUnique({
      where: { id: institutionId },
      select: { name: true, shortName: true, logoUrl: true, academicYear: true },
    }),
    getActiveYear(institutionId),
    db.period.findMany({
      where: { institutionId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true, active: true },
    }),
    db.dashboardSetting.findUnique({ where: { institutionId } }),
    db.branch.findMany({
      where: { institutionId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const yearRow = await db.academicYear.findUnique({
    where: { institutionId_year: { institutionId, year: yearNum } },
    select: { id: true, year: true },
  });
  const prevYearRow = await db.academicYear.findUnique({
    where: { institutionId_year: { institutionId, year: yearNum - 1 } },
    select: { id: true, year: true },
  });

  // Periodo activo: param → active → el que contiene hoy → el último. (misma prioridad que el resto del panel)
  const now = new Date();
  const activePeriod =
    (params.periodId ? periods.find((p) => p.id === params.periodId) : null) ??
    periods.find((p) => p.active) ??
    periods.find((p) => p.startDate <= now && p.endDate >= now) ??
    periods[periods.length - 1] ??
    null;
  const activeIdx = activePeriod ? periods.findIndex((p) => p.id === activePeriod.id) : -1;
  const prevPeriod = activeIdx > 0 ? periods[activeIdx - 1] : null;
  const last5Periods = activeIdx >= 0 ? periods.slice(Math.max(0, activeIdx - 4), activeIdx + 1) : [];

  // Filtro de grupos: año activo + drill params, acotado por el alcance del coordinador.
  const sedeScoped = !scope.allInstitution && scope.branchIds !== null;
  const gradoScoped = !scope.allInstitution && scope.gradeLevelIds !== null;
  if (sedeScoped && params.sedeId && !scope.branchIds!.includes(params.sedeId)) {
    return { error: "OUT_OF_SCOPE" as DirectivoError };
  }
  if (gradoScoped && params.gradoId && !scope.gradeLevelIds!.includes(params.gradoId)) {
    return { error: "OUT_OF_SCOPE" as DirectivoError };
  }
  const groupWhere = {
    institutionId,
    ...(yearRow ? { academicYearId: yearRow.id } : {}),
    ...(sedeScoped
      ? { branchId: { in: params.sedeId ? scope.branchIds!.filter((b) => b === params.sedeId) : scope.branchIds! } }
      : params.sedeId
        ? { branchId: params.sedeId }
        : {}),
    ...(gradoScoped
      ? { gradeLevelId: { in: params.gradoId ? scope.gradeLevelIds!.filter((g) => g === params.gradoId) : scope.gradeLevelIds! } }
      : params.gradoId
        ? { gradeLevelId: params.gradoId }
        : {}),
    ...(params.grupoId ? { id: params.grupoId } : {}),
  };
  const groups = await db.group.findMany({
    where: groupWhere,
    select: {
      id: true, name: true, branchId: true, journeyId: true, gradeLevelId: true,
      branch: { select: { name: true } },
      journey: { select: { name: true } },
      gradeLevel: { select: { name: true } },
    },
  });
  if (groups.length === 0) {
    return {
      error: "NO_GROUPS" as DirectivoError,
      institution: institution ? { name: institution.name, shortName: institution.shortName, logoUrl: institution.logoUrl } : null,
      year: yearNum,
    };
  }
  const groupIds = groups.map((g) => g.id);
  const groupMeta = new Map(groups.map((g) => [g.id, g]));

  // Umbrales (settings o defaults; la fila se crea desde la API de configuración)
  const thresholds = {
    riskThreshold: settings?.riskThreshold ?? 3.0,
    attendanceThreshold: settings?.attendanceThreshold ?? 90,
    pendingTasksLimit: settings?.pendingTasksLimit ?? 20,
  };

  // --- Fase B: métricas en paralelo ---
  const currentRange = activePeriod ? { gte: activePeriod.startDate, lte: activePeriod.endDate } : null;
  const attendanceRange = prevPeriod && currentRange
    ? { gte: prevPeriod.startDate, lte: activePeriod!.endDate }
    : currentRange;
  const last5Ids = last5Periods.map((p) => p.id);

  const [
    studentsCount,
    prevStudentsCount,
    teacherRows,
    prevTeacherRows,
    prevGroupsCount,
    attendanceRows,
    gradeRecordRows,
    activityRows,
    enrollmentEvents,
    enrollmentByGroup,
    auditRows,
    scopeLabels,
  ] = await Promise.all([
    db.studentEnrollment.count({
      where: { institutionId, ...(yearRow ? { academicYearId: yearRow.id } : {}), status: { in: [...ACTIVE_ENROLLMENT_STATUSES] }, groupId: { in: groupIds } },
    }),
    prevYearRow
      ? db.studentEnrollment.count({
          where: { institutionId, academicYearId: prevYearRow.id, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] }, groupId: { in: groupIds } },
        })
      : Promise.resolve(null),
    db.subjectAssignment.findMany({
      where: { institutionId, year: yearNum, groupId: { in: groupIds } },
      distinct: ["teacherId"],
      select: { teacherId: true },
    }),
    prevYearRow
      ? db.subjectAssignment.findMany({
          where: { institutionId, year: prevYearRow.year, groupId: { in: groupIds } },
          distinct: ["teacherId"],
          select: { teacherId: true },
        })
      : Promise.resolve(null),
    prevYearRow
      ? db.group.count({
          where: { institutionId, academicYearId: prevYearRow.id, ...(sedeScoped ? { branchId: { in: scope.branchIds! } } : params.sedeId ? { branchId: params.sedeId } : {}), ...(gradoScoped ? { gradeLevelId: { in: scope.gradeLevelIds! } } : params.gradoId ? { gradeLevelId: params.gradoId } : {}) },
        })
      : Promise.resolve(null),
    attendanceRange
      ? db.attendance.findMany({
          where: { groupId: { in: groupIds }, date: attendanceRange },
          select: { groupId: true, status: true, date: true },
        })
      : Promise.resolve([] as { groupId: string; status: string; date: Date }[]),
    last5Ids.length > 0
      ? db.gradeRecord.findMany({
          where: { activity: { periodId: { in: last5Ids }, groupId: { in: groupIds } } },
          select: { activityId: true, studentId: true, value: true, activity: { select: { periodId: true, subjectId: true, subject: { select: { name: true } } } } },
        })
      : Promise.resolve([]),
    currentRange || activePeriod
      ? db.activity.findMany({
          where: { institutionId, ...(activePeriod ? { periodId: activePeriod.id } : {}), groupId: { in: groupIds } },
          select: { id: true, name: true, groupId: true },
        })
      : Promise.resolve([]),
    db.enrollmentEvent.findMany({
      where: { enrollment: { institutionId, ...(yearRow ? { academicYearId: yearRow.id } : {}), groupId: { in: groupIds } }, type: "retiro" },
      select: { date: true },
    }),
    db.studentEnrollment.groupBy({
      by: ["groupId"],
      where: { institutionId, ...(yearRow ? { academicYearId: yearRow.id } : {}), status: { in: [...ACTIVE_ENROLLMENT_STATUSES] }, groupId: { in: groupIds } },
      _count: { _all: true },
    }),
    db.auditLog.findMany({
      where: { institutionId, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, module: true, createdAt: true, user: { select: { fullName: true } } },
    }),
    // Nombres de sedes/grados del alcance (para el header y mensajes de fuera-de-alcance)
    Promise.all([
      sedeScoped ? db.branch.findMany({ where: { id: { in: scope.branchIds! } }, select: { id: true, name: true } }) : Promise.resolve([]),
      gradoScoped ? db.gradeLevel.findMany({ where: { id: { in: scope.gradeLevelIds! } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]),
  ]);

  // --- Agregaciones en memoria ---
  const inRange = (d: Date, p: { startDate: Date; endDate: Date }) => d >= p.startDate && d <= p.endDate;

  // Asistencia por periodo (actual y anterior) y por grado (alertas)
  const currentStatuses: string[] = [];
  const prevStatuses: string[] = [];
  const byGradeStatuses = new Map<string, string[]>();
  for (const row of attendanceRows) {
    if (currentRange && inRange(row.date, activePeriod!)) {
      currentStatuses.push(row.status);
      const gradeId = groupMeta.get(row.groupId)?.gradeLevelId ?? "sin-grado";
      byGradeStatuses.set(gradeId, [...(byGradeStatuses.get(gradeId) ?? []), row.status]);
    } else if (prevPeriod && inRange(row.date, prevPeriod)) {
      prevStatuses.push(row.status);
    }
  }
  const attendanceCur = attendancePct(currentStatuses);
  const attendancePrev = attendancePct(prevStatuses);

  // Rendimiento por periodo, por estudiante (riesgo) y por asignatura (tendencias)
  const periodVals = new Map<string, number[]>();
  const studentVals = new Map<string, number[]>();
  const subjectVals = new Map<string, { name: string; vals: Record<string, number[]> }>();
  for (const r of gradeRecordRows) {
    const pid = r.activity.periodId;
    (periodVals.get(pid) ?? periodVals.set(pid, []).get(pid)!).push(r.value);
    (studentVals.get(r.studentId) ?? studentVals.set(r.studentId, []).get(r.studentId)!).push(r.value);
    const sid = r.activity.subjectId;
    if (!subjectVals.has(sid)) subjectVals.set(sid, { name: r.activity.subject.name, vals: {} });
    (subjectVals.get(sid)!.vals[pid] ??= []).push(r.value);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const perfOf = (pid: string) => {
    const a = avg(periodVals.get(pid) ?? []);
    return a == null ? null : Math.round(a * 20 * 10) / 10; // escala 0-5 → %
  };
  const perfCur = activePeriod ? perfOf(activePeriod.id) : null;
  const perfPrev = prevPeriod ? perfOf(prevPeriod.id) : null;

  // Estudiantes en riesgo (promedio del periodo < umbral)
  let riskStudents = 0;
  if (activePeriod) {
    const curByStudent = new Map<string, number[]>();
    for (const r of gradeRecordRows) {
      if (r.activity.periodId === activePeriod.id) {
        (curByStudent.get(r.studentId) ?? curByStudent.set(r.studentId, []).get(r.studentId)!).push(r.value);
      }
    }
    for (const [, vals] of curByStudent) {
      const a = avg(vals);
      if (a != null && a < thresholds.riskThreshold) riskStudents++;
    }
  }

  // Tareas pendientes: actividades del periodo sin ninguna calificación registrada
  const gradedActivityIds = new Set(
    gradeRecordRows.filter((r) => activePeriod && r.activity.periodId === activePeriod.id).map((r) => r.activityId)
  );
  const pendingActivities = activityRows.filter((a) => !gradedActivityIds.has(a.id)).length;

  // Retiros del año activo y serie por periodo (para comparativa)
  const retirosYear = enrollmentEvents.length;
  const retirosByPeriod = last5Periods.map((p) => enrollmentEvents.filter((e) => inRange(e.date, p)).length);

  // Distribución (sede / grado / jornada) a partir de matrículas por grupo
  function distribute(key: "branchId" | "gradeLevelId" | "journeyId") {
    const totals = new Map<string, { name: string; count: number }>();
    let total = 0;
    for (const row of enrollmentByGroup) {
      if (!row.groupId) continue; // groupId es nullable en StudentEnrollment
      const g = groupMeta.get(row.groupId);
      if (!g) continue;
      const id = (g[key] as string | null) ?? "sin-asignar";
      const name =
        key === "branchId" ? g.branch?.name : key === "journeyId" ? g.journey?.name : g.gradeLevel?.name;
      const entry = totals.get(id) ?? { name: name ?? "Sin asignar", count: 0 };
      entry.count += row._count._all;
      totals.set(id, entry);
      total += row._count._all;
    }
    const items = [...totals.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count, pct: pct(v.count, total) }))
      .sort((a, b) => b.count - a.count);
    // Regla dura: >10 barras → agrupar las menores como "Otros"
    if (items.length > 10) {
      const top = items.slice(0, 9);
      const rest = items.slice(9);
      const restCount = rest.reduce((s, i) => s + i.count, 0);
      top.push({ id: "otros", name: "Otros", count: restCount, pct: pct(restCount, total) });
      return top;
    }
    return items;
  }

  // KPIs con deltas
  const delta = (cur: number | null, prev: number | null | undefined) =>
    cur == null || prev == null || prev === 0 ? null : Math.round((cur - prev) * 10) / 10;
  const teachersCount = new Set(teacherRows.map((t) => t.teacherId)).size;
  const prevTeachersCount = prevTeacherRows ? new Set(prevTeacherRows.map((t) => t.teacherId)).size : null;

  // Alertas jerarquizadas (🔴 → 🟠 → 🟡)
  const alerts: AlertItem[] = [];
  if (riskStudents > 0) {
    alerts.push({
      severity: "critico",
      message: `${riskStudents} estudiante${riskStudents === 1 ? "" : "s"} con promedio < ${thresholds.riskThreshold}`,
      context: activePeriod ? `En ${activePeriod.name}` : "Periodo sin definir",
      action: "ver-detalle",
      module: "consolidado",
    });
  }
  if (attendanceCur != null && attendanceCur < thresholds.attendanceThreshold) {
    alerts.push({
      severity: "medio",
      message: `Asistencia del periodo en ${attendanceCur}%`,
      context: `Umbral institucional: ${thresholds.attendanceThreshold}%`,
      action: "intervenir",
      module: "asistencia",
    });
  }
  const lowGrades: string[] = [];
  for (const g of groups) {
    if (!g.gradeLevelId || !g.gradeLevel) continue;
    const p = attendancePct(byGradeStatuses.get(g.gradeLevelId) ?? []);
    if (p != null && p < thresholds.attendanceThreshold && !lowGrades.includes(g.gradeLevel.name)) {
      lowGrades.push(g.gradeLevel.name);
    }
  }
  if (lowGrades.length > 0) {
    alerts.push({
      severity: "medio",
      message: `Grado${lowGrades.length > 1 ? "s" : ""} ${lowGrades.join(", ")} con asistencia < ${thresholds.attendanceThreshold}%`,
      context: "Asistencia por grado en el periodo actual",
      action: "intervenir",
      module: "asistencia",
    });
  }
  if (pendingActivities >= thresholds.pendingTasksLimit) {
    alerts.push({
      severity: "info",
      message: `${pendingActivities} tareas sin calificar`,
      context: activePeriod ? `Actividades de ${activePeriod.name} sin registro de notas` : "Periodo sin definir",
      action: "ver-detalle",
      module: "notas",
    });
  }
  const severityRank = { critico: 0, medio: 1, info: 2 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // Tendencias (máx. 6): rendimiento, asistencia, retiros + top-3 asignaturas
  const series = (get: (pid: string) => number | null) => last5Periods.map((p) => get(p.id));
  type Trend = { indicator: string; value: string; delta: number | null; direction: "up" | "flat" | "down"; sparkline: (number | null)[] };
  const directionOf = (d: number | null): "up" | "flat" | "down" => (d == null || Math.abs(d) < 0.5 ? "flat" : d > 0 ? "up" : "down");
  const trends: Trend[] = [];
  trends.push({
    indicator: "Rendimiento",
    value: perfCur != null ? `${perfCur}%` : "--",
    delta: delta(perfCur, perfPrev),
    direction: directionOf(delta(perfCur, perfPrev)),
    sparkline: series(perfOf),
  });
  trends.push({
    indicator: "Asistencia",
    value: attendanceCur != null ? `${attendanceCur}%` : "--",
    delta: delta(attendanceCur, attendancePrev),
    direction: directionOf(delta(attendanceCur, attendancePrev)),
    sparkline: series((pid) => {
      const p = periods.find((x) => x.id === pid);
      if (!p) return null;
      return attendancePct(attendanceRows.filter((r) => inRange(r.date, p)).map((r) => r.status));
    }),
  });
  trends.push({
    indicator: "Retiros",
    value: String(retirosYear),
    delta: null, // sin año anterior de referencia por periodo
    direction: retirosYear === 0 ? "flat" : "flat",
    sparkline: retirosByPeriod,
  });
  const topSubjects = [...subjectVals.entries()]
    .sort(([, sa], [, sb]) => (sb.vals[activePeriod?.id ?? ""]?.length ?? 0) - (sa.vals[activePeriod?.id ?? ""]?.length ?? 0))
    .slice(0, 3);
  for (const [, s] of topSubjects) {
    const curA = activePeriod ? avg(s.vals[activePeriod.id] ?? []) : null;
    const prevA = prevPeriod ? avg(s.vals[prevPeriod.id] ?? []) : null;
    const curPct = curA == null ? null : Math.round(curA * 20 * 10) / 10;
    const d = curPct == null || prevA == null ? null : Math.round((curPct - prevA * 20) * 10) / 10;
    trends.push({
      indicator: s.name,
      value: curPct != null ? `${curPct}%` : "--",
      delta: d,
      direction: directionOf(d),
      sparkline: last5Periods.map((p) => {
        const a = avg(s.vals[p.id] ?? []);
        return a == null ? null : Math.round(a * 20 * 10) / 10;
      }),
    });
  }

  const [scopeBranches, scopeGradeLevels] = scopeLabels;

  return {
    error: null as null,
    header: {
      institutionName: institution?.name ?? "",
      institutionShortName: institution?.shortName ?? null,
      logoUrl: institution?.logoUrl ?? null,
      year: yearNum,
      period: activePeriod ? { id: activePeriod.id, name: activePeriod.name } : null,
      periods: periods.map((p) => ({ id: p.id, name: p.name, active: p.active })),
      branches,
      scope: {
        allInstitution: scope.allInstitution,
        sede: params.sedeId ? (groups[0]?.branch?.name ?? null) : sedeScoped ? scopeBranches.map((b) => b.name).join(", ") : null,
        grado: params.gradoId ? (groups[0]?.gradeLevel?.name ?? null) : gradoScoped ? scopeGradeLevels.map((g) => g.name).join(", ") : null,
        grupo: params.grupoId ? (groups[0]?.name ?? null) : null,
        allowedSedes: sedeScoped ? scopeBranches : null,
        allowedGrados: gradoScoped ? scopeGradeLevels : null,
      },
    },
    thresholds,
    kpis: {
    students: {
      value: studentsCount,
      // Delta solo si el año anterior tiene datos reales (evita "+N" ruidoso con años vacíos)
      delta: prevStudentsCount == null || prevStudentsCount === 0 ? null : studentsCount - prevStudentsCount,
    },
    teachers: { value: teachersCount, delta: prevTeachersCount == null || prevTeachersCount === 0 ? null : teachersCount - prevTeachersCount },
    groups: { value: groups.length, delta: prevGroupsCount == null || prevGroupsCount === 0 ? null : groups.length - prevGroupsCount },
      attendance: { value: attendanceCur, delta: delta(attendanceCur, attendancePrev) },
      performance: { value: perfCur, delta: delta(perfCur, perfPrev) },
      alerts: { value: alerts.length },
    },
    alerts,
    trends,
    distribution: {
      bySede: distribute("branchId"),
      byGrado: distribute("gradeLevelId"),
      byJornada: distribute("journeyId"),
      totalStudents: enrollmentByGroup.reduce((s, r) => s + r._count._all, 0),
    },
    comparative: {
      periods: last5Periods.map((p) => p.name),
      attendance: last5Periods.map((p) => attendancePct(attendanceRows.filter((r) => inRange(r.date, p)).map((r) => r.status))),
      performance: last5Periods.map((p) => perfOf(p.id)),
      retiros: retirosByPeriod,
    },
    quickReports: [
      { key: "consolidado", label: "Consolidado anual", module: "consolidado" },
      { key: "asistencia", label: "Informe de asistencia", module: "asistencia" },
      { key: "indicadores", label: "Informes académicos", module: "indicadores" },
      { key: "supervision", label: "Supervisión académica", module: "supervision" },
      { key: "convivencia", label: "Convivencia escolar", module: "convivencia" },
    ],
    recentActivity: auditRows.map((a) => ({
      id: a.id,
      description: `${a.action} · ${a.module}`,
      userName: a.user?.fullName ?? "Sistema",
      createdAt: a.createdAt.toISOString(),
    })),
    drill: {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        sede: g.branch?.name ?? null,
        grado: g.gradeLevel?.name ?? null,
        jornada: g.journey?.name ?? null,
        students: enrollmentByGroup.find((e) => e.groupId === g.id)?._count._all ?? 0,
      })),
    },
  };
}
