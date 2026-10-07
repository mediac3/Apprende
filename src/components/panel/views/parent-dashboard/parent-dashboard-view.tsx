"use client";

// [Dashboard Padre] Contenedor — composición de bloques A→J.
// El hijo activo vive en la URL (?childId=) para que el padre pueda volver/compartir.
import { useEffect, useState } from "react";
import { useUIStore, type ModuleKey } from "@/store/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParentDashboard } from "./use-parent-dashboard";
import { WelcomeHeader } from "./welcome-header";
import { ChildSelector } from "./child-selector";
import { ChildKpis } from "./child-kpis";
import { SubjectProgressList } from "./subject-progress-list";
import { HelpRecommendations } from "./help-recommendations";
import { UpcomingActivities } from "./upcoming-activities";
import { Student360Profile } from "./student-360-profile";
import { AttendanceDetail } from "./attendance-detail";
import { BehaviorSummary } from "./behavior-summary";
import { CommunicationBlock } from "./communication-block";
import { CelebrationsBlock } from "./celebrations-block";

function LoadingSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando el resumen de tu hijo">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

function NotLinkedCard() {
  return (
    <Card className="mx-auto max-w-lg border-dashed">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="text-4xl" aria-hidden>💌</span>
        <p className="text-lg font-semibold">Aún no estás vinculado a un estudiante</p>
        <p className="text-sm text-muted-foreground">
          Para ver el resumen de tu hijo o hija, el colegio debe vincular tu cuenta.
          Escribe a secretaría o al rector y te recibirán con gusto.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="text-4xl" aria-hidden>☁️</span>
        <p className="font-semibold">No pudimos cargar el resumen</p>
        <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
        <Button size="sm" variant="outline" onClick={onRetry}>Reintentar</Button>
      </CardContent>
    </Card>
  );
}

export function ParentDashboardView() {
  const [childId, setChildId] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("childId") : null
  );
  // [Selector de período] null = usa el período ACTIVO de la configuración del sistema
  const [periodId, setPeriodId] = useState<string | null>(null);
  const { data, loading, error, refetch } = useParentDashboard(childId, periodId);
  const setModule = useUIStore((s) => s.setModule);

  // Espeja el hijo activo en la URL sin recargar (patrón drill-down directivo)
  useEffect(() => {
    if (!data || data.ok === false || !data.linked) return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("childId");
    if (data.activeChildId !== current) {
      url.searchParams.set("childId", data.activeChildId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [data]);

  const onSelectChild = (id: string) => setChildId(id);

  if (loading && !data) return <LoadingSkeleton />;
  if (error || !data || data.ok === false) return <ErrorCard onRetry={refetch} />;
  if (!data.linked) return <NotLinkedCard />;

  const navigate = (m: ModuleKey) => setModule(m);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" data-testid="parent-dashboard">
      <WelcomeHeader
        parentName={data.parentName}
        childFirstName={data.activeChildFirstName}
        groupName={data.groupName}
      />
      <ChildSelector items={data.children} activeId={data.activeChildId} onSelect={onSelectChild} />
      {data.periods.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <Select value={periodId ?? data.periodId ?? ""} onValueChange={(v) => setPeriodId(v)}>
            <SelectTrigger className="h-8 w-[220px]" aria-label="Seleccionar período"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.active ? " (actual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <ChildKpis kpis={data.kpis} prevPeriodName={data.prevPeriodName} onNavigate={navigate} />
      <SubjectProgressList
        subjects={data.subjects}
        childFirstName={data.activeChildFirstName}
        periodName={data.periodName}
      />
      <HelpRecommendations items={data.helpRecommendations} />
      <UpcomingActivities items={data.upcomingActivities} total={data.pendingTotal} />
      <Student360Profile data={data.student360} childFirstName={data.activeChildFirstName} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceDetail detail={data.attendanceDetail} />
        <BehaviorSummary behavior={data.behavior} />
        <CommunicationBlock
          messages={data.communication.recentMessages}
          onNavigate={() => navigate("mensajeria")}
        />
        <CelebrationsBlock items={data.celebrations} />
      </div>
    </div>
  );
}
