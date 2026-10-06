"use client";

import { useState } from "react";
import { ChartPie } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SectionShell } from "./critical-alerts";
import type { DirectivoData, DirectivoDrill, DistributionItem } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque E] Distribución de estudiantes.
// Toggle Por sede / Por grado / Por jornada con barras horizontales.
// Clic en una barra de sede o grado = drill-down (la barra "Otros" y
// la jornada son informativas).
// ============================================================

type Mode = "sede" | "grado" | "jornada";

const MODES: { key: Mode; label: string }[] = [
  { key: "sede", label: "Por sede" },
  { key: "grado", label: "Por grado" },
  { key: "jornada", label: "Por jornada" },
];

type Props = {
  data: DirectivoData;
  drill: DirectivoDrill;
  onDrill: (patch: Partial<DirectivoDrill>) => void;
};

function DistributionBar({
  item,
  onClick,
  active,
}: {
  item: DistributionItem;
  onClick?: () => void;
  active?: boolean;
}) {
  const pct = item.pct ?? 0;
  const content = (
    <>
      <span className="w-28 shrink-0 truncate text-xs font-medium md:w-36" title={item.name}>
        {item.name}
      </span>
      <span className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
        <span
          className={cn("block h-full rounded-md transition-all", onClick ? "bg-primary" : "bg-primary/50")}
          style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
      </span>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {item.count} · {String(pct).replace(".", ",")}%
      </span>
    </>
  );
  const base = "flex w-full items-center gap-3 rounded-md px-2 py-1";
  if (!onClick) {
    return <div className={cn(base, "text-foreground/80")}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.name}: ${item.count} estudiantes (${pct}%). Ver detalle`}
      className={cn(
        base,
        "text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
        active && "bg-primary/5 ring-1 ring-primary/30"
      )}
    >
      {content}
    </button>
  );
}

export function DistributionChart({ data, drill, onDrill }: Props) {
  // Si la URL compartida trae grado activo, arrancar en modo "Por grado"
  const [mode, setMode] = useState<Mode>(() => (drill.grado ? "grado" : "sede"));
  const items =
    mode === "sede" ? data.distribution.bySede : mode === "grado" ? data.distribution.byGrado : data.distribution.byJornada;

  return (
    <SectionShell id="distribution" title="Distribución" icon={<ChartPie className="h-4 w-4 text-primary" />}>
      <Card className="gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          {/* Toggle dual/triple de modo */}
          <div className="inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Modo de distribución">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none",
                  mode === m.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{data.distribution.totalStudents} estudiantes</span>
        </div>

        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin datos de distribución.</p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const isOther = item.id === "otros";
              if (mode === "sede") {
                return (
                  <DistributionBar
                    key={item.id}
                    item={item}
                    active={drill.sede === item.id}
                    onClick={isOther ? undefined : () => onDrill({ sede: item.id, grado: null, grupo: null })}
                  />
                );
              }
              if (mode === "grado") {
                return (
                  <DistributionBar
                    key={item.id}
                    item={item}
                    active={drill.grado === item.id}
                    onClick={isOther ? undefined : () => onDrill({ grado: item.id, grupo: null })}
                  />
                );
              }
              return <DistributionBar key={item.id} item={item} />;
            })}
          </div>
        )}

        {/* Nivel 3 del drill-down: grupos del grado activo (clic → filtra por grupo) */}
        {mode === "grado" && drill.grado && data.drill.groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
            <span className="text-xs text-muted-foreground">Grupos:</span>
            {data.drill.groups.map((g) => {
              const active = drill.grupo === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onDrill({ grupo: active ? null : g.id })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                    active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {g.name} · {g.students}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </SectionShell>
  );
}
