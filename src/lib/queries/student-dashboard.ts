// [F1] Dashboard del estudiante — query agregada (emocional + accionable + gamificada)
// Una sola función, queries en paralelo, sin N+1. Todo por Prisma (parametrizado).
import { db } from "@/lib/db";

export interface NextAction {
  activityId: string;
  title: string;
  subjectName: string;
  urgency: "red" | "yellow" | "green";
}

export interface SubjectActivityItem {
  id: string;
  title: string;
  graded: boolean;
  value: number | null; // nota 0.0–5.0 si está calificada
  dateISO: string | null; // fecha de registro (updatedAt)
}

export interface SubjectCard {
  id: string;
  name: string;
  progress: number; // 0-100 (fórmula 40/60)
  graded: number;
  total: number;
  prom: number | null;
  items: SubjectActivityItem[]; // detalle para el modal de la asignatura
}

export interface AchievementCard {
  badgeId: string;
  name: string;
  icon: string;
  earnedAt: string | null; // ISO
  newlyAwarded: boolean;
  locked: boolean; // criterio no cumplido aún
}

export interface DailyMission {
  key: string;
  description: string;
  progress: number;
  target: number;
  xpReward: number;
  completed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Fórmula de progreso acordada: (calificadas/total)×40 + (prom/5.0×100)×60
function progressFormula(graded: number, total: number, prom: number | null): number {
  if (total === 0) return 0;
  const delivery = (graded / total) * 40;
  const perf = prom !== null ? (prom / 5.0) * 100 * 0.6 : 0;
  return Math.max(0, Math.min(100, Math.round(delivery * 0.4 + perf)));
}

export async function getStudentDashboard(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, institutionId: true },
  });
  if (!user || !user.active) return { ok: false as const, reason: "user_not_found" };
  if (user.role !== "estudiante") return { ok: false as const, reason: "not_student" };

  const student = await db.student.findFirst({
    where: { userId },
    include: { group: { select: { id: true, name: true } } },
  });
  if (!student) return { ok: true as const, linked: false as const, firstName: user.id };

  // Periodo activo de la institución
  const period = await db.period.findFirst({
    where: { institutionId: student.institutionId, active: true },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  // Grupo: prioriza Student.groupId; respaldo: última matrícula activa
  let groupId = student.groupId;
  if (!groupId) {
    const enr = await db.studentEnrollment.findFirst({
      where: { studentId: student.id, status: { in: ["matriculado", "renovado"] } },
      orderBy: { updatedAt: "desc" },
      select: { groupId: true },
    });
    groupId = enr?.groupId ?? null;
  }

  // Asignaturas visibles = unión de SubjectAssignment del grupo y materias con
  // actividades reales en el periodo (la asignación académica puede estar incompleta
  // mientras el docente ya registra actividades en Notas parciales).
  const [assignments, activitySubjects] = await Promise.all([
    groupId
      ? db.subjectAssignment.findMany({
          where: { groupId },
          include: { subject: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    groupId && period
      ? db.activity.findMany({
          where: { groupId, periodId: period.id },
          select: { subjectId: true, subject: { select: { id: true, name: true } } },
          distinct: ["subjectId"],
        })
      : Promise.resolve([]),
  ]);
  const subjectMap = new Map<string, { id: string; name: string }>();
  for (const a of assignments) subjectMap.set(a.subject.id, a.subject);
  for (const a of activitySubjects) subjectMap.set(a.subject.id, a.subject);
  const subjects = [...subjectMap.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const subjectIds = subjects.map((s) => s.id);

  const activities = groupId && period
    ? await db.activity.findMany({
        where: { groupId, periodId: period.id, subjectId: { in: subjectIds } },
        select: { id: true, subjectId: true, name: true, label: true, order: true },
        orderBy: [{ subjectId: "asc" }, { order: "asc" }],
      })
    : [];

  const records = period
    ? await db.gradeRecord.findMany({
        where: {
          studentId: student.id,
          activity: { periodId: period.id, subjectId: { in: subjectIds } },
        },
        select: { activityId: true, value: true, updatedAt: true, createdAt: true },
      })
    : [];

  const recByActivity = new Map(records.map((r) => [r.activityId, r]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  // ── Bloque C: mini-apps por asignatura (con detalle de actividades) ──
  const subjectCards: SubjectCard[] = subjects.map((s) => {
    const acts = activities.filter((ac) => ac.subjectId === s.id);
    const recs = acts.map((ac) => recByActivity.get(ac.id)).filter(Boolean);
    const prom = recs.length
      ? recs.reduce((sum, r) => sum + (r!.value ?? 0), 0) / recs.length
      : null;
    return {
      id: s.id,
      name: s.name,
      progress: progressFormula(recs.length, acts.length, prom),
      graded: recs.length,
      total: acts.length,
      prom: prom !== null ? Math.round(prom * 10) / 10 : null,
      items: acts.map((ac) => {
        const r = recByActivity.get(ac.id);
        return {
          id: ac.id,
          title: ac.label || ac.name,
          graded: !!r,
          value: r ? Math.round(r.value * 10) / 10 : null,
          dateISO: r?.updatedAt.toISOString() ?? null,
        };
      }),
    };
  });

  // ── Bloque A: progreso semanal + delta ──
  const promAll = records.length
    ? records.reduce((s, r) => s + r.value, 0) / records.length
    : null;
  const progress = progressFormula(records.length, activities.length, promAll);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const oldRecords = records.filter((r) => r.updatedAt < weekAgo);
  const promOld = oldRecords.length
    ? oldRecords.reduce((s, r) => s + r.value, 0) / oldRecords.length
    : null;
  const progressPrev = progressFormula(oldRecords.length, activities.length, promOld);
  const progressDelta = records.length ? progress - progressPrev : null;

  // ── Bloque B: próximas acciones (actividades sin nota) ──
  let periodElapsed = 0;
  if (period) {
    const span = period.endDate.getTime() - period.startDate.getTime();
    if (span > 0) periodElapsed = (Date.now() - period.startDate.getTime()) / span;
  }
  const urgency: NextAction["urgency"] = periodElapsed > 0.7 ? "red" : "yellow";
  const pendingActivities = activities.filter((ac) => !recByActivity.has(ac.id));
  const nextActions: NextAction[] = pendingActivities.slice(0, 5).map((ac) => ({
    activityId: ac.id,
    title: ac.label || ac.name,
    subjectName: subjectById.get(ac.subjectId)?.name ?? "General",
    urgency,
  }));
  const totalPending = pendingActivities.length;

  // ── Racha: 1 actualización por día ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = student.streak;
  const lastActive = student.lastActiveAt;
  let streakChanged = false;
  if (!lastActive) {
    streak = 1;
    streakChanged = true;
  } else {
    const lastDay = new Date(lastActive);
    lastDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - lastDay.getTime()) / DAY_MS);
    if (diffDays === 1) {
      streak = streak + 1;
      streakChanged = true;
    } else if (diffDays > 1) {
      streak = 1; // sin penalización visible: reinicia en 1, no en 0
      streakChanged = true;
    }
  }

  // ── Bloque D: logros (Badge existente + UserBadge persistente) ──
  const badges = await db.badge.findMany({
    where: { criteria: { in: ["streak_3", "streak_7", "high_grade", "all_up_to_date", "ten_activities"] } },
  });
  const earned = await db.userBadge.findMany({
    where: {
      userId,
      badgeId: { in: badges.map((b) => b.id) },
    },
    select: { badgeId: true, awardedAt: true },
  });
  const earnedMap = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));

  const rules: Record<string, boolean> = {
    streak_3: streak >= 3,
    streak_7: streak >= 7,
    high_grade: records.some((r) => r.value >= 4.5),
    all_up_to_date: totalPending === 0 && activities.length > 0,
    ten_activities: records.length >= 10,
  };

  // Otorga los nuevos (persistente) antes de responder
  const toAward = badges.filter((b) => (b.criteria ? rules[b.criteria] : false) && !earnedMap.has(b.id));
  if (toAward.length > 0) {
    await db.userBadge.createMany({
      data: toAward.map((b) => ({ userId, badgeId: b.id })),
    });
  }
  const achievements: AchievementCard[] = badges.map((b) => {
    const at = earnedMap.get(b.id) ?? (toAward.some((t) => t.id === b.id) ? new Date() : null);
    return {
      badgeId: b.id,
      name: b.name,
      icon: b.iconUrl || "🎖️",
      earnedAt: at ? at.toISOString() : null,
      newlyAwarded: !earnedMap.has(b.id) && toAward.some((t) => t.id === b.id),
      locked: at === null,
    };
  });
  // recientes primero: ganados por fecha desc, luego bloqueados
  achievements.sort((a, b) => {
    if (a.earnedAt && b.earnedAt) return a.earnedAt < b.earnedAt ? 1 : -1;
    if (a.earnedAt) return -1;
    if (b.earnedAt) return 1;
    return 0;
  });

  // ── Bloque E: misión diaria + XP ──
  const key = dateKey(today);
  let mission: DailyMission;
  let xpGain = 0;
  if (totalPending > 0) {
    const target = Math.min(totalPending, 3);
    const doneToday = records.filter((r) => r.createdAt >= today).length;
    mission = {
      key: "complete_pending",
      description: `Ponte al día: ${target} ${target === 1 ? "actividad sin nota" : "actividades sin nota"}`,
      progress: Math.min(doneToday, target),
      target,
      xpReward: 50,
      completed: doneToday >= target,
    };
  } else {
    mission = {
      key: "review_notes",
      description: "Revisa tus notas del periodo",
      progress: 1,
      target: 1,
      xpReward: 20,
      completed: true,
    };
  }
  const mp = await db.missionProgress.findUnique({
    where: { studentId_date_missionKey: { studentId: student.id, date: key, missionKey: mission.key } },
  });
  if (!mp) {
    // primer acceso del día: registra misión y otorga XP si ya está completa
    const completed = mission.completed;
    xpGain = completed ? mission.xpReward : 0;
    await db.missionProgress.create({
      data: {
        studentId: student.id,
        date: key,
        missionKey: mission.key,
        progress: mission.progress,
        target: mission.target,
        completed,
        xpAwarded: xpGain,
      },
    });
  } else if (!mp.completed && mission.completed) {
    // la misión se completó en esta carga
    xpGain = mission.xpReward;
    await db.missionProgress.update({
      where: { id: mp.id },
      data: { progress: mission.progress, completed: true, xpAwarded: xpGain },
    });
  } else {
    mission = { ...mission, progress: Math.max(mission.progress, mp.progress), completed: mp.completed || mission.completed };
  }

  const newXp = student.xp + xpGain;
  if (streakChanged || xpGain > 0) {
    await db.student.update({
      where: { id: student.id },
      data: {
        ...(streakChanged ? { streak, lastActiveAt: new Date() } : {}),
        ...(xpGain > 0 ? { xp: newXp } : {}),
      },
    });
  }

  return {
    ok: true as const,
    linked: true as const,
    firstName: student.firstName,
    groupName: student.group?.name ?? null,
    periodName: period?.name ?? null,
    progress,
    progressDelta,
    nextActions,
    totalPending,
    subjects: subjectCards,
    achievements,
    streak,
    mission: { ...mission, justCompleted: xpGain > 0 },
    xp: newXp,
    xpGained: xpGain,
    level: Math.min(10, Math.floor(newXp / 500) + 1),
    levelProgress: Math.round(((newXp % 500) / 500) * 100),
  };
}
