"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsolidadoResult } from "@/lib/queries/consolidado";

// === [F2] Consolidado anual: hook de carga y filtros ===
// Filtros: año académico (default: activo) → grado → grupo → periodo
// (año completo o acumulado hasta Px). Exporta a Excel vía xlsx
// (dependencia existente en package.json).

export interface ConsolidadoFilters {
  yearId: string;
  gradeLevelId: string; // "" = todos los grados
  groupId: string;
  hasta: string; // "" = año completo | "1".."6" = acumulado hasta ese periodo
}

interface YearRow { id: string; year: number; active: boolean }
interface GradeLevelRow { id: string; name: string; code: string }
interface GroupRow {
  id: string;
  name: string;
  gradeLevelId: string | null;
  gradeLevel?: { name: string; code: string } | null;
}

export function useConsolidado(institutionId: string | undefined) {
  const [years, setYears] = useState<YearRow[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [filters, setFilters] = useState<ConsolidadoFilters>({
    yearId: "",
    gradeLevelId: "",
    groupId: "",
    hasta: "",
  });
  const [data, setData] = useState<ConsolidadoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Años y grados: una sola carga
  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    (async () => {
      try {
        const [yrRes, glRes] = await Promise.all([
          fetch(`/api/academic-years?institutionId=${institutionId}`),
          fetch(`/api/grade-levels?institutionId=${institutionId}`),
        ]);
        const yr = await yrRes.json();
        const gl = await glRes.json();
        if (!alive) return;
        const ys: YearRow[] = yr.ok ? yr.years : [];
        setYears(ys);
        setGradeLevels(gl.ok ? gl.gradeLevels : []);
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

  // Grupos del año seleccionado
  useEffect(() => {
    if (!institutionId || !filters.yearId) {
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
    filters.gradeLevelId && filters.gradeLevelId !== "all"
      ? groups.filter((g) => g.gradeLevelId === filters.gradeLevelId)
      : groups;

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

  const setFilter = useCallback((key: keyof ConsolidadoFilters, value: string) => {
    setFilters((f) => {
      const next = { ...f, [key]: value };
      if (key === "yearId") {
        next.gradeLevelId = "";
        next.groupId = "";
      }
      if (key === "gradeLevelId") next.groupId = "";
      return next;
    });
  }, []);

  const exportExcel = useCallback(async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const g = data.group;
    const aoa: (string | number | null)[][] = [];
    aoa.push([
      g.institutionName,
      g.branchName ?? "",
      "CONSOLIDADO ANUAL",
      `${g.gradeLevelName ?? ""} — ${g.name}`,
      `Año ${g.year ?? ""}`,
      `Umbral de promoción: ${data.umbral}`,
    ]);
    const head1: (string | number | null)[] = ["#", "ESTUDIANTE"];
    const head2: (string | number | null)[] = ["", ""];
    for (const s of data.subjects) {
      head1.push(s.abbreviation ?? s.name);
      for (let i = 0; i < data.periods.length; i++) head1.push("");
      for (const p of data.periods) head2.push(p.order ? `P${p.order}` : p.name);
      head2.push("DEF");
    }
    head1.push("%", "DBJ", "PT", "Inas", "% Ina.", "ÁREAS EN BAJO", "NIVELACIÓN (PÁR. 3)", "ESTADO");
    head2.push("%", "DBJ", "PT", "Inas", "% Ina.", "ÁREAS EN BAJO", "NIVELACIÓN (PÁR. 3)", "ESTADO");
    aoa.push(head1, head2);
    const estadoLabel = (estado: string): string => {
      switch (estado) {
        case "promovido": return "PROMOVIDO";
        case "promovido_nivelacion": return "PROMOVIDO CON NIVELACIÓN";
        case "nivelacion": return "SUJETO A NIVELACIÓN (1-2 ÁREAS)";
        case "no_promovido": return "NO PROMOVIDO (3+ ÁREAS)";
        case "no_promovido_inasistencia": return "NO PROMOVIDO POR INASISTENCIA";
        default: return "SIN DATOS";
      }
    };
    for (const st of data.students) {
      const row: (string | number | null)[] = [
        st.pt ?? "",
        st.fullName,
      ];
      for (const subj of data.subjects) {
        for (const p of data.periods) row.push(st.def[subj.id]?.[p.id] ?? null);
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
        estadoLabel(st.estado)
      );
      aoa.push(row);
    }
    const promRow: (string | number | null)[] = ["", "Prom"];
    const nmRow: (string | number | null)[] = ["", "NM"];
    for (const subj of data.subjects) {
      for (let i = 0; i < data.periods.length; i++) {
        promRow.push("");
        nmRow.push("");
      }
      promRow.push(data.resumen[subj.id]?.prom ?? null);
      nmRow.push(data.resumen[subj.id]?.nm ?? null);
    }
    promRow.push("", "", "", "", "", "", "", "");
    nmRow.push("", "", "", "", "", "", "", "");
    aoa.push(promRow, nmRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 4 },
      { wch: 32 },
      ...data.subjects.flatMap(() => [
        ...data.periods.map(() => ({ wch: 5 })),
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
  }, [data]);

  return {
    years,
    gradeLevels,
    groups: visibleGroups,
    filters,
    setFilter,
    data,
    loading,
    error,
    reload: load,
    exportExcel,
  };
}
