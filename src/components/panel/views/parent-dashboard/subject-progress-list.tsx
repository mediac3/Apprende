"use client";

// [Dashboard Padre] Bloque C — materias con barra de progreso y color por rango.
// Máx. 8 visibles + "Ver todas". Click → notas del área.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParentSubject } from "@/lib/queries/parent-dashboard";
import { fmt } from "./use-parent-dashboard";

const MAX_VISIBLE = 8;

const BAND_BAR: Record<NonNullable<ParentSubject["band"]>, string> = {
  verde: "bg-emerald-500",
  azul: "bg-sky-500",
  amarillo: "bg-amber-500",
  rojo: "bg-rose-500",
};

export function SubjectProgressList({
  subjects,
  childFirstName,
  onNavigate,
}: {
  subjects: ParentSubject[];
  childFirstName: string;
  onNavigate: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (subjects.length === 0) return null; // regla dura: sin datos → sin bloque

  const visible = showAll ? subjects : subjects.slice(0, MAX_VISIBLE);
  const hidden = subjects.length - MAX_VISIBLE;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Materias de {childFirstName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5" data-testid="parent-materias">
        {visible.map((s) => {
          const delta = s.prom !== null && s.prevProm !== null ? Math.round((s.prom - s.prevProm) * 10) / 10 : null;
          return (
            <button
              key={s.id}
              onClick={onNavigate}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/60"
            >
              <span className="w-28 shrink-0 truncate text-sm font-medium sm:w-40" title={s.name}>
                {s.name}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-2 rounded-full", s.band ? BAND_BAR[s.band] : "bg-muted-foreground/30")}
                  style={{ width: `${s.pct ?? 0}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums">
                {s.prom !== null ? fmt(s.prom) : "—"}
              </span>
              <span
                className={cn(
                  "w-10 shrink-0 text-right text-xs tabular-nums",
                  delta === null
                    ? "text-transparent"
                    : delta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : delta < 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                )}
              >
                {delta !== null ? `${delta > 0 ? "↑" : delta < 0 ? "↓" : "="}${fmt(Math.abs(delta))}` : "·"}
              </span>
            </button>
          );
        })}
        {hidden > 0 && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Ver menos" : `Ver todas (${subjects.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
