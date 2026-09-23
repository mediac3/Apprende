"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CurriculumView } from "./curriculum-view";
import {
  Plus, Edit, Trash2, Calendar, FileText, Scale, BookOpen, Building2, MapPin, Clock, Variable, Save, X, ArrowLeft, ListTree,
} from "lucide-react";

type ModuleType =
  | "academic-years"
  | "subjects"
  | "curriculum-plans"
  | "evaluation-scales"
  | "indicator-adjectives"
  | "institution"
  | "branches"
  | "journeys"
  | "report-templates"
  | "report-variables";

interface Props {
  module: ModuleType;
}

const MODULE_CONFIG: Record<ModuleType, { title: string; description: string; icon: any; apiBase: string }> = {
  "academic-years": { title: "Años académicos", description: "Gestión de años académicos con creación del siguiente año y migración de indicadores.", icon: Calendar, apiBase: "/api/academic-years" },
  "subjects": { title: "Asignaturas", description: "Asignaturas con abreviatura, promedia y estado.", icon: BookOpen, apiBase: "/api/subjects" },
  "curriculum-plans": { title: "Plan de estudios", description: "Estructura curricular por grado con intensidad horaria y áreas del conocimiento.", icon: ListTree, apiBase: "/api/curriculum-plans" },
  "evaluation-scales": { title: "Escalas valorativas", description: "Escalas como Bajo, Básico, Alto, Superior con rangos numéricos.", icon: Scale, apiBase: "/api/evaluation-scales" },
  "indicator-adjectives": { title: "Adjetivos para indicadores", description: "Adjetivos asociados a cada escala valorativa.", icon: FileText, apiBase: "/api/indicator-adjectives" },
  "institution": { title: "Institución", description: "Datos de la institución: resolución, ciudad, código ICFES, decreto.", icon: Building2, apiBase: "/api/institution" },
  "branches": { title: "Sedes", description: "Sedes de la institución.", icon: MapPin, apiBase: "/api/branches" },
  "journeys": { title: "Jornadas", description: "Jornadas con modelos educativos asociados.", icon: Clock, apiBase: "/api/journeys" },
  "report-templates": { title: "Plantillas de reportes", description: "Constancias, certificados e informes con encabezado, cuerpo y pie.", icon: FileText, apiBase: "/api/report-templates" },
  "report-variables": { title: "Variables de reporte", description: "Variables dinámicas para informes valorativos.", icon: Variable, apiBase: "/api/report-variables" },
};

const EDUCATIONAL_MODELS = [
  "Educación tradicional",
  "Escuela nueva",
  "Post-primaria",
  "Etnoeducación",
  "Aceleración del aprendizaje",
  "Educación para adultos",
  "Burbuja",
  "Caminar por secundaria",
];

export function ParamsView({ module }: Props) {
  const user = useAuthStore((s) => s.user);
  const config = MODULE_CONFIG[module];
  const Icon = config.icon;

  // Special case: institution is a single-record form
  if (module === "institution") {
    return <InstitutionForm />;
  }

  if (module === "report-variables") {
    return <ReportVariablesView />;
  }

  // Plan de estudios: módulo con pestañas (planes / grados / áreas)
  if (module === "curriculum-plans") {
    return <CurriculumView />;
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
            <Icon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-heading font-semibold tracking-tight">{config.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{config.description}</p>
        </div>
      </header>
      {module === "academic-years" && <AcademicYearsView />}
      {module === "subjects" && <SubjectsView />}
      {module === "evaluation-scales" && <EvaluationScalesView />}
      {module === "indicator-adjectives" && <AdjectivesView />}
      {module === "branches" && <BranchesView />}
      {module === "journeys" && <JourneysView />}
      {module === "report-templates" && <ReportTemplatesView />}
    </motion.div>
  );
}

// ============================================================
// Helper: CRUD list component
// ============================================================

