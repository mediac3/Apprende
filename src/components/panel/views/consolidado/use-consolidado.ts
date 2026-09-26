"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConsolidadoAnoResumen, ConsolidadoResult } from "@/lib/queries/consolidado";

// === [F2] Consolidado anual: hook de carga y filtros ===
// Filtros: año académico (default: activo) → grado → grupo → periodo
// (año completo o acumulado hasta Px). Exporta a Excel vía xlsx
// (dependencia existente en package.json).
// Filtros de presentación (estado local, sin URL; se resetean al cambiar de
// grupo): docente (oculta columnas de asignaturas) → áreas en bajo → notas
// en blanco → mejores promedios (top N con empates). El promedio final del
// estudiante NUNCA se recalcula con las asignaturas visibles.

export interface ConsolidadoFilters {
  yearId: string;
  branchId: string; // "" = todas las sedes
  gradeLevelId: string; // "" = todos los grados
  groupId: string;
  hasta: string; // "" = año completo | "1".."6" = acumulado hasta ese periodo
}

export interface ConsolidadoDisplayFilters {
  teacherId: string; // "" = todos los docentes
  areasMode: "all" | "reprobadas" | "aprobadas";
  blankOnly: boolean; // solo estudiantes con notas en blanco (excluye topBest)
  topBest: boolean; // mejores promedios descendente
  topN: number; // cantidad de puestos (default 10)
}

const DEFAULT_DISPLAY: ConsolidadoDisplayFilters = {
  teacherId: "",
  areasMode: "all",
  blankOnly: false,
  topBest: false,
  topN: 10,
};

/** Etiqueta legible del estado de promoción (compartida por exports) */
export function estadoPromocionLabel(estado: string): string {
  switch (estado) {
    case "promovido": return "PROMOVIDO";
    case "promovido_nivelacion": return "PROMOVIDO CON NIVELACIÓN";
    case "nivelacion": return "SUJETO A NIVELACIÓN (1-2 ÁREAS)";
    case "no_promovido": return "NO PROMOVIDO (3+ ÁREAS)";
    case "no_promovido_inasistencia": return "NO PROMOVIDO POR INASISTENCIA";
    default: return "SIN DATOS";
  }
}

interface YearRow { id: string; year: number; active: boolean; groupsCount?: number }
interface BranchRow { id: string; name: string }
interface GradeLevelRow { id: string; name: string; code: string }
interface GroupRow {
  id: string;
  name: string;
  gradeLevelId: string | null;
  branchId: string | null;
  gradeLevel?: { name: string; code: string } | null;
}

