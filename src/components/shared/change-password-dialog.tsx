"use client";

/**
 * [F2] Diálogo de cambio de contraseña forzado.
 * Se muestra (no descartable) cuando el usuario autenticado tiene
 * mustChangePassword=true (contraseña inicial = documento). Bloquea el panel
 * hasta completar el cambio. Se monta una sola vez en el panel principal.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

/**
 * Resuelve la política institucional: ¿a este usuario le toca cambio inicial?
 * forcePasswordChange=false → nadie. passwordChangeRoles="[]" → todos los roles;
 * si lista roles, aplica al rol principal o a cualquiera de sus roles.
 * Ante datos ausentes o error de red → true (comportamiento conservador original).
 */
function policyApplies(
  inst: { forcePasswordChange?: boolean; passwordChangeRoles?: string } | undefined,
  role: string,
  roles: string[] | undefined
): boolean {
  if (!inst || inst.forcePasswordChange === undefined) return true;
  if (!inst.forcePasswordChange) return false;
  let allowed: unknown = [];
  try { allowed = JSON.parse(inst.passwordChangeRoles ?? "[]"); } catch { allowed = []; }
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.includes(role) || (roles ?? []).some((r) => allowed.includes(r));
}

export function ChangePasswordDialog() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // null = resolviendo política institucional; no renderizar nada mientras tanto
  const [gateOpen, setGateOpen] = useState<boolean | null>(null);

  const mustChange = !!user?.mustChangePassword;
  useEffect(() => {
    if (!mustChange || !user) {
      setGateOpen(false);
      return;
    }
    let alive = true;
    // Config vigente (no la del login): el cambio institucional aplica al instante
    fetch(`/api/institution?institutionId=${encodeURIComponent(user.institution.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setGateOpen(policyApplies(d?.institution, user.role, user.roles));
      })
      .catch(() => {
        if (alive) setGateOpen(true); // conservador
      });
    return () => {
      alive = false;
    };
  }, [mustChange, user?.id, user?.role, user?.institution.id]);

  const open = gateOpen === true;
  if (!mustChange || gateOpen === false || gateOpen === null) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo cambiar la contraseña");
        return;
      }
      setUser({ ...user, mustChangePassword: false });
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md [&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Cambia tu contraseña</DialogTitle>
          <DialogDescription>
            Por seguridad, tu contraseña inicial es tu número de documento. Debes
            cambiarla antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cpw-current">Contraseña actual</Label>
            <Input
              id="cpw-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpw-new">Nueva contraseña</Label>
            <Input
              id="cpw-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpw-confirm">Confirmar nueva contraseña</Label>
            <Input
              id="cpw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          >
            {saving ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
