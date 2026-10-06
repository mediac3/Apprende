"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionShell } from "./critical-alerts";
import type { DirectivoData } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque H] Actividad reciente institucional
// (AuditLog, últimos 7 días — el filtro vive en el servidor).
// Máx. 8 eventos con scroll interno y timestamp relativo.
// ============================================================

const ACTION_LABELS: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
  login: "Inició sesión",
  sign: "Firmó",
};

type Props = { data: DirectivoData };

export function RecentActivity({ data }: Props) {
  const events = data.recentActivity.slice(0, 8);

  return (
    <SectionShell id="activity" title="Actividad reciente" icon={<Activity className="h-4 w-4 text-primary" />}>
      <Card className="py-0">
        {events.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin actividad en los últimos 7 días.</p>
        ) : (
          <ScrollArea className="max-h-64">
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span className="font-medium">{e.userName}</span>{" "}
                      <span className="text-muted-foreground">{describe(e.description)}</span>
                    </span>
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={e.createdAt}>
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: es })}
                  </time>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </Card>
    </SectionShell>
  );
}

function describe(raw: string): string {
  // El AuditLog guarda "action · module" (ej. "update · grades")
  const [action, module] = raw.split(" · ");
  const label = ACTION_LABELS[action] ?? action;
  return module ? `${label.toLowerCase()} en ${module}` : label;
}
