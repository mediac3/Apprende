"use client";

import QRCode from "qrcode";
import {
  buildGradeSheet,
  padConceptToN10,
  type GradeSheetConcept,
  type GradeSheetPayload,
} from "@/lib/pdf/grade-sheet";

// [F1] Hook de generación de planillas imprimibles: arma el payload desde el
// contexto de Notas parciales (grupo/asignatura/periodo seleccionados), genera el
// QR identificador (lo lee el scanner [F2]) y produce el PDF (preview o descarga).

export interface GradeSheetGeneratorInput {
  institutionId: string;
  institutionName: string;
  institutionLogoUrl: string | null;
  yearLabel: string;
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
  periodId: string;
  periodName: string;
  defaultTeacher: string;
  concepts: Array<{ id: string; name: string }>;
  /** Actividades por concepto en orden estable (label = `N${order}` de la planilla) */
  activitiesByConcept: Record<string, Array<{ id: string; label: string }>>;
  students: Array<{ id: string; name: string }>;
}

export interface GradeSheetOptions {
  teacher: string;
  journey: string;
  conceptIds: string[];
  includeProm: boolean;
  /** false → solo actividades creadas; true → bloque fijo N1..N10 por concepto */
  fillToN10: boolean;
  size: "a4" | "letter";
}

async function fetchLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > 1_500_000) return null; // logos enormes: omitir, no bloquear
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function gradeSheetFileName(groupName: string, periodName: string): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `planilla-${clean(groupName)}-${clean(periodName)}.pdf`;
}

export async function buildGradeSheetPayload(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions
): Promise<GradeSheetPayload> {
  const selected = input.concepts.filter((c) => opts.conceptIds.includes(c.id));
  const concepts: GradeSheetConcept[] = selected.map((c) => {
    const acts = (input.activitiesByConcept[c.id] ?? []).map((a) => ({
      id: a.id,
      label: a.label,
    }));
    return opts.fillToN10 ? padConceptToN10({ id: c.id, name: c.name, activities: acts }) : { id: c.id, name: c.name, activities: acts };
  });

  // QR identificador: el scanner [F2] lo decodifica para fijar/validar el contexto.
  const qrPayload = JSON.stringify({
    v: 1,
    inst: input.institutionId,
    group: input.groupId,
    subj: input.subjectId,
    period: input.periodId,
    year: input.yearLabel,
  });
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 128 });
  } catch {
    qrDataUrl = null;
  }

  const logoDataUrl = input.institutionLogoUrl
    ? await fetchLogoDataUrl(input.institutionLogoUrl)
    : null;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const generatedAtLabel = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return {
    header: {
      institutionName: input.institutionName,
      logoDataUrl,
      teacher: opts.teacher,
      journey: opts.journey,
      period: input.periodName,
      group: input.groupName,
      generatedAtLabel,
      qrDataUrl,
    },
    concepts,
    students: input.students.map((s) => ({ id: s.id, name: s.name })),
    size: opts.size,
    includeProm: opts.includeProm,
  };
}

/** Genera el PDF. mode "preview" lo abre en pestaña nueva; "download" lo descarga. */
export async function generateGradeSheet(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions,
  mode: "preview" | "download"
): Promise<void> {
  const payload = await buildGradeSheetPayload(input, opts);
  if (payload.concepts.length === 0) throw new Error("Selecciona al menos un concepto");
  const doc = await buildGradeSheet(payload);
  if (mode === "preview") {
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(gradeSheetFileName(input.groupName, input.periodName));
  }
}
