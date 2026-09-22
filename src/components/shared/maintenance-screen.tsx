"use client";

// [theme-options] Pantalla de Modo Mantenimiento.
// Se muestra a usuarios no administradores cuando maintenance.enabled (gate en page.tsx).
// Todos los campos son opcionales; vacíos = pantalla minimalista con mensaje por defecto.

import { useEffect, useState } from "react";
import { Construction } from "lucide-react";
import { useThemeOptionsStore } from "@/store/theme-options-store";
import { renderShortcodes } from "@/lib/theme-options";

function useCountdown(target: string): string | null {
  const [remaining, setRemaining] = useState<string | null>(null);
  useEffect(() => {
    const t = new Date(target).getTime();
    if (Number.isNaN(t)) return undefined;
    const tick = () => {
      const diff = t - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        return;
      }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setRemaining(`${d ? `${d}d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

export function MaintenanceScreen() {
  const theme = useThemeOptionsStore((s) => s.theme);
  const m = theme?.maintenance;
  const countdown = useCountdown(m?.countdownEnabled && m.countdownTarget ? m.countdownTarget : "");

  if (!m) return null;
  const social = m.showSocial && theme ? theme.footer.social : null;
  const socialEntries = social
    ? Object.entries(social).filter(([, url]) => Boolean(url))
    : [];

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--app-bg)] p-6">
      <div className="max-w-lg w-full text-center space-y-5">
        {m.imageDataUrl ? (
          <img src={m.imageDataUrl} alt="Mantenimiento" className="mx-auto max-h-48 object-contain" />
        ) : (
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[var(--app-accent)] text-[var(--app-accent-fg)] grid place-items-center">
            <Construction className="h-8 w-8" />
          </div>
        )}

        <h1 className="text-3xl font-bold text-[var(--app-fg)]">
          {m.title || "Sitio en mantenimiento"}
        </h1>

        {m.description && (
          <p className="text-sm text-[var(--app-muted-fg)] leading-relaxed whitespace-pre-line">
            {m.description}
          </p>
        )}

        {m.countdownEnabled && countdown && (
          <div className="font-mono text-2xl font-semibold text-[var(--app-primary)] tabular-nums">
            {countdown}
          </div>
        )}

        {m.bottomText && (
          <p className="text-xs text-[var(--app-muted-fg)] whitespace-pre-line">
            {renderShortcodes(m.bottomText)}
          </p>
        )}

        {socialEntries.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {socialEntries.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs font-medium text-[var(--app-primary)] hover:underline capitalize"
              >
                {key}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
