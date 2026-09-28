// Matching difuso de estudiantes: tolera tildes, orden invertido y errores de dictado.
// Implementación propia (decisión: sin fuse.js).
import type { ChatStudent } from "./types";
import { FUZZY_THRESHOLD, normalizeText, similarity } from "./synonyms";

export function studentFullName(s: ChatStudent): string {
  return normalizeText(
    [s.firstName, s.firstName2, s.lastName, s.lastName2].filter(Boolean).join(" ")
  ).trim();
}

// Nombre con el casing original de la BD (para mostrar en el chat).
export function studentDisplayName(s: ChatStudent): string {
  return [s.firstName, s.firstName2, s.lastName, s.lastName2].filter(Boolean).join(" ").trim();
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
    const sTokens = full.split(" ");
    let score = 0;

    // Contención con borde de palabra (nombre completo o parcial).
    if (full === q) score = 1;
    else if (new RegExp(`\\b${q}\\b`).test(full) || new RegExp(`\\b${full}\\b`).test(q)) {
      score = 0.95;
    } else {
      // Solapamiento exacto de tokens (tolera orden invertido: "moreno juan carlos").
      const sTokenSet = new Set(sTokens);
      const exactOverlap = qTokens.filter((t) => sTokenSet.has(t)).length / qTokens.length;
      // Fuzzy por token (errores de dictado: "juan carlo moreno" → "carlo"≈"carlos").
      // El fuzzy de string completo es demasiado permisivo en nombres largos.
      let fuzzyHits = 0;
      for (const qt of qTokens) {
        const best = Math.max(...sTokens.map((st) => similarity(qt, st)));
        if (best >= 0.75) fuzzyHits += 1;
      }
      const fuzzyRatio = fuzzyHits / qTokens.length;
      score = Math.max(exactOverlap, fuzzyRatio);
    }
    return { student: s, score };
  });

  const hits = scored
    .filter((x) => x.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (hits.length === 0) {
    // Sugerencia: mayor score; a igualdad, match exacto del apellido (último token);
    // a igualdad, similitud global.
    const lastToken = qTokens[qTokens.length - 1];
    const best = scored.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
      const aExact = studentFullName(a.student).split(" ").includes(lastToken) ? 1 : 0;
      const bExact = studentFullName(b.student).split(" ").includes(lastToken) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return similarity(q, studentFullName(b.student)) - similarity(q, studentFullName(a.student));
    })[0];
    return { matches: [], best: best?.student ?? null, score: best?.score ?? 0 };
  }
  return { matches: hits.map((x) => x.student), best: hits[0].student, score: hits[0].score };
}
