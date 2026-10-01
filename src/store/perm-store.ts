// [F1] Store de permisos efectivos del usuario en sesión (solo lectura).
// Se carga una vez por sesión desde /api/permissions?mode=self (roles resueltos
// en BD). Fail-open mientras carga o si un módulo no está en el mapa, para no
// romper la UI ante fallos de red; las reglas duras se validan en servidor.

import { create } from "zustand";
import { useAuthStore } from "./auth-store";

export interface PermFlags {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export type PermAction = keyof PermFlags;

interface PermState {
  perms: Record<string, PermFlags> | null;
  isAdmin: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  canDo: (moduleKey: string, action?: PermAction) => boolean;
  reset: () => void;
}

export const usePermStore = create<PermState>((set, get) => ({
  perms: null,
  isAdmin: false,
  loaded: false,

  load: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ perms: null, isAdmin: false, loaded: false });
      return;
    }
    try {
      const res = await fetch(
        `/api/permissions?institutionId=${encodeURIComponent(user.institution.id)}&userId=${encodeURIComponent(user.id)}&mode=self`
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        set({ perms: json.perms as Record<string, PermFlags>, isAdmin: Boolean(json.isAdmin), loaded: true });
      } else {
        set({ loaded: true }); // fail-open: sin datos no se filtra nada
      }
    } catch {
      set({ loaded: true });
    }
  },

  canDo: (moduleKey, action = "canView") => {
    const { perms, isAdmin } = get();
    if (isAdmin) return true;
    if (!perms) return true;
    const flags = perms[moduleKey];
    if (!flags) return true;
    return flags[action];
  },

  reset: () => set({ perms: null, isAdmin: false, loaded: false }),
}));

/** Hook de conveniencia para ocultar/deshabilitar botones según permisos. */
export function useCan(moduleKey: string, action: PermAction = "canView"): boolean {
  return usePermStore((s) => (s.loaded ? s.canDo(moduleKey, action) : true));
}
