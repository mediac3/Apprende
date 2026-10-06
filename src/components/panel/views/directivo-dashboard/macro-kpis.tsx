"use client";

import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CalendarCheck, Minus, TrendingUp, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DirectivoData } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque B] 6 KPIs macro (regla dura: nunca más).
// Cada KPI es clickeable: baja un nivel del drill-down o salta a la
// sección correspondiente. Delta vs periodo/año anterior con color
// semántico (verde mejora, rojo empeora, gris estable/informativo).
// ============================================================

export type KpiNavigateTarget = "alerts" | "trends" | "distribution" | "module:usuarios";

type Props = {
  data: DirectivoData;
  onNavigate: (target: KpiNavigateTarget) => void;
};

const fmt = new Intl.NumberFormat("es-CO");

function DeltaBadge({ delta, colored }: { delta: number | null; colored: boolean }) {
  if (delta == null) {
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> sin comparación
      </span>
    );
  }
  const stable = Math.abs(delta) < 0.1;
  const good = colored ? delta > 0 : null;
  const Icon = stable ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium",
        stable ? "text-muted-foreground" : colored ? (good ? "text-emerald-600" : "text-red-600") : "text-slate-600 dark:text-slate-400"
      )}
    >
      <Icon className="h-3 w-3" />
      {delta > 0 ? "+" : ""}
      {colored ? `${delta}%` : fmt.format(delta)}
    </span>
  );
}

export function MacroKpis({ data, onNavigate }: Props) {
  const { kpis } = data;
  const pct = (v: number | null) => (v == null ? "--" : `${String(v).replace(".", ",")}%`);

  const cards: {
    key: string;
    label: string;
    icon: React.ReactNode;
    value: string;
    delta: number | null;
    colored: boolean;
    target: KpiNavigateTarget;
  }[] = [
    {
      key: "students",
      label: "Estudiantes",
      icon: <Users className="h-4 w-4" />,
      value: fmt.format(kpis.students.value ?? 0),
      delta: kpis.students.delta,
      colored: false,
      target: "distribution",
    },
    {
      key: "teachers",
      label: "Docentes",
      icon: <UserCog className="h-4 w-4" />,
      value: fmt.format(kpis.teachers.value ?? 0),
      delta: kpis.teachers.delta,
      colored: false,
      target: data.header.scope.allInstitution ? "module:usuarios" : "distribution",
    },
    {
      key: "groups",
      label: "Cursos / grupos",
      icon: <BookOpen className="h-4 w-4" />,
      value: fmt.format(kpis.groups.value ?? 0),
      delta: kpis.groups.delta,
      colored: false,
      target: "distribution",
    },
    {
      key: "attendance",
      label: "Asistencia",
      icon: <CalendarCheck className="h-4 w-4" />,
      value: pct(kpis.attendance.value),
      delta: kpis.attendance.delta,
      colored: true,
      target: "alerts",
    },
    {
      key: "performance",
      label: "Rendimiento",
      icon: <TrendingUp className="h-4 w-4" />,
      value: pct(kpis.performance.value),
      delta: kpis.performance.delta,
      colored: true,
      target: "trends",
    },
    {
      key: "alerts",
      label: "Alertas activas",
      icon: <AlertTriangle className="h-4 w-4" />,
      value: fmt.format(kpis.alerts.value ?? 0),
      delta: null,
      colored: false,
      target: "alerts",
    },
  ];

  return (
    <section aria-label="Indicadores institucionales" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          data-testid={`kpi-${c.key}`}
          onClick={() => onNavigate(c.target)}
          aria-label={`${c.label}: ${c.value}. Ver detalle`}
          className="rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="text-primary">{c.icon}</span>
            {c.label}
          </span>
          <span className="mt-1 block text-3xl font-bold leading-none tracking-tight md:text-4xl">{c.value}</span>
          <span className="mt-2 flex items-center justify-between">
            <DeltaBadge delta={c.delta} colored={c.colored} />
            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
          </span>
        </button>
      ))}
    </section>
  );
}
