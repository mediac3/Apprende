"use client";

// [Dashboard Docente] Bloque G — Actividad reciente (7 días, máx 10, scroll).
import { ClipboardPen, NotebookPen, MessageSquare, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentActivityItem } from "@/lib/queries/teacher-dashboard";

const ICONS: Record<RecentActivityItem["kind"], { icon: LucideIcon; className: string }> = {
  grade: { icon: ClipboardPen, className: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
  observation: { icon: NotebookPen, className: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
  message: { icon: MessageSquare, className: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Hace ${d} d${d > 1 ? "ías" : "ía"}`;
}

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad en los últimos 7 días.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {items.map((item) => {
              const meta = ICONS[item.kind];
              return (
                <div key={item.id} className="flex items-start gap-2.5 text-sm">
                  <span className={`shrink-0 rounded-md p-1.5 ${meta.className}`}>
                    <meta.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{item.text}</p>
                    <p className="text-[11px] text-muted-foreground">{relativeTime(item.createdAtISO)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
