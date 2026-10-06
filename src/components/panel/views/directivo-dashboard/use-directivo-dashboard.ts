"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

// ============================================================
// [Dashboard directivo] Hook de carga: consume /api/directivo-dashboard
// con el alcance (sede/grado/grupo) y periodo seleccionados. El alcance
// se valida en servidor; aquí solo refleja el estado del drill-down.
// ============================================================

export type DirectivoDrill = {
  periodId: string | null;
  sede: string | null;
  grado: string | null;
  grupo: string | null;
};

export type DirectivoKpi = { value: number | null; delta: number | null };

export type DirectivoAlert = {
  severity: "critico" | "medio" | "info";
  message: string;
  context: string;
  action: "ver-detalle" | "intervenir";
  module: string;
};

export type DirectivoTrend = {
  indicator: string;
  value: string;
  delta: number | null;
  direction: "up" | "flat" | "down";
  sparkline: (number | null)[];
};

export type DistributionItem = { id: string; name: string; count: number; pct: number | null };

export type DirectivoData = {
  header: {
    institutionName: string;
    institutionShortName: string | null;
    logoUrl: string | null;
    year: number;
    period: { id: string; name: string } | null;
    periods: { id: string; name: string; active: boolean }[];
    branches: { id: string; name: string }[];
    scope: {
      allInstitution: boolean;
      sede: string | null;
      grado: string | null;
      grupo: string | null;
      allowedSedes: { id: string; name: string }[] | null;
      allowedGrados: { id: string; name: string }[] | null;
    };
  };
  thresholds: { riskThreshold: number; attendanceThreshold: number; pendingTasksLimit: number };
  kpis: {
    students: DirectivoKpi;
    teachers: DirectivoKpi;
    groups: DirectivoKpi;
    attendance: DirectivoKpi;
    performance: DirectivoKpi;
    alerts: DirectivoKpi;
  };
  alerts: DirectivoAlert[];
  trends: DirectivoTrend[];
  distribution: {
    bySede: DistributionItem[];
    byGrado: DistributionItem[];
    byJornada: DistributionItem[];
    totalStudents: number;
  };
  comparative: {
    periods: string[];
    attendance: (number | null)[];
    performance: (number | null)[];
    retiros: number[];
  };
  quickReports: { key: string; label: string; module: string }[];
  recentActivity: { id: string; description: string; userName: string; createdAt: string }[];
  drill: {
    groups: { id: string; name: string; sede: string | null; grado: string | null; jornada: string | null; students: number }[];
  };
};

export function useDirectivoDashboard(drill: DirectivoDrill) {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DirectivoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!user) return;
    const institutionId = user.institution?.id;
    if (!institutionId) return;
    const controller = new AbortController();
    let cancelled = false;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ institutionId, userId: user.id });
        if (drill.periodId) qs.set("periodId", drill.periodId);
        if (drill.sede) qs.set("sede", drill.sede);
        if (drill.grado) qs.set("grado", drill.grado);
        if (drill.grupo) qs.set("grupo", drill.grupo);
        const res = await fetch(`/api/directivo-dashboard?${qs.toString()}`, { signal: controller.signal });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setData(null);
          setEmpty(false);
          setForbidden(json.message ?? "No autorizado");
        } else if (json.empty) {
          setData(null);
          setEmpty(true);
        } else {
          setEmpty(false);
          setForbidden(null);
          setData(json as DirectivoData);
        }
      } catch (e) {
        if (!cancelled && (e as Error).name !== "AbortError") setForbidden("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user, drill.periodId, drill.sede, drill.grado, drill.grupo]);

  return { data, loading, forbidden, empty };
}
