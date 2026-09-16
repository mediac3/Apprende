"use client";

import { useMemo } from "react";
import { useGradesGrid, type CellPos } from "./use-grades-grid";
import {
  type StudentRow,
  type CalculatedRow,
  parseNote,
  APPROVAL_THRESHOLD,
} from "./use-grades-calculations";
import { cn } from "@/lib/utils";

// === Módulo Calificaciones: planilla tipo Excel (capturas 2, 3, 6) ===
// Fila 1: concepto + [X%] · Fila 2: sub-columnas N1, N2... · Celdas con nota.

export interface SheetConcept {
  id: string;
  name: string;
  percentage: number;
  order: number;
}

export interface SheetActivity {
  id: string;
  name: string;
  conceptId: string;
  isGeneral: boolean;
}

// Paleta determinística por orden de concepto (verde, naranja, morado, azul…)
const CONCEPT_COLORS = [
  { header: "bg-emerald-500 text-white", col: "bg-emerald-50/70 dark:bg-emerald-950/40" },
  { header: "bg-orange-500 text-white", col: "bg-orange-50/70 dark:bg-orange-950/40" },
  { header: "bg-violet-500 text-white", col: "bg-violet-50/70 dark:bg-violet-950/40" },
  { header: "bg-sky-500 text-white", col: "bg-sky-50/70 dark:bg-sky-950/40" },
];

function colorFor(order: number) {
  const i = ((order % CONCEPT_COLORS.length) + CONCEPT_COLORS.length) % CONCEPT_COLORS.length;
  return CONCEPT_COLORS[i];
}

function fmt(v: number | null): string {
  return v === null ? "" : v.toFixed(1);
}

export interface GradesSheetProps {
  students: StudentRow[];
  concepts: SheetConcept[];
  activities: SheetActivity[];
  values: Record<string, string>; // `${studentId}::${activityId}`
  calculations: CalculatedRow[];
  periodClosed: boolean;
  onCellChange: (studentId: string, activityId: string, raw: string) => void;
}

