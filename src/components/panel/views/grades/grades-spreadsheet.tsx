"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
//  - Fila 1 (nested headers): concepto + [X%] + botón "+" [F1] — SIEMPRE visible,
//    tenga o no actividades (UX: cada actividad queda debajo de su concepto).
//  - Fila 2 (headers): sub-columnas N1, N2… + botones lápiz/− [F2]; los conceptos
//    sin actividades muestran una columna "—" de marcador ( readOnly).
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
  /** [UX] título visual en la columna; null → usar name */
  label?: string | null;
  conceptId: string;
  isGeneral: boolean;
}

// Paleta determinística por orden de concepto (equivalente a la tabla original)
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
const COLOR_HEADER_MUTED = "#efece4"; // bloque Estudiantes/PROM/DEF

function colorFor(order: number) {
  const i = ((order % CONCEPT_COLORS.length) + CONCEPT_COLORS.length) % CONCEPT_COLORS.length;
  return CONCEPT_COLORS[i];
}

// [theme-options] Resuelve las vars CSS del tema por nombre de concepto.
// Orden de match importa: "autoevaluación" antes que otros; "ser" al final
// (startsWith no colisiona con "saber"). Fallbacks = paleta actual.
const CONCEPT_VAR_MATCHERS: [RegExp, string, string][] = [
  [/autoevaluac/, "autoevaluacion", "#10b981"],
  [/saber/, "saber", "#8b5cf6"],
  [/hacer/, "hacer", "#0ea5e9"],
  [/^ser/, "ser", "#f97316"],
];

function conceptThemeStyle(name: string): { bg: string; text: string } | null {
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [re, key, fb] of CONCEPT_VAR_MATCHERS) {
    if (re.test(n)) {
      return {
        bg: `var(--grades-concept-${key}-bg, ${fb})`,
        text: `var(--grades-concept-${key}-text, #ffffff)`,
      };
    }
  }
  return null;
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

// Columna de la grilla: actividad real o marcador "—" de un concepto vacío
type GridCol =
  | { kind: "activity"; activity: SheetActivity }
  | { kind: "placeholder"; conceptId: string };

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

type Props = GradesSpreadsheetProps;

