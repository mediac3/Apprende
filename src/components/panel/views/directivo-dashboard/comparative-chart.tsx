"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionShell } from "./critical-alerts";
import type { DirectivoData } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque F] Comparativa con períodos
// anteriores: líneas de Asistencia y Rendimiento (% — eje izq.) y
// barras de Retiros (eje der.) para los últimos 5 periodos.
// Regla dura: reutilizar recharts (ya instalado).
// ============================================================

type Props = { data: DirectivoData };

export function ComparativeChart({ data }: Props) {
  const { periods, attendance, performance, retiros } = data.comparative;
  const rows = periods.map((name, i) => ({
    name,
    asistencia: attendance[i] ?? null,
    rendimiento: performance[i] ?? null,
    retiros: retiros[i] ?? 0,
  }));

  return (
    <SectionShell id="comparative" title="Comparativa con períodos anteriores" icon={<LineChart className="h-4 w-4 text-primary" />}>
      <Card className="p-4">
        {periods.length < 2 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aún no hay suficientes periodos para comparar.
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <LegendDot className="bg-emerald-500" label="Asistencia %" />
              <LegendDot className="bg-violet-500" label="Rendimiento %" />
              <LegendDot className="bg-slate-400" label="Retiros" />
            </div>
            <div className="h-52" data-testid="comparative-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={38} />
                  <YAxis yAxisId="ret" orient="right" domain={[0, "auto"]} allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={26} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value, name) =>
                      name === "Retiros" ? [String(value), "Retiros"] : [`${String(value).replace(".", ",")}%`, String(name)]
                    }
                  />
                  <Bar yAxisId="ret" dataKey="retiros" name="Retiros" fill="rgb(148 163 184 / 0.5)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Line yAxisId="pct" type="monotone" dataKey="asistencia" name="Asistencia" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
                  <Line yAxisId="pct" type="monotone" dataKey="rendimiento" name="Rendimiento" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>
    </SectionShell>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
