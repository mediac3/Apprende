"use client";

import { useMemo } from "react";

// === Módulo Calificaciones: cálculos derivados (NO se persisten) ===
// Escala fija por decisión: 0.0 - 5.0, aprobación 3.0, 1 decimal.

export const MIN_NOTE = 0;
export const MAX_NOTE = 5;
export const APPROVAL_THRESHOLD = 3;
export const DECIMALS = 1;

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function isValidNote(raw: string): boolean {
  if (raw.trim() === "") return true; // vacío = sin nota
  const n = Number(raw.replace(",", "."));
  return !isNaN(n) && n >= MIN_NOTE && n <= MAX_NOTE;
}

export function parseNote(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (isNaN(n) || n < MIN_NOTE || n > MAX_NOTE) return null;
  return round1(n);
}

export interface ConceptColumn {
  conceptId: string;
  name: string;
  percentage: number;
  color: string; // clase tailwind de fondo del header/concepto
  activityIds: string[]; // sub-columnas en orden Activity.order
}

export interface StudentRow {
  studentId: string;
  fullName: string;
  code: string;
}

export interface CalculatedRow {
  studentId: string;
  prom: number | null; // promedio simple de todas las notas del periodo
  def: number | null; // Σ(conceptAvg × %) renormalizado sobre conceptos con notas
  conceptAvgs: Record<string, number | null>; // conceptId → promedio del concepto
}

/**
 * PROM(estudiante) = AVG de todas las notas registradas (todas las actividades
 * del periodo para esa asignatura, "Act. General" incluida — decisión aprobada).
 *
 * DEF(estudiante) = Σ (conceptAvg_i × %_i). Los conceptos sin ninguna nota no
 * aportan y los pesos se renormalizan sobre los conceptos con notas (periodo
 * parcial); con todos los conceptos con notas equivale a la fórmula exacta.
 */
export function useGradesCalculations(
  students: StudentRow[],
  concepts: ConceptColumn[],
  values: Record<string, string> // clave `${studentId}::${activityId}`
): CalculatedRow[] {
  return useMemo(() => {
    return students.map((s) => {
      const all: number[] = [];
      const perConcept: Record<string, number[]> = {};
      for (const c of concepts) {
        perConcept[c.conceptId] = [];
        for (const actId of c.activityIds) {
          const v = parseNote(values[`${s.studentId}::${actId}`] ?? "");
          if (v !== null) {
            all.push(v);
            perConcept[c.conceptId].push(v);
          }
        }
      }
      const conceptAvgs: Record<string, number | null> = {};
      let weighted = 0;
      let weightSum = 0;
      for (const c of concepts) {
        const arr = perConcept[c.conceptId];
        if (arr.length > 0) {
          const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
          conceptAvgs[c.conceptId] = round1(avg);
          weighted += avg * c.percentage;
          weightSum += c.percentage;
        } else {
          conceptAvgs[c.conceptId] = null;
        }
      }
      return {
        studentId: s.studentId,
        prom: all.length > 0 ? round1(all.reduce((a, b) => a + b, 0) / all.length) : null,
        def: weightSum > 0 ? round1(weighted / weightSum) : null,
        conceptAvgs,
      };
    });
  }, [students, concepts, values]);
}
