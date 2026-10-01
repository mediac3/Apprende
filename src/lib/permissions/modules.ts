// [F1] Catálogo de módulos del panel + defaults de permisos por rol.
//
// Los `defaultRoles` se copian 1:1 de los arrays `roles` históricos del NAV
// (src/components/panel/institutional-panel.tsx) para que la matriz efectiva
// SIN filas explícitas en RolePermission reproduzca el comportamiento actual
// (cero regresión). Un array vacío = visible para todos los roles.
//
// Reglas:
// - El rol ADMIN_ROLE (`administrador`) siempre tiene todo: bypass en server
//   y fila bloqueada (todas las celdas marcadas y deshabilitadas) en la UI.
// - Los módulos personalizados (`custom:<id>`) NO van aquí: sus defaults
//   salen de visibleRolesJson / canCreateRolesJson / canEditRolesJson /
//   canDeleteRolesJson del modelo CustomModule (ver server.ts).

export const ADMIN_ROLE = "administrador";

export type PermAction = "canView" | "canCreate" | "canEdit" | "canDelete";

export interface ModuleDef {
  key: string;
  label: string;
  group: string;
  /** Códigos de rol con acceso histórico. Vacío = todos los roles. */
  defaultRoles: string[];
}

export const STATIC_MODULES: ModuleDef[] = [
  // General
  { key: "dashboard", label: "Inicio", group: "General", defaultRoles: [] },

  // Académico
  { key: "planeador", label: "Planeador de clases", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "notas", label: "Notas parciales", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "consolidado", label: "Consolidado anual", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "base-conocimientos", label: "Base de conocimientos", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", ADMIN_ROLE, "rector"] },
  { key: "gestion-actividades", label: "Gestión de Actividades", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "pre-informe", label: "Pre-Informe", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", "rector"] },
  { key: "talleres", label: "Banco de talleres", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador"] },
  { key: "e-learning", label: "E-Learning", group: "Académico", defaultRoles: ["docente", "estudiante", "acudiente"] },
  { key: "autoevaluacion", label: "Autoevaluación", group: "Académico", defaultRoles: ["docente", "estudiante"] },
  { key: "supervision", label: "Supervisión académica", group: "Académico", defaultRoles: ["coordinador", "rector"] },
  { key: "indicadores", label: "Informes académicos", group: "Académico", defaultRoles: ["docente", "director_grupo", "coordinador", "rector"] },

  // Convivencia
  { key: "asistencia", label: "Control de asistencia", group: "Convivencia", defaultRoles: ["docente", "director_grupo", "coordinador", "acudiente"] },
  { key: "direccion-grupo", label: "Dirección de grupo", group: "Convivencia", defaultRoles: ["director_grupo", "coordinador"] },
  { key: "observador", label: "Ficha del observador", group: "Convivencia", defaultRoles: ["docente", "director_grupo", "orientador", "coordinador", "rector"] },
  { key: "convivencia", label: "Convivencia escolar", group: "Convivencia", defaultRoles: ["director_grupo", "orientador", "coordinador", "rector"] },
  { key: "orientacion", label: "Orientación escolar", group: "Convivencia", defaultRoles: ["orientador", "coordinador", "rector"] },
  { key: "notas-acudientes", label: "Notas para acudientes", group: "Convivencia", defaultRoles: ["director_grupo", "acudiente"] },
  { key: "sms", label: "Comunicación SMS", group: "Convivencia", defaultRoles: ["director_grupo", "coordinador", "rector", ADMIN_ROLE] },

  // Comunidad
  { key: "comunidad", label: "Comunidad (Feed)", group: "Comunidad", defaultRoles: [] },
  { key: "mensajeria", label: "Mensajería directa", group: "Comunidad", defaultRoles: [] },
  { key: "gobierno-escolar", label: "Gobierno escolar", group: "Comunidad", defaultRoles: ["rector", "coordinador", ADMIN_ROLE, "estudiante", "acudiente", "docente"] },
  { key: "inscripcion", label: "Inscripción en línea", group: "Comunidad", defaultRoles: [ADMIN_ROLE, "rector", "acudiente"] },
  { key: "pre-matricula", label: "Pre-Matrícula", group: "Comunidad", defaultRoles: [ADMIN_ROLE, "rector", "acudiente"] },

  // Administración
  { key: "usuarios", label: "Usuarios", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "gestion-grupos", label: "Gestión de Grupos", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "gestion-estudiantes", label: "Gestión de Estudiantes", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "importar-estudiantes", label: "Importar estudiantes", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "modelos-educativos", label: "Modelos educativos", group: "Administración", defaultRoles: ["rector", "coordinador", ADMIN_ROLE] },
  { key: "conceptos-evaluativos", label: "Conceptos evaluativos", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "libros", label: "Libros reglamentarios", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE, "coordinador"] },
  { key: "actas", label: "Actas institucionales", group: "Administración", defaultRoles: ["rector", "coordinador", ADMIN_ROLE] },
  { key: "matricula", label: "Matrícula", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "promocion", label: "Promoción de grado", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "asignacion", label: "Asignación académica", group: "Administración", defaultRoles: ["rector", "coordinador", ADMIN_ROLE] },
  { key: "periodos", label: "Periodos académicos", group: "Administración", defaultRoles: ["rector", "coordinador", ADMIN_ROLE] },
  { key: "talento-humano", label: "Talento Humano", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "auditoria", label: "Auditoría", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "configuracion", label: "Configuración", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "opciones-tema", label: "Opciones de tema", group: "Administración", defaultRoles: ["rector", ADMIN_ROLE] },

  // Constructor
  { key: "custom-module-builder", label: "Constructor de módulos", group: "Constructor", defaultRoles: [ADMIN_ROLE] },
  { key: "module-approvals", label: "Aprobar módulos", group: "Constructor", defaultRoles: ["rector"] },

  // Parámetros del sistema (PDF)
  { key: "param-academic-years", label: "Años académicos", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-institution", label: "Institución", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-subjects", label: "Asignaturas", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-curriculum-plans", label: "Plan de estudios", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-evaluation-scales", label: "Escalas valorativas", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-indicator-adjectives", label: "Adjetivos indicadores", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-branches", label: "Sedes", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-journeys", label: "Jornadas", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-report-templates", label: "Plantillas de reportes", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-report-variables", label: "Variables de reporte", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-promocion", label: "Promoción escolar", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
  { key: "param-ai", label: "Inteligencia artificial", group: "Parámetros", defaultRoles: ["rector", ADMIN_ROLE] },
];

/** Prefijo de moduleKey para módulos personalizados publicados. */
export const CUSTOM_PREFIX = "custom:";

export function isCustomKey(moduleKey: string): boolean {
  return moduleKey.startsWith(CUSTOM_PREFIX);
}

/** ¿Tiene el rol (por código) acceso de visualización histórico al módulo? */
export function defaultCanView(def: ModuleDef, roleCodes: string[]): boolean {
  if (def.defaultRoles.length === 0) return true;
  return def.defaultRoles.some((r) => roleCodes.includes(r));
}
