"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// === [F3] Wizard "Promoción de grado": hook de estado y llamadas ===
// Criterios oficiales de la comisión: valoración por áreas, nivelación
// (Parágrafo 3), inasistencia injustificada ≥ umbral (configurable),
// preescolar automático y decisiones de comisión con justificación
// obligatoria al desviar el cálculo. Preview/execute vía POST /api/promocion.

export interface PromocionRow {
  id: string;
  fullName: string;
  promFinal: number | null;
  defCompleta: boolean;
  areasBajo: string[];
  pendientesNivelacion: string[];
  pctInasistencia: number | null;
  estado: string; // EstadoPromocion
  promovible: boolean;
}

export interface PromocionMeta {
  umbral: number;
  umbralInasistencia: number;
  preescolar: boolean;
  from: { id: string; name: string; gradeLevelName: string | null; year: number | null };
  to: { id: string; name: string; gradeLevelName: string | null; year: number | null };
}

export interface PromocionPreview extends PromocionMeta {
  students: PromocionRow[];
}

export interface PromocionDecision {
  id: string;
  decision: string;
  justificacion: string;
}

export interface PromocionResult extends PromocionMeta {
  promovidos: string[];
  decisions: PromocionDecision[];
  rechazados: { id: string; fullName: string; reason: string }[];
}

