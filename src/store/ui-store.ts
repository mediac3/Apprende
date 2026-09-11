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
  | "auditoria"
  | "comunidad"
  | "mensajeria"
  | "mi-acudido"
  | "indicadores";

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
