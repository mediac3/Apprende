"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// === [F3] Wizard "Promoción de grado": hook de estado y llamadas ===
// Preview y execute vía POST /api/promocion. La selección viene pre-marcada
// con los estudiantes que cumplen el umbral; los no promovibles (promedio <
// umbral o sin notas) quedan deshabilitados (re-validado en servidor).

export interface PromocionRow {
  id: string;
  fullName: string;
  promFinal: number | null;
  defCompleta: boolean;
  promovido: boolean;
}

export interface PromocionMeta {
  umbral: number;
  from: { id: string; name: string; gradeLevelName: string | null; year: number | null };
  to: { id: string; name: string; gradeLevelName: string | null; year: number | null };
}

export interface PromocionPreview extends PromocionMeta {
  students: PromocionRow[];
}

export interface PromocionResult extends PromocionMeta {
  promovidos: string[];
  rechazados: { id: string; fullName: string; reason: string }[];
}

interface YearRow { id: string; year: number; active: boolean }
interface GradeLevelRow { id: string; name: string; code: string; sortOrder: number }
interface GroupRow { id: string; name: string; gradeLevelId: string | null; gradeLevel?: { sortOrder: number } | null }

export function usePromocion(institutionId: string | undefined, userId: string | undefined) {
  const [years, setYears] = useState<YearRow[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelRow[]>([]);
  const [groupsFrom, setGroupsFrom] = useState<GroupRow[]>([]);
  const [groupsTo, setGroupsTo] = useState<GroupRow[]>([]);

  const [fromYearId, setFromYearId] = useState("");
  const [fromGroupId, setFromGroupId] = useState("");
  const [toYearId, setToYearId] = useState("");
  const [toGroupId, setToGroupId] = useState("");

  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<PromocionPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"todos" | "promovidos" | "no">("todos");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromocionResult | null>(null);

  // Catálogos: años y grados
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
        const gls: GradeLevelRow[] = gl.ok ? gl.gradeLevels : [];
        setYears(ys);
        setGradeLevels(gls);
        const active = ys.find((y) => y.active) ?? ys[0];
        if (active) {
          setFromYearId(active.id);
          const next = ys.find((y) => y.year === active.year + 1);
          if (next) setToYearId(next.id);
        }
      } catch {
        if (alive) setError("No se pudieron cargar años o grados.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [institutionId]);

  // Grupos de cada año seleccionado
  useEffect(() => {
    if (!institutionId || !fromYearId) {
      setGroupsFrom([]);
      return;
    }
    let alive = true;
    (async () => {
      const res = await fetch(`/api/groups?institutionId=${institutionId}&yearId=${fromYearId}`);
      const j = await res.json();
      if (alive) setGroupsFrom(j.ok ? j.groups ?? [] : []);
    })().catch(() => alive && setGroupsFrom([]));
    return () => {
      alive = false;
    };
  }, [institutionId, fromYearId]);

  useEffect(() => {
    if (!institutionId || !toYearId) {
      setGroupsTo([]);
      return;
    }
    let alive = true;
    (async () => {
      const res = await fetch(`/api/groups?institutionId=${institutionId}&yearId=${toYearId}`);
      const j = await res.json();
      if (alive) setGroupsTo(j.ok ? j.groups ?? [] : []);
    })().catch(() => alive && setGroupsTo([]));
    return () => {
      alive = false;
    };
  }, [institutionId, toYearId]);

  const fromGroup = groupsFrom.find((g) => g.id === fromGroupId) ?? null;
  const toGroup = groupsTo.find((g) => g.id === toGroupId) ?? null;
  const toYear = years.find((y) => y.id === toYearId) ?? null;

  // Grado siguiente al del grupo origen (por sortOrder)
  const nextLevel = useMemo(() => {
    if (!fromGroup?.gradeLevelId) return null;
    const sorted = [...gradeLevels].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((g) => g.id === fromGroup.gradeLevelId);
    return idx >= 0 ? sorted[idx + 1] ?? null : null;
  }, [fromGroup, gradeLevels]);

  const suggestedDestGroups = useMemo(() => {
    if (!nextLevel) return [];
    return groupsTo.filter((g) => g.gradeLevelId === nextLevel.id);
  }, [groupsTo, nextLevel]);

  const createDestGroup = useCallback(
    async (name: string) => {
      if (!institutionId || !nextLevel || !toYearId) return null;
      setLoading(true);
      try {
        const res = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutionId,
            name,
            gradeLevelId: nextLevel.id,
            academicYearId: toYearId,
            userId,
          }),
        });
        const j = await res.json();
        if (!j.ok) {
          setError(j.error ?? "No se pudo crear el grupo destino.");
          return null;
        }
        // recargar grupos destino y seleccionar el nuevo
        const r2 = await fetch(`/api/groups?institutionId=${institutionId}&yearId=${toYearId}`);
        const j2 = await r2.json();
        const gs: GroupRow[] = j2.ok ? j2.groups ?? [] : [];
        setGroupsTo(gs);
        const created = gs.find((g) => g.name === name && g.gradeLevelId === nextLevel.id);
        if (created) setToGroupId(created.id);
        return created ?? null;
      } finally {
        setLoading(false);
      }
    },
    [institutionId, nextLevel, toYearId, userId]
  );

  const loadPreview = useCallback(async () => {
    if (!fromGroupId || !toGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/promocion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", fromGroupId, toGroupId }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error ?? "Error al calcular la promoción.");
        return;
      }
      setPreview(j as PromocionPreview);
      setSelected(new Set((j.students as PromocionRow[]).filter((s) => s.promovido).map((s) => s.id)));
      setTab("todos");
      setStep(2);
    } catch {
      setError("Error de red al calcular la promoción.");
    } finally {
      setLoading(false);
    }
  }, [fromGroupId, toGroupId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const execute = useCallback(async () => {
    if (!preview || selected.size === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch("/api/promocion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          fromGroupId: preview.from.id,
          toGroupId: preview.to.id,
          studentIds: [...selected],
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error ?? "Error al ejecutar la promoción.");
        return;
      }
      setResult(j as PromocionResult);
      setStep(4);
    } catch {
      setError("Error de red al ejecutar la promoción.");
    } finally {
      setExecuting(false);
    }
  }, [preview, selected]);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setSelected(new Set());
    setStep(1);
    setError(null);
  }, []);

  const suggestedName = useMemo(() => {
    if (!fromGroup || !nextLevel) return "";
    const m = fromGroup.name.match(/^\d+/);
    return m ? fromGroup.name.replace(/^\d+/, nextLevel.code) : nextLevel.name;
  }, [fromGroup, nextLevel]);

  const exportCsv = useCallback(() => {
    if (!preview) return;
    const meta = result ?? preview;
    const promotedSet = result ? new Set(result.promovidos) : selected;
    const lines: string[][] = [
      ["ESTUDIANTE", "PROMEDIO FINAL", "DEF COMPLETA", "ESTADO", "GRUPO ORIGEN", "GRUPO DESTINO", "RESULTADO"],
    ];
    for (const s of preview.students) {
      const wasSelected = promotedSet.has(s.id);
      const rechazo = result?.rechazados.find((r) => r.id === s.id);
      lines.push([
        s.fullName,
        s.promFinal !== null ? String(s.promFinal) : "",
        s.defCompleta ? "Sí" : "No",
        s.promovido ? "PROMOVIDO" : "NO PROMOVIDO",
        `${meta.from.name} (${meta.from.year ?? ""})`,
        `${meta.to.name} (${meta.to.year ?? ""})`,
        rechazo ? `NO PROMOVIDO: ${rechazo.reason}` : wasSelected ? "PROMOVIDO" : "NO INCLUIDO",
      ]);
    }
    const csv = lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promocion-${meta.from.name}-a-${meta.to.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preview, result, selected]);

  return {
    years,
    gradeLevels,
    groupsFrom,
    groupsTo,
    fromYearId,
    setFromYearId: (v: string) => {
      setFromYearId(v);
      setFromGroupId("");
    },
    fromGroupId,
    setFromGroupId,
    toYearId,
    setToYearId: (v: string) => {
      setToYearId(v);
      setToGroupId("");
    },
    toGroupId,
    setToGroupId,
    fromGroup,
    toGroup,
    toYear,
    nextLevel,
    suggestedDestGroups,
    suggestedName,
    createDestGroup,
    step,
    setStep,
    preview,
    selected,
    toggle,
    tab,
    setTab,
    loading,
    executing,
    error,
    result,
    loadPreview,
    execute,
    reset,
    exportCsv,
  };
}
