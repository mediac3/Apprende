"use client";

// [Dashboard Docente] Bloque A — Header operativo: saludo por hora + fecha.
// Regla dura: sin números en el header; el saludo siempre primero.
import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "¡Buenos días";
  if (hour >= 12 && hour < 19) return "¡Buenas tardes";
  return "¡Buenas noches";
}

// Primer nombre del docente ("Javier Esteban Ruiz" → "Javier")
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// false durante SSR/hidratación, true en cliente — sin setState en effects
const emptySubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

export function HeroGreeting({ teacherName }: { teacherName: string }) {
  const mounted = useMounted();

  const now = new Date();
  const saludo = greetingForHour(now.getHours());
  const raw = format(now, "EEEE, d 'de' MMMM", { locale: es });
  const fecha = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <div className="mb-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        {mounted ? (
          <>
            {saludo}, Profe. {firstName(teacherName)}! 👋
          </>
        ) : (
          "\u00A0"
        )}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{mounted ? fecha : "\u00A0"}</p>
    </div>
  );
}
