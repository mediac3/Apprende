import type { jsPDF } from "jspdf";

// [F1] Generador de planillas imprimibles con celdas guía de puntos grises.
// Layout: Estudiante × Concepto (Def + actividades del concepto) + PROM, landscape A4/Carta.
// Celda guía: 5 puntos #B0B0B0 (4 esquinas + centro) según boceto, espacio para 1-3 dígitos.
// Patrón jsPDF dinámico tomado de src/components/panel/views/consolidado/use-consolidado.ts:378.

// Gris guía (regla dura: #B0B0B0, claramente más tenue que la tinta del docente;
// en el pipeline ICR se eliminan por umbral antes del reconocimiento).
const GUIDE_DOT_RGB: [number, number, number] = [176, 176, 176];
const GUIDE_DOT_RADIUS_MM = 0.25;
const GUIDE_DOT_INSET_MM = 1.3;
const GUIDE_DOT_COLS = 5; // 5 puntos horizontales
const GUIDE_DOT_ROWS = 3; // 3 puntos verticales (5×3 según ejemplo del usuario)
const BODY_ROW_MIN_HEIGHT_MM = 7.2; // espacio para escribir 1-3 dígitos a mano

export interface GradeSheetHeaderInfo {
  institutionName: string;
  logoDataUrl?: string | null;
  teacher: string;
  journey: string;
  period: string;
  group: string;
  generatedAtLabel: string; // ej. "2026-09-29 15:50"
  qrDataUrl?: string | null; // {v,inst,group,subj,period,year} — lo lee el scanner [F2]
}

export interface GradeSheetConceptActivity {
  /** id de la actividad en BD (GradeRecord.activityId); null → celda solo papel (modo hasta N10) */
  id: string | null;
  label: string; // "N1".."N10"
}

export interface GradeSheetConcept {
  id: string;
  name: string;
  /** Actividades del concepto en orden; en modo "hasta N10" viene relleno a 10 con id null. */
  activities: GradeSheetConceptActivity[];
}

export interface GradeSheetStudent {
  id: string;
  name: string;
}

export interface GradeSheetPayload {
  header: GradeSheetHeaderInfo;
  concepts: GradeSheetConcept[];
  students: GradeSheetStudent[];
  size: "a4" | "letter";
  includeProm: boolean;
}

/** Convierte el bloque de un concepto a columnas fijas N1..N10 (id null en las vacías). */
export function padConceptToN10(concept: GradeSheetConcept): GradeSheetConcept {
  const activities = [...concept.activities];
  while (activities.length < 10) activities.push({ id: null, label: `N${activities.length + 1}` });
  return { ...concept, activities: activities.slice(0, Math.max(10, concept.activities.length)) };
}

interface BuildContext {
  payload: GradeSheetPayload;
  guideColumnIndexes: Set<number>;
}

function drawPageHeader(doc: jsPDF, ctx: BuildContext): number {
  const { header } = ctx.payload;
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 10;
  let y = 12;

  // Logo (opcional) + nombre de institución
  if (header.logoDataUrl) {
    try {
      doc.addImage(header.logoDataUrl, "PNG", left, y - 5, 12, 12);
    } catch {
      // logo inválido: no bloquea la generación
    }
  }
  const nameX = header.logoDataUrl ? left + 15 : left;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(header.institutionName, nameX, y + 1);
  y += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Docente: ${header.teacher}   ·   Jornada: ${header.journey}   ·   Periodo: ${header.period}   ·   Grupo: ${header.group}`,
    nameX,
    y
  );
  y += 4;

  // QR identificador (arriba a la derecha) + fecha de generación bajo el QR
  if (header.qrDataUrl) {
    try {
      doc.addImage(header.qrDataUrl, "PNG", pageWidth - 26, 7, 16, 16);
    } catch {
      // QR inválido: no bloquea la generación
    }
  }
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generado el ${header.generatedAtLabel}`, pageWidth - 10, y + 1, { align: "right" });
  doc.setTextColor(0, 0, 0);

  return y + 4; // startY de la tabla
}

