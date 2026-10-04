"use client";

// [F1] Bloque B — Próximas acciones (¡la sección más importante!)
// Regla dura: aparece ANTES del progreso académico. Estados: 🔴 urgente / 🟡 próxima / 🟢 al día.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardNextAction } from "./use-student-dashboard";

const URGENCY = {
  red: { dot: "bg-rose-500", label: "Urgente", badge: "destructive" as const },
  yellow: { dot: "bg-amber-400", label: "Próxima", badge: "secondary" as const },
  green: { dot: "bg-emerald-500", label: "Pendiente", badge: "secondary" as const },
} as const;

interface NextActionsProps {
  actions: DashboardNextAction[];
  totalPending: number;
  periodName: string | null;
}

export function NextActions({ actions, totalPending, periodName }: NextActionsProps) {
  const [selected, setSelected] = useState<DashboardNextAction | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold sm:text-lg">
          ¿Qué tengo que hacer ahora?
        </CardTitle>
        {periodName && (
          <p className="text-xs text-muted-foreground">{periodName} en curso</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {totalPending === 0 ? (
          // Estado vacío positivo — nunca castigar
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-4">
            <PartyPopper className="h-8 w-8 shrink-0 text-emerald-500" aria-hidden="true" />
            <div>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                ¡Estás al día! 🎉
              </p>
              <p className="text-sm text-muted-foreground">
                No tienes actividades pendientes en este periodo.
              </p>
            </div>
          </div>
        ) : (
          <>
            {actions.map((a) => {
              const u = URGENCY[a.urgency];
              return (
                <button
                  key={a.activityId}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* Ícono de estado accesible */}
                  <span
                    role="img"
                    aria-label={u.label}
                    title={u.label}
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-full", u.dot)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {a.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.subjectName} · Registra tu evaluación
                    </span>
                  </span>
                  <Badge variant={u.badge} className="shrink-0 text-[11px]">
                    {u.label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              );
            })}
            {totalPending > actions.length && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                +{totalPending - actions.length} pendientes más
              </p>
            )}
          </>
        )}
      </CardContent>

      {/* Detalle sin navegación a vistas de docentes (no existe módulo de tareas) */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              {selected && (
                <span
                  role="img"
                  aria-label={URGENCY[selected.urgency].label}
                  className={cn("inline-block h-2.5 w-2.5 rounded-full", URGENCY[selected.urgency].dot)}
                />
              )}
              {selected?.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1.5 pt-1">
                <p>
                  <span className="font-medium text-foreground">Asignatura:</span>{" "}
                  {selected?.subjectName}
                </p>
                {periodName && (
                  <p>
                    <span className="font-medium text-foreground">Periodo:</span> {periodName}
                  </p>
                )}
                <p className="pt-2 text-sm">
                  Esta actividad aún no tiene nota registrada. Habla con tu docente de{" "}
                  <span className="font-medium">{selected?.subjectName}</span> para saber qué
                  necesitas entregar.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
