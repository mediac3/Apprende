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
  /** [C5] secuencia estable dentro del concepto: base de la etiqueta N# */
  order: number;
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

// [C2] Inmovilización de columnas: el control vive en Configuración institucional
// (academico-view) y persiste en localStorage; esta planilla solo lo lee.
const FREEZE_KEY = "apprende:grades:freezeCount";
const FREEZE_EVENT = "apprende:grades:freeze-changed";
function readFreezeCount(): number {
  if (typeof window === "undefined") return 1;
  const v = parseInt(window.localStorage.getItem(FREEZE_KEY) ?? "", 10);
  return Number.isFinite(v) ? Math.min(3, Math.max(0, v)) : 1;
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

// [C5] Etiqueta corta SIEMPRE "N{order}" (★ si es general); el nombre completo
// solo se muestra en el tooltip nativo y en el menú contextual. Nunca se
// reemplaza por la etiqueta/nombre editados.
function shortActivityLabel(a: SheetActivity): string {
  return a.isGeneral ? `N${a.order} ★` : `N${a.order}`;
}

// [C4] Menú contextual de actividad (DOM vanilla: los headers del spreadsheet
// viven fuera del árbol React). Entrada siempre visible: chip "N#" clicable.
let activityMenuEl: HTMLDivElement | null = null;
function closeActivityMenu() {
  if (!activityMenuEl) return;
  activityMenuEl.remove();
  activityMenuEl = null;
  document.removeEventListener("mousedown", onActivityMenuOutside, true);
  window.removeEventListener("scroll", closeActivityMenu, true);
  document.removeEventListener("keydown", onActivityMenuKeydown);
}
function onActivityMenuOutside(e: MouseEvent) {
  if (activityMenuEl && !activityMenuEl.contains(e.target as Node)) closeActivityMenu();
}
function onActivityMenuKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") closeActivityMenu();
}
function openActivityMenu(
  anchor: HTMLElement,
  activity: SheetActivity,
  handlers: Pick<GradesSpreadsheetProps, "onEditActivity" | "onDeleteActivity">
) {
  closeActivityMenu();
  const menu = document.createElement("div");
  Object.assign(menu.style, {
    position: "fixed",
    zIndex: "70",
    minWidth: "150px",
    maxWidth: "240px",
    background: "#ffffff",
    color: "#1f2937",
    border: "1px solid rgba(0,0,0,0.14)",
    borderRadius: "10px",
    boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
    padding: "4px",
    fontSize: "12px",
  } satisfies Partial<CSSStyleDeclaration>);
  const head = document.createElement("div");
  head.textContent = activity.name; // [C5] nombre completo visible también en móvil
  Object.assign(head.style, {
    padding: "6px 8px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    marginBottom: "2px",
  } satisfies Partial<CSSStyleDeclaration>);
  menu.appendChild(head);
  const mkItem = (label: string, danger: boolean, fn?: () => void) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = label;
    Object.assign(item.style, {
      display: "block",
      width: "100%",
      textAlign: "left",
      padding: "7px 10px",
      minHeight: "32px",
      border: "none",
      borderRadius: "6px",
      backgroundColor: "transparent",
      cursor: "pointer",
      font: "inherit",
      color: danger ? "#b91c1c" : "#1f2937",
    } satisfies Partial<CSSStyleDeclaration>);
    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = danger ? "#fee2e2" : "rgba(0,0,0,0.06)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor = "transparent";
    });
    item.addEventListener("click", () => {
      closeActivityMenu();
      fn?.();
    });
    menu.appendChild(item);
  };
  mkItem("Editar actividad", false, () => handlers.onEditActivity?.(activity));
  mkItem("Eliminar actividad", true, () => handlers.onDeleteActivity?.(activity));
  document.body.appendChild(menu);
  activityMenuEl = menu;
  const r = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(4, r.left), window.innerWidth - menu.offsetWidth - 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${r.bottom + 4}px`;
  document.addEventListener("mousedown", onActivityMenuOutside, true);
  window.addEventListener("scroll", closeActivityMenu, true);
  document.addEventListener("keydown", onActivityMenuKeydown);
}

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
    // [C6] hit area táctil 32px con visual de 18px (background-clip content-box)
    width: "32px",
    height: "32px",
    marginLeft: "0px",
    padding: "7px",
    backgroundClip: "content-box",
    borderRadius: "9999px",
    border: "none",
    cursor: opts.disabled ? "not-allowed" : "pointer",
    backgroundColor: opts.color ?? "rgba(255,255,255,0.3)",
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
  /** [comentarios] mapa `studentId::activityId` → texto del comentario */
  comments?: Record<string, string>;
  /** [comentarios] contador que cambia al guardar → reconstruye marcadores */
  commentsVersion?: number;
  /** [comentarios] modo activo: un tap/click en celda abre su comentario */
  commentMode?: boolean;
  /** [comentarios] solicitud de edición de comentario en una celda */
  onCellCommentRequest?: (info: { key: string; studentName: string; activityName: string }) => void;
}

type Props = GradesSpreadsheetProps;

type WorksheetInstance = import("jspreadsheet-ce").WorksheetInstance;
type JspreadsheetInstanceElement = import("jspreadsheet-ce").JspreadsheetInstanceElement;

export function GradesSpreadsheet(props: Props) {
  const { students, concepts, activities, values, calculations, periodClosed, comments, commentMode, commentsVersion } = props;
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
    minColWidth: 108, // [ajuste usuario] 180×0.6: bloques de concepto más compactos
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
      minColWidth: num("--grades-min-col-width", 108), // [ajuste usuario] -40%
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

  // [theme-options-movil] breakpoint móvil para densidad y ancho de tabla
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // [C2] Ancho uniforme por bloque de concepto: cada bloque mide máx(180px, n×64px)
  // y sus sub-columnas se reparten ese ancho por igual → nombre + [%] + "+" caben
  // siempre, independientemente del nº de actividades del concepto.
  // [theme-options] el mínimo configurable vive en --grades-min-col-width.
  // [theme-options-movil] en móvil columnas más angostas → más información visible.
  const STUDENT_COL_WIDTH = isMobile ? 150 : 220;
  // [ajuste usuario] ancho de actividad -40%: 52→31 (móvil) y 64→38 (escritorio)
  const ACTIVITY_COL_WIDTH = isMobile ? 31 : 38;
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
  }, [gridCols, CONCEPT_MIN_WIDTH, ACTIVITY_COL_WIDTH]);
  const colWidthsRef = useRef<number[]>(colWidths);
  colWidthsRef.current = colWidths;

  // [C2] Columnas inmovilizadas (Estudiantes=1, +PROM=2, +DEF=3; 0 = ninguna).
  // Default 1 = comportamiento actual. El control vive en Configuración
  // institucional; aquí solo se lee (evento custom + storage).
  const [freezeCount, setFreezeCount] = useState<number>(readFreezeCount);

  useEffect(() => {
    const apply = () => setFreezeCount(readFreezeCount());
    window.addEventListener(FREEZE_EVENT, apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener(FREEZE_EVENT, apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

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
        mob: isMobile ? 1 : 0,
        // [comentarios] reconstruir cuando cambian marcadores o el modo
        cm: [commentsVersion ?? 0, Object.keys(comments ?? {}).length, commentMode ? 1 : 0],
      }),
    [students, activities, concepts, periodClosed, gradesTheme, freezeCount, isMobile, commentsVersion, comments, commentMode]
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

    // [comentarios] convertir el mapa `studentId::activityId` a nombres de celda
    const commentsInit: Record<string, string> = {};
    if (comments) {
      for (const [key, text] of Object.entries(comments)) {
        const [sid, aid] = key.split("::");
        const r = students.findIndex((s) => s.studentId === sid);
        if (r < 0) continue;
        const ci = gridCols.findIndex((col) => col.kind === "activity" && col.activity.id === aid);
        if (ci < 0) continue;
        commentsInit[`${colName(ci + 3)}${r + 1}`] = text;
      }
    }
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
              // [ajuste usuario] SIN tableWidth en ningún tamaño: la tabla
              // conserva su ancho natural (suma de columnas) → hay desborde
              // real también en escritorio y freezeColumns funciona igual en
              // móvil y escritorio (el scrollport es .jss_content, que se
              // configura inline justo después del init).
              tableWidth: undefined,
              freezeColumns: freezeCount,
          editable: !periodClosed,
          comments: commentsInit,
          columnResize: false,
          columnDrag: false,
          columnSorting: false,
          search: false,
          pagination: 0,
          // Columnas: Estudiante · PROM · DEF · actividades / marcadores "—"
          // [C2] ancho por columna según bloque de concepto (uniforme)
          columns: [
            { title: "Estudiantes", width: STUDENT_COL_WIDTH, readOnly: true },
            { title: "PROM", width: 52, readOnly: true },
            { title: "DEF", width: 52, readOnly: true },
            ...cols.map((col, ci) =>
              col.kind === "activity"
                ? {
                    // [C5] la etiqueta N{order} nunca se reemplaza por label/name
                    title: col.activity.isGeneral
                      ? `N${col.activity.order} ★`
                      : `N${col.activity.order}`,
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

    // [ajuste usuario] Móvil y escritorio por igual: .jss_content es el
    // scrollport (x e y) de la hoja. Con altura acotada, los encabezados
    // (conceptos + Estudiantes/PROM/DEF/N#) quedan fijos al desplazar la
    // lista de estudiantes verticalmente, y freezeColumns también opera en
    // escritorio (position:sticky requiere un scroll container real).
    if (el) {
      const containerEl = el.querySelector<HTMLElement>(".jss_container");
      if (containerEl) containerEl.style.maxWidth = "100%";
      const contentEl = el.querySelector<HTMLElement>(".jss_content");
      if (contentEl) {
        contentEl.style.width = "100%";
        contentEl.style.overflow = "auto";
        contentEl.style.maxHeight = "calc(100dvh - 170px)";
        contentEl.style.overscrollBehavior = "contain";
      }
    }

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

    // [comentarios] en modo comentario, un tap/click en una celda de actividad
    // abre el diálogo de su comentario (funciona igual en táctil y escritorio)
    const handleCommentClick = (ev: Event) => {
      if (!propsRef.current.commentMode) return;
      const target = ev.target as HTMLElement;
      const td = target.closest("td");
      const x = Number(td?.getAttribute("data-x"));
      const y = Number(td?.getAttribute("data-y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x < 3) return; // Estudiantes/PROM/DEF sin comentarios
      const col = colsRef.current[x - 3];
      if (!col || col.kind !== "activity") return; // marcador "—"
      const s = propsRef.current.students[y];
      if (!s) return;
      ev.preventDefault();
      ev.stopPropagation();
      propsRef.current.onCellCommentRequest?.({
        key: `${s.studentId}::${col.activity.id}`,
        studentName: s.fullName,
        activityName: col.activity.label ?? col.activity.name,
      });
    };
    el.addEventListener("click", handleCommentClick);

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
        th.title = a.name; // [C5] tooltip nativo (hover desktop) con el nombre completo
        // [C4] chip "N#" clicable → menú contextual Editar/Eliminar; siempre
        // visible sin importar cuántas actividades haya por concepto.
        th.textContent = "";
        const chip = document.createElement("span");
        chip.textContent = shortActivityLabel(a);
        Object.assign(chip.style, {
          padding: "8px 4px",
          cursor: periodClosed ? "not-allowed" : "pointer",
        } satisfies Partial<CSSStyleDeclaration>);
        if (!periodClosed) {
          chip.style.borderBottom = "1px dotted currentColor";
          chip.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openActivityMenu(chip, a, propsRef.current);
          });
        }
        th.appendChild(chip);
      });

      // Fila 1 (conceptos): fila propia insertada en el thead, con colspans
      // que suman los anchos reales de las columnas → alineación garantizada.
      // Bloque de color + botón "+" por concepto [F1], siempre visible.
      if (props.onAddActivityForConcept && concepts.length > 0) {
        const thead = el.querySelector("thead");
        const stdRow = ws.headers?.[0]?.parentElement;
        if (thead && stdRow) {
          const tr = document.createElement("tr");
          // [theme-options] alto configurable del header de conceptos ([C6] default 32px)
          tr.style.height = "var(--grades-header-height, 32px)";
          // Grupo: columna de numeración + Estudiantes + PROM + DEF (4 columnas)
          // [theme-options-movil] la franja se divide para congelarse SOLO sobre
          // las columnas realmente congeladas por jss (Estudiantes + PROM/DEF
          // según los chips): la numeración y el resto se desplazan con el scroll.
          const groupStyles: Partial<CSSStyleDeclaration> = {
            background: COLOR_HEADER_MUTED,
            color: "#374151",
            fontWeight: "700",
            fontSize: "var(--grades-header-font-size, 11px)",
            textAlign: "left",
            paddingLeft: "8px",
          };
          const mkGroupCell = (colspan: number, opts?: { stickyLeft?: number; text?: string }) => {
            if (colspan <= 0) return;
            const td = document.createElement("td");
            td.colSpan = colspan;
            if (opts?.stickyLeft !== undefined) {
              td.style.position = "sticky";
              td.style.left = `${opts.stickyLeft}px`;
              td.style.zIndex = "4";
            }
            Object.assign(td.style, groupStyles);
            if (opts?.text) td.textContent = opts.text;
            tr.appendChild(td);
          };
          if (freezeCount > 0) {
            // numeración: se desplaza (jss no congela la columna de numeración)
            mkGroupCell(1);
            // Estudiantes: congelada en el borde del contenido
            mkGroupCell(1, { stickyLeft: 0, text: "Estudiantes" });
            // PROM/DEF congeladas: franja fija a continuación del ancho de Estudiantes
            const frozenExtra = freezeCount - 1;
            mkGroupCell(frozenExtra, { stickyLeft: STUDENT_COL_WIDTH });
            // resto no congelado del grupo: se desplaza
            mkGroupCell(3 - freezeCount);
          } else {
            mkGroupCell(4, { text: "Estudiantes" });
          }
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
          // [ajuste usuario] Encabezados fijos al desplazar la lista en
          // vertical: la fila de conceptos pega en top 0 y la fila estándar
          // (Estudiantes/PROM/DEF/N#) justo debajo. Sticky opera dentro del
          // scrollport .jss_content (altura acotada tras el init).
          for (let hci = 0; hci < tr.children.length; hci++) {
            const hc = tr.children[hci] as HTMLElement;
            hc.style.position = "sticky";
            hc.style.top = "0px";
            hc.style.zIndex = "6";
          }
          const conceptHeaderH = `${tr.offsetHeight || 32}px`;
          for (let hci = 0; hci < stdRow.children.length; hci++) {
            const hc = stdRow.children[hci] as HTMLElement;
            hc.style.position = "sticky";
            hc.style.top = conceptHeaderH;
            hc.style.zIndex = "5";
          }
          // [ajuste usuario] Congelación horizontal de los encabezados: sticky
          // con inset left por columna (la clase grades-frozen-head eleva el
          // z-index sobre las celdas de scroll; ver globals.css).
          if (freezeCount > 0) {
            let accLeft = 0;
            for (let k = 1; k <= freezeCount; k++) {
              const hc = stdRow.children[k] as HTMLElement | undefined;
              if (!hc) break;
              hc.classList.add("grades-frozen-head");
              hc.style.left = `${accLeft}px`;
              accLeft += hc.offsetWidth || 0;
            }
            const cEst = tr.children[1] as HTMLElement | undefined;
            if (cEst) {
              cEst.classList.add("grades-frozen-head");
              cEst.style.left = "0px";
            }
            if (freezeCount >= 2) {
              const cGroup = tr.children[2] as HTMLElement | undefined;
              if (cGroup) {
                cGroup.classList.add("grades-frozen-head");
                cGroup.style.left = `${(stdRow.children[1] as HTMLElement)?.offsetWidth || 0}px`;
              }
            }
          }
        }
      }
    }

    return () => {
      el.removeEventListener("mousedown", fillDown);
      el.removeEventListener("click", handleCommentClick);
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
  // [C2] los chips de inmovilización se movieron a Configuración institucional;
  // el valor llega por localStorage + evento "apprende:grades:freeze-changed".
  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div ref={containerRef} className="jss-planilla flex-1 rounded-xl border bg-card" />
    </div>
  );
}
