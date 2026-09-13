"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Edit, Trash2, Users, Save, BadgeCheck, ChevronLeft, ChevronRight, Search, KeyRound,
} from "lucide-react";

// ============================================================
// GESTIÓN DE USUARIOS — módulo de Administración
// Listado con búsqueda y paginación + cambio del estado de los
// roles por usuario (relación N:M normalizada, catálogo Role).
// ============================================================

interface RoleRef {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active?: boolean;
}

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  active: boolean;
  role: string;
  lastLoginAt: string | null;
  userRoles: { id: string; role: RoleRef }[];
}

// Colores de las insignias de rol (PDF: Estudiante rojo, Contacto familiar verde)
const ROLE_COLORS: Record<string, string> = {
  rector: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  coordinador: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  director_grupo: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  docente: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  orientador: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  acudiente: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  estudiante: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  administrativo: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  supervisor: "bg-slate-100 text-slate-800 dark:bg-slate-950/60 dark:text-slate-300",
  auxiliar_principal: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  asistente_matricula: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
  tesoreria: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  pta_docente_tutor: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
  escuela_nueva: "bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300",
  tercero: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
};

function RoleBadge({ role }: { role: RoleRef }) {
  return (
    <Badge className={`text-[10px] border-transparent ${ROLE_COLORS[role.code] || "bg-secondary text-secondary-foreground"}`}>
      {role.name}
    </Badge>
  );
}

