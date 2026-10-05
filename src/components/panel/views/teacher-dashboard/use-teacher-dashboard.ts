"use client";

// [Dashboard Docente] Hook de carga — GET agregado (con periodo seleccionable)
// + guardado de umbrales IA. El periodo viaja por ref para no re-disparar el fetch inicial.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { TeacherDashboardData, TeacherDashboardConfigDTO } from "@/lib/queries/teacher-dashboard";

export function useTeacherDashboard() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const periodRef = useRef<string | null>(null); // null = default por fecha actual

  const load = useCallback(
    async (pid?: string | null) => {
      if (!user?.id) return;
      const effective = pid ?? periodRef.current;
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ userId: user.id });
        if (effective) q.set("periodId", effective);
        const res = await fetch(`/api/teacher-dashboard?${q.toString()}`, {
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
    },
    [user?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Cambio de periodo desde el selector: fija y recarga
  const setPeriod = useCallback(
    (pid: string | null) => {
      periodRef.current = pid;
      load(pid);
    },
    [load]
  );

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

  return { data, loading, error, refetch: load, saveConfig, setPeriod };
}
