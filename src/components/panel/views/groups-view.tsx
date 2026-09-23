"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Save, Users } from "lucide-react";

// ============================================================
// Gestión de Grupos (PDF Módulo Grupos)
// Tabla: Sede | Grado | Grupo | Jornada | Director | Acciones
// Formulario: Año*, Grado*, Sede*, Jornada*, Nombre del grupo*
// (Tipo de periodos / Semestralizado / Semestre eliminados [C1]:
//  la relación de periodos viene por Grado → Plan → Modelo Educativo)
// ============================================================

interface GroupRow {
  id: string;
  name: string;
  otherName?: string | null;
  gradeLevel?: { id: string; code: string; name: string } | null;
  academicYearId?: string | null;
  academicYear?: { id: string; year: number } | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  journeyId?: string | null;
  journey?: { id: string; name: string } | null;
  headTeacherId?: string | null;
  headTeacher?: { id: string; fullName: string } | null;
  studentCount?: number;
}

/** Carga una lista de un endpoint estilo { ok, <clave>: [] } sin conocer la clave */
function useApiList<T = any>(url: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!url) return;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d[Object.keys(d).find((k) => k !== "ok") as string] || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);
  return { items, loading };
}

async function apiSend(method: "POST" | "PATCH", body: any, okMsg: string) {
  const res = await fetch("/api/groups", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await res.json();
  if (d.ok) toast.success(okMsg); else toast.error(d.error || "Error");
  return d;
}

async function apiDelete(id: string, institutionId: string, userId?: string) {
  const res = await fetch(`/api/groups?id=${id}&institutionId=${institutionId}&userId=${userId || ""}`, { method: "DELETE" });
  const d = await res.json();
  if (d.ok) toast.success("Grupo eliminado"); else toast.error(d.error || "Error");
  return d;
}

export function GroupsView() {
  const user = useAuthStore((s) => s.user)!;
  const instId = user.institution.id;

  // Catálogos existentes (normalización: reutilización, sin duplicar datos)
  const { items: years } = useApiList<any>(`/api/academic-years?institutionId=${instId}`);
  const { items: gradeLevels } = useApiList<any>(`/api/grade-levels?institutionId=${instId}`);
  const { items: branches } = useApiList<any>(`/api/branches?institutionId=${instId}`);
  const { items: journeys } = useApiList<any>(`/api/journeys?institutionId=${instId}`);
  const { items: users } = useApiList<any>(`/api/users?institutionId=${instId}`);

  // Docentes / directores candidatos (director de grupo)
  const teachers = (users || []).filter((u: any) => {
    const roles = u.userRoles?.map((ur: any) => ur.role?.code) || [u.role];
    return !roles?.length || roles.some((r: string) => ["docente", "director_grupo", "coordinador"].includes(r));
  });

  // Año seleccionado (por defecto el activo; si no, el más reciente)
  const sortedYears = [...(years || [])].sort((a: any, b: any) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.year - a.year;
  });
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  // Derivado sin efecto: año activo → más reciente (evita setState en efecto)
  const yearId = selectedYearId || sortedYears[0]?.id || "";

  // Grupos del año seleccionado (reloadKey permite recargar tras crear/editar/eliminar)
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const loadGroups = () => setReloadKey((k) => k + 1);
  useEffect(() => {
    if (!yearId) return;
    fetch(`/api/groups?institutionId=${instId}&yearId=${yearId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGroups(d.groups); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [instId, yearId, reloadKey]);

  // Formulario
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [fGrade, setFGrade] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fJourney, setFJourney] = useState("");
  const [fName, setFName] = useState("");
  const [fOtherName, setFOtherName] = useState("");

  function openCreate() {
    setEditing(null);
    setFGrade(""); setFBranch(""); setFJourney("");
    setFName("");
    setShowForm(true);
  }

  function openEdit(g: GroupRow) {
    setEditing(g);
    setFGrade(g.gradeLevel?.id || "");
    setFBranch(g.branchId || "");
    setFJourney(g.journeyId || "");
    setFName(g.name);
    setFOtherName(g.otherName || "");
    setShowForm(true);
  }

  async function save() {
    const body: any = {
      institutionId: instId, userId: user.id,
      name: fName, otherName: fOtherName, branchId: fBranch, journeyId: fJourney,
    };
    if (!editing) {
      body.gradeLevelId = fGrade;
      body.academicYearId = yearId;
      const d = await apiSend("POST", body, "Grupo creado");
      if (!d.ok) return;
    } else {
      body.id = editing.id;
      const d = await apiSend("PATCH", body, "Grupo actualizado");
      if (!d.ok) return;
    }
    setShowForm(false);
    loadGroups();
  }

  async function del(g: GroupRow) {
    if (!confirm(`¿Eliminar el grupo "${g.name}"? Los estudiantes quedarán sin grupo.`)) return;
    await apiDelete(g.id, instId, user.id);
    loadGroups();
  }

  async function setDirector(g: GroupRow, teacherId: string) {
    const d = await apiSend("PATCH", {
      id: g.id, institutionId: instId, userId: user.id, headTeacherId: teacherId || null,
    }, "Director asignado");
    if (d.ok) loadGroups();
  }

  const activeYear = sortedYears.find((y: any) => y.id === yearId);
  const filtered = groups.filter((g) =>
    !search || `${g.name} ${g.otherName || ""} ${g.gradeLevel?.name || ""} ${g.branch?.name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Grupos {activeYear ? `— ${activeYear.year}` : ""} ({groups.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={yearId} onValueChange={setSelectedYearId}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
              <SelectContent>
                {sortedYears.map((y: any) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.year}{y.active ? " (activo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nuevo registro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar grupo..." className="max-w-xs h-8 text-sm"
            />
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin grupos para este año.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Sede</th>
                  <th className="py-2 pr-3 font-medium">Grado</th>
                  <th className="py-2 pr-3 font-medium">Grupo</th>
                  <th className="py-2 pr-3 font-medium">Jornada</th>
                  <th className="py-2 pr-3 font-medium min-w-[180px]">Director</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {filtered.map((g) => (
                    <tr key={g.id} className="hairline-b">
                      <td className="py-2 pr-3">{g.branch?.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3">{g.gradeLevel?.name || g.gradeLevel?.code || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className="font-medium">{g.name}</span>
                        {g.otherName && <span className="ml-1.5 text-[10px] text-muted-foreground">({g.otherName})</span>}
                        {!!g.studentCount && (
                          <Badge variant="outline" className="hairline ml-1.5 text-[10px]">{g.studentCount} est.</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3">{g.journey?.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3">
                        <Select value={g.headTeacherId || "none"} onValueChange={(v) => setDirector(g, v === "none" ? "" : v)}>
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue placeholder="Sin asignar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {teachers.map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(g)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar grupo" : "Crear grupo"}</DialogTitle>
            {activeYear && (
              <DialogDescription>
                Año académico {activeYear.year}
                {editing ? " · el año y el grado no se pueden cambiar" : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Año *</Label>
                <Input value={activeYear ? String(activeYear.year) : ""} disabled />
              </div>
              <div>
                <Label>Grado *</Label>
                {editing ? (
                  <Input value={editing.gradeLevel?.name || editing.gradeLevel?.code || ""} disabled />
                ) : (
                  <Select value={fGrade} onValueChange={setFGrade}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      {(gradeLevels || []).filter((g: any) => g.active !== false).map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sede *</Label>
                <Select value={fBranch} onValueChange={setFBranch}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {(branches || []).filter((b: any) => b.active !== false).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jornada *</Label>
                <Select value={fJourney} onValueChange={setFJourney}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {(journeys || []).filter((j: any) => j.active !== false).map((j: any) => (
                      <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nombre del grupo *</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="8°A" />
            </div>
            <div>
              <Label>Otro nombre</Label>
              <Input value={fOtherName} onChange={(e) => setFOtherName(e.target.value)} placeholder="802" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={!fName.trim() || !fBranch || !fJourney || (!editing && !fGrade)}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> {editing ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
