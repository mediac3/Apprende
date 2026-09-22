"use client";

// [theme-options] Inyección global de variables CSS del tema.
// Componente cliente mínimo montado en el layout raíz: hace fetch de
// ThemeOptions y pega un <style id> en <head>. No altera el modo de render
// del servidor ni la hidratación (no renderiza markup propio).
// Los consumidores usan var(--grades-*, <fallback>) con fallbacks iguales a
// los defaults → si esto no llega a ejecutarse, la tabla se ve idéntica.

import { useEffect } from "react";
import { normalizeThemeData, GRADES_TABLE_DEFAULTS, type ThemeData } from "@/lib/theme-options";

const STYLE_ID = "theme-options-vars";

const c = (v: string, fallback: string) => v || fallback;

function buildCss(d: ThemeData): string {
  const g = d.gradesTable;
  const rowHeight =
    g.rowDensity === "compact" ? "28px" : g.rowDensity === "comfortable" ? "52px" : "auto";
  const decls: string[] = [
    `--grades-concept-ser-bg:${c(g.concepts.ser.bg, GRADES_TABLE_DEFAULTS.concepts.ser.bg)}`,
    `--grades-concept-ser-text:${c(g.concepts.ser.text, GRADES_TABLE_DEFAULTS.concepts.ser.text)}`,
    `--grades-concept-saber-bg:${c(g.concepts.saber.bg, GRADES_TABLE_DEFAULTS.concepts.saber.bg)}`,
    `--grades-concept-saber-text:${c(g.concepts.saber.text, GRADES_TABLE_DEFAULTS.concepts.saber.text)}`,
    `--grades-concept-hacer-bg:${c(g.concepts.hacer.bg, GRADES_TABLE_DEFAULTS.concepts.hacer.bg)}`,
    `--grades-concept-hacer-text:${c(g.concepts.hacer.text, GRADES_TABLE_DEFAULTS.concepts.hacer.text)}`,
    `--grades-concept-autoevaluacion-bg:${c(g.concepts.autoevaluacion.bg, GRADES_TABLE_DEFAULTS.concepts.autoevaluacion.bg)}`,
    `--grades-concept-autoevaluacion-text:${c(g.concepts.autoevaluacion.text, GRADES_TABLE_DEFAULTS.concepts.autoevaluacion.text)}`,
    `--grades-header-text:${c(g.headerTextColor, GRADES_TABLE_DEFAULTS.headerTextColor)}`,
    `--grades-header-font-size:${g.headerFontSize || GRADES_TABLE_DEFAULTS.headerFontSize}px`,
    `--grades-cell-font-size:${g.cellFontSize || GRADES_TABLE_DEFAULTS.cellFontSize}px`,
    `--grades-student-font-size:${g.studentColFontSize || GRADES_TABLE_DEFAULTS.studentColFontSize}px`,
    `--grades-row-height:${rowHeight}`,
    `--grades-min-col-width:${g.minColumnWidth || GRADES_TABLE_DEFAULTS.minColumnWidth}px`,
    `--grades-prom-bg:${c(g.promBg, GRADES_TABLE_DEFAULTS.promBg)}`,
    `--grades-def-bg:${c(g.defBg, GRADES_TABLE_DEFAULTS.defBg)}`,
    `--grades-conditional:${g.conditionalNotes ? 1 : 0}`,
    `--grades-low-threshold:${g.lowThreshold}`,
    `--grades-low-color:${c(g.lowColor, GRADES_TABLE_DEFAULTS.lowColor)}`,
    `--grades-high-color:${c(g.highColor, GRADES_TABLE_DEFAULTS.highColor)}`,
  ];
  return `:root{${decls.join(";")}}`;
}

export function ThemeOptionsVars() {
  useEffect(() => {
    let alive = true;
    fetch("/api/theme-options")
      .then((r) => r.json())
      .then((res) => {
        if (!alive || !res?.ok) return;
        const css = buildCss(normalizeThemeData(JSON.stringify(res.data)));
        document.getElementById(STYLE_ID)?.remove();
        const el = document.createElement("style");
        el.id = STYLE_ID;
        el.textContent = css;
        document.head.appendChild(el);
      })
      .catch(() => {
        /* sin tema disponible: los consumidores usan sus fallbacks */
      });
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
