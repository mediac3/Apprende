"use client";

// [F1] Dashboard del estudiante — contenedor (composición de bloques A→E)
// Regla dura: Hero → Próximas acciones ANTES que cualquier otro número.
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeroGreeting } from "./hero-greeting";
import { NextActions } from "./next-actions";
import { MySubjects } from "./my-subjects";
import { Achievements } from "./achievements";
import { DailyMission } from "./daily-mission";
import { useStudentDashboard } from "./use-student-dashboard";

function LoadingSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando tu panel">
      <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function StudentDashboardView() {
  const { data, loading, error, refetch } = useStudentDashboard();
  const celebrated = useRef(false);

  // Celebración (confetti + toast): misión completada o badge nuevo — 1 vez por carga
  useEffect(() => {
    if (!data || celebrated.current) return;
    const missionDone = data.mission?.justCompleted;
    const newBadge = data.achievements?.some((a) => a.newlyAwarded);
    if (missionDone || newBadge) {
      celebrated.current = true;
      confetti({
        particleCount: missionDone ? 120 : 80,
        spread: 70,
        origin: { y: 0.7 },
        disableForReducedMotion: true,
      });
      if (missionDone) toast.success(`+${data.xpGained} XP · ¡Misión completada! 🎉`);
      if (newBadge) {
        const badge = data.achievements.find((a) => a.newlyAwarded);
        toast.success(`${badge?.icon ?? "🎖️"} ¡Nuevo logro: ${badge?.name}!`);
      }
    }
  }, [data]);

  if (loading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-3xl" aria-hidden="true">😕</p>
          <p className="font-semibold">No pudimos cargar tu panel</p>
          <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo.</p>
          <Button onClick={refetch} variant="outline" size="sm">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Usuario estudiante sin Student vinculado — estado vacío amable (regla dura)
  if (!data.linked) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-4xl" aria-hidden="true">🎒</p>
          <p className="font-semibold">¡Tu perfil de estudiante aún no está vinculado!</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Pide en coordinación que asocien tu usuario a tu ficha de estudiante para ver tu
            progreso, tus asignaturas y tus logros.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-5 sm:space-y-6"
    >
      {/* A — Saludo emocional */}
      <HeroGreeting data={data} />
      {/* B — ¿Qué tengo que hacer ahora? (siempre antes del progreso académico) */}
      <NextActions
        actions={data.nextActions}
        totalPending={data.totalPending}
        periodName={data.periodName}
      />
      {/* C — Mis asignaturas (mini-apps) */}
      <MySubjects subjects={data.subjects} />
      {/* D — Mis logros + racha */}
      <Achievements achievements={data.achievements} streak={data.streak} />
      {/* E — Misión de hoy */}
      <DailyMission mission={data.mission} />
    </motion.div>
  );
}
