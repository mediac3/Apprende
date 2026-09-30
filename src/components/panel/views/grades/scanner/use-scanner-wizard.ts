"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { CellTarget, QrContext, SheetLayoutPlan } from "@/lib/ocr/detect-grid";
import { normalizeOcrText } from "@/lib/ocr/normalize-value"; // módulo puro: seguro estático
import { padConceptToN10 } from "@/lib/pdf/grade-sheet";
import {
  registerScannedGrades,
  undoScannedGrades,
  type ScanSnapshotEntry,
} from "@/lib/actions/grade-scanner";

// [F2] Estado y orquestación del Scanner Wizard (5 pasos).
// El contexto lo aporta la vista de Notas parciales; el QR del header de la
// planilla debe coincidir (regla dura) para habilitar el escaneo.
// IMPORTANTE: preprocess/detect-grid/extract-digits (tesseract.js, jsqr) se
// importan dinámicamente en los callbacks: su carga estática rompía el chunk
// de Notas parciales en producción (TDZ al evaluar el módulo).

export type ScannerStep = 1 | 2 | 3 | 4 | 5;

export interface ScannerContextInput {
  userId: string;
  institutionId: string;
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
  periodId: string;
  periodName: string;
  yearLabel: string;
  /** Estudiantes del grupo (orden de filas de la planilla) */
  students: Array<{ id: string; name: string }>;
  /** Catálogo del contexto: el layout exacto viene del QR de la planilla */
  concepts: Array<{ id: string; name: string }>;
  activitiesByConcept: Record<string, Array<{ id: string; label: string }>>;
  canRegister: boolean;
}

export type CellStatus = "ok" | "low" | "empty" | "error";

export interface ScannedCell {
  key: string; // `${studentIndex}:${colIndex}` sobre la planilla
  studentId: string;
  studentName: string;
  target: CellTarget;
  raw: string;
  confidence: number;
  value: number | null;
  status: CellStatus;
  excluded: boolean;
}

export interface DetectionResult {
  qr: QrContext | null;
  qrMatch: boolean;
  gridOk: boolean;
  detail: string;
  /** Layout reconstruido desde el QR (fallback: contexto completo) */
  plan: SheetLayoutPlan;
}

function statusFor(norm: { ok: boolean; value: number | null }, confidence: number, threshold: number): CellStatus {
  if (!norm.ok) return "error";
  if (norm.value === null) return "empty";
  return confidence < threshold ? "low" : "ok";
}

const DEFAULT_THRESHOLD = 0.7; // igual a DEFAULT_CONFIDENCE_THRESHOLD de extract-digits

