"use client";

// [F1] Bloque D — Logros (gamificación ligera): racha destacada + badges recientes
// Carrusel horizontal en móvil, grid en desktop. Entrada escalonada con CSS puro.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAchievement } from "./use-student-dashboard";

// "Hace 2 días" — se renderiza solo tras el fetch (cliente), sin riesgo de hidratación
function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (weeks < 5) return `Hace ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

interface AchievementsProps {
  achievements: DashboardAchievement[];
  streak: number;
}

export function Achievements({ achievements, streak }: AchievementsProps) {
  if (achievements.length === 0) return null;
  const earned = achievements.filter((a) => !a.locked);
  const locked = achievements.filter((a) => a.locked);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold sm:text-lg">Mis logros</CardTitle>
        {/* Racha visible y destacada — crea hábito (nunca se penaliza) */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5 text-sm font-bold text-orange-600 dark:text-orange-400"
          title="Días consecutivos entrando al panel"
        >
          <Flame className="h-4.5 w-4.5" aria-hidden="true" />
          {streak} {streak === 1 ? "día" : "días"}
        </span>
      </CardHeader>
      <CardContent>
        <ul className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
          {[...earned, ...locked].map((a, i) => (
            <li
              key={a.badgeId}
              className={cn(
                "w-28 shrink-0 snap-start rounded-xl border p-3 text-center sm:w-auto",
                a.locked ? "bg-muted/40 opacity-60" : "bg-card shadow-sm",
                "stagger-in"
              )}
              style={{ animationDelay: `${i * 80}ms` }}
              aria-label={
                a.locked ? `${a.name} (bloqueado)` : `${a.name}, logro obtenido ${relativeDate(a.earnedAt)}`
              }
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mx-auto flex h-11 w-11 items-center justify-center rounded-full text-2xl",
                  a.locked ? "bg-muted text-muted-foreground" : "bg-violet-500/10"
                )}
              >
                {a.locked ? <Lock className="h-5 w-5" /> : a.icon}
              </span>
              <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold leading-4">
                {a.name}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {a.locked ? "Bloqueado" : relativeDate(a.earnedAt)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
