import { create } from "zustand";
import { normalizeThemeData, type ThemeData } from "@/lib/theme-options";

// [theme-options] Store compartido del tema + aplicación en el documento.
// ThemeOptionsVars lo carga al montar; el módulo lo refresca al guardar.
// Los consumidores (sidebar, login, gate de mantenimiento) leen useThemeOptionsStore.

interface ThemeOptionsState {
  theme: ThemeData | null;
  setTheme: (t: ThemeData) => void;
}

export const useThemeOptionsStore = create<ThemeOptionsState>((set) => ({
  theme: null,
  setTheme: (theme) => set({ theme }),
}));

const STYLE_ID = "theme-options-vars";

const c = (v: string, fallback: string) => v || fallback;

function gradesDecls(d: ThemeData): string[] {
  const g = d.gradesTable;
  const rowHeight =
    g.rowDensity === "compact" ? "28px" : g.rowDensity === "comfortable" ? "52px" : "auto";
  return [
    `--grades-concept-ser-bg:${c(g.concepts.ser.bg, "#f97316")}`,
    `--grades-concept-ser-text:${c(g.concepts.ser.text, "#FFFFFF")}`,
    `--grades-concept-saber-bg:${c(g.concepts.saber.bg, "#8b5cf6")}`,
    `--grades-concept-saber-text:${c(g.concepts.saber.text, "#FFFFFF")}`,
    `--grades-concept-hacer-bg:${c(g.concepts.hacer.bg, "#0ea5e9")}`,
    `--grades-concept-hacer-text:${c(g.concepts.hacer.text, "#FFFFFF")}`,
    `--grades-concept-autoevaluacion-bg:${c(g.concepts.autoevaluacion.bg, "#10b981")}`,
    `--grades-concept-autoevaluacion-text:${c(g.concepts.autoevaluacion.text, "#FFFFFF")}`,
    `--grades-header-text:${c(g.headerTextColor, "#FFFFFF")}`,
    `--grades-header-font-size:${g.headerFontSize || 11}px`,
    `--grades-header-height:${g.headerHeight || 32}px`, // [C6] default compacto
    `--grades-cell-font-size:${g.cellFontSize || 13}px`,
    `--grades-student-font-size:${g.studentColFontSize || 13}px`,
    `--grades-student-align:${g.studentNameAlign || "left"}`,
    `--grades-student-color:${g.studentNameColor || "inherit"}`,
    `--grades-row-height:${rowHeight}`,
    `--grades-min-col-width:${g.minColumnWidth || 108}px`, // [ajuste usuario] -40%
    `--grades-prom-bg:${c(g.promBg, "#e0f2fe")}`,
    `--grades-def-bg:${c(g.defBg, "#ecfdf5")}`,
    `--grades-conditional:${g.conditionalNotes ? 1 : 0}`,
    `--grades-low-threshold:${g.lowThreshold}`,
    `--grades-low-color:${c(g.lowColor, "#fee2e2")}`,
    `--grades-high-color:${c(g.highColor, "#d1fae5")}`,
  ];
}

/** Overrides de la paleta global (--app-*): solo valores no vacíos. */
function appColorDecls(d: ThemeData): string[] {
  const col = d.colors;
  const decls: string[] = [];
  const push = (v: string, name: string) => {
    if (v) decls.push(`${name}:${v}`);
  };
  // Prioridad: botón primario regular > color primario (mismo token --app-primary)
  const primary = col.btnPrimary.regular.bg || col.primary;
  if (primary) {
    decls.push(`--app-primary:${primary}`);
    if (!col.btnPrimary.regular.text) decls.push("--app-primary-fg:#FFFFFF");
  }
  push(col.bg, "--app-bg");
  push(col.contentBg, "--app-card");
  push(col.altBg, "--app-muted");
  if (col.border) {
    decls.push(`--app-border:${col.border}`);
    decls.push(`--app-input:${col.border}`);
  }
  push(col.bodyText, "--app-fg");
  push(col.bodyText, "--app-card-fg");
  push(col.altText, "--app-muted-fg");
  if (col.btnSecondary.regular.bg) decls.push(`--app-secondary:${col.btnSecondary.regular.bg}`);
  return decls;
}

/** Reglas de tipografía global (elementos base; las utilidades de clase siguen ganando). */
function typographyCss(d: ThemeData): string {
  const t = d.typography;
  if (!t.enabled) return "";
  const fam = (f: string) => (f ? `font-family:${f};` : "");
  const spec = (sel: string, s: { family: string; weight: number; size: number }) => {
    const parts = [fam(s.family), `font-size:${s.size}px;`, `font-weight:${s.weight};`].join("");
    return `${sel}{${parts}}`;
  };
  const bodyFam = fam(t.body.family) || "";
  const rules: string[] = [];
  rules.push(`body{${bodyFam}font-size:${t.body.size}px;}`);
  rules.push(spec("h1", t.h1));
  rules.push(spec("h2", t.h2));
  rules.push(spec("h3", t.h3));
  rules.push(spec("h4", t.h4));
  rules.push(spec("h5", t.h5));
  rules.push(spec("h6", t.h6));
  return rules.join("");
}

/** CSS completo del tema (vars + overrides + tipografía + CSS personalizado). */
export function buildThemeCss(d: ThemeData): string {
  const parts: string[] = [`:root{${gradesDecls(d).join(";")}}`];
  const app = appColorDecls(d);
  if (app.length > 0) parts.push(`:root{${app.join(";")}}`);
  const typo = typographyCss(d);
  if (typo) parts.push(typo);
  if (d.customCode.enabled && d.customCode.css) parts.push(d.customCode.css);
  return parts.join("\n");
}

function injectScript(id: string, code: string, target: "head" | "body") {
  document.getElementById(id)?.remove();
  if (!code) return;
  const el = document.createElement("script");
  el.id = id;
  el.textContent = code;
  (target === "head" ? document.head : document.body).appendChild(el);
}

/** Aplica el tema completo al documento (style tag + JS + código de head). */
export function applyThemeToDocument(rawTheme: unknown) {
  if (typeof document === "undefined") return;
  const d = normalizeThemeData(
    typeof rawTheme === "string" ? rawTheme : JSON.stringify(rawTheme ?? {})
  );

  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildThemeCss(d);
  document.head.appendChild(style);

  // Códigos personalizados — solo se inyectan con el toggle activo.
  // (La edición está restringida a rector/administrativo a nivel de API.)
  injectScript("theme-custom-js", d.customCode.enabled ? d.customCode.js : "", "body");
  document.getElementById("theme-custom-head")?.remove();
  if (d.customCode.enabled && d.customCode.headCode) {
    const tpl = document.createElement("div");
    tpl.innerHTML = d.customCode.headCode;
    // Re-crear <script> para que ejecute (innerHTML no ejecuta scripts)
    tpl.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const attr of Array.from(old.attributes)) s.setAttribute(attr.name, attr.value);
      s.textContent = old.textContent ?? "";
      old.replaceWith(s);
    });
    const frag = document.createDocumentFragment();
    while (tpl.firstChild) frag.appendChild(tpl.firstChild);
    const holder = document.createElement("div");
    holder.id = "theme-custom-head";
    holder.style.display = "none";
    holder.appendChild(frag);
    document.head.appendChild(holder);
  }
}
