// [Dashboard Docente] Query agregada — operativa + accionable + IA.
// Una sola función, queries en paralelo, sin N+1. Todo por Prisma (parametrizado).
// Convenciones reutilizadas: estados de matrícula activa y año activo (teaching-rules).
import { db } from "@/lib/db";
import { ACTIVE_ENROLLMENT_STATUSES } from "@/lib/teaching-rules";

export interface AlertStudent {
  studentId: string;
  name: string;
  detail: string; // "Prom. 2.4 (antes 3.1)" | "Último registro: 12/05" | "Prom. 2.8"
}

export interface TeacherAlert {
  type: "risk" | "decline" | "inactive" | "concept";
  emoji: string;
  message: string;
  count: number;
  students: AlertStudent[];
  actionLabel: "Ver estudiantes" | "Intervenir";
}

export interface SubjectPerformanceRow {
  subjectId: string;
  subjectName: string;
  percentage: number; // 0-100 (avg / 5)
  avgGrade: number; // 0.0-5.0
  studentCount: number;
  groups: { groupName: string; percentage: number }[];
}

export interface PendingTaskRow {
  activityId: string;
  name: string; // label visual o name
  subjectName: string;
  groupName: string;
  graded: number;
  total: number;
  periodName: string;
  createdAtISO: string;
}

export interface RecentActivityItem {
  id: string;
  kind: "grade" | "observation" | "message";
  text: string;
  createdAtISO: string;
}

export interface TeacherDashboardConfigDTO {
  declineThreshold: number;
  inactivityDays: number;
  riskThreshold: number;
}

export interface TeacherDashboardData {
  teacherName: string;
  hasAssignments: boolean;
  currentPeriodName: string | null;
  kpis: {
    courses: number;
    students: number;
    pendingTasks: number;
    gradedWeek: number;
    gradedWeekDelta: number; // vs semana anterior (puede ser negativo)
  };
  subjectPerformance: SubjectPerformanceRow[];
  alerts: TeacherAlert[];
  config: TeacherDashboardConfigDTO;
  pendingTasks: PendingTaskRow[]; // top 5, incompletas primero
  pendingTasksTotal: number;
  recentActivity: RecentActivityItem[]; // máx 10, últimos 7 días
}

export type TeacherDashboardResult =
  | { ok: true; data: TeacherDashboardData }
  | { ok: false; reason: "user_not_found" | "user_inactive" | "not_teacher" };

