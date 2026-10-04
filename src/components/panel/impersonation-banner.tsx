"use client";

/**
 * [F4.3] Banner rojo permanente durante la impersonación "Ver como".
 * Muestra el usuario impersonado + botón "Volver a mi rol". Expira sola a los
 * 30 min (salvaguarda); cerrar sesión cierra la sesión REAL del admin.
 */
import { useCallback, useEffect } from "react";
import { Eye, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";

export function ImpersonationBanner() {
  const user = useAuthStore((s) => s.user);
  const impersonating = useAuthStore((s) => s.impersonating);
  const setUser = useAuthStore((s) => s.setUser);
  const setImpersonating = useAuthStore((s) => s.setImpersonating);
  const setModule = useUIStore((s) => s.setModule);

  const stop = useCallback(
    async (auto = false) => {
      if (!impersonating) return;
      try {
        await fetch("/api/impersonation", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logId: impersonating.logId }),
        });
      } catch {
        // la vista local se restaura aunque falle el registro del fin
      }
      setUser(impersonating.originalUser);
      setImpersonating(null);
      setModule("dashboard");
      if (!auto) return;
    },
    [impersonating, setUser, setImpersonating, setModule]
  );

  // Expiración automática (revisión cada 30 s)
  useEffect(() => {
    if (!impersonating) return;
    const t = setInterval(() => {
      if (impersonating && new Date(impersonating.expiresAt) < new Date()) {
        stop(true);
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [impersonating, stop]);

  if (!user || !impersonating) return null;
  const expired = new Date(impersonating.expiresAt) < new Date();

  return (
    <div className="bg-red-600 text-white text-sm" role="alert" data-testid="impersonation-banner">
      <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Eye className="h-4 w-4" />
          Viendo como <strong>{user.fullName}</strong> ({user.role})
        </span>
        <span className="text-red-100 text-xs hidden sm:inline">
          Los permisos de esta vista corresponden a su rol.
          {expired && " Sesión de vista expirada: vuelve a tu rol para continuar."}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto h-7 gap-1.5 bg-white text-red-700 hover:bg-red-50"
          onClick={() => stop()}
        >
          <LogOut className="h-3.5 w-3.5" /> Volver a mi rol
        </Button>
      </div>
    </div>
  );
}
