"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SectionShell } from "./critical-alerts";
import type { DirectivoData, DirectivoTrend } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque D] Tendencias del período.
// Máx. 6 indicadores (regla dura): valor actual + delta vs periodo
// anterior + flecha direccional coloreada + sparkline de los últimos
// 5 periodos (SVG propio, sin dependencia extra). Clic → detalle.
// ============================================================

const directionStyle = {
  up: { icon: <ArrowUpRight className="h-4 w-4" />, className: "text-emerald-600 dark:text-emerald-400", title: "Mejora" },
  flat: { icon: <Minus className="h-4 w-4" />, className: "text-muted-foreground", title: "Estable" },
  down: { icon: <ArrowDownRight className="h-4 w-4" />, className: "text-red-600 dark:text-red-400", title: "Empeora" },
} as const;

/** Sparkline SVG minimal: línea con huecos donde no hay dato. */
function Sparkline({ values, className }: { values: (number | null)[]; className?: string }) {
  const w = 72;
  const h = 22;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) {
    return <span className={cn("text-[10px] text-muted-foreground/60", className)}>sin serie</span>;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  // Segmentos: se corta la línea en los null para no inventar datos
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = i * step;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-[22px] w-[72px] shrink-0", className)} aria-hidden="true">
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
      ))}
    </svg>
  );
}

/** Módulo destino de cada indicador (null = fila informativa, no clickeable). */
function moduleFor(t: DirectivoTrend): string | null {
  if (t.indicator === "Rendimiento") return "consolidado";
  if (t.indicator === "Asistencia") return "asistencia";
  if (t.indicator === "Retiros") return null;
  return "notas"; // asignaturas del top-3
}

type Props = {
  data: DirectivoData;
  onOpenModule: (moduleKey: string) => void;
};

export function TrendsList({ data, onOpenModule }: Props) {
  const trends = data.trends.slice(0, 6);

  return (
    <SectionShell id="trends" title="Tendencias del período" icon={<TrendingUp className="h-4 w-4 text-primary" />}>
      <Card className="py-0">
        <ul className="divide-y">
          {trends.map((t) => {
            const dir = directionStyle[t.direction];
            const target = moduleFor(t);
            const Row = (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.indicator}</span>
                <span className="text-sm font-semibold tabular-nums">{t.value}</span>
                <span className={cn("flex w-14 items-center justify-end gap-0.5 text-xs font-medium tabular-nums", dir.className)}>
                  {t.delta != null ? `${t.delta > 0 ? "+" : ""}${String(t.delta).replace(".", ",")}%` : "—"}
                </span>
                <span className={cn("shrink-0", dir.className)} title={dir.title}>
                  {dir.icon}
                </span>
                <span className={dir.className}>
                  <Sparkline values={t.sparkline} />
                </span>
              </>
            );
            const base = "flex items-center gap-3 px-4 py-2.5";
            return (
              <li key={t.indicator}>
                {target ? (
                  <button
                    type="button"
                    onClick={() => onOpenModule(target)}
                    className={cn(base, "w-full text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:inset-ring focus-visible:outline-none")}
                    aria-label={`${t.indicator}: ${t.value}. Ver detalle`}
                  >
                    {Row}
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  </button>
                ) : (
                  <div className={cn(base, "text-muted-foreground")}>{Row}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </SectionShell>
  );
}
