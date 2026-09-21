"use client";

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import jspreadsheet from "jspreadsheet-ce";
import "jspreadsheet-ce/dist/jspreadsheet.css";
import {
  type StudentRow,
  type CalculatedRow,
  parseNote,
  isValidNote,
  APPROVAL_THRESHOLD,
} from "./use-grades-calculations";

// === [F4] Módulo Calificaciones: planilla sobre Jspreadsheet CE (MIT) ===
// Integración vanilla (sin wrapper) para React 19 / Next 16:
//  - Fila 1 (nested headers): concepto + [X%] + botón "+" [F1]
//  - Fila 2 (headers): sub-columnas N1, N2… + botones lápiz/− [F2]
//  - Columnas: Estudiante (ro) · PROM (ro) · DEF (ro) · actividades (editables)
//  - Excel-like nativo: selección, flechas, Ctrl+C/V multi-celda y drag-fill.
// El spreadsheet usa paleta clara propia (área de hoja siempre clara).

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

// Paleta determinística por orden de concepto (equivalente a la tabla anterior)
const CONCEPT_COLORS = [
  { header: "#10b981", tint: "#ecfdf5" }, // emerald
  { header: "#f97316", tint: "#fff7ed" }, // orange
  { header: "#8b5cf6", tint: "#f5f3ff" }, // violet
  { header: "#0ea5e9", tint: "#f0f9ff" }, // sky
];
const COLOR_RED_BG = "#fee2e2";
const COLOR_RED_FG = "#b91c1c";
const COLOR_GREEN_BG = "#d1fae5";
const COLOR_SKY_BG = "#e0f2fe";

function colorFor(order: number) {
  const i = ((order % CONCEPT_COLORS.length) + CONCEPT_COLORS.length) % CONCEPT_COLORS.length;
  return CONCEPT_COLORS[i];
}

function fmt(v: number | null): string {
  return v === null ? "" : v.toFixed(1);
}