export function useScannerWizard(input: ScannerContextInput, onClose: () => void) {
  const [step, setStep] = useState<ScannerStep>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [cells, setCells] = useState<ScannedCell[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [result, setResult] = useState<{ registered: number; snapshot: ScanSnapshotEntry[] } | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    void (async () => {
      try {
        const { terminateOcrWorker } = await import("@/lib/ocr/extract-digits");
        await terminateOcrWorker();
      } catch {
        // best-effort al liberar el worker
      }
    })();
    canvasRef.current = null;
    pdfFileRef.current = null;
    setStep(1);
    setBusy(null);
    setError(null);
    setPreviewUrl(null);
    setPageNumber(1);
    setPageCount(1);
    setRotation(0);
    setDetection(null);
    setCells([]);
    setResult(null);
    setUndoLeft(0);
    if (undoTimerRef.current) {
      clearInterval(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  /** Paso 1: carga imagen o PDF (página actual) → canvas base. */
  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setBusy("Cargando archivo…");
    try {
      const { renderPdfPageToCanvas } = await import("@/lib/ocr/preprocess");
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      let canvas: HTMLCanvasElement;
      if (isPdf) {
        pdfFileRef.current = file;
        canvas = await renderPdfPageToCanvas(file, 1);
        // total de páginas: re-render consulta pdfjs de nuevo; aproximamos con 1..N via getDocument
        const pdfjs = await import("pdfjs-dist");
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        setPageCount(pdf.numPages);
      } else if (file.type.startsWith("image/")) {
        pdfFileRef.current = null;
        const url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Imagen ilegible"));
          img.src = url;
        });
        canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        setPageCount(1);
      } else {
        throw new Error("Formato no soportado (usa PDF, JPG o PNG).");
      }
      canvasRef.current = canvas;
      setRotation(0);
      setPageNumber(1);
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
      setDetection(null);
      setCells([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el archivo.");
    } finally {
      setBusy(null);
    }
  }, []);

  /** Carga la página N de un PDF multipágina. */
  const goToPage = useCallback(async (n: number) => {
    const file = pdfFileRef.current;
    if (!file) return;
    setBusy("Cargando página…");
    try {
      const { renderPdfPageToCanvas } = await import("@/lib/ocr/preprocess");
      const canvas = await renderPdfPageToCanvas(file, n);
      canvasRef.current = canvas;
      setPageNumber(n);
      setRotation(0);
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
      setDetection(null);
    } finally {
      setBusy(null);
    }
  }, []);

  /** Paso 2: rotación manual (90°, -90°, 180°) + redetección si ya había. */
  const rotate = useCallback(async (deg: 90 | -90 | 180) => {
    const src = canvasRef.current;
    if (!src) return;
    const next = (rotation + deg + 360) % 360;
    setRotation(next);
    const out = document.createElement("canvas");
    out.width = deg === 180 ? src.width : src.height;
    out.height = deg === 180 ? src.height : src.width;
    const ctx = out.getContext("2d", { willReadFrequently: true })!;
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    canvasRef.current = out;
    setPreviewUrl(out.toDataURL("image/jpeg", 0.85));
    setDetection(null);
  }, [rotation]);

  /** Layout esperado: reconstruido desde el QR de la planilla; fallback = todo el contexto. */
  const planFromQr = useCallback(
    (qr: QrContext | null): SheetLayoutPlan => {
      const map = new Map(input.concepts.map((c) => [c.id, c]));
      const ids = qr?.cc?.length ? qr.cc.filter((id) => map.has(id)) : input.concepts.map((c) => c.id);
      const concepts = ids.map((id) => {
        const c = map.get(id)!;
        const activities = (input.activitiesByConcept[id] ?? []).map((a) => ({ id: a.id, label: a.label }));
        return qr?.n10 === 1
          ? padConceptToN10({ id: c.id, name: c.name, activities })
          : { id: c.id, name: c.name, activities };
      });
      return { concepts, includeProm: qr ? qr.prom !== 0 : true, studentCount: input.students.length };
    },
    [input]
  );

  /** Paso 2: QR + detección de cuadrícula contra el layout esperado. */
  const detect = useCallback(async (): Promise<DetectionResult> => {
    const canvas = canvasRef.current;
    const fallbackPlan = planFromQr(null);
    if (!canvas) return { qr: null, qrMatch: false, gridOk: false, detail: "Sin imagen.", plan: fallbackPlan };
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const dg = await import("@/lib/ocr/detect-grid");
    const pp = await import("@/lib/ocr/preprocess");

    // QR sobre imagen a escala reducida (jsQR es O(n)); la página completa a resolución media basta.
    let qr: QrContext | null = null;
    try {
      const maxSide = 1200;
      const s = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
      const qc = document.createElement("canvas");
      qc.width = Math.round(canvas.width * s);
      qc.height = Math.round(canvas.height * s);
      qc.getContext("2d")!.drawImage(canvas, 0, 0, qc.width, qc.height);
      const id = qc.getContext("2d")!.getImageData(0, 0, qc.width, qc.height);
      qr = await dg.decodeQrContext({ width: id.width, height: id.height, data: id.data });
    } catch {
      qr = null;
    }

    const plan = planFromQr(qr);
    const qrMatch =
      qr !== null &&
      qr.group === input.groupId &&
      qr.subj === input.subjectId &&
      qr.period === input.periodId;

    const gray = pp.toGrayscale({ width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data });
    const bin = pp.denoise(pp.binarize(gray));
    const hLines = dg.findHorizontalLines(bin);
    const vLines = hLines.length >= 2 ? dg.findVerticalLines(bin, hLines[0], hLines[hLines.length - 1]) : [];
    const built = dg.buildCellRects(hLines, vLines, plan);

    let detail: string;
    if (qr && !qrMatch) {
      detail = "El QR corresponde a otro grupo/asignatura/periodo. Selecciona el contexto correcto.";
    } else if (!qr) {
      detail = "No se detectó QR. Verifica que la planilla sea una generada por el sistema.";
    } else if (!built) {
      detail = `Cuadrícula no coincide (líneas H: ${hLines.length}, esperadas ${plan.studentCount + 3}). Rota o reescanea con mejor luz/enfoque.`;
    } else {
      detail = "Alineación confirmada.";
    }
    const res: DetectionResult = { qr, qrMatch, gridOk: qrMatch && built !== null, detail, plan };
    setDetection(res);
    return res;
  }, [input, planFromQr]);

  /** Paso 3: OCR de las celdas de nota (solo targets registrables). */
  const scan = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(null);
    setBusy("Detectando cuadrícula…");
    const det = detection ?? (await detect());
    if (!det.gridOk) {
      setBusy(null);
      return;
    }
    try {
      const dg = await import("@/lib/ocr/detect-grid");
      const pp = await import("@/lib/ocr/preprocess");
      const { recognizeCell } = await import("@/lib/ocr/extract-digits");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const gray = pp.toGrayscale({ width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data });
      const bin = pp.denoise(pp.binarize(gray));
      const hLines = dg.findHorizontalLines(bin);
      const vLines = dg.findVerticalLines(bin, hLines[0], hLines[hLines.length - 1]);
      const built = dg.buildCellRects(hLines, vLines, det.plan);
      if (!built) {
        setError("La cuadrícula dejó de coincidir; reajusta la alineación.");
        return;
      }
      const gradeRects = built.gradeRects.filter((r) => r.target.kind === "grade");
      const newCells: ScannedCell[] = [];
      const crop = document.createElement("canvas");
      const plan = det.plan;
      for (let i = 0; i < gradeRects.length; i++) {
        const rect = gradeRects[i];
        setBusy(`Reconociendo notas… ${i + 1}/${gradeRects.length}`);
        if (rect.target.kind !== "grade") continue;
        // Los rects van por fila en orden → índice de estudiante = fila del rect
        const rowIdx = Math.floor(i / gradeColsPerRow(plan));
        const st = input.students[rowIdx];
        if (!st) continue;
        crop.width = Math.max(8, Math.round(rect.w));
        crop.height = Math.max(8, Math.round(rect.h));
        const cctx = crop.getContext("2d", { willReadFrequently: true })!;
        cctx.clearRect(0, 0, crop.width, crop.height);
        cctx.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, crop.width, crop.height);
        // margen interior: quitar 1px de borde para no confundir el trazo de la cuadrícula
        const ocr = await recognizeCell(crop);
        const norm = ocr.normalized;
        newCells.push({
          key: `${rowIdx}:${rect.target.activityId}`,
          studentId: st.id,
          studentName: st.name,
          target: rect.target,
          raw: ocr.rawText,
          confidence: ocr.confidence,
          value: norm.value,
          status: statusFor(norm, ocr.confidence, threshold),
          excluded: false,
        });
        if (i % 12 === 11) await new Promise((r) => setTimeout(r, 0)); // ceder el hilo (UI viva)
      }
      setCells((prev) => {
        const byKey = new Map(prev.map((c) => [c.key, c]));
        for (const c of newCells) byKey.set(c.key, c); // re-escanear página actualiza; otras páginas se acumulan
        return Array.from(byKey.values());
      });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error durante el reconocimiento.");
    } finally {
      setBusy(null);
    }
  }, [detection, detect, input, threshold]);

  /** Edición manual en paso 4. */
  const updateCell = useCallback((key: string, raw: string) => {
    setCells((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const norm = normalizeOcrText(raw);
        return { ...c, raw, value: norm.value, status: statusFor(norm, c.confidence, threshold), excluded: false };
      })
    );
  }, [threshold]);

  const toggleExclude = useCallback((key: string) => {
    setCells((prev) => prev.map((c) => (c.key === key ? { ...c, excluded: !c.excluded } : c)));
  }, []);

  const included = cells.filter((c) => !c.excluded && c.status !== "error" && c.value !== null);

  /** Paso 5: registro (regla dura: confirmación explícita ya ocurrió en paso 4). */
  const apply = useCallback(async () => {
    if (!input.canRegister) {
      toast.error("Solo el docente asignado puede registrar notas de este grupo.");
      return;
    }
    if (included.length === 0) {
      toast.error("No hay celdas válidas para registrar.");
      return;
    }
    setBusy("Registrando notas…");
    try {
      const res = await registerScannedGrades({
        userId: input.userId,
        institutionId: input.institutionId,
        groupId: input.groupId,
        subjectId: input.subjectId,
        periodId: input.periodId,
        grades: included.map((c) => ({ studentId: c.studentId, activityId: (c.target as { activityId: string }).activityId, value: c.value! })),
      });
      if (!res.success || !res.snapshot) {
        throw new Error(res.error ?? "No se pudieron registrar las notas.");
      }
      setResult({ registered: res.registered ?? 0, snapshot: res.snapshot });
      setStep(5);
      setUndoLeft(30);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      undoTimerRef.current = setInterval(() => {
        setUndoLeft((s) => {
          if (s <= 1 && undoTimerRef.current) {
            clearInterval(undoTimerRef.current);
            undoTimerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar.");
    } finally {
      setBusy(null);
    }
  }, [included, input]);

  const undo = useCallback(async () => {
    if (!result) return;
    setBusy("Deshaciendo…");
    try {
      const res = await undoScannedGrades({
        userId: input.userId,
        institutionId: input.institutionId,
        groupId: input.groupId,
        subjectId: input.subjectId,
        snapshot: result.snapshot,
      });
      if (!res.success) throw new Error(res.error ?? "No se pudo deshacer.");
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      setUndoLeft(0);
      toast.success(`Deshecho completo: ${res.restored ?? 0} valores restaurados.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo deshacer.");
    } finally {
      setBusy(null);
    }
  }, [result, input]);

  const csv = useCallback(() => {
    const head = "Estudiante,Concepto,Actividad,Valor,Confianza,Estado";
    const lines = cells.map((c) =>
      [
        `"${c.studentName}"`,
        `"${c.target.kind === "grade" ? c.target.conceptName : "-"}"`,
        `"${c.target.label}"`,
        c.value ?? "",
        c.confidence.toFixed(2),
        c.status,
      ].join(",")
    );
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scanner-${input.groupName}-${input.periodName}.csv`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(a.href);
  }, [cells, input]);

  return {
    step, setStep, busy, error, setError,
    previewUrl, pageNumber, pageCount, goToPage, loadFile,
    rotation, rotate, detect, detection,
    cells, scan, updateCell, toggleExclude, threshold, setThreshold,
    included, apply, undo, undoLeft, csv, result, canRegister: input.canRegister, close, reset,
  };
}

// helpers internos
function gradeColsPerRow(plan: SheetLayoutPlan): number {
  return plan.concepts.reduce((acc, c) => acc + c.activities.filter((a) => a.id).length, 0);
}

export type ScannerWizardApi = ReturnType<typeof useScannerWizard>;