function useCrudList<T>(apiBase: string, institutionId: string | undefined) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    if (!institutionId) return;
    setLoading(true);
    fetch(`${apiBase}?institutionId=${institutionId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setItems(d[Object.keys(d).find((k) => k !== "ok") as string] || []); })
      .finally(() => setLoading(false));
  }, [apiBase, institutionId]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, search, setSearch, load };
}

async function crudPost(apiBase: string, body: any, successMsg = "Registro creado") {
  const res = await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json();
  if (d.ok) toast.success(successMsg);
  else toast.error(d.error || "Error");
  return d;
}

async function crudPatch(apiBase: string, body: any, successMsg = "Registro actualizado") {
  const res = await fetch(apiBase, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json();
  if (d.ok) toast.success(successMsg);
  else toast.error(d.error || "Error");
  return d;
}

async function crudDelete(apiBase: string, id: string, institutionId: string, userId?: string, successMsg = "Registro eliminado") {
  const res = await fetch(`${apiBase}?id=${id}&institutionId=${institutionId}&userId=${userId || ""}`, { method: "DELETE" });
  const d = await res.json();
  if (d.ok) toast.success(successMsg);
  else toast.error(d.error || "Error");
  return d;
}

// ============================================================
// AÑOS ACADÉMICOS
// ============================================================

function AcademicYearsView() {
  const user = useAuthStore((s) => s.user)!;
  const { items: years, loading, load } = useCrudList<any>("/api/academic-years", user.institution.id);
  const [showCreate, setShowCreate] = useState(false);
  const [nextYear, setNextYear] = useState(new Date().getFullYear() + 1);
  const [decree, setDecree] = useState("");
  const [migrateIndicators, setMigrateIndicators] = useState(true);
  const [creating, setCreating] = useState(false);

  async function createNextYear() {
    setCreating(true);
    const d = await crudPost("/api/academic-years/create-next", {
      institutionId: user.institution.id,
      year: nextYear,
      decree,
      migrateIndicators,
      userId: user.id,
    }, `Año ${nextYear} creado`);
    setCreating(false);
    if (d.ok) {
      setShowCreate(false);
      load();
    }
  }

  async function toggleActive(y: any) {
    await crudPatch("/api/academic-years", { id: y.id, institutionId: user.institution.id, active: !y.active, userId: user.id });
    load();
  }

  async function del(y: any) {
    if (!confirm(`¿Eliminar el año ${y.year}?`)) return;
    await crudDelete("/api/academic-years", y.id, user.institution.id, user.id);
    load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Años registrados ({years.length})</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Crear año
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : years.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No hay años registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="hairline-b text-left">
                    <th className="py-2 pr-3 font-medium">Año</th>
                    <th className="py-2 pr-3 font-medium">Decreto</th>
                    <th className="py-2 pr-3 font-medium">Fecha inicio</th>
                    <th className="py-2 pr-3 font-medium">Fecha fin</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.id} className="hairline-b">
                      <td className="py-2 pr-3 font-mono">{y.year}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{y.decree || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{y.startDate ? new Date(y.startDate).toLocaleDateString("es-CO") : "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{y.endDate ? new Date(y.endDate).toLocaleDateString("es-CO") : "—"}</td>
                      <td className="py-2 pr-3">
                        {y.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : y.closed ? <Badge className="chip-bajo text-[10px]">Cerrado</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(y)} className="h-7 text-xs">{y.active ? "Desactivar" : "Activar"}</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(y)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Crear nuevo año académico</DialogTitle>
            <DialogDescription>
              Al crear el nuevo año se copiará la misma estructura de grupos, periodos y plan de estudio de forma automática.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-md bg-warning/10 hairline text-sm">
              <strong>¡Información!</strong> Está a punto de crear el Año {nextYear}. Puede seleccionar si desea o no migrar los indicadores de desempeño del año anterior al nuevo año.
            </div>
            <div>
              <Label>Año *</Label>
              <Input type="number" value={nextYear} onChange={(e) => setNextYear(Number(e.target.value))} />
            </div>
            <div>
              <Label>Decreto</Label>
              <Input value={decree} onChange={(e) => setDecree(e.target.value)} placeholder="Ej: 1075" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={migrateIndicators} onCheckedChange={setMigrateIndicators} id="migrate" />
              <Label htmlFor="migrate" className="cursor-pointer">¿Migrar indicadores de desempeño?</Label>
            </div>
            {!migrateIndicators && (
              <p className="text-xs text-muted-foreground">Si no migra los indicadores, deberán ingresarse manualmente.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={createNextYear} disabled={creating} className="gap-1.5">
              {creating ? "Creando..." : "Crear año"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// ASIGNATURAS
// ============================================================

function SubjectsView() {
  const user = useAuthStore((s) => s.user)!;
  const { items: subjects, loading, search, setSearch, load } = useCrudList<any>("/api/subjects", user.institution.id);
  const [areas, setAreas] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadAreas = useCallback(() => {
    fetch(`/api/knowledge-areas?institutionId=${user.institution.id}`).then((r) => r.json()).then((d) => {
      if (d.ok) setAreas(d.areas);
    });
  }, [user]);

  useEffect(() => { loadAreas(); }, [loadAreas]);

  const filtered = search ? subjects.filter((s) => (s.name + s.area + s.abbreviation).toLowerCase().includes(search.toLowerCase())) : subjects;

  async function save(data: any) {
    if (editing) {
      await crudPatch("/api/subjects", { id: editing.id, institutionId: user.institution.id, userId: user.id, ...data });
    } else {
      await crudPost("/api/subjects", { institutionId: user.institution.id, userId: user.id, ...data });
    }
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function del(s: any) {
    if (!confirm(`¿Eliminar la asignatura "${s.name}"?`)) return;
    await crudDelete("/api/subjects", s.id, user.institution.id, user.id);
    load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Asignaturas ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-sm" />
            <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin asignaturas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="hairline-b text-left">
                    <th className="py-2 pr-3 font-medium">Nombre</th>
                    <th className="py-2 pr-3 font-medium">Área</th>
                    <th className="py-2 pr-3 font-medium">Abreviatura</th>
                    <th className="py-2 pr-3 font-medium">Promedia</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="hairline-b">
                      <td className="py-2 pr-3">{s.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{s.area || "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{s.abbreviation || "—"}</td>
                      <td className="py-2 pr-3">{s.averages ? <Badge className="chip-superior text-[10px]">Sí</Badge> : <Badge variant="outline" className="hairline text-[10px]">No</Badge>}</td>
                      <td className="py-2 pr-3">{s.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SubjectForm open={showForm} onOpenChange={setShowForm} subject={editing} areas={areas} onSave={save} />
    </>
  );
}

function SubjectForm({ open, onOpenChange, subject, areas, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; subject: any | null; areas: any[]; onSave: (data: any) => void }) {
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [averages, setAverages] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (subject) {
      setName(subject.name || "");
      setAreaId(subject.areaId || "none");
      setAbbreviation(subject.abbreviation || "");
      setAverages(subject.averages !== false);
      setActive(subject.active !== false);
    } else {
      setName(""); setAreaId("none"); setAbbreviation(""); setAverages(true); setActive(true);
    }
  }, [subject, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{subject ? "Editar asignatura" : "Crear asignatura"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Área</Label>
            <Select value={areaId || "none"} onValueChange={setAreaId}>
              <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin área</SelectItem>
                {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Las áreas se administran en Plan de estudios → Áreas.</p>
          </div>
          <div><Label>Abreviatura</Label><Input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} placeholder="MAT, LEN..." className="font-mono" /></div>
          <div className="flex items-center gap-2"><Switch checked={averages} onCheckedChange={setAverages} id="avg" /><Label htmlFor="avg" className="cursor-pointer">Promedia (cuenta para el promedio)</Label></div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} id="act" /><Label htmlFor="act" className="cursor-pointer">Estado activo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave({ name, areaId: areaId === "none" ? null : areaId, abbreviation: abbreviation || null, averages, active })} disabled={!name} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ESCALAS VALORATIVAS
// ============================================================

function EvaluationScalesView() {
  const user = useAuthStore((s) => s.user)!;
  const { items: scales, loading, load } = useCrudList<any>("/api/evaluation-scales", user.institution.id);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function save(data: any) {
    if (editing) {
      await crudPatch("/api/evaluation-scales", { id: editing.id, institutionId: user.institution.id, userId: user.id, ...data });
    } else {
      await crudPost("/api/evaluation-scales", { institutionId: user.institution.id, userId: user.id, ...data });
    }
    setShowForm(false); setEditing(null); load();
  }

  async function del(s: any) {
    if (!confirm(`¿Eliminar la escala "${s.name}"?`)) return;
    await crudDelete("/api/evaluation-scales", s.id, user.institution.id, user.id);
    load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Escalas ({scales.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : scales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin escalas. Cree Bajo, Básico, Alto, Superior.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Orden</th>
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Mín</th>
                  <th className="py-2 pr-3 font-medium">Máx</th>
                  <th className="py-2 pr-3 font-medium">Adjetivos</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {scales.map((s) => (
                    <tr key={s.id} className="hairline-b">
                      <td className="py-2 pr-3 font-mono">{s.sortOrder}</td>
                      <td className="py-2 pr-3"><Badge className={`${s.color || "chip-alto"} text-[10px]`}>{s.name}</Badge></td>
                      <td className="py-2 pr-3 tabular-nums">{s.minValue.toFixed(1)}</td>
                      <td className="py-2 pr-3 tabular-nums">{s.maxValue.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{s._count?.adjectives || 0}</td>
                      <td className="py-2 pr-3">{s.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScaleForm open={showForm} onOpenChange={setShowForm} scale={editing} onSave={save} />
    </>
  );
}

function ScaleForm({ open, onOpenChange, scale, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; scale: any | null; onSave: (data: any) => void }) {
  const [name, setName] = useState("");
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(0);
  const [color, setColor] = useState("chip-alto");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (scale) {
      setName(scale.name); setMinValue(scale.minValue); setMaxValue(scale.maxValue);
      setColor(scale.color || "chip-alto"); setSortOrder(scale.sortOrder); setActive(scale.active !== false);
    } else { setName(""); setMinValue(0); setMaxValue(0); setColor("chip-alto"); setSortOrder(0); setActive(true); }
  }, [scale, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>{scale ? "Editar escala" : "Crear escala"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bajo, Básico, Alto, Superior" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nota mínima</Label><Input type="number" step="0.1" value={minValue} onChange={(e) => setMinValue(Number(e.target.value))} /></div>
            <div><Label>Nota máxima</Label><Input type="number" step="0.1" value={maxValue} onChange={(e) => setMaxValue(Number(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Color (chip)</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chip-bajo">chip-bajo (rojo)</SelectItem>
                  <SelectItem value="chip-basico">chip-basico (ámbar)</SelectItem>
                  <SelectItem value="chip-alto">chip-alto (verde azulado)</SelectItem>
                  <SelectItem value="chip-superior">chip-superior (verde)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Orden</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} id="sc-act" /><Label htmlFor="sc-act" className="cursor-pointer">Activo</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave({ name, minValue, maxValue, color, sortOrder, active })} disabled={!name} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ADJETIVOS PARA INDICADORES
// ============================================================

function AdjectivesView() {
  const user = useAuthStore((s) => s.user)!;
  const [scales, setScales] = useState<any[]>([]);
  const [selectedScale, setSelectedScale] = useState<string>("");
  const [adjectives, setAdjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch(`/api/evaluation-scales?institutionId=${user.institution.id}`).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setScales(d.scales);
        if (d.scales.length > 0) setSelectedScale(d.scales[0].id);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!selectedScale) return;
    setLoading(true);
    fetch(`/api/indicator-adjectives?institutionId=${user.institution.id}&scaleId=${selectedScale}`).then((r) => r.json()).then((d) => {
      if (d.ok) setAdjectives(d.adjectives);
    }).finally(() => setLoading(false));
  }, [selectedScale, user]);

  async function add() {
    if (!newName.trim() || !selectedScale) return;
    const d = await crudPost("/api/indicator-adjectives", { institutionId: user.institution.id, scaleId: selectedScale, name: newName, userId: user.id });
    if (d.ok) { setNewName(""); setShowForm(false); load(); }
  }

  async function del(a: any) {
    if (!confirm(`¿Eliminar "${a.name}"?`)) return;
    await crudDelete("/api/indicator-adjectives", a.id, user.institution.id, user.id);
    load();
  }

  function load() {
    if (!selectedScale) return;
    fetch(`/api/indicator-adjectives?institutionId=${user.institution.id}&scaleId=${selectedScale}`).then((r) => r.json()).then((d) => {
      if (d.ok) setAdjectives(d.adjectives);
    });
  }

  return (
    <Card className="hairline">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Escala:</Label>
          <Select value={selectedScale} onValueChange={setSelectedScale}>
            <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{scales.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={!selectedScale} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo adjetivo</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
        ) : adjectives.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin adjetivos. Agregue adjetivos como "Difícilmente", "Algunas veces", "Frecuentemente", "Siempre".</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {adjectives.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hairline text-sm">
                {a.name}
                <button onClick={() => del(a)} className="text-destructive hover:opacity-70" aria-label="Eliminar"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Nuevo adjetivo</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Escala: {scales.find((s) => s.id === selectedScale)?.name}</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Difícilmente" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={add} disabled={!newName.trim()} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// SEDES
// ============================================================

function BranchesView() {
  const user = useAuthStore((s) => s.user)!;
  const { items: branches, loading, load } = useCrudList<any>("/api/branches", user.institution.id);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  async function save() {
    if (!name.trim()) return;
    if (editing) {
      await crudPatch("/api/branches", { id: editing.id, institutionId: user.institution.id, name, active, userId: user.id });
    } else {
      await crudPost("/api/branches", { institutionId: user.institution.id, name, active, userId: user.id });
    }
    setShowForm(false); setEditing(null); setName(""); setActive(true); load();
  }

  async function del(b: any) {
    if (!confirm(`¿Eliminar la sede "${b.name}"?`)) return;
    await crudDelete("/api/branches", b.id, user.institution.id, user.id);
    load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Sedes ({branches.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setName(""); setActive(true); setShowForm(true); }} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : branches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin sedes registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id} className="hairline-b">
                      <td className="py-2 pr-3">{b.name}</td>
                      <td className="py-2 pr-3">{b.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(b); setName(b.name); setActive(b.active !== false); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{editing ? "Editar sede" : "Crear sede"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Principal, Sede B..." /></div>
            <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} id="br-act" /><Label htmlFor="br-act" className="cursor-pointer">Activo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!name.trim()} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// JORNADAS
// ============================================================

function JourneysView() {
  const user = useAuthStore((s) => s.user)!;
  const { items: journeys, loading, load } = useCrudList<any>("/api/journeys", user.institution.id);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  function toggleModel(m: string) {
    setSelectedModels((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  }

  async function save() {
    if (!name.trim()) return;
    if (editing) {
      await crudPatch("/api/journeys", { id: editing.id, institutionId: user.institution.id, name, educationalModels: selectedModels, active, userId: user.id });
    } else {
      await crudPost("/api/journeys", { institutionId: user.institution.id, name, educationalModels: selectedModels, active, userId: user.id });
    }
    setShowForm(false); setEditing(null); setName(""); setSelectedModels([]); setActive(true); load();
  }

  async function del(j: any) {
    if (!confirm(`¿Eliminar la jornada "${j.name}"?`)) return;
    await crudDelete("/api/journeys", j.id, user.institution.id, user.id);
    load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Jornadas ({journeys.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setName(""); setSelectedModels([]); setActive(true); setShowForm(true); }} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : journeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin jornadas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Modelos educativos</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {journeys.map((j) => (
                    <tr key={j.id} className="hairline-b">
                      <td className="py-2 pr-3">{j.name}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {(j.educationalModels || []).slice(0, 3).map((m: string) => <Badge key={m} variant="outline" className="hairline text-[10px]">{m}</Badge>)}
                          {(j.educationalModels || []).length > 3 && <Badge variant="outline" className="hairline text-[10px]">+{(j.educationalModels || []).length - 3}</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{j.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(j); setName(j.name); setSelectedModels(j.educationalModels || []); setActive(j.active !== false); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(j)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar jornada" : "Crear jornada"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mañana, Tarde, Única..." /></div>
            <div>
              <Label>Modelos educativos</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {EDUCATIONAL_MODELS.map((m) => (
                  <button key={m} type="button" onClick={() => toggleModel(m)} className={`text-left px-2 py-1.5 rounded-md text-xs hairline transition-colors ${selectedModels.includes(m) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} id="j-act" /><Label htmlFor="j-act" className="cursor-pointer">Activo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!name.trim()} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// PLANTILLAS DE REPORTES