export function GradesSheet({
  students,
  concepts,
  activities,
  values,
  calculations,
  periodClosed,
  onCellChange,
}: GradesSheetProps) {
  // Sub-columnas aplanadas en orden: concept.order → activity.order
  const conceptById = useMemo(() => {
    const m = new Map<string, SheetConcept & { color: ReturnType<typeof colorFor> }>();
    for (const c of concepts) m.set(c.id, { ...c, color: colorFor(c.order) });
    return m;
  }, [concepts]);

  const calcByStudent = useMemo(() => {
    const m = new Map<string, CalculatedRow>();
    for (const c of calculations) m.set(c.studentId, c);
    return m;
  }, [calculations]);

  const grid = useGradesGrid({
    rowCount: students.length,
    colCount: activities.length,
    getCellValue: (p) =>
      values[`${students[p.row]?.studentId ?? ""}::${activities[p.col]?.id ?? ""}`] ?? "",
    setCellValue: (p, v) => {
      const s = students[p.row];
      const a = activities[p.col];
      if (s && a) onCellChange(s.studentId, a.id, v);
    },
  });

  const inRange = (pos: CellPos) => {
    if (!grid.range) return false;
    const { from, to } = grid.range;
    return (
      pos.row >= Math.min(from.row, to.row) &&
      pos.row <= Math.max(from.row, to.row) &&
      pos.col >= Math.min(from.col, to.col) &&
      pos.col <= Math.max(from.col, to.col)
    );
  };

  if (students.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border bg-card p-8 text-sm text-muted-foreground">
        El grupo seleccionado no tiene estudiantes activos.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-xl border bg-card">
      <table
        className="w-full border-collapse text-sm"
        onMouseLeave={() => grid.endDrag(null)}
      >
        <thead className="sticky top-0 z-10">
          {/* Fila 1: nombre del concepto + [X%] */}
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-20 min-w-[220px] border border-border bg-muted px-3 py-2 text-left text-xs font-bold uppercase"
            >
              Estudiantes
            </th>
            <th
              rowSpan={2}
              className="w-16 border border-border bg-sky-100 px-1 py-2 text-center text-xs font-bold dark:bg-sky-950"
            >
              PROM
            </th>
            <th
              rowSpan={2}
              className="w-16 border border-border bg-emerald-100 px-1 py-2 text-center text-xs font-bold dark:bg-emerald-950"
            >
              DEF
            </th>
            {concepts.map((c) => {
              const acts = activities.filter((a) => a.conceptId === c.id);
              const color = colorFor(c.order);
              return (
                <th
                  key={c.id}
                  colSpan={Math.max(acts.length, 1)}
                  className={cn("border border-border px-2 py-1.5 text-center text-xs font-bold", color.header)}
                >
                  {c.name} [{c.percentage}%]
                </th>
              );
            })}
          </tr>
          {/* Fila 2: sub-columnas N1, N2, N3... */}
          <tr>
            {concepts.map((c) => {
              const acts = activities.filter((a) => a.conceptId === c.id);
              const color = colorFor(c.order);
              if (acts.length === 0) {
                return (
                  <th key={c.id} className={cn("border border-border px-1 py-1 text-center text-[11px] text-muted-foreground", color.col)}>
                    —
                  </th>
                );
              }
              return acts.map((a) => (
                <th
                  key={a.id}
                  title={a.isGeneral ? "Actividad general (aplica a todo el grupo)" : a.name}
                  className={cn("border border-border px-1 py-1 text-center text-[11px] font-semibold", color.col)}
                >
                  {a.name}
                  {a.isGeneral ? " ★" : ""}
                </th>
              ));
            })}
          </tr>
        </thead>
        <tbody>
          {students.map((s, ri) => {
            const calc = calcByStudent.get(s.studentId);
            return (
              <tr key={s.studentId} className="hover:bg-muted/40">
                <td className="sticky left-0 z-10 border border-border bg-card px-3 py-1 text-xs font-medium">
                  {s.fullName}
                </td>
                <td
                  className={cn(
                    "border border-border px-1 text-center text-xs font-bold",
                    calc?.prom !== null && calc?.prom !== undefined && calc.prom < APPROVAL_THRESHOLD
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-sky-50 dark:bg-sky-950"
                  )}
                >
                  {fmt(calc?.prom ?? null)}
                </td>
                <td
                  className={cn(
                    "border border-border px-1 text-center text-xs font-bold",
                    calc?.def !== null && calc?.def !== undefined && calc.def < APPROVAL_THRESHOLD
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-emerald-50 dark:bg-emerald-950"
                  )}
                >
                  {fmt(calc?.def ?? null)}
                </td>
                {activities.map((a, ci) => {
                  const pos = { row: ri, col: ci };
                  const isActive = grid.active?.row === ri && grid.active?.col === ci;
                  const raw = values[`${s.studentId}::${a.id}`] ?? "";
                  const val = parseNote(raw);
                  const color = conceptById.get(a.conceptId)?.color;
                  return (
                    <td
                      key={a.id}
                      className={cn(
                        "relative border border-border p-0",
                        val === null
                          ? color?.col
                          : val < APPROVAL_THRESHOLD
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-emerald-100/80 dark:bg-emerald-950/60",
                        inRange(pos) && "bg-blue-100 dark:bg-blue-950"
                      )}
                      onMouseEnter={() => grid.overDrag(pos)}
                      onMouseUp={() => {
                        if (grid.isDragging) grid.endDrag(pos);
                      }}
                    >
                      <input
                        value={raw}
                        disabled={periodClosed}
                        inputMode="decimal"
                        className="h-8 w-14 bg-transparent text-center text-xs outline-none focus:bg-white/70 disabled:cursor-not-allowed"
                        onFocus={() => grid.setActive(pos)}
                        onKeyDown={grid.handleKeyDown}
                        onChange={(e) => onCellChange(s.studentId, a.id, e.target.value)}
                      />
                      {isActive && (
                        <div
                          role="separator"
                          aria-label="Controlador de autocompletar"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            grid.beginDrag(pos);
                          }}
                          className="absolute bottom-0 right-0 h-2 w-2 cursor-crosshair bg-blue-600"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
