import type { jsPDF } from "jspdf";

// [F1] Generador de planillas imprimibles con celdas guía de puntos grises.
// Layout: Estudiante × Concepto (Def + N1..N10) + PROM, landscape A4/Carta.
// Celda guía: 5 puntos #B0B0B0 (4 esquinas + centro) según boceto, espacio para 1-3 dígitos.
// Patrón jsPDF dinámico tomado de src/components/panel/views/consolidado/use-consolidado.ts:378.

// Gris guía (regla dura: #B0B0B0, no interfiere con la escritura).
const GUIDE_DOT_RGB: [number, number, number] = [176, 176, 176];
const GUIDE_DOT_RADIUS_MM = 0.42;
const GUIDE_DOT_INSET_MM = 1.35;
const BODY_ROW_MIN_HEIGHT_MM = 7.2; // espacio para escribir 1-3 dígitos a mano

export interface GradeSheetHeaderInfo {
  institutionName: string;
  logoDataUrl?: string | null;
  teacher: string;
  journey: string;
  period: string;
  group: string;
  generatedAtLabel: string; // ej. "2026-09-29 15:50"
  qrDataUrl?: string | null; // opcional en FASE 3; se llena con `qrcode` en FASE 4
}

export interface GradeSheetConcept {
  id: string;
  name: string;
}

export interface GradeSheetActivity {
  id: string;
  label: string; // "N1".."N10"
}

export interface GradeSheetStudent {
  id: string;
  name: string;
}

export interface GradeSheetPayload {
  header: GradeSheetHeaderInfo;
  concepts: GradeSheetConcept[];
  activities: GradeSheetActivity[]; // 1..10 según filtro "solo creadas"
  students: GradeSheetStudent[];
  size: "a4" | "letter";
  includeProm: boolean;
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

// 5 puntos guía estilo "dado 5": 4 esquinas + centro (boceto adjunto).
function drawGuideDots(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  const r = GUIDE_DOT_RADIUS_MM;
  const inset = GUIDE_DOT_INSET_MM;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points: Array<[number, number]> = [
    [x + inset, y + inset],
    [x + w - inset, y + inset],
    [cx, cy],
    [x + inset, y + h - inset],
    [x + w - inset, y + h - inset],
  ];
  doc.setFillColor(...GUIDE_DOT_RGB);
  for (const [px, py] of points) doc.circle(px, py, r, "F");
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

  // Columnas: [# , Estudiante] + por concepto [Def, N1..N10] + [PROM]
  // Índice 0=#, 1=Estudiante; por concepto c*nAct+2..; PROM=última.
  const nAct = Math.max(payload.activities.length, 1);
  payload.concepts.forEach((_, ci) => {
    const start = 2 + ci * nAct;
    for (let k = 0; k < nAct; k++) ctx.guideColumnIndexes.add(start + k);
  });
  const promIndex = 2 + payload.concepts.length * nAct;
  if (payload.includeProm) ctx.guideColumnIndexes.add(promIndex);

  const head: Array<Array<Record<string, unknown>>> = [
    [
      { content: "#", rowSpan: 2 },
      { content: "Estudiante", rowSpan: 2 },
      ...payload.concepts.map((c) => ({ content: c.name, colSpan: nAct, styles: { halign: "center" } })),
      ...(payload.includeProm ? [{ content: "PROM", rowSpan: 2 }] : []),
    ],
    [
      ...payload.concepts.flatMap(() => [
        { content: "Def", styles: { halign: "center" } },
        ...payload.activities.map((a) => ({ content: a.label, styles: { halign: "center" } })),
      ]),
    ],
  ];

  const body: Array<Array<string | number>> = payload.students.map((s, i) => {
    const row: Array<string | number> = [i + 1, s.name];
    for (let c = 0; c < payload.concepts.length * nAct; c++) row.push("");
    if (payload.includeProm) row.push("");
    return row;
  });

  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: 7, halign: "center" },
    1: { cellWidth: 36, halign: "left", fontStyle: "bold" },
  };
  payload.concepts.forEach((_, ci) => {
    const start = 2 + ci * nAct;
    for (let k = 0; k < nAct; k++) columnStyles[start + k] = { cellWidth: 9, halign: "center" };
  });
  if (payload.includeProm) columnStyles[promIndex] = { cellWidth: 10, halign: "center" };

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
