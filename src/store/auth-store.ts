import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: string; // rol principal (compatibilidad)
  roles?: string[]; // todos los roles asignados (N:M); fallback: [role]
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  mustChangePassword?: boolean; // [F2] bloquea el panel hasta cambiar la contraseña inicial
  institution: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    academicYear: string;
    forcePasswordChange?: boolean; // [Seguridad] política institucional de cambio inicial
    passwordChangeRoles?: string; // JSON array de códigos de rol; [] = todos
  };
}

// [F4.3] Impersonación "Ver como" — preserva la sesión real del admin
export interface ImpersonationSession {
  logId: string; // registro en ImpersonationLog (auditoría)
  originalUser: SessionUser;
  startedAt: string;
  expiresAt: string; // startedAt + 30 min (salvaguarda)
}

interface AuthState {
  user: SessionUser | null;
  impersonating: ImpersonationSession | null;
  setUser: (u: SessionUser | null) => void;
  setImpersonating: (i: ImpersonationSession | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      impersonating: null,
      setUser: (user) => set({ user }),
      setImpersonating: (impersonating) => set({ impersonating }),
      logout: () => {
        set({ user: null, impersonating: null });
        // [Seguridad] cierra la sesión de API (elimina la cookie httpOnly) y evita
        // que el módulo activo o los permisos en caché sobrevivan a la sesión:
        // el siguiente usuario no hereda vistas del anterior (p. ej. Usuarios).
        // Imports diferidos para no crear ciclo de módulos entre stores.
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        void import("./ui-store").then((m) => m.useUIStore.getState().setModule("dashboard"));
        void import("./perm-store").then((m) => m.usePermStore.getState().reset());
      },
    }),
    {
      name: "apprende-auth",
    }
  )
);
