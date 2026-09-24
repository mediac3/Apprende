"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Table2 } from "lucide-react";
import { ConsolidadoTable } from "./consolidado-table";
import { useConsolidado } from "./use-consolidado";

// === [F2] Módulo "Consolidado anual" (grupo Académico) ===
// Filtros: año académico (default activo) → grado → grupo → periodo
// (año completo | acumulado hasta Px). Header del reporte: institución +
// sede + grado + grupo + año. Exportación a Excel.

export default function ConsolidadoView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;
  const {
    years,
    gradeLevels,
    groups,
    filters,
    setFilter,
    data,
    loading,
    error,
    reload,
    exportExcel,
  } = useConsolidado(institutionId);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportExcel();
    } finally {
      setExporting(false);
    }
  }

  const activeYear = years.find((y) => y.id === filters.yearId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Table2 className="h-5 w-5" />
            Consolidado anual
          </h1>
          <p className="text-sm text-muted-foreground">
            Notas por periodo, DEF final, promedio y estado de promoción por estudiante.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={!filters.groupId || loading}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Actualizar
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!data || exporting}>
            <Download className="mr-1 h-4 w-4" />
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Select value={filters.yearId} onValueChange={(v) => setFilter("yearId", v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.year}{y.active ? " (activo)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.gradeLevelId} onValueChange={(v) => setFilter("gradeLevelId", v)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Grado (todos)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grados</SelectItem>
              {gradeLevels.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.groupId} onValueChange={(v) => setFilter("groupId", v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent>
              {groups.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Sin grupos</div>
              )}
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.hasta} onValueChange={(v) => setFilter("hasta", v)}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="Periodo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Año completo (final)</SelectItem>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>Acumulado hasta P{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loading && <span className="text-sm text-muted-foreground">Calculando…</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </CardContent>
      </Card>

      {!filters.groupId ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Selecciona un año y un grupo para generar el consolidado.
        </div>
      ) : data ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.group.institutionName}</span>
            {data.group.branchName ? ` · ${data.group.branchName}` : ""} ·{" "}
            {data.group.gradeLevelName ?? "—"} · Grupo {data.group.name} · Año{" "}
            {data.group.year ?? activeYear?.year ?? "—"} · Umbral de promoción:{" "}
            <span className="font-medium text-foreground">{data.umbral}</span>
          </p>
          <ConsolidadoTable data={data} />
        </div>
      ) : !loading && !error ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin datos para el grupo seleccionado.
        </div>
      ) : null}
    </div>
  );
}
