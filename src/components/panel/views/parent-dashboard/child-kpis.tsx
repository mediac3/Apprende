"use client";

// [Dashboard Padre] Bloque B — 4 KPIs cálidos con delta y acción (2×2 en móvil).
// Regla dura: ningún número frío — siempre label cálido + contexto.
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/store/ui-store";
import type { ParentDashboardResult } from "@/lib/queries/parent-dashboard";
import type { ReactNode } from "react";
import { fmt } from "./use-parent-dashboard";

type Kpis = Extract<ParentDashboardResult, { linked: true }>["kpis"];

const BEHAVIOR_LABEL = {
  excelente: "Excelente",
  bueno: "Bueno",
  con_observaciones: "Con observaciones",
} as const;

function DeltaChip({ delta, vs }: { delta: number | null; vs: string | null }) {
  if (delta === null) return null;
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        flat
          ? "bg-muted text-muted-foreground"
          : up
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      {flat ? "= sin cambio" : `${up ? "↑" : "↓"} ${up ? "+" : "−"}${fmt(Math.abs(delta))}`}
      {vs ? <span className="font-normal opacity-70">vs {vs}</span> : null}
    </span>
  );
}

function KpiCard({
  emoji,
  label,
  value,
  unit,
  sub,
  onClick,
  testId,
}: {
  emoji: string;
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <Card
      data-testid={testId}
      onClick={onClick}
      className={cn("p-4 transition-shadow", onClick && "cursor-pointer hover:shadow-md")}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-lg" aria-hidden>{emoji}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {value}
        {unit ? <span className="text-sm font-normal text-muted-foreground"> {unit}</span> : null}
      </p>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </Card>
  );
}

export function ChildKpis({
  kpis,
  prevPeriodName,
  onNavigate,
}: {
  kpis: Kpis;
  prevPeriodName: string | null;
  onNavigate: (m: ModuleKey) => void;
}) {
  const attSub =
    kpis.attendancePct === null
      ? "Sin registros aún"
      : kpis.attendancePct >= 95
        ? "¡Constancia impecable!"
        : kpis.attendancePct >= 85
          ? "Muy constante"
          : "Sigamos juntos";
  return (
    <section aria-label="Resumen del hijo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        testId="parent-kpi-promedio"
        emoji="📈"
        label="Promedio general"
        value={kpis.average !== null ? fmt(kpis.average) : "—"}
        unit={kpis.average !== null ? "/ 5.0" : undefined}
        sub={<DeltaChip delta={kpis.averageDelta} vs={prevPeriodName} />}
        onClick={kpis.average !== null ? () => onNavigate("notas-acudientes") : undefined}
      />
      <KpiCard
        testId="parent-kpi-asistencia"
        emoji="📅"
        label="Asistencia"
        value={kpis.attendancePct !== null ? `${kpis.attendancePct}%` : "—"}
        sub={<span>{attSub}</span>}
        onClick={kpis.attendancePct !== null ? () => onNavigate("asistencia") : undefined}
      />
      <KpiCard
        testId="parent-kpi-comportamiento"
        emoji={kpis.behaviorStatus === "excelente" ? "🌟" : kpis.behaviorStatus === "bueno" ? "🙂" : "📝"}
        label="Comportamiento"
        value={BEHAVIOR_LABEL[kpis.behaviorStatus]}
        sub={<span>{kpis.behaviorStatus === "excelente" ? "Referente de convivencia" : "Acompañemos el proceso"}</span>}
      />
      <KpiCard
        testId="parent-kpi-pendientes"
        emoji="📝"
        label="Por entregar"
        value={String(kpis.pendingCount)}
        sub={
          <button
            className="underline-offset-2 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById("parent-actividades")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            {kpis.pendingCount > 0 ? "Ver cuáles son" : "¡Está al día! 🎉"}
          </button>
        }
      />
    </section>
  );
}
