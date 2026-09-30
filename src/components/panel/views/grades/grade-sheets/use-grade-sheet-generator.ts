"use client";

import QRCode from "qrcode";
import {
  buildGradeSheet,
  type GradeSheetConcept,
  type GradeSheetPayload,
} from "@/lib/pdf/grade-sheet";
import { createSheetActivities } from "@/lib/actions/grade-sheet-activities";

// [F1] Hook de generación de planillas imprimibles: arma el payload desde el
// contexto de Notas parciales (grupo/asignatura/periodo seleccionados), genera el
// QR identificador (lo lee el scanner [F2]) y produce el PDF (preview o descarga).

export interface GradeSheetGeneratorInput {
  userId: string;
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
  /** Total de actividades a IMPRIMIR por concepto (≥ creadas; el déficit se crea en BD) */
  totals: Record<string, number>;
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

/**
 * Crea en BD las actividades que falten para alcanzar el total configurado
 * por concepto y devuelve el catálogo actualizado (incluye las nuevas).
 */
export async function ensureActivitiesForTotals(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions
): Promise<Record<string, Array<{ id: string; label: string }>>> {
  const perConcept = opts.conceptIds
    .map((cid) => {
      const createdCount = (input.activitiesByConcept[cid] ?? []).length;
      const total = Math.max(0, opts.totals[cid] ?? createdCount);
      return { conceptId: cid, count: Math.max(0, total - createdCount) };
    })
    .filter((p) => p.count > 0);
  if (perConcept.length === 0) return input.activitiesByConcept;

  const res = await createSheetActivities({
    userId: input.userId,
    institutionId: input.institutionId,
    groupId: input.groupId,
    subjectId: input.subjectId,
    periodId: input.periodId,
    perConcept,
  });
  if (!res.success || !res.created) {
    throw new Error(res.error ?? "No se pudieron crear las actividades nuevas.");
  }
  const merged: Record<string, Array<{ id: string; label: string }>> = {
    ...input.activitiesByConcept,
  };
  for (const c of res.created) {
    const list = merged[c.conceptId] ?? (merged[c.conceptId] = []);
    list.push({ id: c.activityId, label: `N${c.order}` });
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }
  return merged;
}

/** Cuenta cuántas actividades nuevas se crearían con estos totales. */
export function countNewActivities(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions
): number {
  return opts.conceptIds.reduce((acc, cid) => {
    const createdCount = (input.activitiesByConcept[cid] ?? []).length;
    const total = Math.max(0, opts.totals[cid] ?? createdCount);
    return acc + Math.max(0, total - createdCount);
  }, 0);
}

export async function buildGradeSheetPayload(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions
): Promise<GradeSheetPayload> {
  const selected = input.concepts.filter((c) => opts.conceptIds.includes(c.id));
  const concepts: GradeSheetConcept[] = selected.map((c) => {
    const all = (input.activitiesByConcept[c.id] ?? []).map((a) => ({ id: a.id, label: a.label }));
    const total = Math.max(0, opts.totals[c.id] ?? all.length);
    // imprime las primeras `total`; si el catálogo aún no alcanza, rellena con id null (solo papel)
    const printed = Array.from({ length: total }, (_, i) =>
      all[i] ?? { id: null as string | null, label: `N${i + 1}` }
    );
    return { id: c.id, name: c.name, activities: printed };
  });

  // QR identificador (v3): el scanner reconstruye el layout exacto impreso.
  const qrPayload = JSON.stringify({
    v: 3,
    inst: input.institutionId,
    group: input.groupId,
    subj: input.subjectId,
    period: input.periodId,
    year: input.yearLabel,
    prom: opts.includeProm ? 1 : 0,
    cc: opts.conceptIds,
    ac: Object.fromEntries(selected.map((c) => [c.id, opts.totals[c.id] ?? (input.activitiesByConcept[c.id] ?? []).length])),
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

/** Archiva el PDF para auditoría (FASE 5). Fire-and-forget: nunca bloquea la descarga. */
async function archiveForAudit(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions,
  payload: GradeSheetPayload,
  fileName: string,
  dataUrl: string
): Promise<void> {
  try {
    await fetch("/api/grade-sheet-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: input.userId,
        institutionId: input.institutionId,
        groupId: input.groupId,
        subjectId: input.subjectId,
        periodId: input.periodId,
        yearLabel: input.yearLabel,
        fileName,
        dataUrl,
      }),
    });
  } catch {
    // auditoría best-effort: fallo de red no afecta al usuario
  }
}

/** Genera el PDF. mode "preview" lo abre en pestaña nueva; "download" lo descarga. */
export async function generateGradeSheet(
  input: GradeSheetGeneratorInput,
  opts: GradeSheetOptions,
  mode: "preview" | "download"
): Promise<void> {
  // 1) crea en BD las actividades que falten para los totales configurados
  const activitiesByConcept = await ensureActivitiesForTotals(input, opts);
  // 2) arma el payload con el catálogo actualizado
  const payload = await buildGradeSheetPayload({ ...input, activitiesByConcept }, opts);
  if (payload.concepts.length === 0) throw new Error("Selecciona al menos un concepto");
  const doc = await buildGradeSheet(payload);
  const fileName = gradeSheetFileName(input.groupName, input.periodName);
  if (mode === "preview") {
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
  } else {
    doc.save(fileName);
  }
  void archiveForAudit(input, opts, payload, fileName, doc.output("dataurlstring"));
}
