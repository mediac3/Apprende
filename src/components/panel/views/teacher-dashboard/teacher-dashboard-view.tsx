"use client";

// [Dashboard Docente] Vista contenedora — operativa + accionable + IA.
// Orden: saludo → KPIs → rendimiento → alertas IA → atajos → tareas → actividad.
// Regla dura: solo datos del docente de la sesión (validado también en servidor).
import { useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore, type ModuleKey } from "@/store/ui-store";
import { useGradesPreselectStore } from "@/store/grades-prefill-store";
import { useTeacherDashboard } from "./use-teacher-dashboard";
import { HeroGreeting } from "./hero-greeting";
import { PeriodSelect } from "./period-select";
import { KpiCards } from "./kpi-cards";
import { SubjectPerformance } from "./subject-performance";
import { AiAlerts } from "./ai-alerts";
import { QuickActions } from "./quick-actions";
import { PendingTasks } from "./pending-tasks";
import { RecentActivity } from "./recent-activity";
import type { PendingTaskRow } from "@/lib/queries/teacher-dashboard";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  not_teacher: "Este dashboard es exclusivo para docentes.",
  user_not_found: "No se encontró tu usuario.",
  user_inactive: "Tu usuario está inactivo.",
  network: "No se pudo conectar con el servidor.",
};

export function TeacherDashboardView() {
  const { data, loading, error, refetch, saveConfig, setPeriod } = useTeacherDashboard();
  const setModule = useUIStore((s) => s.setModule);
  const setPreselect = useGradesPreselectStore((s) => s.setPreselect);
  const nav = (m: ModuleKey) => setModule(m);

  // [C1] KPI "Tareas por revisar" → scroll animado a la sección del panel
  const pendingRef = useRef<HTMLDivElement>(null);
  const [highlightPending, setHighlightPending] = useState(false);
  function goToPendingTasks() {
    pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightPending(true);
    setTimeout(() => setHighlightPending(false), 2400);
  }

  // Click en grupo×asignatura del bloque C → Notas parciales pre-filtrado
  const openGradesFor = (sel: { subjectId: string; subjectName: string; groupId: string; groupName: string }) => {
    setPreselect({
      groupId: sel.groupId,
      groupName: sel.groupName,
      subjectId: sel.subjectId,
      subjectName: sel.subjectName,
      periodId: data?.selectedPeriodId ?? null,
    });
    nav("notas");
  };

  // [C2] Botón Calificar de una tarea → planilla pre-filtrada + destello de celdas
  const openGradesForTask = (t: PendingTaskRow) => {
    setPreselect({
      groupId: t.groupId,
      groupName: t.groupName,
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      periodId: t.periodId,
      flash: true,
    });
    nav("notas");
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-10 w-2/3 rounded-md bg-muted" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-40 rounded-lg bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {error ? (ERROR_MESSAGES[error] ?? "Error al cargar el dashboard.") : "Sin datos."}
          </p>
          <Button size="sm" variant="outline" onClick={refetch}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data.hasAssignments) {
    return (
      <div>
        <HeroGreeting teacherName={data.teacherName} />
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Aún no tienes cursos asignados</p>
            <p className="text-sm text-muted-foreground">
              Cuando la institución te asigne asignaturas, verás aquí tus cursos, estudiantes y alertas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <HeroGreeting teacherName={data.teacherName} />
        {/* Selector de periodo: default por fecha actual, cambio arbitrario */}
        <PeriodSelect
          periods={data.periods}
          selectedId={data.selectedPeriodId}
          onChange={(pid) => setPeriod(pid)}
          className="mt-2 md:mt-3 order-first w-full sm:w-auto md:order-none"
        />
      </div>
      <KpiCards
        courses={data.kpis.courses}
        students={data.kpis.students}
        pendingTasks={data.kpis.pendingTasks}
        gradedWeek={data.kpis.gradedWeek}
        gradedWeekDelta={data.kpis.gradedWeekDelta}
        onNavigate={nav}
        onPendingTasksClick={goToPendingTasks}
      />
      <SubjectPerformance
        subjects={data.subjectPerformance}
        periodName={data.selectedPeriod?.name ?? null}
        onSelectGroup={openGradesFor}
      />
      <AiAlerts
        alerts={data.alerts}
        config={data.config}
        onSaveConfig={saveConfig}
        onNavigate={(m) => nav(m)}
      />
      <QuickActions onNavigate={nav} />
      <div
        ref={pendingRef}
        className={cn(
          "rounded-xl transition-all duration-500",
          highlightPending && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background shadow-lg"
        )}
      >
        <PendingTasks
          tasks={data.pendingTasks}
          total={data.pendingTasksTotal}
          onGrade={openGradesForTask}
        />
      </div>
      <RecentActivity items={data.recentActivity} />
    </div>
  );
}
