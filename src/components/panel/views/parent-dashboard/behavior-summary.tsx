"use client";

// [Dashboard Padre] Bloque H — comportamiento y convivencia (resumen narrativo).
// Regla dura: sin observaciones → "Sin observaciones 🎉"; sin exponer detalles sensibles sin contexto.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ParentDashboardResult } from "@/lib/queries/parent-dashboard";
import { shortDate } from "./use-parent-dashboard";

type Behavior = Extract<ParentDashboardResult, { linked: true }>["behavior"];

const STATUS = {
  excelente: { label: "Excelente", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  bueno: { label: "Bueno", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  con_observaciones: { label: "Con observaciones", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
} as const;

export function BehaviorSummary({ behavior }: { behavior: Behavior }) {
  const s = STATUS[behavior.status];
  return (
    <Card data-testid="parent-comportamiento">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Comportamiento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-semibold", s.cls)} data-testid="parent-comportamiento-estado">
          {s.label}
        </span>
        {behavior.status === "excelente" ? (
          <p className="text-sm text-muted-foreground">Sin observaciones 🎉</p>
        ) : behavior.lastObservation ? (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              Último registro · {shortDate(behavior.lastObservation.dateISO)}
              {behavior.lastObservation.title ? ` · ${behavior.lastObservation.title}` : ""}
            </p>
            <p className="mt-1 line-clamp-3 text-sm leading-snug">{behavior.lastObservation.description}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
