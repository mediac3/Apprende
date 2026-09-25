"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Eraser, RefreshCw, SlidersHorizontal, Table2 } from "lucide-react";
import { ConsolidadoTable } from "./consolidado-table";
import { StudentDrilldownModal } from "./student-drilldown-modal";
import { useConsolidado, type ConsolidadoDisplayFilters } from "./use-consolidado";

// === [F2] Módulo "Consolidado anual" (grupo Académico) ===
// Filtros: año académico (default activo) → grado → grupo → periodo
// (año completo | acumulado hasta Px). Header del reporte: institución +
// sede + grado + grupo + año. Exportación a Excel.
// Filtros de presentación ([F2]-[F5] del usuario): docente, áreas en bajo,
// notas en blanco y mejores promedios — colapsables en móvil, estado local.

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
    view,
    teachers,
    display,
    setDisplayFilter,
    resetDisplay,
    loading,
    error,
    reload,
    exportExcel,
  } = useConsolidado(institutionId);
  const [exporting, setExporting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportExcel();
    } finally {
      setExporting(false);
    }
  }

  const activeYear = years.find((y) => y.id === filters.yearId);
  const activeDisplayCount =
    (display.teacherId !== "" ? 1 : 0) +
    (display.areasMode !== "all" ? 1 : 0) +
    (display.blankOnly ? 1 : 0) +
    (display.topBest ? 1 : 0);

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
          <Button size="sm" onClick={handleExport} disabled={!view || exporting}>
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
                  {y.year}
                  {y.active ? " (activo)" : ""}
                  {y.groupsCount === 0 ? " (sin grupos)" : ""}
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

          {/* Filtros de presentación — botón colapsable solo en móvil */}
          <div className="flex w-full items-center gap-2 md:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              disabled={!data}
            >
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              Filtros{activeDisplayCount > 0 ? ` (${activeDisplayCount})` : ""}
            </Button>
          </div>
          <div
            className={`${
              showFilters ? "flex" : "hidden"
            } w-full flex-wrap items-center gap-2 border-t pt-2 md:flex`}
          >
            <Select
              value={display.teacherId || "all"}
              onValueChange={(v) => setDisplayFilter("teacherId", v === "all" ? "" : v)}
              disabled={!data}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Docente (todos)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los docentes</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={display.areasMode}
              onValueChange={(v) =>
                setDisplayFilter("areasMode", v as ConsolidadoDisplayFilters["areasMode"])
              }
              disabled={!data}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Áreas: todas</SelectItem>
                <SelectItem value="reprobadas">Con áreas en bajo (nivelación)</SelectItem>
                <SelectItem value="aprobadas">Con todas las áreas aprobadas</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={display.blankOnly}
                onCheckedChange={(v) => setDisplayFilter("blankOnly", v === true)}
                disabled={!data}
              />
              Solo con notas en blanco
            </label>

            <label
              className="flex items-center gap-1.5 text-sm"
              title={
                display.blankOnly
                  ? "Desactiva «Solo con notas en blanco» para usar mejores promedios"
                  : undefined
              }
            >
              <Checkbox
                checked={display.topBest}
                onCheckedChange={(v) => setDisplayFilter("topBest", v === true)}
                disabled={!data || display.blankOnly}
              />
              Mejores promedios
            </label>
            {display.topBest && (
              <label className="flex items-center gap-1 text-sm">
                Cantidad de puestos:
                <Input
                  type="number"
                  min={1}
                  value={display.topN}
                  onChange={(e) =>
                    setDisplayFilter(
                      "topN",
                      Math.max(1, Math.floor(Number(e.target.value)) || 1)
                    )
                  }
                  className="h-8 w-[72px]"
                />
              </label>
            )}
            {display.blankOnly && (
              <span className="text-xs text-muted-foreground">
                «Mejores promedios» no es combinable con notas en blanco.
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={resetDisplay}
              disabled={activeDisplayCount === 0}
            >
              <Eraser className="mr-1 h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {!filters.groupId ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Selecciona un año y un grupo para generar el consolidado.
        </div>
      ) : data && view ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.group.institutionName}</span>
            {data.group.branchName ? ` · ${data.group.branchName}` : ""} ·{" "}
            {data.group.gradeLevelName ?? "—"} · Grupo {data.group.name} · Año{" "}
            {data.group.year ?? activeYear?.year ?? "—"} · Umbral de promoción:{" "}
            <span className="font-medium text-foreground">{data.umbral}</span>
          </p>
          {activeDisplayCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Filtros activos: mostrando {view.students.length} de{" "}
              {data.students.length} estudiantes
              {view.subjects.length !== data.subjects.length
                ? ` · ${view.subjects.length} de ${data.subjects.length} asignaturas`
                : ""}
              . Los promedios y puestos se calculan sobre todas las asignaturas.
            </p>
          )}
          <ConsolidadoTable data={view} onStudentClick={setSelectedStudent} />
          <StudentDrilldownModal
            data={data}
            studentId={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        </div>
      ) : !loading && !error ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin datos para el grupo seleccionado.
        </div>
      ) : null}
    </div>
  );
}
