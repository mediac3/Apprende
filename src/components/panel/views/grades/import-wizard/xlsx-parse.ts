// Parser del wizard de importación (Excel → actividades/notas/asistencias).
// Reglas de negocio (decididas con el usuario):
//   - Número 0-5          → nota (GradeRecord)
//   - Serial Excel (>20000) → ASISTENCIA "presente" en esa fecha
//   - X / F → ausente · E → excusa · T → tarde (fecha del encabezado de la columna)
//   - T(3.5)              → tarde + nota 3.5
//   - Vacío               → se ignora
import * as XLSX from "xlsx";

export const EPOCH_MS = Date.UTC(1899, 11, 30); // época del serial Excel (1900 system)

export function serialToIso(n: number): string {
  return new Date(EPOCH_MS + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

export function normalizeIsoDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const y = Number(iso.slice(0, 4));
  if (y < 2000 || y > 2100) return null;
  return iso;
}

// "Ser - Portafolio de aprendizaje - 17/09/2026" → { concept, name, dateIso }
export function parseHeaderCell(
  raw: string
): { concept: string; name: string; dateIso: string | null } | null {
  const parts = String(raw)
    .split(/\s+-\s+/) // separador " - " (con espacios) para no romper nombres con guiones
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  let dateIso: string | null = null;
  const last = parts[parts.length - 1];
  const m = last.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    dateIso = normalizeIsoDate(`${m[3]}-${mm}-${dd}`);
    if (!dateIso) return null;
    parts.pop();
  }
  const concept = parts[0];
  const name = parts.slice(1).join(" - ");
  if (!concept || !name) return null;
  return { concept, name, dateIso };
}

export type ImportCell =
  | { kind: "empty" }
  | { kind: "grade"; value: number }
  | { kind: "present"; dateIso: string }
  | { kind: "attendance"; status: "ausente" | "excusa" | "tarde"; dateIso: string | null }
  | { kind: "late_with_grade"; grade: number; dateIso: string | null }
  | { kind: "invalid"; raw: string; reason: string };

export type ImportColumn = {
  raw: string;
  concept: string;
  activityName: string;
  dateIso: string | null;
};

export type ImportRow = { name: string; cells: ImportCell[] };

export type ParsedSheet = {
  columns: ImportColumn[];
  rows: ImportRow[];
  errors: string[];
};

function parseCell(value: unknown, colDateIso: string | null): ImportCell {
  if (value === "" || value === null || value === undefined) return { kind: "empty" };
  if (typeof value === "number") {
    if (Number.isFinite(value) && value >= 0 && value <= 5) return { kind: "grade", value };
    if (Number.isFinite(value) && value >= 20000 && value <= 80000) {
      const dateIso = normalizeIsoDate(serialToIso(value));
      if (dateIso) return { kind: "present", dateIso };
    }
    return {
      kind: "invalid",
      raw: String(value),
      reason: "Número fuera de rango: espera nota 0–5 o fecha de Excel",
    };
  }
  const t = String(value).trim();
  if (!t) return { kind: "empty" };
  const up = t.toUpperCase();
  if (up === "X" || up === "F") return { kind: "attendance", status: "ausente", dateIso: colDateIso };
  if (up === "E") return { kind: "attendance", status: "excusa", dateIso: colDateIso };
  if (up === "T") return { kind: "attendance", status: "tarde", dateIso: colDateIso };
  const m = up.match(/^T\s*\(\s*([0-5](?:[.,]\d{1,2})?)\s*\)$/);
  if (m) {
    const grade = parseFloat(m[1].replace(",", "."));
    if (!isNaN(grade) && grade >= 0 && grade <= 5) {
      return { kind: "late_with_grade", grade, dateIso: colDateIso };
    }
    return { kind: "invalid", raw: t, reason: "T(nota): la nota debe estar entre 0.0 y 5.0" };
  }
  return {
    kind: "invalid",
    raw: t,
    reason: "Texto no reconocido: usa X, E, T, T(nota), una nota 0–5 o una fecha",
  };
}

// Lee la primera hoja del workbook y devuelve columnas/filas normalizadas.
export function parseImportWorkbook(data: ArrayBuffer): ParsedSheet {
  const errors: string[] = [];
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { columns: [], rows: [], errors: ["El archivo no tiene hojas."] };
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  if (rows.length < 2) {
    return { columns: [], rows: [], errors: ["La hoja no tiene filas de estudiantes."] };
  }

  const header = rows[0];
  const columns: ImportColumn[] = [];
  header.slice(1).forEach((raw, idx) => {
    const text = String(raw ?? "").trim();
    if (!text) {
      errors.push(`Columna ${idx + 2}: encabezado vacío, se ignora.`);
      columns.push({ raw: text, concept: "", activityName: "", dateIso: null });
      return;
    }
    const parsed = parseHeaderCell(text);
    if (!parsed) {
      errors.push(
        `Columna "${text}": formato inválido. Espera "Concepto - Actividad - dd/mm/aaaa".`
      );
      columns.push({ raw: text, concept: "", activityName: "", dateIso: null });
      return;
    }
    columns.push({
      raw: text,
      concept: parsed.concept,
      activityName: parsed.name,
      dateIso: parsed.dateIso,
    });
  });

  const importRows: ImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = String(row[0] ?? "").trim();
    if (!name) continue; // fila vacía
    const cells = columns.map((_, c) => parseCell(row[c + 1], columns[c]?.dateIso ?? null));
    importRows.push({ name, cells });
  }
  if (importRows.length === 0) errors.push("No se encontraron estudiantes (columna A vacía).");
  return { columns, rows: importRows, errors };
}

// Resumen de celdas para el preview del wizard.
export function summarizeCells(rows: ImportRow[], columnCount: number) {
  let grades = 0, presente = 0, ausente = 0, excusa = 0, tarde = 0, tardeConNota = 0, empty = 0;
  const invalid: { student: string; column: number; raw: string; reason: string }[] = [];
  const noDateForAttendance: { student: string; column: number }[] = [];
  rows.forEach((r) => {
    r.cells.forEach((c, idx) => {
      if (idx >= columnCount) return;
      switch (c.kind) {
        case "grade": grades += 1; break;
        case "present": presente += 1; break;
        case "attendance":
          if (c.status === "ausente") ausente += 1;
          else if (c.status === "excusa") excusa += 1;
          else tarde += 1;
          if (!c.dateIso) noDateForAttendance.push({ student: r.name, column: idx });
          break;
        case "late_with_grade":
          tardeConNota += 1;
          if (!c.dateIso) noDateForAttendance.push({ student: r.name, column: idx });
          break;
        case "invalid": invalid.push({ student: r.name, column: idx, raw: c.raw, reason: c.reason }); break;
        default: empty += 1;
      }
    });
  });
  return { grades, presente, ausente, excusa, tarde, tardeConNota, empty, invalid, noDateForAttendance };
}
