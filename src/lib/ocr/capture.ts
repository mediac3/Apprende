// [F2] Captura estilo escáner de documentos (como el iPhone): viewfinder en
// vivo, detección del papel (cuadrilátero más brillante) y corrección de
// perspectiva por homografía → imagen rectificada lista para la cuadrícula.
// Cores puros sobre GrayImage (testeables sin DOM); pegamento de cámara aparte.

import type { GrayImage } from "./preprocess";

export interface Point {
  x: number;
  y: number;
}
export interface Quad {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

// === Pegamento de cámara (browser) ===
// (los cores puros están arriba; el umbral usa percentil porque el papel es
// la clase MÁS BRILLANTE de la escena y Otsu puede empatar en escenas bimodales)

function percentileValue(g: GrayImage, pct: number): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  const target = g.data.length * pct;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

/**
 * Detecta el papel como la región brillante de la foto y devuelve sus 4 esquinas
 * (puntos extremos: min/max de x+y y x−y). null si el fondo no contrasta.
 */
export function detectPaperQuad(g: GrayImage): Quad | null {
  // El papel es lo más brillante: umbral por percentil alto (no Otsu, que empata
  // en escenas bimodales fondo-oscuro/papel-claro).
  const thr = Math.max(1, percentileValue(g, 0.85) - 10);
  const { width: w, height: h, data } = g;
  let brightCount = 0;
  let tl: Point | null = null;
  let tr: Point | null = null;
  let br: Point | null = null;
  let bl: Point | null = null;
  let tlSum = Infinity;
  let trDiff = -Infinity;
  let brSum = -Infinity;
  let blDiff = Infinity;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 400)); // muestreo: imágenes grandes
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[y * w + x] < thr) continue;
      brightCount++;
      const sum = x + y;
      const diff = x - y;
      if (sum < tlSum) {
        tlSum = sum;
        tl = { x, y };
      }
      if (diff > trDiff) {
        trDiff = diff;
        tr = { x, y };
      }
      if (sum > brSum) {
        brSum = sum;
        br = { x, y };
      }
      if (diff < blDiff) {
        blDiff = diff;
        bl = { x, y };
      }
    }
  }
  if (!tl || !tr || !br || !bl) return null;
  const sampled = Math.ceil(w / step) * Math.ceil(h / step);
  const ratio = brightCount / sampled;
  if (ratio < 0.15 || ratio > 0.92) return null; // sin contraste papel/fondo
  return { tl, tr, br, bl };
}

function quadArea(q: Quad): number {
  const { tl, tr, br, bl } = q;
  return Math.abs(
    tl.x * (tr.y - bl.y) + tr.x * (br.y - tl.y) + br.x * (bl.y - tr.y) + bl.x * (tl.y - br.y)
  ) / 2;
}

/** Resuelve el sistema lineal 8×8 por eliminación gaussiana (pure). */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-9) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/**
 * Homografía (rect → quad) y muestreo bilineal: endereza la foto del papel.
 * outW/outH definen el rectángulo destino (p.ej. A4 landscape 1700×1202).
 */
export function warpPerspective(
  src: GrayImage,
  quad: Quad,
  outW: number,
  outH: number
): GrayImage {
  const { tl, tr, br, bl } = quad;
  // DLT: sistema único 8×8 con filas intercaladas x/y y un solo vector b
  const A: number[][] = [];
  const b: number[] = [];
  const dst: Array<[number, number]> = [
    [0, 0],
    [outW, 0],
    [outW, outH],
    [0, outH],
  ];
  const srcPts: Array<[number, number]> = [
    [tl.x, tl.y],
    [tr.x, tr.y],
    [br.x, br.y],
    [bl.x, bl.y],
  ];
  for (let i = 0; i < 4; i++) {
    const [u, v] = dst[i];
    const [x, y] = srcPts[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  const h = solveLinear(A, b);
  const out = new Uint8ClampedArray(outW * outH);
  if (!h) {
    out.fill(255);
    return { width: outW, height: outH, data: out };
  }
  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const den = h[6] * u + h[7] * v + 1;
      const x = (h[0] * u + h[1] * v + h[2]) / den;
      const y = (h[3] * u + h[4] * v + h[5]) / den;
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      if (xi < 0 || yi < 0 || xi >= src.width - 1 || yi >= src.height - 1) {
        out[v * outW + u] = 255;
        continue;
      }
      const fx = x - xi;
      const fy = y - yi;
      const i00 = src.data[yi * src.width + xi];
      const i10 = src.data[yi * src.width + xi + 1];
      const i01 = src.data[(yi + 1) * src.width + xi];
      const i11 = src.data[(yi + 1) * src.width + xi + 1];
      out[v * outW + u] =
        i00 * (1 - fx) * (1 - fy) + i10 * fx * (1 - fy) + i01 * (1 - fx) * fy + i11 * fx * fy;
    }
  }
  return { width: outW, height: outH, data: out };
}

// === Pegamento de cámara (browser) ===

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Extrae el frame del video a canvas (usa resolución nativa del stream). */
export function grabVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0);
  return canvas;
}

/**
 * Captura estilo escáner: frame del video → detección del papel → rectificación
 * a A4 landscape. Si no detecta papel, devuelve el frame completo (el wizard
 * avisa "no se detectó el borde del papel").
 */
export function captureDocumentFrame(video: HTMLCanvasElement | HTMLVideoElement): {
  canvas: HTMLCanvasElement;
  rectified: boolean;
} {
  const frame =
    video instanceof HTMLVideoElement
      ? grabVideoFrame(video)
      : (video as HTMLCanvasElement);
  const ctx = frame.getContext("2d", { willReadFrequently: true })!;
  const gray: GrayImage = {
    width: frame.width,
    height: frame.height,
    data: new Uint8ClampedArray(frame.width * frame.height),
  };
  const rgba = ctx.getImageData(0, 0, frame.width, frame.height).data;
  for (let p = 0, i = 0; p < gray.data.length; p++, i += 4) {
    gray.data[p] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  const quad = detectPaperQuad(gray);
  if (!quad || quadArea(quad) < frame.width * frame.height * 0.12) {
    return { canvas: frame, rectified: false };
  }
  const OUT_W = 1700;
  const OUT_H = Math.round(1700 / (297 / 210)); // A4 landscape
  const warped = warpPerspective(gray, quad, OUT_W, OUT_H);
  const canvas = grayToCanvasForCapture(warped);
  return { canvas, rectified: true };
}

function grayToCanvasForCapture(g: GrayImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const rgba = ctx.createImageData(g.width, g.height);
  for (let p = 0, i = 0; p < g.data.length; p++, i += 4) {
    rgba.data[i] = rgba.data[i + 1] = rgba.data[i + 2] = g.data[p];
    rgba.data[i + 3] = 255;
  }
  ctx.putImageData(rgba, 0, 0);
  return canvas;
}
