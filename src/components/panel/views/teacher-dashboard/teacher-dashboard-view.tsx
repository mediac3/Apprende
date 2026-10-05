"use client";

// [Dashboard Docente] Vista contenedora — operativa + accionable + IA.
// Orden: saludo → KPIs → rendimiento → alertas IA → atajos → tareas → actividad.
// Regla dura: solo datos del docente de la sesión (validado también en servidor).
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore, type ModuleKey } from "@/store/ui-store";
import { useTeacherDashboard } from "./use-teacher-dashboard";
import { HeroGreeting } from "./hero-greeting";
import { KpiCards } from "./kpi-cards";
import { SubjectPerformance } from "./subject-performance";
import { AiAlerts } from "./ai-alerts";
import { QuickActions } from "./quick-actions";
import { PendingTasks } from "./pending-tasks";
import { RecentActivity } from "./recent-activity";

const ERROR_MESSAGES: Record<string, string> = {
  not_teacher: "Este dashboard es exclusivo para docentes.",
  user_not_found: "No se encontró tu usuario.",
  user_inactive: "Tu usuario está inactivo.",
  network: "No se pudo conectar con el servidor.",
};

export function TeacherDashboardView() {
  const { data, loading, error, refetch, saveConfig } = useTeacherDashboard();
  const setModule = useUIStore((s) => s.setModule);
  const nav = (m: ModuleKey) => setModule(m);

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
      <HeroGreeting teacherName={data.teacherName} />
      <KpiCards
        courses={data.kpis.courses}
        students={data.kpis.students}
        pendingTasks={data.kpis.pendingTasks}
        gradedWeek={data.kpis.gradedWeek}
        gradedWeekDelta={data.kpis.gradedWeekDelta}
        onNavigate={nav}
      />
      <SubjectPerformance subjects={data.subjectPerformance} onSelect={() => nav("notas")} />
      <AiAlerts
        alerts={data.alerts}
        config={data.config}
        onSaveConfig={saveConfig}
        onNavigate={(m) => nav(m)}
      />
      <QuickActions onNavigate={nav} />
      <PendingTasks
        tasks={data.pendingTasks}
        total={data.pendingTasksTotal}
        onGrade={() => nav("notas")}
      />
      <RecentActivity items={data.recentActivity} />
    </div>
  );
}
