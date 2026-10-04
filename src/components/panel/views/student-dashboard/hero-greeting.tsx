"use client";

// [F1] Bloque A — Saludo emocional + progress ring + chip XP/nivel
// Regla dura: el saludo va ANTES que cualquier número. Emoji según hora.
// El reloj se lee con useSyncExternalStore (hidratación segura, sin setState en effects).
import { useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight, Flame } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { cn } from "@/lib/utils";
import type { StudentDashboardData } from "./use-student-dashboard";

const DATE_FMT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

// Snapshot de reloj cacheado (estable durante el render; refresco suave cada 30s)
interface ClockSnapshot {
  hour: number;
  date: string;
}
let clockCache: { at: number; snap: ClockSnapshot } | null = null;
function getClockSnapshot(): ClockSnapshot {
  const t = Date.now();
  if (!clockCache || t - clockCache.at > 30_000) {
    const d = new Date(t);
    const s = DATE_FMT.format(d);
    clockCache = {
      at: t,
      snap: { hour: d.getHours(), date: s.charAt(0).toUpperCase() + s.slice(1) },
    };
  }
  return clockCache.snap;
}
const SERVER_CLOCK: ClockSnapshot = { hour: 12, date: "" };
function subscribeClock() {
  return () => {}; // el saludo no requiere actualización en vivo
}

function greetingForHour(h: number): string {
  if (h >= 5 && h < 12) return "¡Buenos días";
  if (h >= 12 && h < 19) return "¡Hola";
  return "¡Buenas noches";
}
function emojiForHour(h: number): string {
  if (h >= 5 && h < 12) return "☀️";
  if (h >= 12 && h < 19) return "👋";
  return "🌙";
}

export function HeroGreeting({ data }: { data: StudentDashboardData }) {
  const clock = useSyncExternalStore(subscribeClock, getClockSnapshot, () => SERVER_CLOCK);
  const delta = data.progressDelta;
  const showDelta = delta !== null && delta !== 0;

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-lg">
      <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
        {/* Ring arriba en móvil, a la izquierda en desktop */}
        <ProgressRing value={data.progress} label="Tu progreso esta semana" className="shrink-0">
          <span className="text-4xl font-bold tracking-tight sm:text-[2.6rem]">
            {data.progress}%
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {greetingForHour(clock.hour)}, {data.firstName}! {emojiForHour(clock.hour)}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {clock.date || "\u00A0"}
            {data.groupName ? ` · ${data.groupName}` : ""}
            {data.periodName ? ` · ${data.periodName}` : ""}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {/* Chip racha */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              <Flame className="h-4 w-4 text-orange-300" aria-hidden="true" />
              {data.streak} {data.streak === 1 ? "día" : "días"}
            </span>
            {/* Chip XP + nivel */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold"
              title={`${data.xp} XP · Nivel ${data.level}`}
            >
              ⚡ {data.xp} XP · Nivel {data.level}
            </span>
            {/* Delta vs semana anterior */}
            {showDelta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-3 py-1 text-sm font-semibold",
                  delta > 0 ? "bg-emerald-400/25 text-emerald-100" : "bg-rose-400/25 text-rose-100"
                )}
                aria-label={`${delta > 0 ? "Subiste" : "Bajaste"} ${Math.abs(delta)} puntos vs semana anterior`}
              >
                {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-white/70">Tu progreso esta semana</p>
        </div>

        {/* CTA: ancla a Mis asignaturas */}
        <a
          href="#mis-asignaturas"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Ver mi progreso <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
