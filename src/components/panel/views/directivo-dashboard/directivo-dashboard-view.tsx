"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore, type ModuleKey } from "@/store/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DirectivoDrill,
  useDirectivoDashboard,
} from "./use-directivo-dashboard";
import { InstitutionHeader } from "./institution-header";
import { KpiNavigateTarget, MacroKpis } from "./macro-kpis";
import { CriticalAlerts } from "./critical-alerts";
import { TrendsList } from "./trends-list";
import { DistributionChart } from "./distribution-chart";
import { ComparativeChart } from "./comparative-chart";
import { QuickReports } from "./quick-reports";
import { RecentActivity } from "./recent-activity";

// ============================================================
// [Dashboard directivo] Contenedor: vista estratégica para
// Rector/Coordinador. El drill-down vive en query params de la URL
// (legibles y compartibles): ?periodId&sede&grado&grupo — se leen al
// montar y se espejan con replaceState (soft navigation, sin recargar).
// ============================================================

const EMPTY_DRILL: DirectivoDrill = { periodId: null, sede: null, grado: null, grupo: null };

function parseDrillFromUrl(): DirectivoDrill {
  if (typeof window === "undefined") return EMPTY_DRILL;
  const sp = new URLSearchParams(window.location.search);
  return {
    periodId: sp.get("periodId"),
    sede: sp.get("sede"),
    grado: sp.get("grado"),
    grupo: sp.get("grupo"),
  };
}

export function DirectivoDashboardView() {
  const user = useAuthStore((s) => s.user);
  // Hidratación desde la URL compartida: initializer síncrono del estado (sin setState en effects)
  const [drill, setDrill] = useState<DirectivoDrill>(parseDrillFromUrl);
  const { data, loading, forbidden, empty } = useDirectivoDashboard(drill);

  // Hidratar drill desde la URL compartida (una sola vez)
  // Espejar el drill-down en la URL sin recargar (regla dura: URL compartible)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (drill.periodId) sp.set("periodId", drill.periodId);
    if (drill.sede) sp.set("sede", drill.sede);
    if (drill.grado) sp.set("grado", drill.grado);
    if (drill.grupo) sp.set("grupo", drill.grupo);
    const qs = sp.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [drill]);

  const onDrill = useCallback((patch: Partial<DirectivoDrill>) => {
    setDrill((prev) => ({ ...prev, ...patch }));
  }, []);

  // Navegación de los KPIs: scroll a la sección destino o cambio de módulo.
  // El panel revalida permisos de módulo en su propio gate (institutional-panel).
  const onKpiNavigate = useCallback((target: KpiNavigateTarget) => {
    if (target.startsWith("module:")) {
      useUIStore.getState().setModule(target.slice(7) as ModuleKey);
      return;
    }
    document.getElementById(`directivo-section-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Botones de las alertas → módulo donde se interviene (el panel revalida permisos)
  const onOpenModule = useCallback((moduleKey: string) => {
    useUIStore.getState().setModule(moduleKey as ModuleKey);
  }, []);

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-col" data-testid="directivo-dashboard">
      {data ? (
        <InstitutionHeader data={data} drill={drill} onDrill={onDrill} />
      ) : (
        <div className="border-b bg-card/60 px-4 py-3 md:px-6">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-5 w-56" />
        </div>
      )}

      <div className="flex-1 p-4 md:p-6">
        {forbidden ? (
          <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-2 text-center" data-testid="directivo-forbidden">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <p className="font-semibold">{forbidden}</p>
            <p className="text-sm text-muted-foreground">
              Si crees que es un error, pide al administrador revisar tu alcance asignado.
            </p>
          </div>
        ) : empty ? (
          <p className="mt-16 text-center text-muted-foreground" data-testid="directivo-empty">
            Sin datos disponibles para el periodo.
          </p>
        ) : (
          <div className="space-y-6" data-testid="directivo-sections">
            {data && <MacroKpis data={data} onNavigate={onKpiNavigate} />}
            {data && <CriticalAlerts data={data} onOpenModule={onOpenModule} />}
            {data && <TrendsList data={data} onOpenModule={onOpenModule} />}
            {data && (
              <div className="grid gap-6 lg:grid-cols-2">
                <DistributionChart data={data} drill={drill} onDrill={onDrill} />
                <ComparativeChart data={data} />
              </div>
            )}
            {data && <QuickReports data={data} onOpenModule={onOpenModule} />}
            {data && <RecentActivity data={data} />}
            {loading && !data ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
