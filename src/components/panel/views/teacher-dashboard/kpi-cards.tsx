"use client";

// [Dashboard Docente] Bloque B — KPIs del día: 4 cards clicables (dato → acción).
import {
  BookOpen,
  Users,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/store/ui-store";

interface KpiItem {
  icon: LucideIcon;
  value: number;
  label: string;
  delta?: number;
  deltaLabel?: string;
  module: ModuleKey;
  accent: string; // clases de color del ícono
}

export function KpiCards({
  courses,
  students,
  pendingTasks,
  gradedWeek,
  gradedWeekDelta,
  onNavigate,
  onPendingTasksClick,
}: {
  courses: number;
  students: number;
  pendingTasks: number;
  gradedWeek: number;
  gradedWeekDelta: number;
  onNavigate: (m: ModuleKey) => void;
  /** Si se define, el KPI de tareas hace scroll animado a la sección del panel */
  onPendingTasksClick?: () => void;
}) {
  const kpis: KpiItem[] = [
    {
      icon: BookOpen,
      value: courses,
      label: "Cursos asignados",
      module: "planeador",
      accent: "text-blue-600 bg-blue-100 dark:bg-blue-950",
    },
    {
      icon: Users,
      value: students,
      label: "Estudiantes",
      module: "asistencia",
      accent: "text-violet-600 bg-violet-100 dark:bg-violet-950",
    },
    {
      icon: ClipboardList,
      value: pendingTasks,
      label: "Tareas por revisar",
      module: "notas",
      accent: "text-amber-600 bg-amber-100 dark:bg-amber-950",
    },
    {
      icon: CheckCircle2,
      value: gradedWeek,
      label: "Calificaciones (7 días)",
      delta: gradedWeekDelta,
      deltaLabel: "vs semana anterior",
      module: "notas",
      accent: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {kpis.map((k) => (
        <Card
          key={k.label}
          role="link"
          tabIndex={0}
          onClick={() =>
            k.label === "Tareas por revisar" && onPendingTasksClick
              ? onPendingTasksClick()
              : onNavigate(k.module)
          }
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (k.label === "Tareas por revisar" && onPendingTasksClick) onPendingTasksClick();
            else onNavigate(k.module);
          }}
          className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn("shrink-0 rounded-lg p-2.5", k.accent)}>
              <k.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl md:text-3xl font-bold leading-none">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{k.label}</div>
              {typeof k.delta === "number" && k.delta !== 0 && (
                <div
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] mt-0.5",
                    k.delta > 0 ? "text-emerald-600" : "text-red-500"
                  )}
                >
                  {k.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {k.delta > 0 ? `+${k.delta}` : k.delta} {k.deltaLabel}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
