// [Dashboard Padre] Query agregada del acudiente — "¿Cómo está mi hijo y cómo puedo ayudar?"
// Narrativa + accionable. Seguridad: SOLO estudiantes con userId = parentId (query parametrizada).
// Patrón: student-dashboard.ts (periodo activo, unión de asignaturas, agregaciones en memoria).
import { db } from "@/lib/db";

export interface ParentChild {
  id: string;
  firstName: string;
  lastName: string;
  groupName: string | null;
}

export interface ParentSubjectItem {
  id: string;
  title: string;
  graded: boolean;
  value: number | null; // nota 0.0–5.0 si está calificada
  dateISO: string | null;
}

export interface ParentSubject {
  id: string;
  name: string;
  prom: number | null; // promedio 0.0–5.0 del periodo activo
  prevProm: number | null; // promedio del periodo anterior (delta)
  pct: number | null; // prom/5*100
  band: "verde" | "azul" | "amarillo" | "rojo" | null; // verde ≥4, azul 3–3.9, amarillo 2–2.9, rojo <2
  items: ParentSubjectItem[]; // detalle de evaluaciones de la materia (periodo seleccionado)
}

export interface HelpRecommendation {
  icon: string;
  message: string; // narrativo
  action: string; // sugerencia accionable
}

export interface ParentActivity {
  activityId: string;
  title: string;
  subjectName: string;
  urgency: "red" | "yellow" | "green";
}

export interface AttendanceDay {
  dateISO: string;
  status: "presente" | "tarde" | "ausente" | "excusa"; // peor estado del día
}

export interface BehaviorObservation {
  dateISO: string;
  title: string | null;
  description: string; // truncado a 160 chars
  severity: string | null;
  status: string;
}

export interface RecentMessage {
  id: string;
  direction: "sent" | "received";
  counterpart: string;
  preview: string;
  createdAtISO: string;
  read: boolean;
}

export interface Student360 {
  narrative: string;
  traits: { icon: string; label: string }[];
}