// ============================================================

function ReportTemplatesView() {
  const user = useAuthStore((s) => s.user)!;
  const { items: templates, loading, load } = useCrudList<any>("/api/report-templates", user.institution.id);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function save(data: any) {
    if (editing) {
      await crudPatch("/api/report-templates", { id: editing.id, institutionId: user.institution.id, userId: user.id, ...data });
    } else {
      await crudPost("/api/report-templates", { institutionId: user.institution.id, userId: user.id, ...data });
    }
    setShowForm(false); setEditing(null); load();
  }

  async function del(t: any) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    await crudDelete("/api/report-templates", t.id, user.institution.id, user.id);
    load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Plantillas ({templates.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin plantillas. Cree constancias, certificados o informes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Slug</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Variables</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="hairline-b">
                      <td className="py-2 pr-3">{t.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{t.slug}</td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="hairline text-[10px]">{t.type}</Badge></td>
                      <td className="py-2 pr-3 text-muted-foreground">{t._count?.variables || 0}</td>
                      <td className="py-2 pr-3">{t.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(t); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReportTemplateForm open={showForm} onOpenChange={setShowForm} template={editing} onSave={save} />
    </>
  );
}

function ReportTemplateForm({ open, onOpenChange, template, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; template: any | null; onSave: (data: any) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("constancia");
  const [headerHtml, setHeaderHtml] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (template) {
      setName(template.name); setSlug(template.slug); setType(template.type || "constancia");
      setHeaderHtml(template.headerHtml || ""); setBodyHtml(template.bodyHtml || ""); setFooterHtml(template.footerHtml || "");
      setActive(template.active !== false);
    } else { setName(""); setSlug(""); setType("constancia"); setHeaderHtml(""); setBodyHtml(""); setFooterHtml(""); setActive(true); }
  }, [template, open]);

  useEffect(() => {
    if (name && !slug) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  }, [name, slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? "Editar plantilla" : "Crear plantilla"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Slug *</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="constancia">Constancia</SelectItem>
                  <SelectItem value="certificado">Certificado</SelectItem>
                  <SelectItem value="informe_valorativo">Informe valorativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><div className="flex items-center gap-2 pb-2"><Switch checked={active} onCheckedChange={setActive} id="rt-act" /><Label htmlFor="rt-act" className="cursor-pointer">Activo</Label></div></div>
          </div>
          <div><Label>Encabezado (HTML)</Label><Textarea value={headerHtml} onChange={(e) => setHeaderHtml(e.target.value)} rows={4} className="font-mono text-xs" placeholder="<div>REPÚBLICA DE COLOMBIA...</div>" /></div>
          <div><Label>Cuerpo (HTML)</Label><Textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={6} className="font-mono text-xs" placeholder="<p>El estudiante {{nombre_estudiante}}...</p>" /></div>
          <div><Label>Pie (HTML)</Label><Textarea value={footerHtml} onChange={(e) => setFooterHtml(e.target.value)} rows={3} className="font-mono text-xs" placeholder="<div>Firma del rector</div>" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave({ name, slug, type, headerHtml, bodyHtml, footerHtml, active })} disabled={!name || !slug} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// VARIABLES DE REPORTE
// ============================================================

function ReportVariablesView() {
  const user = useAuthStore((s) => s.user)!;
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [variables, setVariables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ variable: "", value: "", description: "" });

  useEffect(() => {
    fetch(`/api/report-templates?institutionId=${user.institution.id}`).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setTemplates(d.templates);
        if (d.templates.length > 0) setSelectedTemplate(d.templates[0].id);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setLoading(true);
    fetch(`/api/report-variables?institutionId=${user.institution.id}&reportTemplateId=${selectedTemplate}`).then((r) => r.json()).then((d) => {
      if (d.ok) setVariables(d.variables);
    }).finally(() => setLoading(false));
  }, [selectedTemplate, user]);

  async function add() {
    if (!form.variable.trim() || !selectedTemplate) return;
    const d = await crudPost("/api/report-variables", { reportTemplateId: selectedTemplate, institutionId: user.institution.id, userId: user.id, ...form });
    if (d.ok) { setForm({ variable: "", value: "", description: "" }); setShowForm(false); load(); }
  }

  async function del(v: any) {
    if (!confirm(`¿Eliminar la variable "${v.variable}"?`)) return;
    await crudDelete("/api/report-variables", v.id, user.institution.id, user.id);
    load();
  }

  function load() {
    if (!selectedTemplate) return;
    fetch(`/api/report-variables?institutionId=${user.institution.id}&reportTemplateId=${selectedTemplate}`).then((r) => r.json()).then((d) => {
      if (d.ok) setVariables(d.variables);
    });
  }

  return (
    <Card className="hairline">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Plantilla:</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-56 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={!selectedTemplate} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nueva variable</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
        ) : variables.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin variables. Agregue variables como <code className="font-mono text-xs">{"{{nombre_estudiante}}"}</code>, <code className="font-mono text-xs">{"{{fecha}}"}</code>, <code className="font-mono text-xs">{"{{promedio}}"}</code>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="hairline-b text-left">
                <th className="py-2 pr-3 font-medium">Variable</th>
                <th className="py-2 pr-3 font-medium">Valor</th>
                <th className="py-2 pr-3 font-medium">Descripción</th>
                <th className="py-2 pr-3 font-medium text-right">Acciones</th>
              </tr></thead>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.id} className="hairline-b">
                    <td className="py-2 pr-3 font-mono text-xs">{`{{${v.variable}}}`}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{v.value || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">{v.description || "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Nueva variable</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Variable *</Label><Input value={form.variable} onChange={(e) => setForm({ ...form, variable: e.target.value })} placeholder="nombre_estudiante" className="font-mono" /></div>
            <div><Label>Valor</Label><Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Valor por defecto o fórmula" /></div>
            <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Para qué sirve esta variable" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={add} disabled={!form.variable.trim()} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// INSTITUCIÓN (formulario único)
// ============================================================

function InstitutionForm() {
  const user = useAuthStore((s) => s.user)!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    fetch(`/api/institution?institutionId=${user.institution.id}`).then((r) => r.json()).then((d) => {
      if (d.ok) setForm(d.institution);
    }).finally(() => setLoading(false));
  }, [user]);

  async function save() {
    setSaving(true);
    await crudPatch("/api/institution", { id: user.institution.id, userId: user.id, ...form });
    setSaving(false);
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 skeleton-pulse rounded" />)}</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Institución</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Datos institucionales: resolución, ciudad, código ICFES, decreto y datos de contacto.</p>
      </header>

      <Card className="hairline">
        <CardHeader><CardTitle className="text-sm">Datos básicos</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Nombre *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Nombre corto</Label><Input value={form.shortName || ""} onChange={(e) => setForm({ ...form, shortName: e.target.value })} /></div>
          <div><Label>NIT</Label><Input value={form.nit || ""} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></div>
          <div><Label>DANE</Label><Input value={form.dane || ""} onChange={(e) => setForm({ ...form, dane: e.target.value })} /></div>
          <div><Label>Resolución</Label><Input value={form.resolution || ""} onChange={(e) => setForm({ ...form, resolution: e.target.value })} placeholder="S 127082 3/Octubre de 2014" /></div>
          <div><Label>Código ICFES</Label><Input value={form.icfesCode || ""} onChange={(e) => setForm({ ...form, icfesCode: e.target.value })} /></div>
          <div><Label>Decreto</Label><Input value={form.decree || ""} onChange={(e) => setForm({ ...form, decree: e.target.value })} placeholder="1075" /></div>
          <div><Label>Año académico activo</Label><Input value={form.academicYear || ""} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card className="hairline">
        <CardHeader><CardTitle className="text-sm">Clasificación SIMAT</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Etc</Label><Input value={form.etc || ""} onChange={(e) => setForm({ ...form, etc: e.target.value })} placeholder="Antioquia" /></div>
          <div>
            <Label>Calendario</Label>
            <Select value={form.calendario || ""} onValueChange={(v) => setForm({ ...form, calendario: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sector</Label>
            <Select value={form.sector || ""} onValueChange={(v) => setForm({ ...form, sector: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                <SelectItem value="Oficial">Oficial</SelectItem>
                <SelectItem value="Privado">Privado</SelectItem>
                <SelectItem value="Mixto">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zona sede</Label>
            <Select value={form.zonaSede || ""} onValueChange={(v) => setForm({ ...form, zonaSede: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                <SelectItem value="Urbana">Urbana</SelectItem>
                <SelectItem value="Rural">Rural</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jornada</Label>
            <Select value={form.jornada || ""} onValueChange={(v) => setForm({ ...form, jornada: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                <SelectItem value="Mañana">Mañana</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Nocturna">Nocturna</SelectItem>
                <SelectItem value="Única">Única</SelectItem>
                <SelectItem value="Completa">Completa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="hairline">
        <CardHeader><CardTitle className="text-sm">Contacto y ubicación</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Ciudad</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Carepa - Antioquia" /></div>
          <div><Label>Dirección</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Teléfono</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </motion.div>
  );
}
