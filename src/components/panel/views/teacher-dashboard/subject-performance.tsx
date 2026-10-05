"use client";

// [Dashboard Docente] Bloque C — Rendimiento por asignatura (barras con %).
// Click en la asignatura despliega sus grupos con el estado del promedio actual;
// click en un grupo (ej. "10°A — Ciencias sociales") abre Notas parciales
// pre-filtrado por grupo, asignatura y periodo.
import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Estado del promedio según la nota (escala 0.0-5.0)
function perfLabel(avgGrade: number): string {
  if (avgGrade >= 4.6) return "Superior";
  if (avgGrade >= 4.0) return "Alto";
  if (avgGrade >= 3.0) return "Básico";
  return "Bajo";
}

export interface SubjectGroupSelection {
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
}

export function SubjectPerformance({
  subjects,
  periodName,
  onSelectGroup,
}: {
  subjects: SubjectPerformanceRow[];
  periodName: string | null;
  onSelectGroup: (sel: SubjectGroupSelection) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null); // subjectId expandido

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Rendimiento de mis cursos
          {periodName && (
            <span className="text-xs font-normal text-muted-foreground">· {periodName}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin asignaturas asignadas.</p>
        ) : (
          <div className="space-y-1">
            {subjects.map((s) => {
              const isOpen = expanded === s.subjectId;
              return (
                <div key={s.subjectId} className="rounded-md">
                  {/* Fila asignatura: click despliega grupos */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : s.subjectId)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{s.subjectName}</span>
                    <span className="flex-1 hidden sm:block h-2.5 rounded-full bg-muted overflow-hidden">
                      <span
                        className={cn("block h-full rounded-full transition-all", barColor(s.percentage))}
                        style={{ width: `${s.studentCount > 0 ? s.percentage : 0}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold w-12 text-right shrink-0",
                        s.studentCount > 0 ? textColor(s.percentage) : "text-muted-foreground"
                      )}
                    >
                      {s.studentCount > 0 ? `${s.percentage}%` : "—"}
                    </span>
                  </button>

                  {/* Grupos de la asignatura: click abre Notas pre-filtrado */}
                  {isOpen && (
                    <div className="ml-6 sm:ml-8 mt-1 mb-2 space-y-1 border-l pl-3">
                      {s.groups.map((g) => (
                        <button
                          key={g.groupId}
                          type="button"
                          onClick={() =>
                            onSelectGroup({
                              subjectId: s.subjectId,
                              subjectName: s.subjectName,
                              groupId: g.groupId,
                              groupName: g.groupName,
                            })
                          }
                          className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors text-left"
                          title={`Abrir Notas parciales: ${g.groupName} — ${s.subjectName}`}
                        >
                          <span className="text-sm font-medium w-20 shrink-0">{g.groupName}</span>
                          <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <span
                              className={cn("block h-full rounded-full", barColor(g.percentage))}
                              style={{ width: `${g.studentCount > 0 ? g.percentage : 0}%` }}
                            />
                          </span>
                          <span
                            className={cn(
                              "text-xs font-semibold shrink-0 text-right",
                              g.studentCount > 0 ? textColor(g.avgGrade ? g.avgGrade * 20 : 0) : "text-muted-foreground"
                            )}
                          >
                            {g.studentCount > 0
                              ? `${g.percentage}% registrado · ${perfLabel(g.avgGrade ?? 0)}`
                              : "Sin notas"}
                          </span>
                        </button>
                      ))}
                      {s.groups.length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">Sin grupos asignados.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
