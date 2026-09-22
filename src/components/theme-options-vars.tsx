"use client";

// [theme-options] Carga del tema al montar el layout raíz.
// Delega la aplicación (style tag, --app-*, tipografía, customCode) en
// applyThemeToDocument() del store; expone el tema vía zustand para
// consumidores (sidebar, login, gate de mantenimiento).
// No altera el modo de render del servidor ni la hidratación.

import { useEffect } from "react";
import { applyThemeToDocument, useThemeOptionsStore } from "@/store/theme-options-store";

export function ThemeOptionsVars() {
  const setTheme = useThemeOptionsStore((s) => s.setTheme);

  useEffect(() => {
    let alive = true;
    fetch("/api/theme-options")
      .then((r) => r.json())
      .then((res) => {
        if (!alive || !res?.ok) return;
        setTheme(res.data);
        applyThemeToDocument(res.data);
      })
      .catch(() => {
        /* sin tema disponible: los consumidores usan sus fallbacks */
      });
    return () => {
      alive = false;
    };
  }, [setTheme]);
  return null;
}
