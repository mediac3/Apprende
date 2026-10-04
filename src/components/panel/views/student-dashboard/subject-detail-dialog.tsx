"use client";

// [F1] Modal de detalle de asignatura — actividades con nota, estado y fecha
// PC: centrado max-w-lg · Móvil: casi pantalla completa con scroll interno.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { subjectEmoji } from "./subject-card";
import { progressColor } from "./progress-ring";
import type { DashboardSubject } from "./use-student-dashboard";

const DATE_FMT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return DATE_FMT.format(d);
}

interface SubjectDetailDialogProps {
  subject: DashboardSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectDetailDialog({ subject, open, onOpenChange }: SubjectDetailDialogProps) {
  if (!subject) return null;
  const accent = progressColor(subject.progress);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl p-0 sm:p-0 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-card/90">
        <DialogHeader className="sticky top-0 z-10 space-y-0 border-b bg-card/95 p-4 backdrop-blur sm:p-5">
          <DialogTitle className="flex items-center gap-3 text-left">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${accent}1f` }}
            >
              {subjectEmoji(subject.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold leading-tight sm:text-lg">
                {subject.name}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {subject.total === 0
                  ? "Sin actividades en el periodo"
                  : `${subject.graded}/${subject.total} actividades · ${subject.progress}%`}
              </span>
            </span>
            <span className="shrink-0 text-2xl font-extrabold" style={{ color: accent }}>
              {subject.progress}%
            </span>
          </DialogTitle>
        </DialogHeader>

        <ul className="space-y-2 p-4 pt-3 sm:p-5 sm:pt-3">
          {subject.items.length === 0 ? (
            <li className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Aún no hay actividades registradas en esta asignatura para el periodo. 📚
            </li>
          ) : (
            subject.items.map((it, i) => (
              <li
                key={it.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3",
                  it.graded ? "bg-card" : "bg-muted/30"
                )}
              >
                {it.graded ? (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-emerald-500"
                    aria-label="Calificada"
                  />
                ) : (
                  <CircleDashed
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-label="Sin nota registrada"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {i + 1}. {it.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {it.graded
                      ? `Calificada · ${fmtDate(it.dateISO)}`
                      : "Sin nota registrada aún"}
                  </span>
                </span>
                {it.graded && it.value !== null && (
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums",
                      it.value >= 3.5
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    )}
                    aria-label={`Nota ${it.value.toFixed(1)} de 5.0`}
                  >
                    {it.value.toFixed(1)}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>

        {subject.total > 0 && (
          <p className="px-4 pb-4 text-center text-xs text-muted-foreground sm:px-5 sm:pb-5">
            Las notas las registra tu docente en la planilla del grupo.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
