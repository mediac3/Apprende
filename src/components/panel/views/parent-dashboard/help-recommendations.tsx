"use client";

// [Dashboard Padre] Bloque D — ❤️ "¿Cómo puedes ayudar?" (EL DIFERENCIADOR).
// Recomendaciones personalizadas calculadas en servidor; nunca genéricas.
// Regla dura: sin recomendaciones → mensaje positivo, nunca bloque vacío.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HelpRecommendation } from "@/lib/queries/parent-dashboard";

export function HelpRecommendations({ items }: { items: HelpRecommendation[] }) {
  return (
    <Card
      className="border-rose-200/70 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20"
      data-testid="parent-ayudar"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">❤️ ¿Cómo puedes ayudar?</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todo va bien. Sigue así ❤️</p>
        ) : (
          <ul className="space-y-3">
            {items.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-background/70 p-3 dark:bg-background/30">
                <span className="text-lg leading-none" aria-hidden>{r.icon}</span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{r.message}</p>
                  <p className="text-sm leading-snug text-muted-foreground">{r.action}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