// Rejilla guía 5×3 (15 puntos, estilo del boceto del usuario): puntos pequeños
// y claros que delimitan la zona de escritura sin confundirse con la tinta.
function drawGuideDots(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  const r = GUIDE_DOT_RADIUS_MM;
  const inset = GUIDE_DOT_INSET_MM;
  const spanX = w - inset * 2;
  const spanY = h - inset * 2;
  doc.setFillColor(...GUIDE_DOT_RGB);
  for (let row = 0; row < GUIDE_DOT_ROWS; row++) {
    const py = spanY === 0 ? y + inset : y + inset + (spanY * row) / (GUIDE_DOT_ROWS - 1);
    for (let col = 0; col < GUIDE_DOT_COLS; col++) {
      const px = spanX === 0 ? x + inset : x + inset + (spanX * col) / (GUIDE_DOT_COLS - 1);
      doc.circle(px, py, r, "F");
    }
  }
}

export async function buildGradeSheet(payload: GradeSheetPayload): Promise<jsPDF> {
  const [{ jsPDF: JsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: payload.size });

  const ctx: BuildContext = { payload, guideColumnIndexes: new Set<number>() };
  const headerStartY = drawPageHeader(doc, ctx);

  // Columnas: [#(0), Estudiante(1)] + por concepto [Def, act1..actN] + [PROM]
  const head: Array<Array<Record<string, unknown>>> = [
    [
      { content: "#", rowSpan: 2 },
      { content: "Estudiante", rowSpan: 2 },
      ...payload.concepts.map((c) => ({
        content: c.name,
        colSpan: 1 + c.activities.length,
        styles: { halign: "center" },
      })),
      ...(payload.includeProm ? [{ content: "PROM", rowSpan: 2 }] : []),
    ],
    [
      ...payload.concepts.flatMap((c) => [
        { content: "Def", styles: { halign: "center" } },
        ...c.activities.map((a) => ({ content: a.label, styles: { halign: "center" } })),
      ]),
    ],
  ];

  const body: Array<Array<string | number>> = payload.students.map((s, i) => {
    const row: Array<string | number> = [i + 1, s.name];
    for (const c of payload.concepts) {
      for (let k = 0; k < c.activities.length + 1; k++) row.push("");
    }
    if (payload.includeProm) row.push("");
    return row;
  });

  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: 7, halign: "center" },
    1: { cellWidth: 36, halign: "left", fontStyle: "bold" },
  };
  let cursor = 2;
  for (const c of payload.concepts) {
    columnStyles[cursor] = { cellWidth: 8, halign: "center" }; // Def (también celda guía)
    ctx.guideColumnIndexes.add(cursor);
    cursor += 1;
    for (let k = 0; k < c.activities.length; k++) {
      ctx.guideColumnIndexes.add(cursor);
      columnStyles[cursor] = { cellWidth: 9, halign: "center" }; // nota
      cursor += 1;
    }
  }
  const promIndex = cursor;
  if (payload.includeProm) {
    ctx.guideColumnIndexes.add(promIndex);
    columnStyles[promIndex] = { cellWidth: 10, halign: "center" };
  }

  autoTable(doc, {
    head,
    body,
    startY: headerStartY,
    margin: { top: headerStartY, left: 8, right: 8, bottom: 10 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 0.9,
      lineColor: [40, 40, 40],
      lineWidth: 0.15,
      fillColor: [255, 255, 255],
      minCellHeight: BODY_ROW_MIN_HEIGHT_MM,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 6.5,
      minCellHeight: 5,
      lineColor: [40, 40, 40],
    },
    columnStyles,
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1],
    didDrawPage: () => {
      // Página 1 ya tiene el header (dibujado antes de autoTable para calcular startY);
      // en páginas siguientes (vertical u horizontalPageBreak) se redibuja en el margen superior.
      if (doc.getCurrentPageInfo().pageNumber > 1) drawPageHeader(doc, ctx);
    },
    didDrawCell: (data) => {
      if (
        data.section === "body" &&
        ctx.guideColumnIndexes.has(data.column.index) &&
        data.cell.width > 0
      ) {
        drawGuideDots(doc, data.cell.x, data.cell.y, data.cell.width, data.cell.height);
      }
    },
  });

  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generado el ${payload.header.generatedAtLabel}  ·  Planilla de notas  ·  Página ${p}/${pageCount}`,
      w - 8,
      h - 4,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}
