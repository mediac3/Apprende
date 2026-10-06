"use client";

// [Dashboard Docente] Pre-selección para el módulo Notas parciales.
// El dashboard fija grupo/asignatura/periodo antes de navegar; CalificacionesView
// lo consume al montar y lo limpia para no contaminar aperturas posteriores.
import { create } from "zustand";

export interface GradesPreselect {
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
  periodId: string | null;
  /** [Dashboard Docente] destellar celdas sin nota durante 10 s */
  flash?: boolean;
}

interface GradesPreselectState {
  preselect: GradesPreselect | null;
  setPreselect: (p: GradesPreselect) => void;
  clearPreselect: () => void;
}

export const useGradesPreselectStore = create<GradesPreselectState>((set) => ({
  preselect: null,
  setPreselect: (preselect) => set({ preselect }),
  clearPreselect: () => set({ preselect: null }),
}));
