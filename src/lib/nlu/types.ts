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
};

export type ParsedCommand = {
  action: ChatAction;
  value: number | null;
  target: CommandTarget;
  scope: CommandScope;
  raw: string;
  error: string | null;
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
