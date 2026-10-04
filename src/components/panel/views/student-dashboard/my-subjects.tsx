"use client";

// [F1] Bloque C — Mis asignaturas como mini-apps (grid responsive)
// 2 columnas en móvil, 3 en tablet, 4 en desktop. Cada card = materia con progreso.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { SubjectCard } from "./subject-card";
import type { DashboardSubject } from "./use-student-dashboard";

interface MySubjectsProps {
  subjects: DashboardSubject[];
}

export function MySubjects({ subjects }: MySubjectsProps) {
  if (subjects.length === 0) return null; // sin grupo asignado: el resto del panel basta

  return (
    <section id="mis-asignaturas" className="scroll-mt-20">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <BookOpen className="h-4.5 w-4.5 text-violet-500" aria-hidden="true" />
            Mis asignaturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {subjects.map((s) => (
              <SubjectCard key={s.id} subject={s} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
