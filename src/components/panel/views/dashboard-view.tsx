"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import {
  Users,
  GraduationCap,
  Building2,
  LayoutGrid,
  AlertTriangle,
  CalendarDays,
  Activity,
  Newspaper,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DashboardData {
  stats: {
    students: number;
    groups: number;
    teachers: number;
    activeSpaces: number;
    openEnrollments: number;
    pendingObservations: number;
    studentsAtRisk: number;
  };
  periods: Array<{ id: string; name: string; active: boolean; closed: boolean }>;
  performanceStats: { superior: number; alto: number; basico: number; bajo: number };
  attendanceStats: { presente: number; ausente: number; tarde: number; excusa: number };
  recentAudits: Array<{
    id: string;
    action: string;
    module: string;
    entityType: string;
    createdAt: string;
    user?: { fullName: string; username: string } | null;
  }>;
  studentsAtRisk: Array<{
    id: string;
    student: { firstName: string; lastName: string; code: string; group?: { name: string } | null };
    subject?: { name: string } | null;
    value?: number | null;
    performance?: string | null;
  }>;
  recentPosts: Array<{
    id: string;
    content: string;
    createdAt: string;
    author?: { fullName: string; role: string } | null;
    space?: { name: string } | null;
    _count?: { comments: number; reactions: number };
  }>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function perfChip(perf?: string | null) {
  if (perf === "superior") return "chip-superior";
  if (perf === "alto") return "chip-alto";
  if (perf === "basico") return "chip-basico";
  return "chip-bajo";
}

export function DashboardView() {
  const user = useAuthStore((s) => s.user);
  const setModule = useUIStore((s) => s.setModule);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(
      `/api/dashboard?userId=${user.id}&institutionId=${user.institution.id}&role=${user.role}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  const firstName = user.fullName.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">
            {greeting()}, {firstName}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen institucional de <strong>{user.institution.name}</strong> para el año
            académico <strong>{user.institution.academicYear}</strong>. Desde aquí puede supervisar
            indicadores clave, estudiantes en riesgo y la actividad reciente de la comunidad educativa.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {user.role === "rector" ? "Rectoría" : user.jobTitle || "Sesión activa"}
        </Badge>
      </header>

      {/* Stat row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="hairline rounded-xl bg-[var(--app-card)] p-4 h-28 skeleton-pulse" />
          ))
        ) : (
          <>
            <StatCard
              icon={<Users className="h-5 w-5" />}
              value={data?.stats.students ?? 0}
              label="Estudiantes activos"
              hint="Matrícula vigente"
            />
            <StatCard
              icon={<LayoutGrid className="h-5 w-5" />}
              value={data?.stats.groups ?? 0}
              label="Grupos"
              hint="Aulas configuradas"
            />
            <StatCard
              icon={<GraduationCap className="h-5 w-5" />}
              value={data?.stats.teachers ?? 0}
              label="Docentes"
              hint="Planta activa"
            />
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              value={data?.stats.activeSpaces ?? 0}
              label="Espacios"
              hint="Comunidades activas"
            />
          </>
        )}
      </section>

      {/* Two columns */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Students at risk */}
        <Card className="hairline lg:col-span-2 rounded-xl">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-[var(--perf-bajo)]" />
              Estudiantes en riesgo
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={() => setModule("pre-informe")}
            >
              Ver pre-informe <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Listado prioritario de estudiantes con desempeño bajo o básico en el periodo activo.
              Use esta señal temprana para activar refuerzos, citaciones a acudientes o remisiones a
              orientación escolar antes del cierre del periodo.
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-md skeleton-pulse" />
                ))}
              </div>
            ) : data && data.studentsAtRisk.length > 0 ? (
              data.studentsAtRisk.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hairline bg-[var(--app-card)]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.student.firstName} {s.student.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.student.group?.name ?? "Sin grupo"} · {s.subject?.name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{s.value ?? "—"}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md uppercase",
                        perfChip(s.performance)
                      )}
                    >
                      {s.performance ?? "—"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Sin estudiantes en riesgo"
                desc="No se detectaron calificaciones con desempeño bajo o básico en el periodo activo."
              />
            )}
          </CardContent>
        </Card>

        {/* Shortcuts */}
        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Atajos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Accesos rápidos a los módulos de mayor uso diario según su rol. Use estos accesos para
              reducir el tiempo de navegación durante la jornada académica.
            </p>
            <ShortcutRow
              icon={<FileText className="h-4 w-4" />}
              label="Pre-Informe"
              desc="Detección temprana"
              onClick={() => setModule("pre-informe")}
            />
            <ShortcutRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Asistencia"
              desc="Control diario"
              onClick={() => setModule("asistencia")}
            />
            <ShortcutRow
              icon={<Newspaper className="h-4 w-4" />}
              label="Comunidad"
              desc="Feed institucional"
              onClick={() => setModule("comunidad")}
            />
            <ShortcutRow
              icon={<FileText className="h-4 w-4" />}
              label="Actas"
              desc="Actas institucionales"
              onClick={() => setModule("actas")}
            />
          </CardContent>
        </Card>
      </section>

      {/* Active period summary */}
      <Card className="hairline rounded-xl">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Resumen del periodo activo
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {data?.periods?.find((p) => p.active)?.name ?? "Sin periodo activo"}
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Distribución del desempeño académico en el periodo vigente, calculada a partir de las
            calificaciones registradas hasta hoy. Los porcentajes orientan las decisiones de refuerzo
            y promoción al cierre del periodo.
          </p>
          {data && (
            <PerfBar stats={data.performanceStats} />
          )}
        </CardContent>
      </Card>

      {/* Attendance today */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Asistencia de hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Estado de la asistencia registrada el día de hoy en toda la institución. Las barras
            muestran la proporción por categoría y permiten detectar picos de ausentismo que
            requieran contacto con acudientes.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data && (
              <>
                <AttStat label="Presente" value={data.attendanceStats.presente} total={sumAtt(data.attendanceStats)} tone="emerald" />
                <AttStat label="Ausente" value={data.attendanceStats.ausente} total={sumAtt(data.attendanceStats)} tone="rose" />
                <AttStat label="Tarde" value={data.attendanceStats.tarde} total={sumAtt(data.attendanceStats)} tone="amber" />
                <AttStat label="Excusa" value={data.attendanceStats.excusa} total={sumAtt(data.attendanceStats)} tone="info" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bottom grid: recent activity + recent posts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Últimos movimientos registrados en la plataforma, con su hash de auditoría asociado.
              Esta traza es inmutable y respalda la rendición de cuentas institucional.
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-md skeleton-pulse" />
                ))}
              </div>
            ) : data && data.recentAudits.length > 0 ? (
              data.recentAudits.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-md hairline"
                >
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className="font-medium capitalize">{a.action}</span>{" "}
                      <span className="text-muted-foreground">en</span>{" "}
                      <span className="text-primary">{a.module}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.user?.fullName ?? "Sistema"} · {relativeTime(a.createdAt)}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {a.entityType}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title="Sin actividad reciente"
                desc="Aún no se registran movimientos auditables en la institución."
              />
            )}
          </CardContent>
        </Card>

        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="h-4 w-4 text-primary" />
              Publicaciones recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Últimos mensajes compartidos en los espacios de comunidad. Use el feed para
              fortalecer la comunicación con docentes, estudiantes y familias.
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-md skeleton-pulse" />
                ))}
              </div>
            ) : data && data.recentPosts.length > 0 ? (
              data.recentPosts.slice(0, 3).map((p) => (
                <div key={p.id} className="px-3 py-2 rounded-md hairline">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{p.author?.fullName ?? "—"}</span>
                    <span className="text-muted-foreground">{p.space?.name ?? "General"}</span>
                  </div>
                  <p className="text-sm mt-1 line-clamp-2">{p.content}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {p._count?.comments ?? 0} comentarios · {p._count?.reactions ?? 0} reacciones
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Newspaper className="h-5 w-5" />}
                title="Sin publicaciones"
                desc="Todavía no hay mensajes en los espacios de comunidad."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </motion.div>
  );
}

function sumAtt(a: { presente: number; ausente: number; tarde: number; excusa: number }) {
  return a.presente + a.ausente + a.tarde + a.excusa || 1;
}

function StatCard({
  icon,
  value,
  label,
  hint,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="hairline rounded-xl bg-[var(--app-card)] p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-md bg-secondary grid place-items-center text-primary">
          {icon}
        </div>
        <span className="text-2xl font-heading font-semibold tabular-nums">{value}</span>
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function ShortcutRow({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hairline hover:bg-secondary transition-colors text-left"
    >
      <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function PerfBar({
  stats,
}: {
  stats: { superior: number; alto: number; basico: number; bajo: number };
}) {
  const total = stats.superior + stats.alto + stats.basico + stats.bajo || 1;
  const items = [
    { key: "superior", label: "Superior", value: stats.superior, chip: "chip-superior", color: "var(--perf-superior)" },
    { key: "alto", label: "Alto", value: stats.alto, chip: "chip-alto", color: "var(--perf-alto)" },
    { key: "basico", label: "Básico", value: stats.basico, chip: "chip-basico", color: "var(--perf-basico)" },
    { key: "bajo", label: "Bajo", value: stats.bajo, chip: "chip-bajo", color: "var(--perf-bajo)" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden hairline">
        {items.map((it) => (
          <div
            key={it.key}
            className="h-full"
            style={{ width: `${(it.value / total) * 100}%`, backgroundColor: it.color }}
            title={`${it.label}: ${it.value}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", it.chip)} style={{ backgroundColor: it.color }} />
            <span className="text-muted-foreground">{it.label}</span>
            <span className="font-medium tabular-nums">{Math.round((it.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttStat({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "emerald" | "rose" | "amber" | "info";
}) {
  const pct = Math.round((value / total) * 100);
  const toneMap: Record<string, string> = {
    emerald: "var(--app-success)",
    rose: "var(--app-error)",
    amber: "var(--app-warning)",
    info: "var(--app-info)",
  };
  const Icon = tone === "emerald" ? CheckCircle2 : tone === "rose" ? XCircle : Clock;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" style={{ color: toneMap[tone] }} />
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: toneMap[tone] }} />
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">{pct}%</div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
      <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}
