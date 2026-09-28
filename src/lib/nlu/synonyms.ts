// Diccionario de sinónimos y utilidades de normalización del parser NLU.
// Sin dependencias externas: normalización, Levenshtein y vocabulario es-CO.

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[¿?¡!.,;:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

// Similitud 0..1 (1 = idénticos).
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

// Umbral de similitud para matching difuso (decisión: implementación propia).
export const FUZZY_THRESHOLD = 0.7;

// Verbos que indican escritura de nota (ya normalizados, sin tildes).
export const SET_GRADE_VERBS = [
  "pon", "ponle", "ponga", "asigna", "asigne", "registra", "registre",
  "coloca", "coloque", "califica", "califique", "anota", "anote",
  "guarda", "guarde", "ponle nota",
];

// Verbos de consulta de notas de un estudiante.
export const QUERY_VERBS = [
  "muestra", "muestrame", "mostrar", "ver", "consulta", "consulte",
  "dame", "lista", "listame", "cuales son", "que notas tiene", "como va",
];

// Marcadores de consulta agregada ("cuantos estudiantes tienen nota menor a 3.0").
export const AGGREGATE_MARKERS = [
  "cuantos", "cuantas", "menor a", "menores a", "menor que", "menores que",
  "mayor a", "mayores a", "mayor que", "mayores que", "promedio",
];

// Marcadores de target "todos los estudiantes".
export const ALL_STUDENTS_MARKERS = [
  "todos", "todo el grupo", "toda la clase", "todos los estudiantes",
  "todos los alumnos", "grupo completo", "todos en",
];

// Números en palabras → dígitos ("cuatro punto siete" → "4.7").
export const NUMBER_WORDS: Record<string, string> = {
  cero: "0", uno: "1", una: "1", dos: "2", tres: "3",
  cuatro: "4", cinco: "5",
};

// Ordinales para actividades ("la tercera actividad" → order 3).
export const ORDINAL_WORDS: Record<string, number> = {
  primera: 1, primero: 1, segunda: 2, segundo: 2, tercer: 3, tercera: 3,
  tercero: 3, cuarta: 4, cuarto: 4, quinta: 5, quinto: 5, sexta: 6,
  septima: 7, octava: 8, novena: 9, decima: 10,
};

// Reemplaza números en palabras por dígitos antes de la extracción numérica.
export function wordsToDigits(text: string): string {
  return text
    .replace(
      /\b(cero|uno|una|dos|tres|cuatro|cinco)\s+(punto|coma)\s+(cero|uno|una|dos|tres|cuatro|cinco)\b/g,
      (_m, a: string, _sep: string, c: string) => `${NUMBER_WORDS[a]}.${NUMBER_WORDS[c]}`
    )
    .replace(/\b(cero|uno|una|dos|tres|cuatro|cinco)\b/g, (m) => NUMBER_WORDS[m] ?? m);
}
