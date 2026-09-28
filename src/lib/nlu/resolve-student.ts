// Matching difuso de estudiantes: tolera tildes, orden invertido y errores de dictado.
// Implementación propia (decisión: sin fuse.js).
import type { ChatStudent } from "./types";
import { FUZZY_THRESHOLD, normalizeText, similarity } from "./synonyms";

export function studentFullName(s: ChatStudent): string {
  return normalizeText(
    [s.firstName, s.firstName2, s.lastName, s.lastName2].filter(Boolean).join(" ")
  ).trim();
}

export type StudentMatch = {
  matches: ChatStudent[]; // 1 → único; >1 → ambiguo (chips)
  best: ChatStudent | null; // sugerencia cuando no hubo match
  score: number;
};

export function resolveStudent(rawQuery: string, students: ChatStudent[]): StudentMatch {
  const q = normalizeText(rawQuery);
  if (!q) return { matches: [], best: null, score: 0 };
  const qTokens = q.split(" ");

  const scored = students.map((s) => {
    const full = studentFullName(s);
    const sTokens = new Set(full.split(" "));
    let score = 0;

    // Contención con borde de palabra (nombre completo o parcial).
    if (full === q) score = 1;
    else if (new RegExp(`\\b${q}\\b`).test(full) || new RegExp(`\\b${full}\\b`).test(q)) {
      score = 0.95;
    } else {
      // Solapamiento de tokens (tolera orden invertido: "moreno juan carlos").
      const overlap = qTokens.filter((t) => sTokens.has(t)).length / qTokens.length;
      // Fuzzy global (errores de dictado: "juan carlo moreno").
      const lev = similarity(q, full);
      score = Math.max(overlap, lev);
    }
    return { student: s, score };
  });

  const hits = scored
    .filter((x) => x.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (hits.length === 0) {
    const best = scored.sort((a, b) => b.score - a.score)[0];
    return { matches: [], best: best?.student ?? null, score: best?.score ?? 0 };
  }
  return { matches: hits.map((x) => x.student), best: hits[0].student, score: hits[0].score };
}
