"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GraduationCap, Loader2, LogIn, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useThemeOptionsStore } from "@/store/theme-options-store";
import { toast } from "sonner";

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  // [theme-options] logo configurado (si no, fallback "Ap")
  const sharedTheme = useThemeOptionsStore((s) => s.theme);
  const logoDataUrl = sharedTheme?.logo.enabled ? sharedTheme.logo.dataUrl : "";

  // Pre-llenar con credenciales de admin
  useEffect(() => {
    if (open && !username) {
      setUsername("1155218177");
      setPassword("1155218177");
    }
  }, [open, username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Credenciales inválidas");
        return;
      }
      setUser(data.user);
      toast.success(`Bienvenida/o, ${data.user.fullName.split(" ")[0]}`);
      onOpenChange(false);
    } catch (e) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <div className="p-6">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground grid place-items-center font-extrabold text-base shadow-sm overflow-hidden">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="Logo institucional" className="h-full w-full object-contain" />
                ) : (
                  "Ap"
                )}
              </div>
              <div>
                <DialogTitle className="text-xl">Acceso institucional</DialogTitle>
                <DialogDescription className="mt-1">
                  Apprende — Plataforma educativa modular
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario institucional"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-3 rounded-md bg-secondary/60 hairline">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <div className="font-medium text-foreground mb-1">
                  Ambiente de demostración
                </div>
                Admin rector: <span className="font-mono">1155218177 / 1155218177</span>
                <br />
                Otros roles: <span className="font-mono">coordinacion, director, docente, orientador, acudiente</span> / <span className="font-mono">aulnea123</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