export function useConsolidado(institutionId: string | undefined) {
  const [years, setYears] = useState<YearRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [filters, setFilters] = useState<ConsolidadoFilters>({
    yearId: "",
    branchId: "",
    gradeLevelId: "",
    groupId: "",
    hasta: "",
  });
  const [data, setData] = useState<ConsolidadoResult | null>(null);
  const [resumen, setResumen] = useState<ConsolidadoAnoResumen[] | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [display, setDisplay] = useState<ConsolidadoDisplayFilters>(DEFAULT_DISPLAY);

  // Filtros de presentación: reset al cambiar de grupo (estado local)
  useEffect(() => {
    setDisplay(DEFAULT_DISPLAY);
  }, [data?.group.id]);

  // Años y grados: una sola carga
  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    (async () => {
      try {
        const [yrRes, glRes, brRes] = await Promise.all([
          fetch(`/api/academic-years?institutionId=${institutionId}`),
          fetch(`/api/grade-levels?institutionId=${institutionId}`),
          fetch(`/api/branches?institutionId=${institutionId}`),
        ]);
        const yr = await yrRes.json();
        const gl = await glRes.json();
        const br = await brRes.json();
        if (!alive) return;
        const ys: YearRow[] = yr.ok
          ? (yr.years ?? []).map((y: { id: string; year: number; active: boolean; _count?: { groups?: number } }) => ({
              id: y.id,
              year: y.year,
              active: y.active,
              groupsCount: y._count?.groups ?? 0,
            }))
          : [];
        setYears(ys);
        setGradeLevels(gl.ok ? gl.gradeLevels : []);
        setBranches(br.ok ? (br.branches ?? []) : []);
        const active = ys.find((y) => y.active) ?? ys[0];
        if (active) setFilters((f) => ({ ...f, yearId: f.yearId || active.id }));
      } catch {
        if (alive) setError("No se pudieron cargar años académicos o grados.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [institutionId]);

  // Grupos del año seleccionado (no aplica en modo "Todos los años")
  useEffect(() => {
    if (!institutionId || !filters.yearId || filters.yearId === "all") {
      setGroups([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/groups?institutionId=${institutionId}&yearId=${filters.yearId}`
        );
        const j = await res.json();
        if (alive) setGroups(j.ok ? (j.groups ?? []) : []);
      } catch {
        if (alive) setGroups([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [institutionId, filters.yearId]);

  const visibleGroups =
    (filters.branchId && filters.branchId !== "all"
      ? groups.filter((g) => g.branchId === filters.branchId)
      : groups
    ).filter(
      (g) =>
        !filters.gradeLevelId ||
        filters.gradeLevelId === "all" ||
        g.gradeLevelId === filters.gradeLevelId
    );

  // Consolidado
  const load = useCallback(async () => {
    if (!filters.groupId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ groupId: filters.groupId });
      if (filters.hasta && filters.hasta !== "all") qs.set("hasta", filters.hasta);
      const res = await fetch(`/api/consolidado?${qs.toString()}`);
      const j = await res.json();
      if (j.ok) {
        setData(j as ConsolidadoResult);
      } else {
        setData(null);
        setError(j.error ?? "Error al calcular el consolidado.");
      }
    } catch {
      setData(null);
      setError("Error de red al calcular el consolidado.");
    } finally {
      setLoading(false);
    }
  }, [filters.groupId, filters.hasta]);

  useEffect(() => {
    load();
  }, [load]);

  // Modo "Todos los años": resumen por año → grupo (año completo)
  useEffect(() => {
    if (filters.yearId !== "all" || !institutionId) {
      setResumen(null);
      return;
    }
    let alive = true;
    setResumenLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/consolidado/resumen?institutionId=${institutionId}`);
        const j = await res.json();
        if (alive) setResumen(j.ok ? (j.years ?? []) : []);
      } catch {
        if (alive) setResumen([]);
      } finally {
        if (alive) setResumenLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filters.yearId, institutionId]);

  const setFilter = useCallback((key: keyof ConsolidadoFilters, value: string) => {
    setFilters((f) => {
      const next = { ...f, [key]: value };
      if (key === "yearId") {
        next.gradeLevelId = "";
        next.groupId = "";
      }
      if (key === "branchId") next.groupId = "";
      if (key === "gradeLevelId") next.groupId = "";
      return next;
    });
  }, []);

  const setDisplayFilter = useCallback(
    <K extends keyof ConsolidadoDisplayFilters>(
      key: K,
      value: ConsolidadoDisplayFilters[K]
    ) => {
      setDisplay((d) => {
        const next = { ...d, [key]: value };
        // [F4] ⊕ [F3]: mutuamente excluyentes — activar uno desactiva el otro
        if (key === "blankOnly" && value === true) next.topBest = false;
        if (key === "topBest" && value === true) next.blankOnly = false;
        return next;
      });
    },
    []
  );

  const resetDisplay = useCallback(() => setDisplay(DEFAULT_DISPLAY), []);

  // Docentes con asignación en el grupo cargado (dropdown del filtro docente;
  // los docentes sin asignación no aparecen)
  const teachers = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    for (const s of data.subjects) {
      if (s.teacherId && s.teacherName) map.set(s.teacherId, s.teacherName);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Vista filtrada (orden de aplicación): [F2] docente (oculta columnas de
  // asignaturas) → [F5] áreas → [F4] notas en blanco → [F3] mejores promedios.
  // Conserva filas completas: promFinal, pt, estado y áreasBajo NO se
  // recalculan con las asignaturas visibles.
  const view = useMemo<ConsolidadoResult | null>(() => {
    if (!data) return null;
    const subjects =
      display.teacherId === ""
        ? data.subjects
        : data.subjects.filter((s) => s.teacherId === display.teacherId);
    let students = data.students;
    if (display.areasMode === "reprobadas") {
      students = students.filter((st) => st.areasBajo.length > 0);
    } else if (display.areasMode === "aprobadas") {
      // todas las áreas aprobadas; excluye estudiantes sin datos
      students = students.filter(
        (st) => st.areasBajo.length === 0 && st.promFinal !== null
      );
    }
    if (display.blankOnly) {
      students = students.filter((st) => st.blankCount > 0);
    }
    if (display.topBest && !display.blankOnly) {
      const n = Math.max(1, Math.floor(display.topN) || 1);
      const ranked = students
        .filter((st) => st.promFinal !== null)
        .sort(
          (a, b) =>
            (b.promFinal as number) - (a.promFinal as number) ||
            a.fullName.localeCompare(b.fullName)
        );
      // empates en el puesto N: se incluyen todos (corte por valor, no por posición)
      const cutoff =
        ranked.length > n ? (ranked[n - 1].promFinal as number) : -Infinity;
      students = ranked.filter((st) => (st.promFinal as number) >= cutoff);
    }
    return { ...data, subjects, students };
  }, [data, display]);

  const exportExcel = useCallback(async () => {
    if (!view) return;
    const XLSX = await import("xlsx");
    const g = view.group;
    const aoa: (string | number | null)[][] = [];
    aoa.push([
      g.institutionName,
      g.branchName ?? "",
      "CONSOLIDADO ANUAL",
      `${g.gradeLevelName ?? ""} — ${g.name}`,
      `Año ${g.year ?? ""}`,
      `Umbral de promoción: ${view.umbral}`,
    ]);
    const head1: (string | number | null)[] = ["#", "ESTUDIANTE"];
    const head2: (string | number | null)[] = ["", ""];
    for (const s of view.subjects) {
      head1.push(s.abbreviation ?? s.name);
      for (let i = 0; i < view.periods.length; i++) head1.push("");
      for (const p of view.periods) head2.push(p.order ? `P${p.order}` : p.name);
      head2.push("DEF");
    }
    head1.push("%", "DBJ", "PT", "Inas", "% Ina.", "ÁREAS EN BAJO", "NIVELACIÓN (PÁR. 3)", "ESTADO");
    head2.push("%", "DBJ", "PT", "Inas", "% Ina.", "ÁREAS EN BAJO", "NIVELACIÓN (PÁR. 3)", "ESTADO");
    aoa.push(head1, head2);
    for (const st of view.students) {
      const row: (string | number | null)[] = [
        st.pt ?? "",
        st.fullName,
      ];
      for (const subj of view.subjects) {
        for (const p of view.periods) row.push(st.def[subj.id]?.[p.id] ?? null);
        row.push(st.defFinal[subj.id] ?? null);
      }
      row.push(
        st.promFinal !== null ? Math.round((st.promFinal / 5) * 100) : null,
        st.dbj,
        st.pt ?? "",
        st.inas,
        st.pctInasistencia !== null ? `${st.pctInasistencia}%` : "",
        st.areasBajo.join("; "),
        st.pendientesNivelacion.join("; "),
        estadoPromocionLabel(st.estado)
      );
      aoa.push(row);
    }
    const promRow: (string | number | null)[] = ["", "Prom"];
    const nmRow: (string | number | null)[] = ["", "NM"];
    for (const subj of view.subjects) {
      for (let i = 0; i < view.periods.length; i++) {
        promRow.push("");
        nmRow.push("");
      }
      promRow.push(view.resumen[subj.id]?.prom ?? null);
      nmRow.push(view.resumen[subj.id]?.nm ?? null);
    }
    promRow.push("", "", "", "", "", "", "", "");
    nmRow.push("", "", "", "", "", "", "", "");
    aoa.push(promRow, nmRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 4 },
      { wch: 32 },
      ...view.subjects.flatMap(() => [
        ...view.periods.map(() => ({ wch: 5 })),
        { wch: 6 },
      ]),
      { wch: 5 },
      { wch: 5 },
      { wch: 6 },
      { wch: 6 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
    XLSX.writeFile(wb, `consolidado-${g.name}-${g.year ?? ""}.xlsx`);
  }, [view]);

  // Exportar PDF (estilo institucional, respeta los filtros activos).
  // Una columna por asignatura con DEF final: los periodos completos hacen
  // el PDF ilegible; el detalle por periodo queda en el Excel.
  const exportPdf = useCallback(async () => {
    if (!view) return;
    const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableMod.default;
    const g = view.group;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabecera institucional (estilo de los reportes del colegio)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(g.institutionName.toUpperCase(), pageWidth / 2, 13, { align: "center" });
    doc.setFontSize(11);
    doc.text("CONSOLIDADO ANUAL", pageWidth / 2, 19, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const periodoTxt =
      filters.hasta && filters.hasta !== "all" ? ` · Acumulado hasta P${filters.hasta}` : " · Año completo";
    doc.text(
      `SEDE: ${g.branchName ?? "—"}    Grupo: ${g.name}    Año: ${g.year ?? "—"}    Umbral de aprobación: ${view.umbral}${periodoTxt}`,
      pageWidth / 2,
      24.5,
      { align: "center" }
    );

    let startY = 30;
    const filtrosTxt: string[] = [];
    if (display.teacherId) {
      const t = teachers.find((t) => t.id === display.teacherId);
      if (t) filtrosTxt.push(`Docente: ${t.name}`);
    }
    if (display.areasMode !== "all") {
      filtrosTxt.push(display.areasMode === "reprobadas" ? "Con áreas en bajo" : "Todas las áreas aprobadas");
    }
    if (display.blankOnly) filtrosTxt.push("Solo con notas en blanco");
    if (display.topBest) filtrosTxt.push(`Mejores ${display.topN} promedios (con empates)`);
    if (filtrosTxt.length > 0) {
      doc.setFontSize(8);
      doc.text(`Filtros: ${filtrosTxt.join(" · ")}`, pageWidth / 2, startY, { align: "center" });
      startY += 4;
    }

    const head = ["#", "ESTUDIANTE", ...view.subjects.map((s) => s.abbreviation ?? s.name), "%", "DBJ", "PT", "Inas", "% Ina.", "ÁREAS EN BAJO", "ESTADO"];
    const body = view.students.map((st, i) => [
      i + 1,
      st.fullName,
      ...view.subjects.map((s) => st.defFinal[s.id] ?? ""),
      st.promFinal !== null ? `${Math.round((st.promFinal / 5) * 100)}%` : "",
      st.dbj,
      st.pt ?? "",
      st.inas,
      st.pctInasistencia !== null ? `${st.pctInasistencia}%` : "",
      st.areasBajo.join("; "),
      estadoPromocionLabel(st.estado),
    ]);

    const colStyles: Record<number, { cellWidth?: number; halign?: "left" | "center" | "right" }> = {
      0: { cellWidth: 6, halign: "center" },
      1: { cellWidth: 40, halign: "left" },
    };
    const primeraAsig = 2;
    // Ancho de asignaturas calculado para que la tabla quepa en el A4
    // horizontal (297mm) menos márgenes: sin esto, ÁREAS/ESTADO se recortan.
    const margenLateral = 8;
    const fijos = 6 + 40 + 12 + 10 + 9 + 10 + 11 + 36 + 32; // columnas no-asignatura
    const anchoAsig = Math.max(
      6,
      Math.floor(((pageWidth - margenLateral * 2 - fijos) / Math.max(1, view.subjects.length)) * 10) / 10
    );
    view.subjects.forEach((_, i) => {
      colStyles[primeraAsig + i] = { cellWidth: anchoAsig, halign: "center" };
    });
    const fixed: Array<[number, number, "left" | "center"]> = [
      [primeraAsig + view.subjects.length, 12, "center"],
      [primeraAsig + view.subjects.length + 1, 10, "center"],
      [primeraAsig + view.subjects.length + 2, 9, "center"],
      [primeraAsig + view.subjects.length + 3, 10, "center"],
      [primeraAsig + view.subjects.length + 4, 11, "center"],
      [primeraAsig + view.subjects.length + 5, 36, "left"],
      [primeraAsig + view.subjects.length + 6, 32, "left"],
    ];
    for (const [idx, w, h] of fixed) colStyles[idx] = { cellWidth: w, halign: h };

    autoTable(doc, {
      startY,
      head: [head],
      body,
      margin: { left: margenLateral, right: margenLateral, top: 10, bottom: 12 },
      rowPageBreak: "avoid",
      styles: { fontSize: 6.5, cellPadding: 1.1, lineColor: [120, 120, 120], lineWidth: 0.1 },
      headStyles: { fillColor: [235, 235, 235], textColor: 20, halign: "center", fontSize: 6.5 },
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const col = data.column.index;
        if (col >= primeraAsig && col < primeraAsig + view.subjects.length) {
          const v = parseFloat(String(data.cell.raw));
          if (!Number.isNaN(v)) data.cell.styles.textColor = v < view.umbral ? [185, 28, 28] : [21, 94, 63];
        }
      },
    });

    const pages = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(110);
      doc.text(`Generado: ${new Date().toLocaleString("es-CO")} · Apprende`, 8, pageHeight - 4);
      doc.text(`Página ${i} de ${pages}`, pageWidth - 8, pageHeight - 4, { align: "right" });
    }

    doc.save(`consolidado-${g.name}-${g.year ?? ""}.pdf`);
  }, [view, filters.hasta, display, teachers]);

  return {
    years,
    branches,
    gradeLevels,
    groups: visibleGroups,
    filters,
    setFilter,
    data,
    view,
    resumen,
    resumenLoading,
    teachers,
    display,
    setDisplayFilter,
    resetDisplay,
    loading,
    error,
    reload: load,
    exportExcel,
    exportPdf,
  };
}
