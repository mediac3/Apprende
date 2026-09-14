import { create } from "zustand";

export type ModuleKey =
  | "dashboard"
  | "planeador"
  | "notas"
  | "pre-informe"
  | "talleres"
  | "e-learning"
  | "autoevaluacion"
  | "supervision"
  | "asistencia"
  | "direccion-grupo"
  | "observador"
  | "convivencia"
  | "orientacion"
  | "notas-acudientes"
  | "sms"
  | "gobierno-escolar"
  | "inscripcion"
  | "pre-matricula"
  | "libros"
  | "actas"
  | "matricula"
  | "asignacion"
  | "periodos"
  | "configuracion"
  | "talento-humano"
  | "usuarios"
  | "gestion-grupos"
  | "gestion-estudiantes"
  | "conceptos-evaluativos"
  | "modelos-educativos"
  | "auditoria"
  | "comunidad"
  | "mensajeria"
  | "mi-acudido"
  | "indicadores"
  // Constructor de módulos personalizados (rol admin)
  | "custom-module-builder"
  // Aprobación de módulos (rol rector)
  | "module-approvals"
  // Módulos de parámetros del sistema (PDF)
  | "param-academic-years"
  | "param-institution"
  | "param-subjects"
  | "param-curriculum-plans"
  | "param-evaluation-scales"
  | "param-indicator-adjectives"
  | "param-evaluation-models"
  | "param-institution"
  | "param-branches"
  | "param-journeys"
  | "param-report-templates"
  | "param-report-variables"
  // Módulos personalizados publicados — se usa el prefijo `custom:<moduleId>`
  | string; // permite cualquier string para soportar custom:<id>

interface UIState {
  activeModule: ModuleKey;
  setModule: (m: ModuleKey) => void;
  sidebarOpen: boolean;
  setSidebar: (open: boolean) => void;
  demoSheetOpen: boolean;
  setDemoSheet: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModule: "dashboard",
  setModule: (activeModule) => set({ activeModule, sidebarOpen: false }),
  sidebarOpen: false,
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  demoSheetOpen: false,
  setDemoSheet: (demoSheetOpen) => set({ demoSheetOpen }),
}));

// Helper para detectar módulos personalizados y extraer su ID
export function isCustomModule(key: string): boolean {
  return key.startsWith("custom:");
}

export function getCustomModuleId(key: string): string | null {
  if (!isCustomModule(key)) return null;
  return key.slice("custom:".length);
}

export function customModuleKey(moduleId: string): string {
  return `custom:${moduleId}`;
}
