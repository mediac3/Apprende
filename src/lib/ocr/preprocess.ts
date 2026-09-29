// [F2] Preprocesamiento de imagen para el scanner: grayscale + Otsu + denoise,
// y render de PDF escaneado → canvas (pdfjs-dist). Cores puros sobre
// {width,height,data} para poder probarlos sin DOM.

export interface GrayImage {
  width: number;
  height: number;
  /** un byte por píxel (0-255) */
  data: Uint8ClampedArray;
}

export function toGrayscale(img: { width: number; height: number; data: Uint8ClampedArray }): GrayImage {
  const { width, height } = img;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
    out[p] = (img.data[i] * 299 + img.data[i + 1] * 587 + img.data[i + 2] * 114) / 1000;
  }
  return { width, height, data: out };
}

/** Umbral global de Otsu sobre la imagen gris. */
export function otsuThreshold(g: GrayImage): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  const total = g.data.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/** Binariza: 0 = tinta (≤thr), 255 = papel. */
export function binarize(g: GrayImage, thr?: number): GrayImage {
  const t = thr ?? otsuThreshold(g);
  const out = new Uint8ClampedArray(g.data.length);
  for (let i = 0; i < g.data.length; i++) out[i] = g.data[i] <= t ? 0 : 255;
  return { width: g.width, height: g.height, data: out };
}

/** Denoise: apaga píxeles de tinta aislados (sin vecinos de tinta en 3x3). */
export function denoise(b: GrayImage): GrayImage {
  const { width: w, height: h, data } = b;
  const out = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (data[i] !== 0) continue;
      let dark = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (data[(y + dy) * w + (x + dx)] === 0) dark++;
      if (dark <= 2) out[i] = 255; // aislado → papel
    }
  }
  return { width: w, height: h, data: out };
}

/** Renderiza una página de un PDF escaneado a canvas (browser). */
export async function renderPdfPageToCanvas(
  file: File,
  pageNumber: number,
  targetWidth = 1700
): Promise<HTMLCanvasElement> {
  const pdfjs = await import("pdfjs-dist");
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages));
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}
