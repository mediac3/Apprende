// [F2] Reconocimiento de dígitos manuscritos por celda (Tesseract.js local).
// Worker único reutilizado con whitelist "0123456789.," y PSM línea única.
// La confianza por celda alimenta el umbral de revisión del wizard (default 0.7).
// IMPORT: tesseract.js se importa dinámicamente (su carga estática rompe el
// chunk de Notas parciales en producción: TDZ al evaluar el módulo).

import { normalizeOcrText, type NormalizedGrade } from "./normalize-value";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker(): Promise<import("tesseract.js").Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789.,",
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } finally {
    workerPromise = null;
  }
}

export interface CellOcrResult {
  rawText: string;
  confidence: number; // 0-1
  normalized: NormalizedGrade;
}

/**
 * Reconoce una celda recortada. `crop` debe ser un canvas ya recortado
 * (el wizard recorta desde el canvas de página con los rects del grid).
 */
export async function recognizeCell(crop: HTMLCanvasElement): Promise<CellOcrResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(crop);
  const rawText = (data.text ?? "").trim();
  const confidence = Math.min(1, Math.max(0, (data.confidence ?? 0) / 100));
  return { rawText, confidence, normalized: normalizeOcrText(rawText) };
}

/** Umbral de confianza para resaltar celdas en amarillo (regla dura F2). */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
