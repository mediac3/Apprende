// [F2] Detección de la cuadrícula de la planilla escaneada.
// Estrategia: los bordes negros de la tabla (lineColor ~#282828) son la señal
// más fuerte → líneas horizontales/verticales largas. El QR del header da el
// contexto {institutionId, groupId, subjectId, periodId, year}. Los puntos
// guía grises quedan como ancla visual del docente, no se usan para detectar.
// Cores puros sobre GrayImage (testeables sin DOM).
// jsQR se importa dinámicamente (carga estática rompe el chunk en prod).

import type { GrayImage } from "./preprocess";

export interface QrContext {
  v: number;
  inst: string;
  group: string;
  subj: string;
  period: string;
  year: string;
  /** v2/v3: opciones de layout con las que se generó la planilla */
  prom?: number; // 1 → columna PROM incluida
  n10?: number; // v2: 1 → bloques fijos N1..N10
  cc?: string[]; // conceptos seleccionados al generar (orden = columnas)
  ac?: Record<string, number>; // v3: actividades IMPRESAS por concepto (orden de columnas)
}

/** Downscale RGBA por factor entero (vecino más cercano) — pure. */
export function downscaleRgba(
  img: { width: number; height: number; data: Uint8ClampedArray },
  factor: number
): { width: number; height: number; data: Uint8ClampedArray } {
  if (factor <= 1) return { width: img.width, height: img.height, data: img.data };
  const w = Math.floor(img.width / factor);
  const h = Math.floor(img.height / factor);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x * factor;
      const sy = y * factor;
      const si = (sy * img.width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** Recorta una región RGBA (pure). */
export function cropRgba(
  img: { width: number; height: number; data: Uint8ClampedArray },
  x: number,
  y: number,
  w: number,
  h: number
): { width: number; height: number; data: Uint8ClampedArray } {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let yy = 0; yy < h; yy++) {
    const si = ((y + yy) * img.width + x) * 4;
    out.set(img.data.subarray(si, si + w * 4), yy * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** Estira contraste (percentiles 5-95) sobre copia RGBA — pure. */
function stretchContrast(img: { width: number; height: number; data: Uint8ClampedArray }): void {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < img.data.length; i += 4) {
    hist[img.data[i]]++; // canal R aproxima gris (QR es B/N)
  }
  const total = img.data.length / 4;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.05) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.05) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < img.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      img.data[i + c] = Math.max(0, Math.min(255, ((img.data[i + c] - lo) * 255) / range));
    }
  }
}

async function decodeWithBarcodeDetector(
  img: { width: number; height: number; data: Uint8ClampedArray }
): Promise<string | null> {
  const BD = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect(src: unknown): Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const detector = new BD({ formats: ["qr_code"] });
    const codes = await detector.detect(img);
    return codes.find((c) => c.rawValue)?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function decodeWithJsQr(
  img: { width: number; height: number; data: Uint8ClampedArray }
): Promise<string | null> {
  const jsQR = (await import("jsqr")).default;
  const attempts = [img.data, img.data]; // normal + invertido
  for (let inv = 0; inv < 2; inv++) {
    if (inv === 1) {
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255 - img.data[i];
        img.data[i + 1] = 255 - img.data[i + 1];
        img.data[i + 2] = 255 - img.data[i + 2];
      }
    }
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (code?.data) return code.data;
  }
  void attempts;
  return null;
}

/**
 * Decodificación robusta del QR (puede llegar en perspectiva desde una foto):
 * 1) BarcodeDetector nativo (Chrome/Android; tolera distorsión) sobre escala media.
 * 2) jsQR multi-escala con contraste estirado (escala completa y medias).
 * 3) jsQR sobre ROI superior-derecha a resolución completa (el QR vive ahí).
 */
export async function decodeQrContext(rgba: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): Promise<QrContext | null> {
  const parse = (raw: string | null): QrContext | null => {
    if (!raw) return null;
    try {
      const ctx = JSON.parse(raw) as QrContext;
      return ctx && (ctx.v === 1 || ctx.v === 2 || ctx.v === 3) && ctx.group && ctx.subj && ctx.period ? ctx : null;
    } catch {
      return null;
    }
  };

  // 1) Detector nativo a media resolución (rápido y tolerante a perspectiva)
  const mid = downscaleRgba(rgba, Math.max(1, Math.floor(Math.max(rgba.width, rgba.height) / 1400)));
  const native = await decodeWithBarcodeDetector(mid);
  if (native) return parse(native);

  // 2) jsQR multi-escala sobre copias con contraste estirado
  for (const factor of [2, 3, 1]) {
    const scaled = downscaleRgba(rgba, factor);
    stretchContrast(scaled);
    const raw = await decodeWithJsQr(scaled);
    if (raw) return parse(raw);
  }

  // 3) ROI superior-derecha a resolución completa (mayor dpi efectivo en el QR)
  try {
    const roiW = Math.min(rgba.width, Math.floor(rgba.width * 0.45));
    const roiH = Math.min(rgba.height, Math.floor(rgba.height * 0.3));
    if (roiW > 60 && roiH > 60) {
      const roi = cropRgba(rgba, rgba.width - roiW, 0, roiW, roiH);
      stretchContrast(roi);
      const raw = await decodeWithJsQr(roi);
      if (raw) return parse(raw);
    }
  } catch {
    // imagen demasiado pequeña para el ROI: ignorar
  }
  return null;
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
