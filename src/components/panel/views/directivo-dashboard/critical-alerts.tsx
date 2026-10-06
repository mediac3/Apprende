"use client";

import { ArrowRight, BellRing, CircleAlert, CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DirectivoAlert, DirectivoData } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque C] Alertas jerarquizadas.
// 🔴 crítico · 🟠 medio · 🟡 informativo — ordenadas por severidad,
// máx. 5 visibles (regla dura). Cada alerta es accionable: el botón
// lleva al módulo donde se interviene. Sin alertas → mensaje positivo.
// ============================================================

const SEVERITY_ORDER = { critico: 0, medio: 1, info: 2 } as const;

const severityStyle: Record<DirectivoAlert["severity"], { icon: React.ReactNode; ring: string; text: string; label: string }> = {
  critico: {
    icon: <OctagonAlert className="h-4 w-4" />,
    ring: "border-l-red-500 bg-red-500/5",
    text: "text-red-600 dark:text-red-400",
    label: "Crítico",
  },
  medio: {
    icon: <TriangleAlert className="h-4 w-4" />,
    ring: "border-l-orange-500 bg-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
    label: "Medio",
  },
  info: {
    icon: <CircleAlert className="h-4 w-4" />,
    ring: "border-l-yellow-400 bg-yellow-400/5",
    text: "text-yellow-600 dark:text-yellow-500",
    label: "Informativo",
  },
};

/** Carcasa común de sección para los bloques del dashboard (ancla de scroll de los KPIs). */
export function SectionShell({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={`directivo-section-${id}`} aria-label={title} className="scroll-mt-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground/90">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

type Props = {
  data: DirectivoData;
  onOpenModule: (moduleKey: string) => void;
};

export function CriticalAlerts({ data, onOpenModule }: Props) {
  const alerts = [...data.alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const visible = alerts.slice(0, 5);
  const hidden = alerts.length - visible.length;

  return (
    <SectionShell id="alerts" title="Alertas" icon={<BellRing className="h-4 w-4 text-primary" />}>
      {alerts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <CircleCheck className="h-4 w-4 text-emerald-600" />
            Sin alertas críticas en este periodo.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((a, i) => {
            const style = severityStyle[a.severity];
            return (
              <Card key={`${a.severity}-${i}`} className={cn("border-l-4 py-0", style.ring)} data-testid={`alert-${a.severity}`}>
                <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className={cn("shrink-0", style.text)} title={style.label}>
                    {style.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-tight">{a.message}</span>
                    <span className="block text-xs text-muted-foreground">{a.context}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenModule(a.module)}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                  >
                    {a.action === "intervenir" ? "Intervenir" : "Ver detalle"}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
          {hidden > 0 && (
            <p className="text-xs text-muted-foreground">+{hidden} alerta(s) más fuera del top 5.</p>
          )}
        </div>
      )}
    </SectionShell>
  );
}
