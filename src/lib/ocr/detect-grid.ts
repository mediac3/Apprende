// [F2] Detección de la cuadrícula de la planilla escaneada.
// Estrategia: los bordes negros de la tabla (lineColor ~#282828) son la señal
// más fuerte → líneas horizontales/verticales largas. El QR del header da el
// contexto {institutionId, groupId, subjectId, periodId, year}. Los puntos
// guía grises quedan como ancla visual del docente, no se usan para detectar.
// Cores puros sobre GrayImage (testeables sin DOM).

import jsQR from "jsqr";
import type { GrayImage } from "./preprocess";

export interface QrContext {
  v: number;
  inst: string;
  group: string;
  subj: string;
  period: string;
  year: string;
}

/** Decodifica el QR del header (requiere ImageData RGBA completo de la página). */
export function decodeQrContext(rgba: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): QrContext | null {
  const code = jsQR(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height);
  if (!code?.data) return null;
  try {
    const ctx = JSON.parse(code.data) as QrContext;
    return ctx && ctx.v === 1 && ctx.group && ctx.subj && ctx.period ? ctx : null;
  } catch {
    return null;
  }
}

/** Y de cada línea horizontal larga (tinta). Merge de adyacentes. */
export function findHorizontalLines(
  b: GrayImage,
  minCoverage = 0.45,
  darkLimit = 100
): number[] {
  const { width: w, height: h, data } = b;
  const ys: number[] = [];
  for (let y = 0; y < h; y++) {
    let dark = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) if (data[row + x] < darkLimit) dark++;
    if (dark >= w * minCoverage) ys.push(y);
  }
  return mergeRuns(ys);
}

/** X de cada línea vertical larga dentro del rango Y [yFrom,yTo). */
export function findVerticalLines(
  b: GrayImage,
  yFrom: number,
  yTo: number,
  minCoverage = 0.55,
  darkLimit = 100
): number[] {
  const { width: w, data } = b;
  const span = Math.max(1, yTo - yFrom);
  const xs: number[] = [];
  for (let x = 0; x < w; x++) {
    let dark = 0;
    for (let y = yFrom; y < yTo; y++) if (data[y * w + x] < darkLimit) dark++;
    if (dark >= span * minCoverage) xs.push(x);
  }
  return mergeRuns(xs);
}

function mergeRuns(values: number[], gap = 3): number[] {
  if (values.length === 0) return [];
  values.sort((a, b) => a - b);
  const out: number[] = [];
  let runStart = values[0];
  let prev = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] - prev <= gap) {
      prev = values[i];
      continue;
    }
    out.push((runStart + prev) / 2);
    runStart = prev = values[i];
  }
  out.push((runStart + prev) / 2);
  return out;
}

// === Layout esperado (espejo del generador [F1]) ===

export interface PlannedActivity {
  id: string | null; // null → celda "hasta N10" sin actividad en BD (solo papel)
  label: string;
}
export interface PlannedConcept {
  id: string;
  name: string;
  activities: PlannedActivity[];
}
export interface SheetLayoutPlan {
  concepts: PlannedConcept[];
  includeProm: boolean;
  studentCount: number;
}

export type CellTarget =
  | { kind: "grade"; activityId: string; conceptId: string; conceptName: string; label: string }
  | { kind: "paper-only"; conceptId: string; label: string; why: "def" | "no-activity" | "prom" };

/** Semántica de cada columna de nota (tras las columnas # y Estudiante). */
export function plannedColumns(plan: SheetLayoutPlan): CellTarget[] {
  const cols: CellTarget[] = [];
  for (const c of plan.concepts) {
    cols.push({ kind: "paper-only", conceptId: c.id, label: "Def", why: "def" });
    for (const a of c.activities) {
      cols.push(
        a.id
          ? { kind: "grade", activityId: a.id, conceptId: c.id, conceptName: c.name, label: a.label }
          : { kind: "paper-only", conceptId: c.id, label: a.label, why: "no-activity" }
      );
    }
  }
  if (plan.includeProm) cols.push({ kind: "paper-only", conceptId: "", label: "PROM", why: "prom" });
  return cols;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rects de celdas de nota: combina líneas detectadas con el layout esperado.
 * Espera: líneas H = studentCount + 3 (top, sep head, sep head2/body, …, bottom).
 * Devuelve null si la detección no cuadra con lo esperado → el wizard pide reajuste.
 */
export function buildCellRects(
  hLines: number[],
  vLines: number[],
  plan: SheetLayoutPlan
): { gradeRects: Array<CellRect & { target: CellTarget }>; headOk: boolean } | null {
  const expectedHLines = plan.studentCount + 3;
  if (hLines.length !== expectedHLines) return null;
  const expectedCols = plannedColumns(plan).length;
  if (vLines.length !== expectedCols + 3) return null; // #, Estudiante + notas + separadores
  const gradeRects: Array<CellRect & { target: CellTarget }> = [];
  const targets = plannedColumns(plan);
  for (let r = 0; r < plan.studentCount; r++) {
    const yTop = hLines[3 + r];
    const yBot = hLines[4 + r];
    for (let c = 0; c < targets.length; c++) {
      const xL = vLines[2 + c];
      const xR = vLines[3 + c];
      gradeRects.push({ x: xL, y: yTop, w: xR - xL, h: yBot - yTop, target: targets[c] });
    }
  }
  return { gradeRects, headOk: true };
}