const SVG_ATTRS = 'width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SVG_PLUS = `<svg ${SVG_ATTRS}><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
const SVG_PENCIL = `<svg ${SVG_ATTRS}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
const SVG_MINUS = `<svg ${SVG_ATTRS}><path d="M5 12h14"/></svg>`;

function makeHeaderButton(opts: {
  html: string;
  title: string;
  color?: string;
  disabled: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.title = opts.title;
  b.setAttribute("aria-label", opts.title);
  b.innerHTML = opts.html;
  b.disabled = opts.disabled;
  Object.assign(b.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    marginLeft: "4px",
    padding: "0",
    borderRadius: "9999px",
    border: "none",
    cursor: opts.disabled ? "not-allowed" : "pointer",
    background: opts.color ?? "rgba(255,255,255,0.3)",
    color: "inherit",
    opacity: opts.disabled ? "0.4" : "1",
    verticalAlign: "middle",
  } satisfies Partial<CSSStyleDeclaration>);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!opts.disabled) opts.onClick();
  });
  return b;
}

export interface GradesSpreadsheetProps {
  students: StudentRow[];
  concepts: SheetConcept[];
  activities: SheetActivity[];
  values: Record<string, string>; // `${studentId}::${activityId}`
  calculations: CalculatedRow[];
  periodClosed: boolean;
  onCellChange: (studentId: string, activityId: string, raw: string) => void;
  /** [F1] botón "+" del header del concepto */
  onAddActivityForConcept?: (conceptId: string) => void;
  /** [F2] lápiz por actividad */
  onEditActivity?: (activity: SheetActivity) => void;
  /** [F2] "−" por actividad */
  onDeleteActivity?: (activity: SheetActivity) => void;
}

type WorksheetInstance = import("jspreadsheet-ce").WorksheetInstance;
type JspreadsheetInstanceElement = import("jspreadsheet-ce").JspreadsheetInstanceElement;

type Props = GradesSpreadsheetProps;

export function GradesSpreadsheet(props: Props) {
  const { students, concepts, activities, values, calculations, periodClosed } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WorksheetInstance | null>(null);
  // Última instantánea de props para los callbacks DOM (botones del header)
  const propsRef = useRef<Props>(props);
  propsRef.current = props;
  // Claves emitidas por el propio grid (evita eco en el sync de values)
  const echoRef = useRef<Set<string>>(new Set());

  const conceptById = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const conceptsWithActs = useMemo(
    () => concepts.map((c) => ({ c, acts: activities.filter((a) => a.conceptId === c.id) })),
    [concepts, activities]
  );
  const emptyConcepts = useMemo(
    () => conceptsWithActs.filter((x) => x.acts.length === 0).map((x) => x.c),
    [conceptsWithActs]
  );

  // Estructura de la hoja (cambia solo con datos estructurales, no con cada tecla)
  const structureKey = useMemo(
    () =>
      JSON.stringify({
        s: students.map((s) => s.studentId),
        a: activities.map((a) => `${a.id}::${a.conceptId}::${a.name}::${a.isGeneral}`),
        c: concepts.map((c) => `${c.id}::${c.name}::${c.percentage}::${c.order}`),
        pc: periodClosed,
      }),
    [students, activities, concepts, periodClosed]
  );

  // Estilo de una celda de nota según su valor (paridad con la tabla anterior)
  function activityCellStyle(raw: string, conceptOrder: number): string {
    const v = parseNote(raw);
    if (v === null) return `background-color: ${colorFor(conceptOrder).tint};`;
    if (v < APPROVAL_THRESHOLD) return `background-color: ${COLOR_RED_BG}; color: ${COLOR_RED_FG};`;
    return `background-color: ${COLOR_GREEN_BG};`;
  }

  // (Re)construcción del spreadsheet
  useEffect(() => {
    const el = containerRef.current;
    if (!el || students.length === 0) return;

    const calcByStudent = new Map(calculations.map((c) => [c.studentId, c]));
    const data: string[][] = students.map((s) => [
      s.fullName,
      fmt(calcByStudent.get(s.studentId)?.prom ?? null),
      fmt(calcByStudent.get(s.studentId)?.def ?? null),
      ...activities.map((a) => values[`${s.studentId}::${a.id}`] ?? ""),
    ]);

    // Estilos iniciales celda por celda (clave "D2" = col 3, fila 1)
    const style: Record<string, string> = {};
    const colName = (i: number) => {
      let s = "";
      let n = i;
      do {
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
      } while (n >= 0);
      return s;
    };
    for (let r = 0; r < students.length; r++) {
      const calc = calcByStudent.get(students[r].studentId);
      style[`${colName(1)}${r + 1}`] =
        calc && calc.prom !== null && calc.prom < APPROVAL_THRESHOLD
          ? `background-color: ${COLOR_RED_BG}; color: ${COLOR_RED_FG}; font-weight: bold;`
          : `background-color: ${COLOR_SKY_BG}; font-weight: bold;`;
      style[`${colName(2)}${r + 1}`] =
        calc && calc.def !== null && calc.def < APPROVAL_THRESHOLD
          ? `background-color: ${COLOR_RED_BG}; color: ${COLOR_RED_FG}; font-weight: bold;`
          : `background-color: #ecfdf5; font-weight: bold;`;
      for (let ci = 0; ci < activities.length; ci++) {
        const a = activities[ci];
        const raw = values[`${students[r].studentId}::${a.id}`] ?? "";
        const order = conceptById.get(a.conceptId)?.order ?? 0;
        style[`${colName(ci + 3)}${r + 1}`] = activityCellStyle(raw, order);
      }
    }

    // Fila 1: grupos de conceptos con colspan real (solo conceptos con actividades)
    const nested =
      conceptsWithActs.filter((x) => x.acts.length > 0).length > 0
        ? [
            conceptsWithActs
              .filter((x) => x.acts.length > 0)
              .map((x) => ({
                title: `${x.c.name} [${x.c.percentage}%]`,
                colspan: x.acts.length,
                align: "center",
              })),
          ]
        : undefined;

    // v5: la fábrica retorna WorksheetInstance[] directamente
    const worksheets = jspreadsheet(el, {
      // Sin menú contextual (insertar/borrar filas rompería el mapeo)
      contextMenu: () => null,
      // Bloquear cambios estructurales que romperían el mapeo filas/columnas
      onbeforeinsertrow: () => false,
      onbeforedeleterow: () => false,
      onbeforeinsertcolumn: () => false,
      onbeforedeletecolumn: () => false,
      // Validación + edición: notas 0.0 - 5.0 (coma decimal permitida)
      onchange: (instance, cell, colIndex, rowIndex, newValue) => {
        const c = Number(colIndex);
        const r = Number(rowIndex);
        if (c < 3) return; // Estudiante/PROM/DEF no emiten cambios
        const p = propsRef.current;
        const s = p.students[r];
        const a = p.activities[c - 3];
        if (!s || !a) return;
        const raw = String(newValue ?? "");
        const key = `${s.studentId}::${a.id}`;
        if (!isValidNote(raw)) {
          // Revertir al valor previo y avisar (paridad con la tabla anterior)
          toast.error("Nota fuera de rango: debe estar entre 0.0 y 5.0");
          const prev = p.values[key] ?? "";
          instance.setValueFromCoords(c, r, prev, true);
          cell.style.cssText = activityCellStyle(prev, conceptOrderOf(a.conceptId));
          return;
        }
        echoRef.current.add(key);
        p.onCellChange(s.studentId, a.id, raw);
        cell.style.cssText = activityCellStyle(raw, conceptOrderOf(a.conceptId));
      },
      worksheets: [
        {
          data,
          nestedHeaders: nested,
          style,
          tableOverflow: true,
          tableHeight: Math.max(el.clientHeight, 240),
          tableWidth: "100%",
          freezeColumns: 1,
          editable: !periodClosed,
          columnResize: true,
          columnDrag: false,
          columnSorting: false,
          search: false,
          pagination: 0,
          // Columnas: Estudiante · PROM · DEF · actividades
          columns: [
            { title: "Estudiantes", width: 220, readOnly: true },
            { title: "PROM", width: 52, readOnly: true },
            { title: "DEF", width: 52, readOnly: true },
            ...activities.map((a) => ({
              title: a.isGeneral ? `${a.name} ★` : a.name,
              width: 64,
              readOnly: false,
            })),
          ],
        },
      ],
    }) as WorksheetInstance[];

    wsRef.current = worksheets[0] ?? null;

    // === Inyección de botones en los headers (vanilla DOM) ===
    // Fila 2 (headers estándar): lápiz [F2] y "−" [F2] por actividad
    const ws = wsRef.current;
    if (ws) {
      activities.forEach((a, i) => {
        const th = ws.headers?.[i + 3];
        if (!th) return;
        th.style.whiteSpace = "nowrap";
        if (props.onEditActivity) {
          th.appendChild(
            makeHeaderButton({
              html: SVG_PENCIL,
              title: "Editar actividad",
              disabled: periodClosed,
              onClick: () => propsRef.current.onEditActivity?.(a),
            })
          );
        }
        if (props.onDeleteActivity) {
          const del = makeHeaderButton({
            html: SVG_MINUS,
            title: "Eliminar actividad",
            disabled: periodClosed,
            onClick: () => propsRef.current.onDeleteActivity?.(a),
          });
          del.addEventListener("mouseenter", () => {
            del.style.background = "#fee2e2";
            del.style.color = "#b91c1c";
          });
          del.addEventListener("mouseleave", () => {
            del.style.background = "rgba(0,0,0,0.06)";
            del.style.color = "inherit";
          });
          del.style.background = "rgba(0,0,0,0.06)";
          th.appendChild(del);
        }
      });

      // Fila 1 (nested headers): botón "+" por concepto [F1]
      if (props.onAddActivityForConcept) {
        const theadRows = el.querySelectorAll("thead tr");
        const nestedRow = theadRows[0];
        if (nestedRow) {
          const tds = Array.from(nestedRow.querySelectorAll<HTMLElement>("td, th"));
          // tds[0] = grupo Estudiante/PROM/DEF (colspan 3); luego un td por concepto
          const withActs = conceptsWithActs.filter((x) => x.acts.length > 0);
          withActs.forEach((x, i) => {
            const td = tds[i + 1];
            if (!td) return;
            const { header } = colorFor(x.c.order);
            td.style.background = header;
            td.style.color = "#ffffff";
            td.style.fontWeight = "700";
            td.style.fontSize = "11px";
            td.style.textAlign = "center";
            td.style.whiteSpace = "nowrap";
            td.appendChild(
              makeHeaderButton({
                html: SVG_PLUS,
                title: `Agregar actividad al concepto ${x.c.name}`,
                disabled: periodClosed,
                onClick: () => propsRef.current.onAddActivityForConcept?.(x.c.id),
              })
            );
          });
          // Celdas del encabezado estándar bajo el grupo fijo (Estudiantes/PROM/DEF)
        }
      }
    }

    return () => {
      try {
        jspreadsheet.destroy(el as JspreadsheetInstanceElement);
      } catch {
        /* el contenedor puede haberse desmontado ya */
      }
      wsRef.current = null;
      el.innerHTML = "";
      echoRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  function conceptOrderOf(conceptId: string): number {
    return propsRef.current.concepts.find((c) => c.id === conceptId)?.order ?? 0;
  }

  // Sincronizar values externos (recargas de planilla) sin reconstruir la hoja
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    for (let r = 0; r < students.length; r++) {
      const s = students[r];
      for (let ci = 0; ci < activities.length; ci++) {
        const a = activities[ci];
        const key = `${s.studentId}::${a.id}`;
        if (echoRef.current.has(key)) {
          echoRef.current.delete(key); // ya está en el DOM
          continue;
        }
        const v = values[key] ?? "";
        if (String(ws.getValueFromCoords?.(ci + 3, r) ?? "") !== v) {
          ws.setValueFromCoords(ci + 3, r, v, true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, structureKey]);

  // PROM/DEF recalculados (readOnly, force)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    calculations.forEach((calc, r) => {
      ws.setValueFromCoords(1, r, fmt(calc.prom), true);
      ws.setValueFromCoords(2, r, fmt(calc.def), true);
      const promCell = ws.getCell(1, r);
      if (promCell)
        promCell.style.cssText =
          calc.prom !== null && calc.prom < APPROVAL_THRESHOLD
            ? `background-color: ${COLOR_RED_BG}; color: ${COLOR_RED_FG}; font-weight: bold;`
            : `background-color: ${COLOR_SKY_BG}; font-weight: bold;`;
      const defCell = ws.getCell(2, r);
      if (defCell)
        defCell.style.cssText =
          calc.def !== null && calc.def < APPROVAL_THRESHOLD
            ? `background-color: ${COLOR_RED_BG}; color: ${COLOR_RED_FG}; font-weight: bold;`
            : `background-color: #ecfdf5; font-weight: bold;`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculations, structureKey]);

  if (students.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border bg-card p-8 text-sm text-muted-foreground">
        El grupo seleccionado no tiene estudiantes activos.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
      {/* [F1] Conceptos sin actividades: no generan columnas en la hoja;
          se ofrecen aquí con su botón "+" */}
      {emptyConcepts.length > 0 && props.onAddActivityForConcept && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Conceptos sin actividades:</span>
          {emptyConcepts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
            >
              {c.name} [{c.percentage}%]
              <button
                type="button"
                title={`Agregar actividad al concepto ${c.name}`}
                disabled={periodClosed}
                onClick={() => props.onAddActivityForConcept?.(c.id)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[11px] leading-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </span>
          ))}
        </div>
      )}
      <div ref={containerRef} className="jss-planilla min-h-0 flex-1 overflow-hidden rounded-xl border bg-card" />
    </div>
  );
}
