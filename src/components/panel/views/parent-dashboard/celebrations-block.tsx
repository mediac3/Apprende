"use client";

// [Dashboard Padre] Bloque J — para celebrar 🎉 (hitos reales no mostrados en "¿Cómo ayudar?").
// Regla dura: sin hitos → el bloque no se muestra.
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Celebration } from "@/lib/queries/parent-dashboard";

export function CelebrationsBlock({ items }: { items: Celebration[] }) {
  if (items.length === 0) return null; // sin hitos → sin bloque
  return (
    <Card className="border-amber-200/70 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20" data-testid="parent-celebraciones">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Para celebrar 🎉</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((c, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.25 }}
              className="flex items-center gap-2.5 text-sm"
            >
              <span className="text-base" aria-hidden>{c.icon}</span>
              <span className="font-medium">{c.message}</span>
            </motion.li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
