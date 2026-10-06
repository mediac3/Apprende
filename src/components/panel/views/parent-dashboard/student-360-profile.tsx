"use client";

// [Dashboard Padre] Bloque F — Student 360° Profile (narrativo, privado del padre).
// Regla dura: sin evidencia suficiente el servidor manda null → el bloque NO se renderiza.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Student360 } from "@/lib/queries/parent-dashboard";

export function Student360Profile({
  data,
  childFirstName,
}: {
  data: Student360 | null;
  childFirstName: string;
}) {
  if (!data) return null; // regla dura: no inventar, no mostrar vacío
  return (
    <Card
      className="border-sky-200/70 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20"
      data-testid="parent-360"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conoce a {childFirstName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-foreground/90">&ldquo;{data.narrative}&rdquo;</p>
        {data.traits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.traits.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium"
              >
                <span aria-hidden>{t.icon}</span> {t.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
