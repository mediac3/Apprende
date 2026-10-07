"use client";

// [Dashboard Padre] Bloque C — materias con barra de progreso y color por rango.
// Máx. 8 visibles + "Ver todas". Click en la materia → detalle de sus notas del período.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParentSubject } from "@/lib/queries/parent-dashboard";
import { fmt, shortDate } from "./use-parent-dashboard";

const MAX_VISIBLE = 8;
const APROBADO = 3.5; // convención del sistema (coherente con el dashboard del estudiante)

const BAND_BAR: Record<NonNullable<ParentSubject["band"]>, string> = {
  verde: "bg-emerald-500",
  azul: "bg-sky-500",
  amarillo: "bg-amber-500",
  rojo: "bg-rose-500",
};

export function SubjectProgressList({
  subjects,
  childFirstName,
  periodName,
}: {
  subjects: ParentSubject[];
  childFirstName: string;
  periodName: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState<ParentSubject | null>(null);
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
              onClick={() => setDetail(s)}
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

      {/* [Detalle por materia] notas de las evaluaciones del período seleccionado */}
      <Dialog open={detail !== null} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>
              {periodName ? `Notas de ${periodName}. ` : ""}
              {detail?.prom !== null && detail?.prom !== undefined
                ? `Promedio: ${fmt(detail.prom)} / 5.0`
                : "Sin promedio registrado aún"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto" data-testid="parent-detalle-materia">
            {detail?.items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin evaluaciones registradas en este período.</p>
            ) : (
              detail?.items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <span
                    className={cn(
                      "flex h-7 min-w-11 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums",
                      !it.graded
                        ? "bg-muted text-muted-foreground"
                        : (it.value ?? 0) >= APROBADO
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    )}
                  >
                    {it.graded && it.value !== null ? fmt(it.value) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.graded ? (it.dateISO ? shortDate(it.dateISO) : "Calificada") : "Sin nota registrada aún"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
