"use client";

/**
 * [F2] Diálogo de cambio de contraseña forzado.
 * Se muestra (no descartable) cuando el usuario autenticado tiene
 * mustChangePassword=true (contraseña inicial = documento). Bloquea el panel
 * hasta completar el cambio. Se monta una sola vez en el panel principal.
 */
import { useState } from "react";
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

export function ChangePasswordDialog() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = !!user?.mustChangePassword;
  if (!open) return null;

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
