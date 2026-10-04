"use client";

// [F1] Card individual de asignatura (mini-app) — Bloque C
// Acento por asignatura con la paleta determinística del sistema (area-colors);
// barra de progreso con semántica por rango (verde/azul/ámbar/rojo).
import { memo } from "react";
import { cn } from "@/lib/utils";
import { getAreaColor } from "@/lib/area-colors";
import { progressColor } from "./progress-ring";
import type { DashboardSubject } from "./use-student-dashboard";

// Emoji fijo por asignatura (palabra clave → emoji; default 📚)
export function subjectEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("matem") || n.includes("aritm") || n.includes("álgebra") || n.includes("algebra")) return "📐";
  if (n.includes("lengu") || n.includes("español") || n.includes("castellan") || n.includes("lectura")) return "📖";
  if (n.includes("sociales") || n.includes("ciudadan") || n.includes("historia") || n.includes("geograf")) return "🌍";
  if (n.includes("biolog") || n.includes("químic") || n.includes("quimic") || n.includes("físic") || n.includes("fisic") || n.includes("ciencias")) return "🧪";
  if (n.includes("ingl") || n.includes("english")) return "🗣️";
  if (n.includes("física") && n.includes("educación")) return "⚽";
  if (n.includes("educación física") || n.includes("educacion fisica") || n.includes("deport")) return "⚽";
  if (n.includes("art") || n.includes("estétic") || n.includes("estetic")) return "🎨";
  if (n.includes("relig")) return "🕊️";
  if (n.includes("ética") || n.includes("etica")) return "🤝";
  if (n.includes("tecnolog") || n.includes("informátic") || n.includes("informatic")) return "💻";
  if (n.includes("emprend")) return "💡";
  return "📚";
}

interface SubjectCardProps {
  subject: DashboardSubject;
}

export const SubjectCard = memo(function SubjectCard({ subject }: SubjectCardProps) {
  const accent = getAreaColor(subject.id);
  const barColor = progressColor(subject.progress);
  const empty = subject.total === 0;

  return (
    <div
      className="group rounded-xl border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md"
      data-subject-id={subject.id}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${accent}1f` }}
        >
          {subjectEmoji(subject.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{subject.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {empty
              ? "Sin actividades aún"
              : `${subject.graded}/${subject.total} actividades${subject.prom !== null ? ` · PROM ${subject.prom.toFixed(1)}` : ""}`}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={subject.progress}
          aria-label={`Progreso en ${subject.name}: ${subject.progress}%`}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out")}
            style={{ width: `${subject.progress}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-sm font-bold" style={{ color: barColor }}>
            {subject.progress}%
          </span>
          {subject.prom !== null && (
            <span className="text-[11px] text-muted-foreground">
              nota {subject.prom.toFixed(1)}/5.0
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