type WorksheetInstance = import("jspreadsheet-ce").WorksheetInstance;
type JspreadsheetInstanceElement = import("jspreadsheet-ce").JspreadsheetInstanceElement;

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

  // [theme-options] Valores del tema leídos de las CSS vars inyectadas
  // (ThemeOptionsVars en el layout raíz). Defaults = comportamiento actual.
  const [gradesTheme, setGradesTheme] = useState({
    conditional: true,
    threshold: APPROVAL_THRESHOLD,
    minColWidth: 180,
  });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const num = (name: string, fb: number) => {
      const raw = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(raw) ? raw : fb;
    };
    const condRaw = cs.getPropertyValue("--grades-conditional").trim();
    setGradesTheme({
      conditional: condRaw === "" ? true : condRaw !== "0",
      threshold: num("--grades-low-threshold", APPROVAL_THRESHOLD),
      minColWidth: num("--grades-min-col-width", 180),
    });
  }, []);

  // Modelo de columnas: por cada concepto, sus actividades en orden; si no
  // tiene ninguna, una columna marcador "—" (mantiene el concepto visible en
  // el header con su botón "+" — UX según captura del usuario).
  const gridCols = useMemo<GridCol[]>(() => {
    const cols: GridCol[] = [];
    for (const c of concepts) {
      const acts = activities.filter((a) => a.conceptId === c.id);
      for (const a of acts) cols.push({ kind: "activity", activity: a });
      if (acts.length === 0) cols.push({ kind: "placeholder", conceptId: c.id });
    }
    return cols;
  }, [concepts, activities]);
  const colsRef = useRef<GridCol[]>(gridCols);
  colsRef.current = gridCols;

  // [C2] Ancho uniforme por bloque de concepto: cada bloque mide máx(180px, n×64px)
  // y sus sub-columnas se reparten ese ancho por igual → nombre + [%] + "+" caben
  // siempre, independientemente del nº de actividades del concepto.
  // [theme-options] el mínimo configurable vive en --grades-min-col-width.
  const ACTIVITY_COL_WIDTH = 64;
  const CONCEPT_MIN_WIDTH = gradesTheme.minColWidth;
  const colWidths = useMemo(() => {
    const counts = new Map<string, number>();
    for (const col of gridCols) {
      const cid = col.kind === "activity" ? col.activity.conceptId : col.conceptId;
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    return gridCols.map((col) => {
      const cid = col.kind === "activity" ? col.activity.conceptId : col.conceptId;
      const n = counts.get(cid) ?? 1;
      return Math.ceil(Math.max(CONCEPT_MIN_WIDTH, n * ACTIVITY_COL_WIDTH) / n);
    });
  }, [gridCols, CONCEPT_MIN_WIDTH]);
  const colWidthsRef = useRef<number[]>(colWidths);
  colWidthsRef.current = colWidths;

  // [theme-options-movil] Columnas inmovilizadas seleccionables (Estudiantes=1,
  // +PROM=2, +DEF=3; 0 = ninguna). Default 1 = comportamiento actual.
  const [freezeCount, setFreezeCount] = useState(1);

  // Estructura de la hoja (cambia solo con datos estructurales, no con cada tecla)
  const structureKey = useMemo(
    () =>
      JSON.stringify({
        s: students.map((s) => s.studentId),
        a: activities.map((a) => `${a.id}::${a.conceptId}::${a.name}::${a.isGeneral}`),
        c: concepts.map((c) => `${c.id}::${c.name}::${c.percentage}::${c.order}`),
        pc: periodClosed,
        // [theme-options] reconstruir solo si algún valor del tema cambia
        gt: [gradesTheme.conditional ? 1 : 0, gradesTheme.threshold, gradesTheme.minColWidth],
        fc: freezeCount,
      }),
    [students, activities, concepts, periodClosed, gradesTheme, freezeCount]
  );

  // Estilo de una celda de nota según su valor (paridad con la tabla original)
  // [theme-options] colores condicionales y fuente configurables vía CSS vars.
  function activityCellStyle(raw: string, conceptOrder: number): string {
    const v = parseNote(raw);
    if (v === null) return `background-color: ${colorFor(conceptOrder).tint};`;
    if (!gradesTheme.conditional) return `font-size: var(--grades-cell-font-size, 13px);`;
    if (v < gradesTheme.threshold)
      return `background-color: var(--grades-low-color, ${COLOR_RED_BG}); color: ${COLOR_RED_FG}; font-size: var(--grades-cell-font-size, 13px);`;
    return `background-color: var(--grades-high-color, ${COLOR_GREEN_BG}); font-size: var(--grades-cell-font-size, 13px);`;
  }

  function conceptOrderOf(conceptId: string): number {
    return propsRef.current.concepts.find((c) => c.id === conceptId)?.order ?? 0;
  }

  // (Re)construcción del spreadsheet
  useEffect(() => {
    const el = containerRef.current;
    if (!el || students.length === 0) return;

    const cols = gridCols;
    const calcByStudent = new Map(calculations.map((c) => [c.studentId, c]));
    const data: string[][] = students.map((s) => [
      s.fullName,
      fmt(calcByStudent.get(s.studentId)?.prom ?? null),
      fmt(calcByStudent.get(s.studentId)?.def ?? null),
      ...cols.map((col) =>
        col.kind === "activity" ? values[`${s.studentId}::${col.activity.id}`] ?? "" : ""
      ),
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
      // [theme-options] fuente, alineación y color configurables de la columna estudiante
      style[`${colName(0)}${r + 1}`] =
        `font-size: var(--grades-student-font-size, 13px); text-align: var(--grades-student-align, left); color: var(--grades-student-color, inherit);`;
      style[`${colName(1)}${r + 1}`] =
        calc && calc.prom !== null && gradesTheme.conditional && calc.prom < gradesTheme.threshold
          ? `background-color: var(--grades-low-color, ${COLOR_RED_BG}); color: ${COLOR_RED_FG}; font-weight: bold; font-size: var(--grades-cell-font-size, 13px);`
          : `background-color: var(--grades-prom-bg, ${COLOR_SKY_BG}); font-weight: bold; font-size: var(--grades-cell-font-size, 13px);`;
      style[`${colName(2)}${r + 1}`] =
        calc && calc.def !== null && gradesTheme.conditional && calc.def < gradesTheme.threshold
          ? `background-color: var(--grades-low-color, ${COLOR_RED_BG}); color: ${COLOR_RED_FG}; font-weight: bold; font-size: var(--grades-cell-font-size, 13px);`
          : `background-color: var(--grades-def-bg, #ecfdf5); font-weight: bold; font-size: var(--grades-cell-font-size, 13px);`;
      for (let ci = 0; ci < cols.length; ci++) {
        const col = cols[ci];
        if (col.kind === "placeholder") {
          const order = conceptOrderOf(col.conceptId);
          style[`${colName(ci + 3)}${r + 1}`] = `background-color: ${colorFor(order).tint};`;
        } else {
          const order = conceptOrderOf(col.activity.conceptId);
          const raw = values[`${students[r].studentId}::${col.activity.id}`] ?? "";
          style[`${colName(ci + 3)}${r + 1}`] = activityCellStyle(raw, order);
        }
      }
    }

    // Fila 1 (conceptos): se construye por DOM tras crear la hoja — ver abajo.
    // (No se usa nestedHeaders del CE: sus anchos no quedan alineados a las
    // columnas reales cuando hay columnas marcador "—".)

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
        const col = colsRef.current[c - 3];
        if (!col || col.kind !== "activity") return; // columna marcador
        const p = propsRef.current;
        const s = p.students[r];
        if (!s) return;
        const a = col.activity;
        const raw = String(newValue ?? "");
        const key = `${s.studentId}::${a.id}`;
        // [C4] Durante un drag-fill, sustituir la serie de CE por el valor de la
        // fila origen (Excel-copiar) antes de cualquier validación/aviso.
        if (fillSession) {
          const { src } = fillSession;
          let srcRow: number | null = null;
          if (r > src.y2) srcRow = src.y1;
          else if (r < src.y1) srcRow = src.y2;
          if (srcRow !== null && c >= src.x1 && c <= src.x2) {
            const srcVal = instance.getValueFromCoords(c, srcRow);
            const srcRaw = String(srcVal ?? "");
            if (srcRaw !== raw) {
              instance.setValueFromCoords(c, r, srcVal, true);
              echoRef.current.add(key);
              p.onCellChange(s.studentId, a.id, srcRaw);
              cell.style.cssText = activityCellStyle(srcRaw, conceptOrderOf(a.conceptId));
              return;
            }
          }
        }
        if (!isValidNote(raw)) {
          // Revertir al valor previo y avisar (paridad con la tabla original)
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
              style,
              tableOverflow: true,
              // [C3] sin tableHeight → .jss_content sin maxHeight/overflow-y:
              // la grilla crece hasta el último estudiante y el scroll vertical
              // es el de la página (el interno queda solo para horizontal).
              tableWidth: "100%",
          freezeColumns: freezeCount,
          editable: !periodClosed,
          columnResize: false,
          columnDrag: false,
          columnSorting: false,
          search: false,
          pagination: 0,
          // Columnas: Estudiante · PROM · DEF · actividades / marcadores "—"
          // [C2] ancho por columna según bloque de concepto (uniforme)
          columns: [
            { title: "Estudiantes", width: 220, readOnly: true },
            { title: "PROM", width: 52, readOnly: true },
            { title: "DEF", width: 52, readOnly: true },
            ...cols.map((col, ci) =>
              col.kind === "activity"
                ? {
                    title: col.activity.isGeneral
                      ? `${col.activity.label ?? col.activity.name} ★`
                      : col.activity.label ?? col.activity.name,
                    width: colWidths[ci] ?? ACTIVITY_COL_WIDTH,
                    readOnly: false,
                  }
                : { title: "—", width: colWidths[ci] ?? 150, readOnly: true }
            ),
          ],
        },
      ],
    }) as WorksheetInstance[];

    wsRef.current = worksheets[0] ?? null;

    // === [C4] Drag-fill = copiar valor (no incrementar) ===
    // CE v5 no expone evento para el fill del handle (jss_corner) y su fill
    // numérico genera serie (1,2,3…). Al pulsar el handle se arma una sesión
    // de fill con la selección origen; mientras está activa, cada escritura de
    // CE pasa por onchange y se sustituye por el valor de la fila/columna
    // origen (Excel-copiar), siguiendo el flujo normal de validación y
    // persistencia. La sesión se cierra en el mouseup posterior al fill.
    type FillRect = { x1: number; y1: number; x2: number; y2: number };
    type WorksheetWithInternals = WorksheetInstance & {
      jssWorksheet?: WorksheetInstance;
      highlighted?: Element[];
    };
    let fillSession: { src: FillRect } | null = null;
    const fillDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t?.classList?.contains("jss_corner")) return;
      if (propsRef.current.periodClosed) return;
      const holder = t.closest(".jss_container") as (HTMLElement & WorksheetWithInternals) | null;
      const inst = holder?.jssWorksheet ?? (wsRef.current as WorksheetWithInternals | null);
      if (!inst) return;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const node of inst.highlighted ?? []) {
        // CE v5: highlighted[i] = { element: td } (wrapper, no el td directo)
        const cellEl = ((node as unknown as { element?: Element }).element ?? node) as Element;
        const x = Number(cellEl.getAttribute?.("data-x"));
        const y = Number(cellEl.getAttribute?.("data-y"));
        if (Number.isFinite(x) && Number.isFinite(y)) {
          xs.push(x);
          ys.push(y);
        }
      }
      if (!xs.length) return;
      fillSession = {
        src: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) },
      };
    };
    let fillSessionClose: ReturnType<typeof setTimeout> | null = null;
    const fillUpEnd = () => {
      // El fill de CE escribe sus celdas DESPUÉS del mouseup (asíncrono):
      // cerrar la sesión con un pequeño debounce para cubrir esos onchange.
      if (fillSessionClose) clearTimeout(fillSessionClose);
      fillSessionClose = setTimeout(() => {
        fillSession = null;
      }, 200);
    };
    el.addEventListener("mousedown", fillDown);
    document.addEventListener("mouseup", fillUpEnd);

    // === Inyección de botones y estilos en los headers (vanilla DOM) ===
    const ws = wsRef.current;
    if (ws) {
      // Fila 2 (headers estándar): lápiz/− por actividad; "—" tenue en marcadores
      cols.forEach((col, i) => {
        const th = ws.headers?.[i + 3];
        if (!th) return;
        th.style.whiteSpace = "nowrap";
        if (col.kind === "placeholder") {
          const order = conceptOrderOf(col.conceptId);
          th.style.background = colorFor(order).tint;
          th.style.color = "#9ca3af";
          th.style.fontWeight = "600";
          return;
        }
        const a = col.activity;
        th.title = a.name; // tooltip: nombre completo de la actividad
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

      // Fila 1 (conceptos): fila propia insertada en el thead, con colspans
      // que suman los anchos reales de las columnas → alineación garantizada.
      // Bloque de color + botón "+" por concepto [F1], siempre visible.
      if (props.onAddActivityForConcept && concepts.length > 0) {
        const thead = el.querySelector("thead");
        const stdRow = ws.headers?.[0]?.parentElement;
        if (thead && stdRow) {
          const tr = document.createElement("tr");
          // [theme-options] alto configurable del header de conceptos
          tr.style.height = "var(--grades-header-height, 40px)";
          // Grupo fijo: columna de numeración + Estudiantes + PROM + DEF (4 columnas)
          const tdGroup = document.createElement("td");
          tdGroup.colSpan = 4;
          // [theme-options-movil] fijar el grupo izquierdo si hay columnas inmovilizadas
          if (freezeCount > 0) {
            tdGroup.style.position = "sticky";
            tdGroup.style.left = "0px";
            tdGroup.style.zIndex = "4";
          }
          Object.assign(tdGroup.style, {
            background: COLOR_HEADER_MUTED,
            color: "#374151",
            fontWeight: "700",
            fontSize: "var(--grades-header-font-size, 11px)",
            textAlign: "left",
            paddingLeft: "8px",
          } satisfies Partial<CSSStyleDeclaration>);
          tdGroup.textContent = "Estudiantes";
          tr.appendChild(tdGroup);
          // Un bloque por concepto evaluativo.
          // [C2] ancho uniforme: suma de los anchos reales de sus sub-columnas
          // (bloque ≥ 180px); nombre con ellipsis, [%] y "+" siempre visibles.
          const widths = colWidthsRef.current;
          for (const c of concepts) {
            const idxs: number[] = [];
            cols.forEach((col, i) => {
              if ((col.kind === "activity" ? col.activity.conceptId : col.conceptId) === c.id) idxs.push(i);
            });
            if (idxs.length === 0) continue;
            const td = document.createElement("td");
            td.colSpan = idxs.length;
            // Refuerzo de layout: ancho = suma de las columnas que abarca
            const widthSum = idxs.reduce((n, i) => n + (widths[i] ?? 0), 0);
            if (widthSum > 0) td.style.width = `${widthSum}px`;
            const themed = conceptThemeStyle(c.name);
            const { header } = colorFor(c.order);
            Object.assign(td.style, {
              background: themed ? themed.bg : header,
              color: themed ? themed.text : "#ffffff",
              fontWeight: "700",
              fontSize: "var(--grades-header-font-size, 11px)",
              textAlign: "center",
              paddingLeft: "4px",
              paddingRight: "2px",
            } satisfies Partial<CSSStyleDeclaration>);
            td.title = `${c.name} [${c.percentage}%]`;
            // Wrapper flex interno: nombre elástico (ellipsis) + [%] + "+" inflexibles
            const wrap = document.createElement("div");
            Object.assign(wrap.style, {
              display: "flex",
              alignItems: "center",
              gap: "3px",
              width: "100%",
              minWidth: "0",
            } satisfies Partial<CSSStyleDeclaration>);
            const nameSpan = document.createElement("span");
            Object.assign(nameSpan.style, {
              flex: "1 1 0",
              minWidth: "0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
            } satisfies Partial<CSSStyleDeclaration>);
            nameSpan.textContent = c.name;
            const pctSpan = document.createElement("span");
            pctSpan.style.flexShrink = "0";
            pctSpan.textContent = `[${c.percentage}%]`;
            const plus = makeHeaderButton({
              html: SVG_PLUS,
              title: `Agregar actividad al concepto ${c.name}`,
              disabled: periodClosed,
              onClick: () => propsRef.current.onAddActivityForConcept?.(c.id),
            });
            plus.style.flexShrink = "0";
            wrap.appendChild(nameSpan);
            wrap.appendChild(pctSpan);
            wrap.appendChild(plus);
            td.appendChild(wrap);
            tr.appendChild(td);
          }
          thead.insertBefore(tr, stdRow);
        }
      }
    }

    return () => {
      el.removeEventListener("mousedown", fillDown);
      document.removeEventListener("mouseup", fillUpEnd);
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

  // Sincronizar values externos (recargas de planilla) sin reconstruir la hoja
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    for (let r = 0; r < students.length; r++) {
      const s = students[r];
      for (let ci = 0; ci < gridCols.length; ci++) {
        const col = gridCols[ci];
        if (col.kind !== "activity") continue;
        const a = col.activity;
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
          calc.prom !== null && gradesTheme.conditional && calc.prom < gradesTheme.threshold
            ? `background-color: var(--grades-low-color, ${COLOR_RED_BG}); color: ${COLOR_RED_FG}; font-weight: bold;`
            : `background-color: var(--grades-prom-bg, ${COLOR_SKY_BG}); font-weight: bold;`;
      const defCell = ws.getCell(2, r);
      if (defCell)
        defCell.style.cssText =
          calc.def !== null && gradesTheme.conditional && calc.def < gradesTheme.threshold
            ? `background-color: var(--grades-low-color, ${COLOR_RED_BG}); color: ${COLOR_RED_FG}; font-weight: bold;`
            : `background-color: var(--grades-def-bg, #ecfdf5); font-weight: bold;`;
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

  // [C3] sin overflow-hidden ni altura fija: crece con el nº de estudiantes
  // [theme-options-movil] chips de inmovilización (solo móvil, md:hidden):
  // semántica de freeze-panes — seleccionar PROM inmoviliza también Estudiantes.
  const FREEZE_CHIPS: { label: string; value: number }[] = [
    { label: "Estudiantes", value: 1 },
    { label: "PROM", value: 2 },
    { label: "DEF", value: 3 },
  ];
  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex md:hidden items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Inmovilizar:</span>
        {FREEZE_CHIPS.map((chip) => {
          const active = freezeCount >= chip.value;
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={active}
              onClick={() => setFreezeCount(active ? chip.value - 1 : chip.value)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <div ref={containerRef} className="jss-planilla flex-1 rounded-xl border bg-card" />
    </div>
  );
}
