"use client";

// [Dashboard Padre] Bloque E — próximas actividades (evaluaciones sin nota del hijo).
// Máx. 5 + conteo completo. Vacío → "¡Está al día! 🎉".
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ParentActivity } from "@/lib/queries/parent-dashboard";

const URGENCY_DOT: Record<ParentActivity["urgency"], string> = {
  red: "bg-rose-500",
  yellow: "bg-amber-500",
  green: "bg-emerald-500",
};

const URGENCY_HINT: Record<ParentActivity["urgency"], string> = {
  red: "Con urgencia",
  yellow: "Próxima",
  green: "Pendiente",
};

export function UpcomingActivities({ items, total }: { items: ParentActivity[]; total: number }) {
  return (
    <Card id="parent-actividades" data-testid="parent-actividades">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Próximas actividades</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">¡Está al día! 🎉</p>
        ) : (
          <>
            <ul className="divide-y divide-border/60">
              {items.map((a) => (
                <li key={a.activityId} className="flex items-center gap-3 py-2">
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-full", URGENCY_DOT[a.urgency])}
                    title={URGENCY_HINT[a.urgency]}
                    aria-label={URGENCY_HINT[a.urgency]}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.subjectName}</span>
                </li>
              ))}
            </ul>
            {total > items.length && (
              <p className="pt-2 text-xs text-muted-foreground">Y {total - items.length} más este período.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
