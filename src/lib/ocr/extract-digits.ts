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
 * ICR por celda (enfoque Grooper): preprocesado → aislamiento → reconocimiento
 * restringido → validación contextual. Pasos:
 *  1. Gris + umbral adaptativo (Otsu) que elimina la rejilla guía gris #B0B0B0:
 *     solo sobrevive la tinta del docente.
 *  2. Upscale ×3 (aislamiento del carácter).
 *  3. Dos pasadas Tesseract (línea única; reintento como palabra única si la
 *     confianza es baja) con whitelist "0123456789.,"; gana la de mayor confianza.
 *  4. Normalización contextual 0.0–5.0 (normalize-value).
 * `crop` debe ser un canvas ya recortado con la celda.
 */
export async function recognizeCell(crop: HTMLCanvasElement): Promise<CellOcrResult> {
  const worker = await getWorker();
  const pp = await import("./preprocess");
  const ctx = crop.getContext("2d", { willReadFrequently: true })!;
  const gray = pp.toGrayscale({
    width: crop.width,
    height: crop.height,
    data: ctx.getImageData(0, 0, crop.width, crop.height).data,
  });
  // Umbral de tinta adaptativo: deja fuera los puntos guía (#B0B0B0 ≈ 176) y el papel.
  const otsu = pp.otsuThreshold(gray);
  const inkLimit = Math.max(80, Math.min(otsu - 25, 150));
  const cleaned = pp.removeGuideDots(gray, inkLimit);
  const upscaled = pp.upscaleGray(cleaned, 3);
  const passCanvas = pp.grayToCanvas(upscaled);

  const runPass = async (psm: import("tesseract.js").PSM) => {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.,",
      tessedit_pageseg_mode: psm,
    });
    const { data } = await worker.recognize(passCanvas);
    return { text: (data.text ?? "").trim(), confidence: Math.min(1, Math.max(0, (data.confidence ?? 0) / 100)) };
  };

  const { PSM } = await import("tesseract.js");
  const linePass = await runPass(PSM.SINGLE_LINE);
  let best = linePass;
  if (linePass.confidence < 0.6 || linePass.text === "") {
    const wordPass = await runPass(PSM.SINGLE_WORD);
    if (wordPass.confidence > linePass.confidence) best = wordPass;
  }

  return { rawText: best.text, confidence: best.confidence, normalized: normalizeOcrText(best.text) };
}

/** Umbral de confianza para resaltar celdas en amarillo (regla dura F2). */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
