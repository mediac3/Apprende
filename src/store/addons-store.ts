"use client";

import { create } from "zustand";
import {
  ADDON_DEFAULT,
  ADDON_KEYS,
  type AddonKey,
  type AddonState,
  addonVisible,
} from "@/lib/addons";

// [F1] Store de complementos: se carga UNA vez por institución al abrir el panel.
// Componentes: useAddonsMap() + addonVisible(map, key, isMobile) — o este atajo.

interface AddonsStore {
  map: Partial<Record<AddonKey, AddonState>>;
  loaded: boolean;
  load: (institutionId: string) => Promise<void>;
  /** Olvida la config cargada (p.ej. tras guardar desde el gestor) para re-fetch. */
  invalidate: () => void;
}

export const useAddonsStore = create<AddonsStore>()((set, get) => ({
  map: {},
  loaded: false,
  invalidate: () => set({ loaded: false }),
  load: async (institutionId: string) => {
    if (!institutionId) return;
    // ya cargada para esta institución → no re-fetch
    if (get().loaded) return;
    try {
      const res = await fetch(`/api/addons?institutionId=${encodeURIComponent(institutionId)}`);
      const json = await res.json();
      if (json?.ok && Array.isArray(json.addons)) {
        const map: Partial<Record<AddonKey, AddonState>> = {};
        for (const a of json.addons) {
          if ((ADDON_KEYS as string[]).includes(a.featureKey)) {
            map[a.featureKey as AddonKey] = {
              enabled: a.enabled === true,
              targets: (["both", "mobile", "pc"].includes(a.targets) ? a.targets : "both") as AddonState["targets"],
            };
          }
        }
        set({ map, loaded: true });
      } else {
        set({ loaded: true }); // fail-open con defaults
      }
    } catch {
      set({ loaded: true }); // fail-open con defaults
    }
  },
}));

export function useAddonsMap(): Partial<Record<AddonKey, AddonState>> {
  return useAddonsStore((s) => s.map);
}

/** Atajo de visibilidad: combina store + tipo de dispositivo. */
export function useAddonVisible(key: AddonKey, isMobile: boolean): boolean {
  const map = useAddonsMap();
  return addonVisible(map, key, isMobile);
}

export { ADDON_DEFAULT };
