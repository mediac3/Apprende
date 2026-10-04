"use client";

/**
 * [F4.1] Perfil universal de usuarios no-estudiantes (Docente, Rector,
 * Coordinador, Administrador, Acudiente, otros).
 * Header (avatar+nombre+rol+email) + tabs dinámicos según rol — SOLO tabs
 * con datos disponibles (regla dura). Montado desde el módulo Usuarios [F4.2].
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Mail, Phone, BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";

interface ProfileUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  role: string;
  active: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

interface ProfileData {
  user: ProfileUser;
  roles: { id: string; code: string; name: string }[];
  assignments: { id: string; year: number; weeklyHours: number; group: { name: string }; subject: { name: string } }[];
  grades: { id: string; value: number; performance: string | null; updatedAt: string; student: { firstName: string; lastName: string }; subject: { name: string }; period: { name: string } }[];
  observations: { id: string; date: string; title: string | null; category: string; severity: string | null; status: string; student: { firstName: string; lastName: string } }[];
  groups: { id: string; name: string; gradeLevel: { name: string } | null; academicYear: { year: number } | null }[];
  dependents: { id: string; relationship: string; phone: string | null; student: { id: string; code: string; firstName: string; lastName: string; group: { name: string } | null } }[];
  permissions: { moduleKey: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; role: { name: string } }[];
  audits: { id: string; action: string; module: string; createdAt: string }[];
  impersonations: { id: string; startedAt: string; endedAt: string | null; target: { fullName: string; role: string } }[];
}

const initials = (fullName: string) =>
  fullName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

export function UserProfileView({ userId, onBack }: { userId: string; onBack?: () => void }) {
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setImpersonating = useAuthStore((s) => s.setImpersonating);
  const setModule = useUIStore((s) => s.setModule);
  const [data, setData] = useState<ProfileData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmVerComo, setConfirmVerComo] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/profile`);
      const d = await res.json();
      if (d.ok) {
        setData(d);
        setError(null);
      } else {
        setData(undefined);
        setError(d.error || "No se pudo cargar el perfil");
      }
    } catch {
      setData(undefined);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tabs visibles solo con datos (regla dura F4.1)
  const tabs = useMemo(() => {
    if (!data) return [];
    const t: { key: string; label: string }[] = [
      { key: "info", label: "Información personal" },
      { key: "seguridad", label: "Seguridad" },
    ];
    const codes = data.roles.map((r) => r.code);
    if (data.assignments.length > 0) t.push({ key: "asignacion", label: "Asignación académica" });
    if (data.grades.length > 0) t.push({ key: "calificaciones", label: "Calificaciones" });
    if (data.observations.length > 0) t.push({ key: "observaciones", label: "Observaciones" });
    if (data.groups.length > 0) t.push({ key: "grupos", label: "Grupos a cargo" });
    if (data.dependents.length > 0) t.push({ key: "acudidos", label: "Estudiantes a cargo" });
    if (codes.includes("administrador") && data.permissions.length > 0)
      t.push({ key: "permisos", label: "Permisos asignados" });
    if (data.audits.length > 0) t.push({ key: "actividad", label: "Actividad" });
    if (data.impersonations.length > 0) t.push({ key: "impersonaciones", label: "Ver como (registro)" });
    return t;
  }, [data]);

  if (error) {
    return (
      <div className="space-y-4">
        {onBack && (
          <Button variant="ghost" className="gap-2 -ml-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        )}
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">Cargando perfil…</p>;
  }

  const u = data.user;
  // [F4.3] "Ver como": solo Administrador, nunca sobre sí mismo ni sobre otro Admin
  const meIsAdmin = me?.role === "administrador" || !!me?.roles?.includes("administrador");
  const targetIsAdmin = u.role === "administrador" || data.roles.some((r) => r.code === "administrador");
  const canVerComo = !!me && meIsAdmin && !targetIsAdmin && me.id !== u.id;

  // Inicia la impersonación: la sesión real queda preservada en impersonating.originalUser
  async function startVerComo() {
    if (!me) return;
    setStarting(true);
    try {
      const res = await fetch("/api/impersonation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: me.id, targetId: u.id }),
      });
      const d = await res.json();
      if (d.ok) {
        setImpersonating({
          logId: d.logId,
          originalUser: me,
          startedAt: d.startedAt,
          expiresAt: d.expiresAt,
        });
        setUser(d.user);
        setModule("dashboard");
        toast.info(`Viendo como ${d.user.fullName}`);
      } else {
        toast.error(d.error || "No se pudo iniciar «Ver como»");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setStarting(false);
      setConfirmVerComo(false);
    }
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" className="gap-2 -ml-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Volver a usuarios
        </Button>
      )}

      {/* Header: avatar + nombre + rol + email */}
      <div className="hairline rounded-xl bg-card p-4 flex flex-wrap items-center gap-4">
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt={u.fullName} className="h-16 w-16 rounded-full object-cover hairline" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary grid place-items-center text-lg font-semibold">
            {initials(u.fullName)}
          </div>
        )}
        <div className="flex-1 min-w-[240px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-heading font-semibold tracking-tight">{u.fullName}</h1>
            <Badge variant="secondary" className="capitalize">{u.role}</Badge>
            {!u.active && <Badge variant="destructive">Inactivo</Badge>}
            {u.mustChangePassword && <Badge variant="outline" className="text-amber-700 border-amber-300">Debe cambiar contraseña</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {u.email ?? "—"}
            </span>
            {u.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {u.phone}
              </span>
            )}
            {u.jobTitle && (
              <span className="inline-flex items-center gap-1">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> {u.jobTitle}
              </span>
            )}
          </div>
        </div>
        {canVerComo && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmVerComo(true)}>
            <Eye className="h-3.5 w-3.5" /> Ver como
          </Button>
        )}
      </div>

      {/* [F4.3] Confirmación de impersonación (texto de negocio) */}
      <AlertDialog open={confirmVerComo} onOpenChange={setConfirmVerComo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ver como {u.fullName}</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a ver la app como{" "}
              <span className="font-semibold">{u.fullName}</span> ({u.role}).
              Tu sesión seguirá activa. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={starting}
              onClick={(e) => {
                e.preventDefault();
                startVerComo();
              }}
            >
              {starting ? "Iniciando…" : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue={tabs[0]?.key} className="gap-4">
        <TabsList className="flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info">
          <div className="hairline rounded-xl bg-card p-4 max-w-2xl">
            <Row label="Usuario">{u.username}</Row>
            <Row label="Nombre completo">{u.fullName}</Row>
            <Row label="Email">{u.email ?? "—"}</Row>
            <Row label="Teléfono">{u.phone ?? "—"}</Row>
            <Row label="Cargo">{u.jobTitle ?? "—"}</Row>
            <Row label="Roles">
              <span className="flex flex-wrap gap-1 justify-end">
                {data.roles.map((r) => (
                  <Badge key={r.id} variant="outline">{r.name}</Badge>
                ))}
              </span>
            </Row>
            <Row label="Miembro desde">{fmtDate(u.createdAt)}</Row>
          </div>
        </TabsContent>

        <TabsContent value="seguridad">
          <div className="hairline rounded-xl bg-card p-4 max-w-2xl">
            <Row label="Estado">{u.active ? "Activo" : "Inactivo"}</Row>
            <Row label="Último login">{fmtDate(u.lastLoginAt)}</Row>
            <Row label="Cambio de contraseña pendiente">{u.mustChangePassword ? "Sí" : "No"}</Row>
            <p className="text-xs text-muted-foreground mt-3">
              El restablecimiento de contraseña y la activación/desactivación se realizan
              desde el módulo Usuarios (o desde el tab Usuario en la ficha del estudiante).
            </p>
          </div>
        </TabsContent>

        <TabsContent value="asignacion">
          <div className="hairline rounded-xl bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Año</th>
                  <th className="text-left px-4 py-2 font-medium">Grupo</th>
                  <th className="text-left px-4 py-2 font-medium">Asignatura</th>
                  <th className="text-left px-4 py-2 font-medium">Horas/semana</th>
                </tr>
              </thead>
              <tbody>
                {data.assignments.map((a) => (
                  <tr key={a.id} className="border-t border-border/40">
                    <td className="px-4 py-2">{a.year}</td>
                    <td className="px-4 py-2 font-medium">{a.group.name}</td>
                    <td className="px-4 py-2">{a.subject.name}</td>
                    <td className="px-4 py-2">{a.weeklyHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="calificaciones">
          <div className="hairline rounded-xl bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Estudiante</th>
                  <th className="text-left px-4 py-2 font-medium">Asignatura</th>
                  <th className="text-left px-4 py-2 font-medium">Periodo</th>
                  <th className="text-left px-4 py-2 font-medium">Nota</th>
                  <th className="text-left px-4 py-2 font-medium">Desempeño</th>
                  <th className="text-left px-4 py-2 font-medium">Actualizada</th>
                </tr>
              </thead>
              <tbody>
                {data.grades.map((g) => (
                  <tr key={g.id} className="border-t border-border/40">
                    <td className="px-4 py-2 font-medium">{g.student.lastName}, {g.student.firstName}</td>
                    <td className="px-4 py-2">{g.subject.name}</td>
                    <td className="px-4 py-2">{g.period.name}</td>
                    <td className="px-4 py-2 font-mono">{g.value}</td>
                    <td className="px-4 py-2 capitalize">{g.performance ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(g.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-muted-foreground">Últimos 50 registros.</p>
          </div>
        </TabsContent>

        <TabsContent value="observaciones">
          <div className="hairline rounded-xl bg-card divide-y divide-border/40">
            {data.observations.map((o) => (
              <div key={o.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {o.student.lastName}, {o.student.firstName}
                  </span>
                  <Badge variant="outline" className="capitalize">{o.category}</Badge>
                  {o.severity && <Badge variant="outline" className="capitalize">{o.severity}</Badge>}
                  <Badge variant="secondary" className="capitalize">{o.status}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{fmtDate(o.date)}</span>
                </div>
                {o.title && <p className="text-sm mt-1">{o.title}</p>}
              </div>
            ))}
            <p className="px-4 py-2 text-xs text-muted-foreground">Últimas 50 fichas.</p>
          </div>
        </TabsContent>

        <TabsContent value="grupos">
          <div className="hairline rounded-xl bg-card divide-y divide-border/40">
            {data.groups.map((g) => (
              <div key={g.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{g.name}</span>
                {g.gradeLevel && <Badge variant="outline">{g.gradeLevel.name}</Badge>}
                {g.academicYear && <span className="text-xs text-muted-foreground">Año {g.academicYear.year}</span>}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="acudidos">
          <div className="hairline rounded-xl bg-card divide-y divide-border/40">
            {data.dependents.map((d) => (
              <div key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {d.student.lastName}, {d.student.firstName}
                </span>
                <Badge variant="outline" className="capitalize">{d.relationship}</Badge>
                {d.student.group?.name && <Badge variant="secondary">{d.student.group.name}</Badge>}
                <span className="text-xs text-muted-foreground font-mono">{d.student.code}</span>
                {d.phone && <span className="text-xs text-muted-foreground">{d.phone}</span>}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permisos">
          <div className="hairline rounded-xl bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Módulo</th>
                  <th className="text-left px-4 py-2 font-medium">Rol</th>
                  <th className="text-center px-4 py-2 font-medium">Ver</th>
                  <th className="text-center px-4 py-2 font-medium">Crear</th>
                  <th className="text-center px-4 py-2 font-medium">Editar</th>
                  <th className="text-center px-4 py-2 font-medium">Eliminar</th>
                </tr>
              </thead>
              <tbody>
                {data.permissions.map((p) => (
                  <tr key={`${p.role.name}-${p.moduleKey}`} className="border-t border-border/40">
                    <td className="px-4 py-2 font-mono text-xs">{p.moduleKey}</td>
                    <td className="px-4 py-2">{p.role.name}</td>
                    <td className="px-4 py-2 text-center">{p.canView ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{p.canCreate ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{p.canEdit ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{p.canDelete ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="actividad">
          <div className="hairline rounded-xl bg-card divide-y divide-border/40">
            {data.audits.map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline" className="font-mono text-xs">{a.action}</Badge>
                <span className="text-muted-foreground">{a.module}</span>
                <span className="text-xs text-muted-foreground ml-auto">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
            <p className="px-4 py-2 text-xs text-muted-foreground">Últimos 30 eventos.</p>
          </div>
        </TabsContent>

        <TabsContent value="impersonaciones">
          <div className="hairline rounded-xl bg-card divide-y divide-border/40">
            {data.impersonations.map((i) => (
              <div key={i.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{i.target.fullName}</span>
                <Badge variant="outline" className="capitalize">{i.target.role}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {fmtDate(i.startedAt)} {i.endedAt ? `→ ${fmtDate(i.endedAt)}` : "→ en curso"}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {tabs.length === 2 && (
        <EmptyHint text="Sin datos adicionales para este rol todavía." />
      )}
    </div>
  );
}
