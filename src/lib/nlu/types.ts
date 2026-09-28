// Tipos compartidos del NLU del asistente de notas (chat voz/texto).
// Solo tipos: sin lógica para poder importarlos desde cliente y servidor.

export type ChatAction =
  | "set_grade"
  | "query_grades"
  | "aggregate_query";

export type ScopeLevel =
  | "specific_activity"
  | "all_activities_of_component"
  | "all_components"
  | "unknown";

export type StudentOption = {
  id: string;
  fullName: string;
};

export type CommandTarget = {
  type: "single_student" | "all_students";
  studentName: string | null;
  studentIds: string[];
  // Candidatos cuando el nombre coincide con >1 estudiante.
  ambiguous: StudentOption[];
};

export type CommandScope = {
  component: string | null;
  activity: string | null;
  subject: string | null;
  period: string | null;
  scopeLevel: ScopeLevel;
  // Candidatos cuando "Actividad N" matchea >1 actividad (p.ej. N3 de Ser y de Saber).
  ambiguousActivities?: ChatActivity[];
};

export type ParsedCommand = {
  action: ChatAction;
  value: number | null;
  target: CommandTarget;
  scope: CommandScope;
  raw: string;
  error: string | null;
  // Solo para aggregate_query: comparador y umbral ("menor a 3.0" → lt 3.0).
  comparator?: "lt" | "gt" | "lte" | "gte" | null;
};

// Datos que alimenta el grid activo al parser (estructuras del módulo Calificaciones).
export type ChatStudent = {
  id: string;
  firstName: string;
  firstName2?: string | null;
  lastName: string;
  lastName2?: string | null;
};

export type ChatActivity = {
  id: string;
  name: string;
  label?: string | null;
  conceptId: string;
  isGeneral: boolean;
  order: number;
};

export type ChatConcept = { id: string; name: string };

export type ParseContext = {
  students: ChatStudent[];
  activities: ChatActivity[];
  concepts: ChatConcept[];
};

// Un cambio de nota celda a celda, con snapshot previo para undo.
export type GradeChange = {
  studentId: string;
  activityId: string;
  before: number | null;
  after: number;
};

export type ApplyChangesResult = {
  success: boolean;
  updated?: number;
  changes?: GradeChange[];
  error?: string;
};
