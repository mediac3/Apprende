// Matching de conceptos evaluativos (Ser / Saber / Hacer / Autoevaluación).
import type { ChatConcept } from "./types";
import { FUZZY_THRESHOLD, normalizeText, similarity } from "./synonyms";

export type ComponentMatch = {
  concept: ChatConcept | null;
  ambiguous: ChatConcept[]; // >1 coincidencia directa
  suggestion: ChatConcept | null; // más cercano cuando no hubo match
};

export function resolveComponent(normalizedInput: string, concepts: ChatConcept[]): ComponentMatch {
  const normalized = concepts.map((c) => ({ ...c, norm: normalizeText(c.name) }));
  const words = new Set(normalizedInput.split(" "));

  // 1) Coincidencia exacta como palabra completa.
  const wordHits = normalized.filter((c) => words.has(c.norm));
  if (wordHits.length === 1) return { concept: wordHits[0], ambiguous: [], suggestion: null };
  if (wordHits.length > 1) return { concept: null, ambiguous: wordHits, suggestion: null };

  // 2) Coincidencia por subcadena con borde de palabra ("componente ser." / "del saber").
  const boundaryHits = normalized.filter((c) =>
    c.norm.length >= 3 && new RegExp(`\\b${c.norm}\\b`).test(normalizedInput)
  );
  if (boundaryHits.length === 1) return { concept: boundaryHits[0], ambiguous: [], suggestion: null };
  if (boundaryHits.length > 1) return { concept: null, ambiguous: boundaryHits, suggestion: null };

  // 3) Fuzzy por palabra (tolera errores de dictado), solo nombres >= 4 chars.
  let best: { concept: ChatConcept; score: number } | null = null;
  for (const c of normalized) {
    if (c.norm.length < 4) continue;
    for (const w of words) {
      if (w.length < 3) continue;
      const score = similarity(w, c.norm);
      if (!best || score > best.score) best = { concept: c, score };
    }
  }
  if (best && best.score >= FUZZY_THRESHOLD) {
    return { concept: best.concept, ambiguous: [], suggestion: null };
  }
  return { concept: null, ambiguous: [], suggestion: best && best.score >= 0.55 ? best.concept : null };
}
