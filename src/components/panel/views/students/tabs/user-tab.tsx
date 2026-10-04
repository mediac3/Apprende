"use client";

/**
 * [F3] Tab "Usuario" de la ficha del estudiante (360°).
 *  - Sin usuario + sin documento → botón deshabilitado con tooltip.
 *  - Sin usuario + con documento → "Crear usuario" con confirmación
 *    (usuario = contraseña = documento). Tras crear, flag mustChangePassword.
 *  - Con usuario → datos (username, rol, último login, estado) + acciones
 *    Resetear contraseña | Activar/Desactivar.
 * Gestión limitada a roles con edición en Gestión de Estudiantes
 * (rector/administrador según NAV); lectura para el resto.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { KeyRound, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StudentRow } from "../student-detail-view";

interface StudentUser {
  id: string;
  username: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

const canManage = (roles: string[] | undefined) =>
  !!roles?.some((r) => r === "rector" || r === "administrador");

export function UserTab({ student }: { student: StudentRow }) {
  const me = useAuthStore((s) => s.user);
  const manage = canManage(me?.roles ?? [me?.role ?? ""]);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"reset-password" | "toggle-active" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/user`);
      const data = await res.json();
      if (data.ok) setUser(data.user);
      else setError(data.error || "No se pudo cargar el usuario");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [student.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/user`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setUser(data.user);
        setNotice("Usuario creado. Usuario y contraseña = documento; cambiará la contraseña en su primer login.");
      } else {
        setError(data.error || "No se pudo crear el usuario");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
      setConfirmCreate(false);
    }
  }

  async function runAction() {
    if (!confirmAction) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${student.id}/user`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmAction }),
      });
      const data = await res.json();
      if (data.ok) {
        if (confirmAction === "reset-password") {
          setNotice("Contraseña restablecida al documento. Deberá cambiarla en su próximo login.");
          setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
        } else {
          setUser((u) => (u ? { ...u, active: data.active } : u));
          setNotice(data.active ? "Usuario activado." : "Usuario desactivado. No podrá iniciar sesión.");
        }
      } else {
        setError(data.error || "No se pudo completar la acción");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  const hasDocumento = !!student.documentNumber?.trim();
  const nombre = [student.firstName, student.lastName].filter(Boolean).join(" ");

  return (
    <div className="hairline rounded-xl bg-card p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserCog className="h-4 w-4 text-muted-foreground" />
        Acceso al panel (estudiante)
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && notice && <p className="text-sm text-emerald-700">{notice}</p>}

      {!loading && user && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between sm:block gap-2">
              <dt className="text-muted-foreground">Usuario</dt>
              <dd className="font-mono font-medium break-all">{user.username}</dd>
            </div>
            <div className="flex justify-between sm:block gap-2">
              <dt className="text-muted-foreground">Rol</dt>
              <dd className="capitalize">{user.role}</dd>
            </div>
            <div className="flex justify-between sm:block gap-2">
              <dt className="text-muted-foreground">Último login</dt>
              <dd>
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString("es-CO")
                  : "Nunca ha iniciado sesión"}
              </dd>
            </div>
            <div className="flex justify-between sm:block gap-2">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                {user.active ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Activo</Badge>
                ) : (
                  <Badge variant="destructive">Inactivo</Badge>
                )}
              </dd>
            </div>
          </dl>
          {user.mustChangePassword && (
            <p className="text-xs text-amber-700">
              Contraseña inicial = documento; el estudiante deberá cambiarla en su primer login.
            </p>
          )}
          {manage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={busy || !hasDocumento}
                onClick={() => setConfirmAction("reset-password")}
              >
                <KeyRound className="h-4 w-4" /> Resetear contraseña
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={busy}
                onClick={() => setConfirmAction("toggle-active")}
              >
                {user.active ? (
                  <><ShieldOff className="h-4 w-4" /> Desactivar</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" /> Activar</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {!loading && !user && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Este estudiante todavía no tiene usuario para ingresar al panel.
          </p>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={!manage || !hasDocumento ? 0 : -1}>
                  <Button
                    className="gap-2"
                    disabled={busy || !manage || !hasDocumento}
                    onClick={() => setConfirmCreate(true)}
                  >
                    <UserCog className="h-4 w-4" /> Crear usuario
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasDocumento && (
                <TooltipContent>
                  El estudiante no tiene documento. Complételo primero.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {!manage && (
            <p className="text-xs text-muted-foreground">
              Solo Rectoría o Administración pueden crear el usuario.
            </p>
          )}
        </div>
      )}

      {/* Confirmación de creación (texto de negocio exacto) */}
      <AlertDialog open={confirmCreate} onOpenChange={setConfirmCreate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear usuario para {nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro deseas crear el usuario? El usuario y la contraseña serán el
              documento <span className="font-mono font-semibold">{student.documentNumber}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                createUser();
              }}
            >
              {busy ? "Creando…" : "Crear usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de acciones sobre usuario existente */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "reset-password" ? "Resetear contraseña" : user?.active ? "Desactivar usuario" : "Activar usuario"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "reset-password"
                ? `La contraseña volverá a ser el documento ${student.documentNumber}. El estudiante deberá cambiarla en su próximo login.`
                : user?.active
                  ? "El estudiante no podrá iniciar sesión hasta que se reactive."
                  : "El estudiante podrá iniciar sesión de nuevo con su contraseña vigente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                runAction();
              }}
            >
              {busy ? "Procesando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