export interface Celebration {
  icon: string;
  message: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RIESGO_ACADEMICO = 3.0; // umbral coherente con DashboardSetting por defecto
const MEJORA_UMBRAL = 0.5;
const RACHA_DIAS = 5;

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function bandOf(prom: number): ParentSubject["band"] {
  if (prom >= 4) return "verde";
  if (prom >= 3) return "azul";
  if (prom >= 2) return "amarillo";
  return "rojo";
}

export async function getParentDashboard(parentId: string, childId?: string | null, periodId?: string | null) {
  // ── Gate de rol (fresco desde BD, no de sesión) ──
  const user = await db.user.findUnique({
    where: { id: parentId },
    select: { id: true, fullName: true, role: true, active: true, institutionId: true },
  });
  if (!user || !user.active) return { ok: false as const, reason: "user_not_found" };
  if (user.role !== "acudiente") return { ok: false as const, reason: "not_acudiente" };

  // ── Seguridad: SOLO hijos vinculados al acudiente vía ParentStudent ──
  // (Student.userId es la cuenta propia del estudiante; el vínculo del acudiente es N:M)
  const children = await db.student.findMany({
    where: { parentLinks: { some: { parentId } } },
    select: { id: true, firstName: true, lastName: true, groupId: true, group: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  if (children.length === 0) {
    return { ok: true as const, linked: false as const, parentName: user.fullName };
  }

  // childId ajeno → bloqueado (403 en la API)
  const activeChild = childId ? children.find((c) => c.id === childId) : children[0];
  if (!activeChild) return { ok: false as const, reason: "child_not_linked" };

  // ── Periodo seleccionado (o el ACTIVO de la configuración del sistema) + anterior del mismo modelo ──
  // El periodId del selector se valida contra la institución (ajeno → cae al activo, sin error).
  let period = periodId
    ? await db.period.findFirst({
        where: { id: periodId, institutionId: user.institutionId },
        select: { id: true, name: true, startDate: true, endDate: true, educationalModelId: true },
      })
    : null;
  if (!period) {
    period = await db.period.findFirst({
      where: { institutionId: user.institutionId, active: true },
      select: { id: true, name: true, startDate: true, endDate: true, educationalModelId: true },
    });
  }
  const prevPeriod = period
    ? await db.period.findFirst({
        where: {
          institutionId: user.institutionId,
          ...(period.educationalModelId ? { educationalModelId: period.educationalModelId } : {}),
          endDate: { lt: period.startDate },
        },
        orderBy: { startDate: "desc" },
        select: { id: true, name: true },
      })
    : null;

  // Catálogo de periodos para el selector del dashboard (asc = Periodo 1 → N)
  const periods = await db.period.findMany({
    where: { institutionId: user.institutionId },
    select: { id: true, name: true, active: true },
    orderBy: { startDate: "asc" },
  });

  // ── Grupo efectivo (mismo respaldo que student-dashboard) ──
  let groupId = activeChild.groupId ?? null;
  if (!groupId) {
    const enr = await db.studentEnrollment.findFirst({
      where: { studentId: activeChild.id, status: { in: ["matriculado", "renovado"] } },
      orderBy: { updatedAt: "desc" },
      select: { groupId: true },
    });
    groupId = enr?.groupId ?? null;
  }

  // ── Asignaturas visibles: unión de SubjectAssignment y materias con actividades ──
  const periodIds = [period?.id, prevPeriod?.id].filter((x): x is string => !!x);
  const [assignments, activitySubjects] = await Promise.all([
    groupId
      ? db.subjectAssignment.findMany({
          where: { groupId },
          include: { subject: { select: { id: true, name: true, averages: true } } },
        })
      : Promise.resolve([]),
    groupId && periodIds.length
      ? db.activity.findMany({
          where: { groupId, periodId: { in: periodIds } },
          select: { subjectId: true, subject: { select: { id: true, name: true, averages: true } } },
          distinct: ["subjectId"],
        })
      : Promise.resolve([]),
  ]);
  const subjectMap = new Map<string, { id: string; name: string; averages: boolean }>();
  for (const a of assignments) subjectMap.set(a.subject.id, a.subject);
  for (const a of activitySubjects) subjectMap.set(a.subject.id, a.subject);
  // Solo materias que promedian (Subject.averages) — coherente con la planilla
  const subjects = [...subjectMap.values()].filter((s) => s.averages).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const subjectIds = subjects.map((s) => s.id);

  // ── Actividades y notas del hijo (ambos periodos en una query) ──
  const activities = groupId && periodIds.length
    ? await db.activity.findMany({
        where: { groupId, periodId: { in: periodIds }, subjectId: { in: subjectIds } },
        select: { id: true, subjectId: true, periodId: true, name: true, label: true },
      })
    : [];
  const records = await db.gradeRecord.findMany({
    where: {
      studentId: activeChild.id,
      ...(periodIds.length ? { activity: { periodId: { in: periodIds } } } : {}),
    },
    select: { activityId: true, value: true, updatedAt: true, activity: { select: { periodId: true, subjectId: true, subject: { select: { name: true } } } } },
  });

  // Promedio por materia/periodo en memoria
  const recByActivity = new Map(records.map((r) => [r.activityId, r]));
  const avgFor = (sid: string, pid?: string): number | null => {
    const rs = records.filter((r) => r.activity.subjectId === sid && (!pid || r.activity.periodId === pid));
    return rs.length ? rs.reduce((s, r) => s + r.value, 0) / rs.length : null;
  };
  // Promedio general del hijo: todas las materias del periodo (no una materia)
  const recordsActive = period ? records.filter((r) => r.activity.periodId === period.id) : records;
  const promActive = recordsActive.length ? recordsActive.reduce((s, r) => s + r.value, 0) / recordsActive.length : null;
  const recordsPrev = prevPeriod ? records.filter((r) => r.activity.periodId === prevPeriod.id) : [];
  const promPrev = prevPeriod ? (recordsPrev.length ? recordsPrev.reduce((s, r) => s + r.value, 0) / recordsPrev.length : null) : null;
  const averageDelta = promActive !== null && promPrev !== null ? round1(promActive - promPrev) : null;

  const activePeriodActivities = activities.filter((a) => a.periodId === period?.id);

  const parentSubjects: ParentSubject[] = subjects.map((s) => {
    const prom = period ? avgFor(s.id, period.id) : avgFor(s.id);
    return {
      id: s.id,
      name: s.name,
      prom: prom !== null ? round1(prom) : null,
      prevProm: prevPeriod ? (() => { const p = avgFor(s.id, prevPeriod.id); return p !== null ? round1(p) : null; })() : null,
      pct: prom !== null ? Math.round((prom / 5) * 100) : null,
      band: prom !== null ? bandOf(prom) : null,
      // [Detalle por materia] evaluaciones del periodo seleccionado con su nota
      items: activePeriodActivities.filter((a) => a.subjectId === s.id).map((a) => {
        const r = recByActivity.get(a.id);
        return {
          id: a.id,
          title: a.label || a.name,
          graded: !!r,
          value: r ? Math.round(r.value * 10) / 10 : null,
          dateISO: r?.updatedAt.toISOString() ?? null,
        };
      }),
    };
  }).filter((s) => s.prom !== null || s.prevProm !== null); // sin datos en ambos periodos → fuera

  // ── Actividades pendientes (sin nota del hijo) en el periodo activo ──
  let periodElapsed = 0;
  if (period) {
    const span = period.endDate.getTime() - period.startDate.getTime();
    if (span > 0) periodElapsed = (Date.now() - period.startDate.getTime()) / span;
  }
  const urgency: ParentActivity["urgency"] = periodElapsed > 0.7 ? "red" : periodElapsed > 0.4 ? "yellow" : "green";
  const pending = activePeriodActivities.filter((a) => !recByActivity.has(a.id));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const upcomingActivities: ParentActivity[] = pending.slice(0, 5).map((a) => ({
    activityId: a.id,
    title: a.label || a.name,
    subjectName: subjectById.get(a.subjectId)?.name ?? "General",
    urgency,
  }));
  const pendingCount = pending.length;

  // ── Asistencia del periodo (KPI: (total − ausentes)/total, tarde y excusa no restan) ──
  const since = period?.startDate ?? new Date(Date.now() - 120 * DAY_MS);
  const attendance = await db.attendance.findMany({
    where: { studentId: activeChild.id, date: { gte: since } },
    select: { date: true, status: true, excuseReason: true },
    orderBy: { date: "asc" },
  });
  const totalAtt = attendance.length;
  const ausentes = attendance.filter((a) => a.status === "ausente").length;
  const justificadas = attendance.filter((a) => a.status === "excusa").length;
  const tardes = attendance.filter((a) => a.status === "tarde").length;
  const attendancePct = totalAtt ? Math.round(((totalAtt - ausentes) / totalAtt) * 100) : null;

  // Racha: días consecutivos (hacia atrás desde hoy) sin ausencia real (ausente/excusa cortan; día sin registro = sin clase, neutro)
  const byDay = new Map<string, string[]>();
  for (const a of attendance) {
    const k = dateKey(a.date);
    byDay.set(k, [...(byDay.get(k) ?? []), a.status]);
  }
  let streak = 0;
  for (let i = 0; i < 60 && streak < 30; i++) {
    const k = dateKey(new Date(Date.now() - i * DAY_MS));
    const sts = byDay.get(k);
    if (!sts || sts.length === 0) continue; // sin clase / festivo
    if (sts.includes("ausente") || sts.includes("excusa")) break;
    streak++;
  }

  // Calendario del mes en curso (peor estado por día: ausente > excusa > tarde > presente)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rank: Record<string, number> = { presente: 0, tarde: 1, excusa: 2, ausente: 3 };
  const calendarMap = new Map<string, string>();
  for (const a of attendance) {
    if (a.date < monthStart) continue;
    const k = dateKey(a.date);
    const cur = calendarMap.get(k);
    if (!cur || rank[a.status] > rank[cur]) calendarMap.set(k, a.status);
  }
  const calendar: AttendanceDay[] = [...calendarMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, status]) => ({ dateISO: k, status: status as AttendanceDay["status"] }));

  // ── Comportamiento: Observations de convivencia ──
  const observations = await db.observation.findMany({
    where: { studentId: activeChild.id, category: "convivencia" },
    orderBy: { date: "desc" },
    take: 5,
    select: { date: true, title: true, description: true, severity: true, status: true },
  });
  const abiertas = observations.filter((o) => o.status !== "cerrada" && (o.severity === "media" || o.severity === "alta"));
  const behaviorStatus: "excelente" | "bueno" | "con_observaciones" =
    abiertas.length > 0 ? "con_observaciones" : observations.length > 0 ? "bueno" : "excelente";
  const lastObservation: BehaviorObservation | null = observations[0]
    ? {
        dateISO: observations[0].date.toISOString(),
        title: observations[0].title,
        description: observations[0].description.length > 160 ? `${observations[0].description.slice(0, 157)}…` : observations[0].description,
        severity: observations[0].severity,
        status: observations[0].status,
      }
    : null;

  // ── Mensajería: últimos 5 mensajes del acudiente ──
  const messages = await db.message.findMany({
    where: { OR: [{ senderId: parentId }, { receiverId: parentId }] },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true, senderId: true, receiverId: true, content: true, readAt: true, createdAt: true,
      sender: { select: { fullName: true } },
      receiver: { select: { fullName: true } },
    },
  });
  const recentMessages: RecentMessage[] = messages.map((m) => ({
    id: m.id,
    direction: m.senderId === parentId ? ("sent" as const) : ("received" as const),
    counterpart: m.senderId === parentId ? (m.receiver?.fullName ?? "Colegio") : (m.sender?.fullName ?? "Colegio"),
    preview: m.content.length > 90 ? `${m.content.slice(0, 87)}…` : m.content,
    createdAtISO: m.createdAt.toISOString(),
    read: m.readAt !== null || m.senderId === parentId,
  }));

  // ── Pool de hitos → Bloque D (top 3 recomendaciones) y Bloque J (resto, celebraciones) ──
  // Prioridad: intervención (0-1) > mejora/celebración (2-3) > informativo (4)
  type Milestone = { key: string; priority: number; icon: string; message: string; action: string; celebrate: string };
  const first = activeChild.firstName;
  const milestones: Milestone[] = [];

  const debiles = parentSubjects.filter((s) => s.prom !== null && s.prom < RIESGO_ACADEMICO);
  for (const s of debiles.slice(0, 1)) {
    milestones.push({
      key: `apoyo-${s.id}`, priority: 0, icon: "📚",
      message: `${first} está reforzando ${s.name} (${String(s.prom).replace(".", ",")}).`,
      action: `Dediquen 15 minutos a repasar ${s.name} en casa; pregúntale qué tema le cuesta más.`,
      celebrate: "",
    });
  }
  if (pendingCount > 0) {
    const names = [...new Set(pending.slice(0, 3).map((a) => subjectById.get(a.subjectId)?.name ?? "General"))].join(", ");
    milestones.push({
      key: "pendientes", priority: 1, icon: "🎯",
      message: `Tiene ${pendingCount} ${pendingCount === 1 ? "evaluación pendiente" : "evaluaciones pendientes"} este período (${names}${pendingCount > 3 ? "…" : ""}).`,
      action: "Pregúntale cómo van y ayúdale a organizar su tiempo esta semana.",
      celebrate: "",
    });
  }
  const mejoras = parentSubjects.filter((s) => s.prom !== null && s.prevProm !== null && s.prom - s.prevProm >= MEJORA_UMBRAL);
  for (const s of mejoras.slice(0, 2)) {
    const delta = round1((s.prom ?? 0) - (s.prevProm ?? 0));
    milestones.push({
      key: `mejora-${s.id}`, priority: 2, icon: "✨",
      message: `${first} mejoró ${String(delta).replace(".", ",")} puntos en ${s.name} este período.`,
      action: "¡Felicítale su esfuerzo! Reconocerlo refuerza la mejora.",
      celebrate: `Mejoró ${String(delta).replace(".", ",")} puntos en ${s.name}`,
    });
  }
  if (streak >= RACHA_DIAS) {
    milestones.push({
      key: "racha", priority: 3, icon: "🔥",
      message: `Lleva ${streak} días consecutivos sin faltar.`,
      action: "Reconócele ese compromiso: la constancia se construye en casa.",
      celebrate: `${streak} días con asistencia perfecta`,
    });
  }
  const topGrade = [...records].filter((r) => r.activity.periodId === period?.id).sort((a, b) => b.value - a.value)[0];
  if (topGrade && topGrade.value >= 4.5) {
    milestones.push({
      key: `nota-${topGrade.activityId}`, priority: 4, icon: "🏆",
      message: `Obtuvo ${String(round1(topGrade.value)).replace(".", ",")} en ${topGrade.activity.subject.name}.`,
      action: "Celebra ese logro: un reconocimiento en casa vale oro.",
      celebrate: `Nota destacada (${String(round1(topGrade.value)).replace(".", ",")}) en ${topGrade.activity.subject.name}`,
    });
  }
  milestones.sort((a, b) => a.priority - b.priority);
  const helpRecommendations: HelpRecommendation[] = milestones.slice(0, 3).map((m) => ({
    icon: m.icon, message: m.message, action: m.action,
  }));
  const celebrations: Celebration[] = milestones
    .slice(3)
    .filter((m) => m.celebrate)
    .map((m) => ({ icon: m.icon, message: m.celebrate }));

  // ── Student 360°: narrativa + rasgos SOLO con evidencia real ──
  const traits: Student360["traits"] = [];
  const narrParts: string[] = [];
  if (promActive !== null) {
    narrParts.push(`${first} cursa ${activeChild.group?.name ?? "su grupo"} y su promedio${period ? ` en ${period.name}` : ""} es de ${String(round1(promActive)).replace(".", ",")}.`);
    if (promActive >= 4) traits.push({ icon: "🌟", label: "Promedio destacado" });
  }
  const best = parentSubjects.filter((s) => s.prom !== null).sort((a, b) => (b.prom ?? 0) - (a.prom ?? 0))[0];
  if (best && best.prom !== null && best.prom >= 4) {
    traits.push({ icon: "📚", label: `Le va bien en ${best.name}` });
    narrParts.push(`Destaca en ${best.name}.`);
  }
  if (mejoras.length > 0 && mejoras[0].prom !== null) {
    traits.push({ icon: "📈", label: `Mejoró en ${mejoras[0].name}` });
    narrParts.push(`Se le nota una mejora sostenida en ${mejoras[0].name}.`);
  }
  if (debiles.length > 0 && debiles[0].prom !== null) {
    narrParts.push(`Está reforzando ${debiles[0].name} con acompañamiento.`);
  }
  if (attendancePct !== null && totalAtt >= 5) {
    narrParts.push(`Su asistencia es del ${attendancePct}%.`);
    if (attendancePct >= 95) traits.push({ icon: "🔥", label: "Asistencia impecable" });
  }
  const student360: Student360 | null = narrParts.length >= 2 ? { narrative: narrParts.join(" "), traits } : null;

  // ── Respuesta ──
  return {
    ok: true as const,
    linked: true as const,
    parentName: user.fullName,
    children: children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, groupName: c.group?.name ?? null })),
    activeChildId: activeChild.id,
    activeChildName: `${activeChild.firstName} ${activeChild.lastName}`.trim(),
    activeChildFirstName: first,
    groupName: activeChild.group?.name ?? null,
    periodName: period?.name ?? null,
    periodId: period?.id ?? null,
    periods,
    prevPeriodName: prevPeriod?.name ?? null,
    kpis: {
      average: promActive !== null ? round1(promActive) : null,
      averageDelta,
      attendancePct,
      attendanceTotal: totalAtt,
      behaviorStatus,
      pendingCount,
    },
    subjects: parentSubjects,
    helpRecommendations,
    upcomingActivities,
    pendingTotal: pendingCount,
    student360,
    attendanceDetail: {
      pct: attendancePct,
      total: totalAtt,
      justified: justificadas,
      unjustified: ausentes,
      late: tardes,
      streak,
      calendar,
    },
    behavior: {
      status: behaviorStatus,
      lastObservation,
      totalObservations: observations.length,
    },
    communication: { recentMessages },
    celebrations,
  };
}

export type ParentDashboardResult = Awaited<ReturnType<typeof getParentDashboard>>;
