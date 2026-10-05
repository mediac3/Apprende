"use client";

// [Dashboard Docente] Hook de carga — GET agregado + guardado de umbrales IA
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { TeacherDashboardData, TeacherDashboardConfigDTO } from "@/lib/queries/teacher-dashboard";

export function useTeacherDashboard() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher-dashboard?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "error");
        setData(null);
      } else {
        setData(json as TeacherDashboardData);
      }
    } catch {
      setError("network");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = useCallback(
    async (config: TeacherDashboardConfigDTO): Promise<boolean> => {
      if (!user?.id) return false;
      try {
        const res = await fetch("/api/teacher-dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, ...config }),
        });
        if (!res.ok) return false;
        setData((prev) => (prev ? { ...prev, config } : prev));
        return true;
      } catch {
        return false;
      }
    },
    [user?.id]
  );

  return { data, loading, error, refetch: load, saveConfig };
}
