"use client";

// [Dashboard Docente] Bloque F — Tareas por revisar (actividades con notas incompletas).
// Orden por urgencia: más faltantes primero. Botón "Calificar" → Notas parciales.
import { ArrowRight, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PendingTaskRow } from "@/lib/queries/teacher-dashboard";

export function PendingTasks({
  tasks,
  total,
  onGrade,
}: {
  tasks: PendingTaskRow[];
  total: number;
  onGrade: () => void;
}) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Tareas por revisar
          {total > 0 && (
            <Badge variant="secondary" className="ml-1">
              {total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay actividades con notas pendientes. ¡Al día! ✅</p>
        ) : (
          <>
            {tasks.map((t) => (
              <div
                key={t.activityId}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {t.name} · {t.groupName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.subjectName} · {t.graded}/{t.total} calificadas · {t.periodName}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={onGrade}>
                  Calificar <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {total > tasks.length && (
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={onGrade}>
                Ver todas ({total}) <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
