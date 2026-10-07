// [Dashboard Padre] Hook de carga — GET /api/parent-dashboard?userId=&childId=
// Patrón: use-student-dashboard.ts. Helpers de formato compartidos por los bloques.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { ParentDashboardResult } from "@/lib/queries/parent-dashboard";

export function useParentDashboard(childId: string | null, periodId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<ParentDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId });
      if (childId) params.set("childId", childId);
      if (periodId) params.set("periodId", periodId);
      const res = await fetch(`/api/parent-dashboard?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "error");
        setData(null);
      } else {
        setData(json as ParentDashboardResult);
        setError(null);
      }
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }, [userId, childId, periodId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

// Formato narrativo: coma decimal (4,3), sin tecnicismos
export const fmt = (n: number): string => String(n).replace(".", ",");

// Timestamp relativo cálido: "Hoy", "Ayer", "Hace 3 días"…
export function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} semana${Math.floor(days / 7) > 1 ? "s" : ""}`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
