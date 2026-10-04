"use client";

// [F1] Hook del dashboard del estudiante — carga única desde la API con refetch
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

export interface DashboardNextAction {
  activityId: string;
  title: string;
  subjectName: string;
  urgency: "red" | "yellow" | "green";
}

export interface SubjectActivityItem {
  id: string;
  title: string;
  graded: boolean;
  value: number | null;
  dateISO: string | null;
}

export interface DashboardSubject {
  id: string;
  name: string;
  progress: number;
  graded: number;
  total: number;
  prom: number | null;
  items: SubjectActivityItem[];
}

export interface DashboardAchievement {
  badgeId: string;
  name: string;
  icon: string;
  earnedAt: string | null;
  newlyAwarded: boolean;
  locked: boolean;
}

export interface DashboardMission {
  key: string;
  description: string;
  progress: number;
  target: number;
  xpReward: number;
  completed: boolean;
  justCompleted?: boolean;
}

export interface StudentDashboardData {
  ok: boolean;
  linked: boolean;
  firstName: string;
  groupName: string | null;
  periodName: string | null;
  progress: number;
  progressDelta: number | null;
  nextActions: DashboardNextAction[];
  totalPending: number;
  subjects: DashboardSubject[];
  achievements: DashboardAchievement[];
  streak: number;
  mission: DashboardMission;
  xp: number;
  xpGained: number;
  level: number;
  levelProgress: number;
}

export function useStudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student-dashboard?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de carga");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