export function UsersView() {
  const me = useAuthStore((s) => s.user)!;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [loading, setLoading] = useState(true);

  // Listado
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Diálogos
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [rolesTarget, setRolesTarget] = useState<UserRow | null>(null);

  const load = useCallback(() => {
    if (!me.institution.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/users?institutionId=${me.institution.id}`).then((r) => r.json()),
      fetch(`/api/roles?institutionId=${me.institution.id}`).then((r) => r.json()),
    ])
      .then(([u, r]) => {
        if (u.ok) setUsers(u.users);
        if (r.ok) setRoles(r.roles);
      })
      .finally(() => setLoading(false));
  }, [me]);

  useEffect(() => { load(); }, [load]);

  // Filtro de búsqueda: usuario, persona, celular, email y roles
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      u.userRoles.some((ur) => ur.role.name.toLowerCase().includes(q) || ur.role.code.toLowerCase().includes(q))
    );
  }, [users, search]);

  // Paginación
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const end = Math.min(safePage * rowsPerPage, total);
  const paged = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  useEffect(() => { setPage(1); }, [search, rowsPerPage]);

  async function saveUser(data: {
    username: string; fullName: string; phone: string; email: string;
    jobTitle: string; password: string; roleIds: string[];
  }) {
    if (editing) {
      const d = await crudPatch("/api/users", {
        id: editing.id, institutionId: me.institution.id, userId: me.id,
        username: data.username, fullName: data.fullName, phone: data.phone || null,
        email: data.email || null, jobTitle: data.jobTitle || null,
        ...(data.password ? { password: data.password } : {}),
      });
      if (d.ok) { setShowForm(false); setEditing(null); load(); }
    } else {
      const d = await crudPost("/api/users", {
        institutionId: me.institution.id, userId: me.id, ...data,
        phone: data.phone || null, email: data.email || null, jobTitle: data.jobTitle || null,
      });
      if (d.ok) { setShowForm(false); load(); }
    }
  }

  async function toggleActive(u: UserRow) {
    if (u.id === me.id) { toast.error("No puede desactivar su propio usuario"); return; }
    const d = await crudPatch("/api/users", {
      id: u.id, institutionId: me.institution.id, userId: me.id, active: !u.active,
    });
    if (d.ok) load();
  }

  async function del(u: UserRow) {
    if (u.id === me.id) { toast.error("No puede eliminar su propio usuario"); return; }
    if (!confirm(`¿Eliminar el usuario "${u.fullName}" (${u.username})?`)) return;
    const d = await crudDelete("/api/users", u.id, me.institution.id, me.id);
    if (d.ok) load();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Usuarios</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Gestión de usuarios de la institución: datos de contacto, estado de acceso y roles asignados (un usuario puede ejercer varios roles).
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nuevo usuario
        </Button>
      </header>

      <Card className="hairline">
        <CardHeader className="space-y-0">
          <CardTitle className="text-sm tracking-wide">USUARIOS ({total})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Barra de herramientas: registros por página + búsqueda */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">Mostrar</span>
              <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
                <SelectTrigger className="h-8 w-[74px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="hidden sm:inline">registros</span>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-8 w-full sm:w-64 pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : paged.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {search ? "Sin resultados para la búsqueda." : "Sin usuarios. Cree el primero con «Nuevo usuario»."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Usuario</th>
                  <th className="py-2 pr-3 font-medium">Persona</th>
                  <th className="py-2 pr-3 font-medium">Celular</th>
                  <th className="py-2 pr-3 font-medium">EMail</th>
                  <th className="py-2 pr-3 font-medium">Rol(es)</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {paged.map((u) => {
                    const isSelf = u.id === me.id;
                    return (
                      <tr key={u.id} className="hairline-b hover:bg-secondary/50">
                        <td className="py-2 pr-3 font-mono text-xs">{u.username}</td>
                        <td className="py-2 pr-3 font-medium">{u.fullName}{isSelf && <span className="ml-1.5 text-[10px] text-primary">(usted)</span>}</td>
                        <td className="py-2 pr-3 tabular-nums">{u.phone || "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{u.email || "—"}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {u.userRoles.length === 0
                              ? <span className="text-xs text-muted-foreground">—</span>
                              : u.userRoles.map((ur) => <RoleBadge key={ur.id} role={ur.role} />)}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <button onClick={() => toggleActive(u)} title={isSelf ? "No puede desactivar su propio usuario" : undefined}>
                            {u.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title={isSelf ? "No puede cambiar sus propios roles" : "Cambiar estado de los roles"}
                            disabled={isSelf}
                            onClick={() => setRolesTarget(u)}
                          >
                            <BadgeCheck className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => { setEditing(u); setShowForm(true); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            title={isSelf ? "No puede eliminar su propio usuario" : "Eliminar"}
                            disabled={isSelf}
                            onClick={() => del(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación estilo DataTables */}
          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Mostrando {start} a {end} de {total.toLocaleString("es-CO")} registro{total === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Anterior">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
                      <Button
                        variant={p === safePage ? "default" : "outline"}
                        size="icon" className="h-7 w-7 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  ))}
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Siguiente">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        user={editing}
        roles={roles}
        onSave={saveUser}
      />
      <RolesStateDialog
        user={rolesTarget}
        roles={roles}
        onClose={() => setRolesTarget(null)}
        onSaved={load}
      />
    </motion.div>
  );
}

// ============================================================
// FORMULARIO: crear / editar usuario
// ============================================================

function UserFormDialog({ open, onOpenChange, user, roles, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: UserRow | null;
  roles: RoleRef[];
  onSave: (d: { username: string; fullName: string; phone: string; email: string; jobTitle: string; password: string; roleIds: string[] }) => void;
}) {
  const [form, setForm] = useState({ username: "", fullName: "", phone: "", email: "", jobTitle: "", password: "" });
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setForm({ username: user.username, fullName: user.fullName, phone: user.phone || "", email: user.email || "", jobTitle: user.jobTitle || "", password: "" });
      setSelected(user.userRoles.map((ur) => ur.role.id));
    } else {
      setForm({ username: "", fullName: "", phone: "", email: "", jobTitle: "", password: "" });
      setSelected([]);
    }
  }, [user, open]);

  function toggleRole(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{user ? "Editar usuario" : "Crear usuario"}</DialogTitle>
          <DialogDescription>
            {user ? "Actualice los datos de contacto. Deje la contraseña vacía para mantener la actual." : "Los roles se pueden ajustar después desde el listado."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label>Usuario *</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Documento o identificación" className="font-mono" /></div>
            <div><Label>Persona *</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nombre completo" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label>Celular</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="300 000 0000" /></div>
            <div><Label>EMail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label>Cargo</Label><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Opcional" /></div>
            <div>
              <Label className="flex items-center gap-1.5"><KeyRound className="h-3 w-3" /> {user ? "Contraseña" : "Contraseña *"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={user ? "Dejar vacío para mantener" : "Contraseña inicial"} autoComplete="new-password" />
            </div>
          </div>
          {!user && (
            <div>
              <Label>Rol(es)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-md hairline p-3 max-h-44 overflow-y-auto">
                {roles.filter((r) => r.active !== false).map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} />
                    <span className="truncate">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({ ...form, roleIds: selected })}
            disabled={!form.username.trim() || !form.fullName.trim() || (!user && !form.password)}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> {user ? "Actualizar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MODAL: Cambiar el estado del rol de un usuario (PDF)
// ============================================================

function RolesStateDialog({ user, roles, onClose, onSaved }: {
  user: UserRow | null;
  roles: RoleRef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const me = useAuthStore((s) => s.user)!;
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setSelected(user.userRoles.map((ur) => ur.role.id));
  }, [user]);

  function toggleRole(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function update() {
    if (!user) return;
    setSaving(true);
    const res = await fetch("/api/users/roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, institutionId: me.institution.id, userId: me.id, roleIds: selected }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) { toast.success("Roles actualizados"); onClose(); onSaved(); }
    else toast.error(d.error || "Error");
  }

  // Tres columnas como en la referencia (PDF)
  const columnSize = Math.ceil(roles.filter((r) => r.active !== false).length / 3);
  const columns = [0, 1, 2].map((c) => roles.filter((r) => r.active !== false).slice(c * columnSize, (c + 1) * columnSize));

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            {user ? `Cambiar el estado del rol de ${user.fullName}` : ""}
          </DialogTitle>
          <DialogDescription>Active o desactive los roles que ejerce el usuario.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 py-3">
          {columns.map((col, ci) => (
            <div key={ci} className="space-y-2">
              {col.map((r) => (
                <label key={r.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} className="mt-0.5" />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={update} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Actualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Helpers CRUD (mismo contrato que curriculum-view)
// ============================================================

async function crudPost(apiBase: string, body: any, successMsg = "Usuario creado") {
  const res = await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json();
  if (d.ok) toast.success(successMsg);
  else toast.error(d.error || "Error");
  return d;
}

async function crudPatch(apiBase: string, body: any, successMsg = "Usuario actualizado") {
  const res = await fetch(apiBase, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json();
  if (d.ok) toast.success(successMsg);
  else toast.error(d.error || "Error");
  return d;
}

async function crudDelete(apiBase: string, id: string, institutionId: string, userId?: string, successMsg = "Usuario eliminado") {
  const res = await fetch(`${apiBase}?id=${id}&institutionId=${institutionId}&userId=${userId || ""}`, { method: "DELETE" });
  const d = await res.json();
  if (d.ok) toast.success(successMsg);
  else toast.error(d.error || "Error");
  return d;
}