const DEFAULT_CONFIG: TeacherDashboardConfigDTO = {
  declineThreshold: 0.5,
  inactivityDays: 4,
  riskThreshold: 3.0,
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (avg: number) => Math.round((avg / 5) * 100);
const fmtDate = (d: Date) =>
  `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;

export async function getTeacherDashboard(userId: string): Promise<TeacherDashboardResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, institutionId: true, fullName: true },
  });
  if (!user) return { ok: false, reason: "user_not_found" };
  if (!user.active) return { ok: false, reason: "user_inactive" };
  if (user.role !== "docente") return { ok: false, reason: "not_teacher" };

  // Config de umbrales (on-read default)
  const configRow = await db.teacherDashboardConfig.findUnique({ where: { teacherId: user.id } });
  const config: TeacherDashboardConfigDTO = configRow
    ? {
        declineThreshold: configRow.declineThreshold,
        inactivityDays: configRow.inactivityDays,
        riskThreshold: configRow.riskThreshold,
      }
    : DEFAULT_CONFIG;

  const ay = await db.academicYear.findFirst({
    where: { institutionId: user.institutionId, active: true },
    select: { id: true, year: true },
  });

  const assignments = ay
    ? await db.subjectAssignment.findMany({
        where: { teacherId: user.id, year: ay.year },
        select: {
          groupId: true,
          subjectId: true,
          group: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      })
    : [];

  const groupIds = [...new Set(assignments.map((a) => a.groupId))];
  const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];

  if (!ay || groupIds.length === 0) {
    return {
      ok: true,
      data: {
        teacherName: user.fullName,
        hasAssignments: false,
        currentPeriodName: null,
        kpis: { courses: 0, students: 0, pendingTasks: 0, gradedWeek: 0, gradedWeekDelta: 0 },
        subjectPerformance: [],
        alerts: [],
        config,
        pendingTasks: [],
        pendingTasksTotal: 0,
        recentActivity: [],
      },
    };
  }

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const [enrollments, activities, periods] = await Promise.all([
    db.studentEnrollment.findMany({
      where: {
        groupId: { in: groupIds },
        academicYearId: ay.id,
        status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
      },
      select: { studentId: true, groupId: true },
    }),
    db.activity.findMany({
      where: { groupId: { in: groupIds }, subjectId: { in: subjectIds } },
      select: {
        id: true,
        name: true,
        label: true,
        groupId: true,
        subjectId: true,
        periodId: true,
        evaluativeConceptId: true,
        createdAt: true,
        group: { select: { name: true } },
        subject: { select: { name: true } },
        period: { select: { name: true } },
        evaluativeConcept: { select: { name: true } },
      },
    }),
    db.period.findMany({
      where: { institutionId: user.institutionId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true },
    }),
  ]);

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

  const [records, students, observations, messages] = await Promise.all([
    activities.length
      ? db.gradeRecord.findMany({
          where: { activityId: { in: activities.map((a) => a.id) } },
          select: { studentId: true, activityId: true, value: true, updatedAt: true, createdAt: true },
        })
      : Promise.resolve([]),
    studentIds.length
      ? db.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    db.observation.findMany({
      where: { recordedById: user.id, createdAt: { gte: new Date(now.getTime() - weekMs) } },
      select: { id: true, title: true, studentId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.message.findMany({
      where: { senderId: user.id, createdAt: { gte: new Date(now.getTime() - weekMs) } },
      select: { id: true, content: true, receiver: { select: { fullName: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // ---------- índices en memoria ----------
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const studentName = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  const activeByGroup = new Map<string, Set<string>>(); // groupId → studentIds activos
  for (const e of enrollments) {
    if (!activeByGroup.has(e.groupId)) activeByGroup.set(e.groupId, new Set());
    activeByGroup.get(e.groupId)!.add(e.studentId);
  }

  // studentId → último registro del docente (para inactividad)
  const lastRecordAt = new Map<string, Date>();
  // subjectId → studentId → periodId → values[]
  const bySubject = new Map<string, Map<string, Map<string, number[]>>>();
  // conceptId → studentId → values[]
  const byConcept = new Map<string, Map<string, number[]>>();
  // activityId → notas registradas (entre estudiantes activos del grupo)
  const gradedByActivity = new Map<string, number>();

  for (const r of records) {
    const act = activityById.get(r.activityId);
    if (!act) continue;
    const prev = lastRecordAt.get(r.studentId);
    if (!prev || r.updatedAt > prev) lastRecordAt.set(r.studentId, r.updatedAt);

    const isActive = activeByGroup.get(act.groupId)?.has(r.studentId) ?? false;
    if (!isActive) continue;

    gradedByActivity.set(r.activityId, (gradedByActivity.get(r.activityId) ?? 0) + 1);

    if (!bySubject.has(act.subjectId)) bySubject.set(act.subjectId, new Map());
    const perStudent = bySubject.get(act.subjectId)!;
    if (!perStudent.has(r.studentId)) perStudent.set(r.studentId, new Map());
    const perPeriod = perStudent.get(r.studentId)!;
    perPeriod.set(act.periodId, [...(perPeriod.get(act.periodId) ?? []), r.value]);

    if (!byConcept.has(act.evaluativeConceptId)) byConcept.set(act.evaluativeConceptId, new Map());
    const cMap = byConcept.get(act.evaluativeConceptId)!;
    cMap.set(r.studentId, [...(cMap.get(r.studentId) ?? []), r.value]);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // Periodo de contexto: el más reciente (por fecha) que tenga registros del docente;
  // si no hay registros, el último iniciado. Se ignoran periodos vacíos porque la
  // institución puede tener varios juegos de periodos (observado en datos reales).
  const periodsWithRecords = new Set<string>();
  for (const r of records) {
    const act = activityById.get(r.activityId);
    if (act) periodsWithRecords.add(act.periodId);
  }
  let contextPeriod = periods[periods.length - 1] ?? null;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (periods[i].startDate <= now) {
      contextPeriod = periods[i];
      break;
    }
  }
  for (let i = periods.length - 1; i >= 0; i--) {
    if (periodsWithRecords.has(periods[i].id)) {
      contextPeriod = periods[i];
      break;
    }
  }
  // Periodo previo CON registros (para el alerta de declive)
  const recordedPeriodsOrdered = periods.filter((p) => periodsWithRecords.has(p.id));
  const ctxIdx = contextPeriod ? recordedPeriodsOrdered.findIndex((p) => p.id === contextPeriod!.id) : -1;
  const previousPeriod = ctxIdx > 0 ? recordedPeriodsOrdered[ctxIdx - 1] : null;

  // ---------- KPIs ----------
  const gradedWeek = records.filter((r) => r.updatedAt >= new Date(now.getTime() - weekMs)).length;
  const gradedPrevWeek = records.filter(
    (r) =>
      r.updatedAt >= new Date(now.getTime() - 2 * weekMs) &&
      r.updatedAt < new Date(now.getTime() - weekMs)
  ).length;

  // ---------- Rendimiento por asignatura (agregado) ----------
  const subjectPerformance: SubjectPerformanceRow[] = subjectIds
    .map((subjectId) => {
      const subjectAssignments = assignments.filter((a) => a.subjectId === subjectId);
      const subjectName = subjectAssignments[0]?.subject.name ?? "—";
      const groups: { groupName: string; percentage: number }[] = [];
      let allValues: number[] = [];
      let studentsWithRecords = new Set<string>();

      for (const asg of subjectAssignments) {
        const groupValues: number[] = [];
        for (const [studentId, perPeriod] of bySubject.get(subjectId)?.entries() ?? []) {
          if (!activeByGroup.get(asg.groupId)?.has(studentId)) continue;
          const values = [...perPeriod.values()].flat();
          if (values.length) {
            groupValues.push(...values);
            studentsWithRecords.add(studentId);
          }
        }
        groups.push({ groupName: asg.group.name, percentage: pct(avg(groupValues)) });
        allValues.push(...groupValues);
      }

      return {
        subjectId,
        subjectName,
        percentage: pct(avg(allValues)),
        avgGrade: round1(avg(allValues)),
        studentCount: studentsWithRecords.size,
        groups: groups.sort((a, b) => b.percentage - a.percentage),
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  // ---------- Alertas IA ----------
  const alerts: TeacherAlert[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  // 1) Riesgo de reprobar (promedio periodo actual < riskThreshold), por asignatura
  for (const subjectId of subjectIds) {
    const subjectName = assignments.find((a) => a.subjectId === subjectId)?.subject.name ?? "—";
    const affected: AlertStudent[] = [];
    for (const [studentId, perPeriod] of bySubject.get(subjectId)?.entries() ?? []) {
      const values = [...perPeriod.values()].flat();
      const a = avg(values);
      if (values.length && a < config.riskThreshold) {
        affected.push({ studentId, name: studentName.get(studentId) ?? "—", detail: `Prom. ${round1(a)}` });
      }
    }
    if (affected.length) {
      alerts.push({
        type: "risk",
        emoji: "🔴",
        message: `${affected.length} estudiante${affected.length > 1 ? "s" : ""} ${
          affected.length > 1 ? "están" : "está"
        } en riesgo de reprobar ${subjectName}.`,
        count: affected.length,
        students: affected.sort((a, b) => a.name.localeCompare(b.name)),
        actionLabel: "Intervenir",
      });
    }
  }

  // 2) Disminución de rendimiento (periodo actual vs anterior > declineThreshold)
  if (previousPeriod && contextPeriod) {
    for (const subjectId of subjectIds) {
      const subjectName = assignments.find((a) => a.subjectId === subjectId)?.subject.name ?? "—";
      const affected: AlertStudent[] = [];
      for (const [studentId, perPeriod] of bySubject.get(subjectId)?.entries() ?? []) {
        const cur = avg(perPeriod.get(contextPeriod?.id ?? "") ?? []);
        const prev = avg(perPeriod.get(previousPeriod?.id ?? "") ?? []);
        if (cur > 0 && prev > 0 && prev - cur > config.declineThreshold) {
          affected.push({
            studentId,
            name: studentName.get(studentId) ?? "—",
            detail: `Prom. ${round1(cur)} (antes ${round1(prev)})`,
          });
        }
      }
      if (affected.length) {
        alerts.push({
          type: "decline",
          emoji: "📉",
          message: `${affected.length} estudiante${affected.length > 1 ? "s" : ""} presenta${
            affected.length > 1 ? "n" : ""
          } disminución de rendimiento en ${subjectName}.`,
          count: affected.length,
          students: affected.sort((a, b) => a.name.localeCompare(b.name)),
          actionLabel: "Ver estudiantes",
        });
      }
    }
  }

  // 3) Inactividad: sin registros de evaluación en N días (solo si la clase está activa)
  const classActive = records.some((r) => r.updatedAt >= new Date(now.getTime() - config.inactivityDays * dayMs));
  if (classActive) {
    const cutoff = new Date(now.getTime() - config.inactivityDays * dayMs);
    const inactive = studentIds.filter((sid) => {
      const last = lastRecordAt.get(sid);
      return !last || last < cutoff;
    });
    if (inactive.length) {
      alerts.push({
        type: "inactive",
        emoji: "⏰",
        message: `${inactive.length} estudiante${inactive.length > 1 ? "s" : ""} lleva${
          inactive.length > 1 ? "n" : ""
        } ${config.inactivityDays} días sin registros de evaluación.`,
        count: inactive.length,
        students: inactive
          .map((sid) => {
            const last = lastRecordAt.get(sid);
            return {
              studentId: sid,
              name: studentName.get(sid) ?? "—",
              detail: last ? `Último registro: ${fmtDate(last)}` : "Sin registros",
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
        actionLabel: "Intervenir",
      });
    }
  }

  // 4) Concepto bajo (avg < riskThreshold en un concepto evaluativo)
  for (const [conceptId, cMap] of byConcept.entries()) {
    const conceptName = activities.find((a) => a.evaluativeConceptId === conceptId)?.evaluativeConcept.name;
    if (!conceptName) continue;
    const affected: AlertStudent[] = [];
    for (const [studentId, values] of cMap.entries()) {
      const a = avg(values);
      if (values.length && a < config.riskThreshold) {
        affected.push({ studentId, name: studentName.get(studentId) ?? "—", detail: `Prom. ${round1(a)}` });
      }
    }
    if (affected.length >= 3) {
      alerts.push({
        type: "concept",
        emoji: "📊",
        message: `${affected.length} estudiantes tienen notas bajas en el concepto ${conceptName}.`,
        count: affected.length,
        students: affected.sort((a, b) => a.name.localeCompare(b.name)),
        actionLabel: "Ver estudiantes",
      });
    }
  }

  // Priorización: riesgo > declive > inactividad > concepto; máx 4
  const order = { risk: 0, decline: 1, inactive: 2, concept: 3 } as const;
  alerts.sort((a, b) => order[a.type] - order[b.type] || b.count - a.count);
  const topAlerts = alerts.slice(0, 4);

  // ---------- Tareas por revisar (notas incompletas) ----------
  const pendingTasks: PendingTaskRow[] = [];
  for (const act of activities) {
    const total = activeByGroup.get(act.groupId)?.size ?? 0;
    const graded = gradedByActivity.get(act.id) ?? 0;
    if (total > 0 && graded < total) {
      pendingTasks.push({
        activityId: act.id,
        name: act.label || act.name,
        subjectName: act.subject.name,
        groupName: act.group.name,
        graded,
        total,
        periodName: act.period.name,
        createdAtISO: act.createdAt.toISOString(),
      });
    }
  }
  pendingTasks.sort((a, b) => a.graded / a.total - b.graded / b.total || b.createdAtISO.localeCompare(a.createdAtISO));

  // ---------- Actividad reciente (7 días, máx 10) ----------
  const recent: RecentActivityItem[] = [];
  const recentRecords = records
    .filter((r) => r.updatedAt >= new Date(now.getTime() - weekMs))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6);
  for (const r of recentRecords) {
    const act = activityById.get(r.activityId);
    if (!act) continue;
    recent.push({
      id: `grade-${r.activityId}-${r.studentId}`,
      kind: "grade",
      text: `Calificación ${round1(r.value)} · ${studentName.get(r.studentId) ?? "—"} en ${act.label || act.name} (${act.subject.name})`,
      createdAtISO: r.updatedAt.toISOString(),
    });
  }
  const studentNameById = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  for (const o of observations) {
    recent.push({
      id: `obs-${o.id}`,
      kind: "observation",
      text: `Observación registrada: ${o.title || "sin título"} — ${studentNameById.get(o.studentId) ?? "—"}`,
      createdAtISO: o.createdAt.toISOString(),
    });
  }
  for (const m of messages) {
    recent.push({
      id: `msg-${m.id}`,
      kind: "message",
      text: `Mensaje enviado a ${m.receiver?.fullName ?? "usuario"}`,
      createdAtISO: m.createdAt.toISOString(),
    });
  }
  recent.sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));

  return {
    ok: true,
    data: {
      teacherName: user.fullName,
      hasAssignments: true,
      currentPeriodName: contextPeriod?.name ?? null,
      kpis: {
        courses: groupIds.length,
        students: studentIds.length,
        pendingTasks: pendingTasks.length,
        gradedWeek,
        gradedWeekDelta: gradedWeek - gradedPrevWeek,
      },
      subjectPerformance,
      alerts: topAlerts,
      config,
      pendingTasks: pendingTasks.slice(0, 5),
      pendingTasksTotal: pendingTasks.length,
      recentActivity: recent.slice(0, 10),
    },
  };
}

// Guardar umbrales configurables del docente (validado y acotado en servidor)
export async function saveTeacherDashboardConfig(
  userId: string,
  input: { declineThreshold: number; inactivityDays: number; riskThreshold: number }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!user || !user.active) return { ok: false, reason: "user_not_found" };
  if (user.role !== "docente") return { ok: false, reason: "not_teacher" };

  const declineThreshold = Math.min(2, Math.max(0.1, Number(input.declineThreshold) || DEFAULT_CONFIG.declineThreshold));
  const inactivityDays = Math.min(30, Math.max(1, Math.round(Number(input.inactivityDays) || DEFAULT_CONFIG.inactivityDays)));
  const riskThreshold = Math.min(5, Math.max(0.5, Number(input.riskThreshold) || DEFAULT_CONFIG.riskThreshold));

  await db.teacherDashboardConfig.upsert({
    where: { teacherId: userId },
    update: { declineThreshold, inactivityDays, riskThreshold },
    create: { teacherId: userId, declineThreshold, inactivityDays, riskThreshold },
  });
  return { ok: true };
}
