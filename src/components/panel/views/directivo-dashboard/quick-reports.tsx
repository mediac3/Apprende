"use client";

import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionShell } from "./critical-alerts";
import type { DirectivoData } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque G] Reportes rápidos.
// Botones a los módulos de reportes existentes + exportación del
// panel actual: Excel (xlsx, ya instalada) e impresión/PDF del
// navegador. Regla dura: el export respeta los filtros aplicados.
// ============================================================

type Props = {
  data: DirectivoData;
  onOpenModule: (moduleKey: string) => void;
};

export function QuickReports({ data, onOpenModule }: Props) {
  const { header, kpis, alerts, trends, distribution, comparative } = data;

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const scopeLabel =
      [header.scope.sede, header.scope.grado, header.scope.grupo].filter(Boolean).join(" / ") || "Toda la institución";
    const wb = XLSX.utils.book_new();

    // KPIs con contexto de filtros (regla dura: el export respeta los filtros)
    const kpiRows = [
      ["Institución", header.institutionName],
      ["Año", header.year],
      ["Periodo", header.period?.name ?? "--"],
      ["Alcance", scopeLabel],
      [],
      ["KPI", "Valor", "Delta"],
      ["Estudiantes", kpis.students.value ?? 0, kpis.students.delta ?? "--"],
      ["Docentes", kpis.teachers.value ?? 0, kpis.teachers.delta ?? "--"],
      ["Cursos/grupos", kpis.groups.value ?? 0, kpis.groups.delta ?? "--"],
      ["Asistencia %", kpis.attendance.value ?? "--", kpis.attendance.delta ?? "--"],
      ["Rendimiento %", kpis.performance.value ?? "--", kpis.performance.delta ?? "--"],
      ["Alertas activas", kpis.alerts.value ?? 0, "--"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiRows), "KPIs");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Severidad", "Mensaje", "Contexto"],
        ...(alerts.length ? alerts.map((a) => [a.severity, a.message, a.context]) : [["--", "Sin alertas", "--"]]),
      ]),
      "Alertas"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Indicador", "Valor", "Delta", "Dirección", ...comparative.periods],
        ...trends.map((t) => [t.indicator, t.value, t.delta ?? "--", t.direction, ...t.sparkline.map((v) => v ?? "--")]),
      ]),
      "Tendencias"
    );

    const distSheet = [
      ["Sede", "Estudiantes", "%"],
      ...distribution.bySede.map((d) => [d.name, d.count, d.pct ?? 0]),
      [],
      ["Grado", "Estudiantes", "%"],
      ...distribution.byGrado.map((d) => [d.name, d.count, d.pct ?? 0]),
      [],
      ["Jornada", "Estudiantes", "%"],
      ...distribution.byJornada.map((d) => [d.name, d.count, d.pct ?? 0]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(distSheet), "Distribución");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Periodo", "Asistencia %", "Rendimiento %", "Retiros"],
        ...comparative.periods.map((p, i) => [
          p,
          comparative.attendance[i] ?? "--",
          comparative.performance[i] ?? "--",
          comparative.retiros[i] ?? 0,
        ]),
      ]),
      "Comparativa"
    );

    const safeName = (header.institutionShortName ?? header.institutionName).replace(/[^\w-]+/g, "-").toLowerCase();
    XLSX.writeFile(wb, `dashboard-directivo-${safeName}-P${header.period?.id ?? "x"}.xlsx`);
  };

  return (
    <SectionShell id="reports" title="Reportes" icon={<FileSpreadsheet className="h-4 w-4 text-primary" />}>
      <Card className="flex flex-wrap items-center gap-2 p-3">
        {data.quickReports.map((r) => (
          <Button
            key={r.key}
            variant="outline"
            size="sm"
            onClick={() => onOpenModule(r.module)}
            className="focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {r.label}
          </Button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border md:block" />
        <Button variant="secondary" size="sm" onClick={() => void exportExcel()} data-testid="export-excel">
          <Download className="h-3.5 w-3.5" />
          Exportar Excel
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Imprimir / PDF
        </Button>
      </Card>
    </SectionShell>
  );
}
