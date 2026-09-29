// [F2] Normalización del texto OCR de una celda → nota 0.0–5.0.
// Reglas aprobadas: punto o coma como separador; entero >5 y <50 → ÷10 ("47"→4.7);
// fuera de rango tras normalizar → error (celda bloqueada para revisión manual).
// Celda vacía → value null (no se registra nada).

export interface NormalizedGrade {
  ok: boolean;
  /** null = celda vacía (válido, no se registra); número = nota válida 0.0-5.0 */
  value: number | null;
  /** motivo del rechazo (para la UI del wizard) */
  reason?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizeOcrText(raw: string): NormalizedGrade {
  if (!raw) return { ok: true, value: null };
  let t = raw.trim().replace(/\s+/g, "");
  if (!t) return { ok: true, value: null };

  // Separadores: coma → punto; descartar todo lo que no sea dígito o punto.
  t = t.replace(/,/g, ".");
  t = t.replace(/[^0-9.]/g, "");
  if (!t) return { ok: false, value: null, reason: `Texto no numérico: "${raw.trim()}"` };

  // Puntos múltiples: conservar solo el primero ("4.7.1" → "4.71" no; → "4.7"?).
  const firstDot = t.indexOf(".");
  if (firstDot !== -1) {
    t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, "");
  }
  if (t === "." || t === "") return { ok: true, value: null };

  const v = Number.parseFloat(t);
  if (Number.isNaN(v)) return { ok: false, value: null, reason: `No parseable: "${raw.trim()}"` };

  if (v >= 0 && v <= 5) return { ok: true, value: round1(v) };
  if (v > 5 && v <= 50) {
    const d = round1(v / 10);
    if (d >= 0 && d <= 5) return { ok: true, value: d };
  }
  return { ok: false, value: null, reason: `Fuera de rango 0.0–5.0: "${raw.trim()}"` };
}
