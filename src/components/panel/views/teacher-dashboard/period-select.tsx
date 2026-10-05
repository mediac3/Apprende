"use client";

// [Dashboard Docente] Selector de periodo — carga por defecto según la fecha actual
// del cliente; cambio arbitrario desde el Select. Muestra rango de fechas por periodo.
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PeriodOption } from "@/lib/queries/teacher-dashboard";

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

export function PeriodSelect({
  periods,
  selectedId,
  onChange,
  className,
}: {
  periods: PeriodOption[];
  selectedId: string | null;
  onChange: (periodId: string) => void;
  className?: string;
}) {
  if (periods.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
      <Select value={selectedId ?? undefined} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className="h-9 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm w-[210px] md:w-[260px]"
          aria-label="Seleccionar periodo"
        >
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent align="end">
          {periods.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className={cn("truncate", p.id === selectedId ? "font-semibold" : "")}>
                {p.name}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {fmt(p.startDateISO)} – {fmt(p.endDateISO)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
