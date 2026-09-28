// Matching de actividades: por orden ("Actividad 3", "N3", "la tercera actividad")
// o por nombre/label ("Demo").
import type { ChatActivity } from "./types";
import { normalizeText, ORDINAL_WORDS } from "./synonyms";

export type ActivityMatch = {
  candidates: ChatActivity[]; // 1 → resuelta; >1 → ambigua (chips)
  requested: string | null; // descripción de lo pedido ("orden 3", "demo")
  matchedBy: "order" | "name" | null;
};

// Extrae la referencia numérica de actividad del texto normalizado, o null.
export function extractActivityRef(normalizedInput: string): string | null {
  let m = normalizedInput.match(/\bactividad\s+(?:n[°º]?\s*)?(\d{1,2})\b/);
  if (m) return m[1];
  m = normalizedInput.match(/\bn[°º]\s*(\d{1,2})\b/); // "n°3", "n° 3"
  if (m) return m[1];
  m = normalizedInput.match(/\bn(\d{1,2})\b/); // "n3"
  if (m) return m[1];
  m =
    normalizedInput.match(/\b(\w+)\s+actividad\b/) ||
    normalizedInput.match(/\bactividad\s+(\w+)\b/);
  if (m && ORDINAL_WORDS[m[1]]) return String(ORDINAL_WORDS[m[1]]);
  return null;
}

// Busca match por nombre/label con borde de palabra.
function findByName(input: string, activities: ChatActivity[]): ChatActivity[] {
  const hits: ChatActivity[] = [];
  for (const a of activities) {
    for (const text of [a.label ?? "", a.name]) {
      const norm = normalizeText(text);
      if (norm.length >= 3 && new RegExp(`\\b${norm}\\b`).test(input)) {
        hits.push(a);
        break;
      }
    }
  }
  return hits;
}

export function resolveActivity(
  normalizedInput: string,
  activities: ChatActivity[],
  componentId: string | null
): ActivityMatch {
  const ref = extractActivityRef(normalizedInput);
  if (ref) {
    const n = Number(ref);
    // Primero dentro del componente mencionado; si no hay, global.
    let cands = activities.filter(
      (a) => a.order === n && (componentId ? a.conceptId === componentId : true)
    );
    let matchedBy: "order" | "name" | null = cands.length ? "order" : null;
    if (cands.length === 0) {
      // Fallback global: puede traer ambigüedad entre componentes (N3 de Ser y de Saber).
      cands = activities.filter((a) => a.order === n);
      matchedBy = cands.length ? "order" : null;
    }
    return { candidates: cands, requested: `orden ${n}`, matchedBy };
  }
  const byName = findByName(normalizedInput, activities);
  return {
    candidates: byName,
    requested: byName.length ? byName[0].label ?? byName[0].name : null,
    matchedBy: byName.length ? "name" : null,
  };
}