/** Opciones de decisión de comisión (criterios oficiales) */
export const DECISIONES_COMISION = [
  { value: "promovido_piar", label: "Promovido — análisis PIAR / ajustes razonables" },
  { value: "promovido_trayectoria", label: "Promovido — trayectoria ≥ 80% del plan" },
  { value: "no_promovido_repeticion", label: "No promovido — repetición solicitada por la familia (Pár. 2)" },
  { value: "no_sujeto_asistente", label: "No sujeto a promoción — asistente (calendario B / exterior)" },
] as const;

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
  const [params, setParams] = useState<{
    umbralArea: number | null;
    umbralInasistencia: number;
    maxAreasNivelacion: number;
    preescolarCodes: string;
  } | null>(null);

  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<PromocionPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"todos" | "promovidos" | "nivelacion" | "no">("todos");
  const [decisions, setDecisions] = useState<Record<string, PromocionDecision>>({});
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

  // Parámetros institucionales de promoción (solo lectura en el wizard;
  // se configuran en Parámetros → Promoción escolar)
  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    fetch(`/api/promocion-config?institutionId=${institutionId}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.ok) setParams(j.config);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [institutionId]);

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
      const pv = j as PromocionPreview;
      setPreview(pv);
      setDecisions({});
      // Preselección: promovidos, promovidos con nivelación y sujetos a
      // nivelación (promovido condicionado — decisión de la comisión)
      setSelected(
        new Set(pv.students.filter((s) => s.promovible).map((s) => s.id))
      );
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

  /** Un estudiante no promovible se habilita solo con decisión + justificación */
  const canSelect = useCallback(
    (row: PromocionRow) => {
      if (row.promovible) return true;
      const d = decisions[row.id];
      return (
        !!d &&
        d.decision.startsWith("promovido") &&
        d.justificacion.trim().length >= 10
      );
    },
    [decisions]
  );

  const setDecision = useCallback((id: string, decision: string, justificacion: string) => {
    setDecisions((prev) => {
      const next = { ...prev };
      if (!decision && !justificacion) {
        delete next[id];
        return next;
      }
      next[id] = { id, decision, justificacion };
      return next;
    });
  }, []);

  const execute = useCallback(async () => {
    if (!preview || selected.size === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const decisionsEnviadas = Object.values(decisions).filter((d) =>
        selected.has(d.id) ? d.decision && d.justificacion.trim() : true
      );
      const res = await fetch("/api/promocion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          fromGroupId: preview.from.id,
          toGroupId: preview.to.id,
          studentIds: [...selected],
          decisions: decisionsEnviadas,
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
  }, [preview, selected, decisions]);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setSelected(new Set());
    setDecisions({});
    setStep(1);
    setError(null);
  }, []);

  const suggestedName = useMemo(() => {
    if (!fromGroup || !nextLevel) return "";
    const m = fromGroup.name.match(/^\d+/);
    return m ? fromGroup.name.replace(/^\d+/, nextLevel.code) : nextLevel.name;
  }, [fromGroup, nextLevel]);

  const estadoLabel = useCallback((estado: string): string => {
    switch (estado) {
      case "promovido": return "PROMOVIDO";
      case "promovido_nivelacion": return "PROMOVIDO CON NIVELACIÓN";
      case "nivelacion": return "SUJETO A NIVELACIÓN (1-2 áreas)";
      case "no_promovido": return "NO PROMOVIDO (3+ áreas en bajo)";
      case "no_promovido_inasistencia": return "NO PROMOVIDO POR INASISTENCIA";
      default: return "SIN DATOS";
    }
  }, []);

  /** CSV con criterios, decisiones y justificaciones */
  const exportCsv = useCallback(() => {
    if (!preview) return;
    const meta = result ?? preview;
    const promotedSet = new Set(result ? result.promovidos : [...selected]);
    const lines: string[][] = [
      ["ACTA DE COMISIÓN DE PROMOCIÓN — RESUMEN"],
      ["Origen", `${meta.from.name} (${meta.from.year ?? ""})`],
      ["Destino", `${meta.to.name} (${meta.to.year ?? ""})`],
      ["Umbral de áreas", String(meta.umbral)],
      ["Umbral de inasistencia", `${meta.umbralInasistencia}%`],
      ["Preescolar (promoción automática)", meta.preescolar ? "Sí" : "No"],
      [],
      ["ESTUDIANTE", "PROMEDIO", "ÁREAS EN BAJO", "PENDIENTES DE NIVELACIÓN", "% INA.", "ESTADO CALCULADO", "DECISIÓN COMISIÓN", "JUSTIFICACIÓN", "RESULTADO"],
    ];
    for (const s of preview.students) {
      const d = decisions[s.id] ?? result?.decisions.find((x) => x.id === s.id);
      const rechazo = result?.rechazados.find((r) => r.id === s.id);
      const promovido = promotedSet.has(s.id);
      lines.push([
        s.fullName,
        s.promFinal !== null ? String(s.promFinal) : "",
        s.areasBajo.join("; "),
        s.pendientesNivelacion.join("; "),
        s.pctInasistencia !== null ? `${s.pctInasistencia}%` : "",
        estadoLabel(s.estado),
        d?.decision ?? "",
        d?.justificacion ?? "",
        rechazo ? `NO PROMOVIDO: ${rechazo.reason}` : promovido ? "PROMOVIDO" : "NO INCLUIDO",
      ]);
    }
    const csv = lines.map((l) => l.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acta-promocion-${meta.from.name}-a-${meta.to.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preview, result, selected, decisions, estadoLabel]);

  /** Acta de comisión imprimible (guardar como PDF desde el navegador) */
  const printActa = useCallback(() => {
    if (!preview) return;
    const meta = result ?? preview;
    const promotedSet = new Set(result ? result.promovidos : [...selected]);
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const filas = preview.students
      .map((s) => {
        const d = decisions[s.id] ?? result?.decisions.find((x) => x.id === s.id);
        const rechazo = result?.rechazados.find((r) => r.id === s.id);
        const res = rechazo
          ? `No promovido — ${esc(rechazo.reason)}`
          : promotedSet.has(s.id)
            ? "<b>Promovido</b>"
            : "No incluido";
        return `<tr>
          <td>${esc(s.fullName)}</td>
          <td class="c">${s.promFinal ?? "—"}</td>
          <td>${esc(s.areasBajo.join("; ")) || "—"}</td>
          <td>${esc(s.pendientesNivelacion.join("; ")) || "—"}</td>
          <td class="c">${s.pctInasistencia !== null ? s.pctInasistencia + "%" : "—"}</td>
          <td>${esc(estadoLabel(s.estado))}</td>
          <td>${d ? esc(d.decision) : ""}${d?.justificacion ? `<br><i>${esc(d.justificacion)}</i>` : ""}</td>
          <td>${res}</td>
        </tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
      <title>Acta de comisión de promoción</title>
      <style>
        body { font-family: Georgia, serif; margin: 32px; color: #111; }
        h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
        .sub { text-align: center; color: #444; font-size: 13px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #666; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; }
        .c { text-align: center; }
        .meta { font-size: 13px; margin-bottom: 12px; }
        @media print { .noprint { display: none; } }
      </style></head><body>
      <h1>Acta de Comisión de Promoción</h1>
      <p class="sub">${esc(meta.from.name)} (${meta.from.year ?? ""}) → ${esc(meta.to.name)} (${meta.to.year ?? ""})</p>
      <p class="meta">
        Umbral de áreas: <b>${meta.umbral}</b> · Umbral de inasistencia injustificada: <b>${meta.umbralInasistencia}%</b>
        ${meta.preescolar ? " · <b>Preescolar: promoción automática (Pár. 1, Decreto 1411 de 2022)</b>" : ""}<br>
        Criterios: valoración final de todas las áreas en básico o superior; asignatura en bajo
        dentro de área aprobada → nivelación (Pár. 3); 1–2 áreas en bajo → nivelación especial;
        inasistencia injustificada ≥ ${meta.umbralInasistencia}% → no promovido.
      </p>
      <table><thead><tr>
        <th>Estudiante</th><th class="c">Prom.</th><th>Áreas en bajo</th>
        <th>Pendientes de nivelación</th><th class="c">% Ina.</th>
        <th>Estado</th><th>Decisión de comisión</th><th>Resultado</th>
      </tr></thead><tbody>${filas}</tbody></table>
      <p class="meta" style="margin-top:24px">
        Firmas de la comisión: ____________________ &nbsp; ____________________ &nbsp; ____________________
      </p>
      <p class="noprint"><button onclick="window.print()">Imprimir / Guardar como PDF</button></p>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [preview, result, selected, decisions, estadoLabel]);

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
    params,
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
    canSelect,
    decisions,
    setDecision,
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
    printActa,
    estadoLabel,
  };
}
