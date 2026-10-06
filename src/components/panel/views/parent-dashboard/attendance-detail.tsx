"use client";

// [Dashboard Padre] Bloque G — asistencia detallada: resumen + calendario del mes.
// MVP solo lectura: el padre ve el estado de cada día (justificar lo hace el colegio).
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttendanceDay, ParentDashboardResult } from "@/lib/queries/parent-dashboard";

type Detail = Extract<ParentDashboardResult, { linked: true }>["attendanceDetail"];

const DAY_CLS: Record<AttendanceDay["status"], string> = {
  presente: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  tarde: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  excusa: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ausente: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const DAY_NAME: Record<AttendanceDay["status"], string> = {
  presente: "Presente",
  tarde: "Llegó tarde",
  excusa: "Ausente justificado",
  ausente: "Ausente",
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function AttendanceDetail({ detail }: { detail: Detail }) {
  if (detail.total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Asistencia</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aún no hay registros de asistencia este período.</p>
        </CardContent>
      </Card>
    );
  }

  // Calendario del mes en curso (lunes primero)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = new Map<string, AttendanceDay["status"]>(detail.calendar.map((d) => [d.dateISO, d.status]));
  const todayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <Card data-testid="parent-asistencia">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Asistencia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <p className="text-3xl font-bold tabular-nums">{detail.pct}%</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>Justificadas: <b className="text-foreground">{detail.justified}</b></span>
            <span>Sin justificar: <b className="text-foreground">{detail.unjustified}</b></span>
            <span>Retardos: <b className="text-foreground">{detail.late}</b></span>
            {detail.streak >= 2 && (
              <span>🔥 Racha: <b className="text-foreground">{detail.streak} días</b></span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
            {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendario de asistencia del mes">
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const status = byDay.get(key);
              const isToday = key === todayKey;
              return (
                <span
                  key={key}
                  role="gridcell"
                  title={status ? `${day}: ${DAY_NAME[status]}` : `${day}: sin registro`}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-md text-[11px] font-medium",
                    status ? DAY_CLS[status] : "bg-muted/40 text-muted-foreground/50",
                    isToday && "ring-2 ring-primary/50"
                  )}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Presente</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Tarde</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Ausente</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Justificada</span>
        </div>
      </CardContent>
    </Card>
  );
}
