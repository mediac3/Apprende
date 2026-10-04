"use client";

// [F1] Bloque E — Misión de hoy (gamificación activa, 1 sola misión visible)
// El progreso puede completarse cuando el docente registra evaluaciones;
// "Continuar" lleva al estudiante a lo que sí controla (ver sus asignaturas/pendientes).
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, CheckCircle2 } from "lucide-react";
import { progressColor } from "./progress-ring";
import type { DashboardMission } from "./use-student-dashboard";

interface DailyMissionProps {
  mission: DashboardMission;
}

export function DailyMission({ mission }: DailyMissionProps) {
  const pct = mission.target > 0 ? Math.round((mission.progress / mission.target) * 100) : 0;
  const barColor = progressColor(Math.max(pct, 20)); // evita rojo en barras recién iniciadas

  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-indigo-500/10">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15"
          >
            <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">🎯 Misión de hoy</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {mission.description}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400"
            aria-label={`Recompensa: ${mission.xpReward} XP`}
          >
            +{mission.xpReward} XP
          </span>
        </div>

        {/* Barra de progreso de la misión */}
        <div className="mt-3.5 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={mission.target}
            aria-valuenow={mission.progress}
            aria-label={`Progreso de la misión: ${mission.progress} de ${mission.target}`}
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {mission.progress} / {mission.target}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          {mission.completed ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ¡Completada! Vuelve mañana
            </span>
          ) : (
            <Button asChild size="sm" className="rounded-full">
              <a href="#mis-asignaturas">
                Continuar →
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
