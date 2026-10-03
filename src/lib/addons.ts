// [F1] Gestor de complementos: catálogo compartido (server + cliente) y regla
// de visibilidad. Sin config guardada → todo activo y visible en ambos (fail-open,
// igual que el patrón de permisos).

export const ADDON_FEATURES = [
  { key: "import_excel", label: "Importar Excel" },
  { key: "scan_sheet", label: "Escaneo de planilla" },
  { key: "grade_sheets", label: "Generación de planilla" },
  { key: "comments", label: "Comentar" },
  { key: "grades_assistant", label: "Asistente de notas" },
  { key: "ai", label: "Inteligencia artificial" },
  { key: "knowledge_base", label: "Base de conocimientos" },
] as const;

export type AddonKey = (typeof ADDON_FEATURES)[number]["key"];
export type AddonTargets = "both" | "mobile" | "pc";

export interface AddonState {
  enabled: boolean;
  targets: AddonTargets;
}

export const ADDON_KEYS: AddonKey[] = ADDON_FEATURES.map((f) => f.key);

export const ADDON_DEFAULT: AddonState = { enabled: true, targets: "both" };

export function isValidAddonKey(key: string): key is AddonKey {
  return (ADDON_KEYS as string[]).includes(key);
}

export function isValidAddonTargets(t: string): t is AddonTargets {
  return t === "both" || t === "mobile" || t === "pc";
}

/** Regla de visibilidad: complemento activo y su versión (móvil/PC/ambos) aplica. */
export function addonVisible(
  map: Partial<Record<AddonKey, AddonState>>,
  key: AddonKey,
  isMobile: boolean
): boolean {
  const cfg = map[key];
  if (!cfg) return true; // sin configuración → visible (fail-open)
  if (!cfg.enabled) return false;
  if (cfg.targets === "both") return true;
  return cfg.targets === "mobile" ? isMobile : !isMobile;
}
