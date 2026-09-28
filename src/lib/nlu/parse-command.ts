// Parser determinístico de comandos del asistente de notas (reglas + diccionario, sin LLM).
import type { ChatAction, ChatStudent, ParsedCommand, ParseContext } from "./types";
import {
  AGGREGATE_MARKERS,
  normalizeText,
  protectDecimals,
  QUERY_VERBS,
  SET_GRADE_VERBS,
  wordsToDigits,
  ALL_STUDENTS_MARKERS,
} from "./synonyms";
import { resolveComponent } from "./resolve-component";
import { resolveActivity } from "./resolve-activity";
import { resolveStudent, studentDisplayName, studentFullName } from "./resolve-student";

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|\\s)${token}(\\s|$)`).test(text);
}

function detectAction(text: string): ChatAction | null {
  if (AGGREGATE_MARKERS.some((m) => text.includes(m))) return "aggregate_query";
  if (QUERY_VERBS.some((v) => hasToken(text, v))) return "query_grades";
  if (SET_GRADE_VERBS.some((v) => hasToken(text, v))) return "set_grade";
  return null;
}

function detectComparator(text: string): "lt" | "gt" | "lte" | "gte" | null {
  if (/menor(?:es)?\s+(?:a|que)\b/.test(text)) return "lt";
  if (/mayor(?:es)?\s+(?:a|que)\b/.test(text)) return "gt";
  return null;
}

// Extrae el nombre de estudiante tras los marcadores "a / al / para".
function extractTargetName(text: string): string | null {
  const m = text.match(
    /(?:^|\s)(?:a|al|para)\s+(?:estudiante\s+)?(.+?)(?=\s+(?:en|del|de la|de|componente|actividad|asignatura|materia|periodo)\b|$)/
  );
  return m ? m[1].trim() : null;
}

function emptyCommand(raw: string): ParsedCommand {
  return {
    action: "set_grade",
    value: null,
    target: { type: "single_student", studentName: null, studentIds: [], ambiguous: [] },
    scope: {
      component: null,
      activity: null,
      subject: null,
      period: null,
      scopeLevel: "unknown",
    },
    raw,
    error: null,
    comparator: null,
  };
}

export function parseCommand(raw: string, ctx: ParseContext): ParsedCommand {
  const cmd = emptyCommand(raw);
  // Los decimales viajan como "4#7" para no perderse en la tokenización.
  const text = protectDecimals(wordsToDigits(normalizeText(raw)));

  const action = detectAction(text);
  if (!action) {
    cmd.error = "No entendí el comando. Prueba: \"Pon 4.5 a <estudiante> en la Actividad 1 de Ser\".";
    return cmd;
  }
  cmd.action = action;

  // --- Componente evaluativo (Ser / Saber / Hacer / ...) ---
  const compMatch = resolveComponent(text, ctx.concepts);
  const componentId = compMatch.concept?.id ?? null;
  cmd.scope.component = compMatch.concept?.name ?? null;
  if (!compMatch.concept && compMatch.suggestion && /\bcomponente\b/.test(text)) {
    cmd.error = `No encontré ese componente. ¿Quisiste decir "${compMatch.suggestion.name}"?`;
  }

  // --- Actividad ---
  const actMatch = resolveActivity(text, ctx.activities, componentId);
  if (actMatch.candidates.length === 1) {
    const a = actMatch.candidates[0];
    cmd.scope.activity = a.label ?? a.name;
    cmd.scope.scopeLevel = "specific_activity";
  } else if (actMatch.candidates.length > 1) {
    cmd.scope.activity = actMatch.requested;
    cmd.scope.ambiguousActivities = actMatch.candidates;
    cmd.scope.scopeLevel = "specific_activity";
    if (cmd.action === "set_grade" && !cmd.error) {
      cmd.error = `La actividad "${actMatch.requested}" coincide con ${actMatch.candidates.length} actividades. Especifica el componente.`;
    }
  }

  // --- Asignatura / periodo mencionados (informativo; la planilla ya está scoped) ---
  const periodMatch = text.match(
    /\bdel\s+(primer|primero|segundo|tercer|tercera|cuarto|cuarta)\s+periodo\b/
  );
  if (periodMatch) {
    cmd.scope.period =
      periodMatch[1].charAt(0).toUpperCase() + periodMatch[1].slice(1) + " periodo";
    const subjMatch = text.match(
      /\b(?:en|de)\s+([a-z]+)\s+del\s+(?:primer|primero|segundo|tercer|tercera|cuarto|cuarta)\s+periodo\b/
    );
    if (subjMatch && !ctx.concepts.some((c) => normalizeText(c.name) === subjMatch[1])) {
      cmd.scope.subject = subjMatch[1].charAt(0).toUpperCase() + subjMatch[1].slice(1);
    }
  }

  if (action === "aggregate_query") {
    cmd.comparator = detectComparator(text);
    // Umbral = primer número del texto (en aggregate no hay refs de actividad).
    const valueMatch = text.match(/\b(\d{1,2}(?:#\d{1,2})?)\b/);
    cmd.value = valueMatch ? parseFloat(valueMatch[1].replace("#", ".")) : null;
    if (cmd.value === null || !cmd.comparator) {
      cmd.error = "No entendí la consulta. Prueba: \"¿Cuántos estudiantes tienen nota menor a 3.0 en Saber?\"";
    }
    return cmd;
  }

  if (action === "query_grades") {
    const m = text.match(/\b(?:notas?|promedio|definitiva)\s+(?:de|del)\s+(?:estudiante\s+)?(.+)$/);
    const name = m ? m[1].trim() : null;
    if (!name) {
      cmd.error = "¿De qué estudiante? Prueba: \"Muestra las notas de Juan Carlos Moreno\".";
      return cmd;
    }
    const studentMatch = resolveStudent(name, ctx.students);
    cmd.target = {
      type: "single_student",
      studentName:
        studentMatch.matches.length === 1 ? studentDisplayName(studentMatch.matches[0]) : name,
      studentIds: studentMatch.matches.length === 1 ? [studentMatch.matches[0].id] : [],
      ambiguous: studentMatch.matches.length > 1 ? studentMatch.matches.map(studentOption) : [],
    };
    if (studentMatch.matches.length === 0) {
      cmd.error = studentMatch.best
        ? `No encontré a "${name}". ¿Quisiste decir "${studentDisplayName(studentMatch.best)}"?`
        : `No encontré al estudiante "${name}" en este grupo.`;
    }
    return cmd;
  }

  // --- set_grade ---
  // Valor: primero neutraliza la referencia de actividad para no confundirla con la nota.
  const actRef = text.match(/\bactividad\s+(?:n[°º]?\s*)?(\d{1,2})\b/) ||
    text.match(/\bn[°º]?\s*(\d{1,2})\b/) ||
    text.match(/\bn(\d{1,2})\b/);
  const valueSource = actRef ? text.replace(actRef[0], " ") : text;
  const valueMatch = valueSource.match(/\b(\d{1,2}(?:#\d{1,2})?)\b/);
  const value = valueMatch ? parseFloat(valueMatch[1].replace("#", ".")) : null;
  if (value === null) {
    cmd.error = "No detecté la nota. Prueba: \"Pon 4.7 a Juan Carlos Moreno en la Actividad 3 de Ser\".";
    return cmd;
  }
  if (value < 0 || value > 5) {
    cmd.error = `La nota ${value} está fuera del rango permitido (0.0 – 5.0).`;
    return cmd;
  }
  cmd.value = value;

  // Alcance sin actividad explícita: componente → todas sus actividades;
  // "todas las actividades" explícito o "todos los componentes".
  if (!cmd.scope.activity) {
    if (/\btodos los componentes\b/.test(text)) {
      cmd.scope.scopeLevel = "all_components";
      if (!cmd.scope.component) {
        cmd.error = "Indica el componente o la actividad (p.ej. \"en todas las actividades del componente Saber\").";
        return cmd;
      }
    } else if (cmd.scope.component || compMatch.concept) {
      cmd.scope.scopeLevel = "all_activities_of_component";
    } else if (cmd.scope.subject) {
      // Mención de asignatura distinta ("en Química del primer periodo"): la planilla
      // activa ya tiene asignatura/periodo; la UI pedirá precisar actividad o componente.
      cmd.scope.scopeLevel = "unknown";
    } else {
      cmd.error = "Indica el componente o la actividad (p.ej. \"en la Actividad 3 de Ser\" o \"en Hacer\").";
      return cmd;
    }
  }

  // Target: todos o un estudiante.
  if (ALL_STUDENTS_MARKERS.some((m) => hasToken(text, m) || text.includes(m))) {
    cmd.target = {
      type: "all_students",
      studentName: null,
      studentIds: ctx.students.map((s) => s.id),
      ambiguous: [],
    };
    if (cmd.target.studentIds.length === 0) {
      cmd.error = "No hay estudiantes matriculados en el grupo activo.";
    }
    return cmd;
  }

  const name = extractTargetName(text);
  if (!name) {
    cmd.error = "No detecté el estudiante. Prueba: \"Pon 4.7 a Juan Carlos Moreno en la Actividad 3 de Ser\".";
    return cmd;
  }
  const studentMatch = resolveStudent(name, ctx.students);
  cmd.target = {
    type: "single_student",
    studentName:
      studentMatch.matches.length === 1 ? studentDisplayName(studentMatch.matches[0]) : name,
    studentIds: studentMatch.matches.length === 1 ? [studentMatch.matches[0].id] : [],
    ambiguous: studentMatch.matches.length > 1 ? studentMatch.matches.map(studentOption) : [],
  };
  if (studentMatch.matches.length === 0) {
    cmd.error = studentMatch.best
      ? `No encontré a "${name}". ¿Quisiste decir "${studentDisplayName(studentMatch.best)}"?`
      : `No encontré al estudiante "${name}" en este grupo.`;
  }
  return cmd;
}

function studentOption(s: ChatStudent) {
  return {
    id: s.id,
    fullName: [s.firstName, s.firstName2, s.lastName, s.lastName2].filter(Boolean).join(" "),
  };
}
