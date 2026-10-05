"use client";

// [Dashboard Docente] Bloque C — Rendimiento por asignatura (barras con %).
// Color por rango: verde ≥80, azul 60-79, amarillo 40-59, rojo <40.
// Click → Notas parciales. Tooltip: promedio, estudiantes y desglose por grupo.
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SubjectPerformanceRow } from "@/lib/queries/teacher-dashboard";

function barColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function textColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-blue-600";
  if (pct >= 40) return "text-amber-600";
  return "text-red-500";
}

export function SubjectPerformance({
  subjects,
  onSelect,
}: {
  subjects: SubjectPerformanceRow[];
  onSelect: () => void;
}) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Rendimiento de mis cursos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin asignaturas asignadas.</p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-3">
              {subjects.map((s) => (
                <Tooltip key={s.subjectId}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onSelect}
                      className="w-full flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors text-left"
                    >
                      <span className="text-sm font-medium w-32 md:w-44 truncate shrink-0">
                        {s.subjectName}
                      </span>
                      <span className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                        <span
                          className={cn("block h-full rounded-full transition-all", barColor(s.percentage))}
                          style={{ width: `${s.studentCount > 0 ? s.percentage : 0}%` }}
                        />
                      </span>
                      <span className={cn("text-sm font-semibold w-12 text-right shrink-0", textColor(s.percentage))}>
                        {s.studentCount > 0 ? `${s.percentage}%` : "—"}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {s.studentCount > 0 ? (
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">
                          Promedio: {s.avgGrade.toFixed(1)} · {s.studentCount} estudiantes
                        </p>
                        {s.groups.map((g) => (
                          <p key={g.groupName}>
                            {g.groupName}: {g.percentage}%
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs">Sin registros de calificación aún</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
