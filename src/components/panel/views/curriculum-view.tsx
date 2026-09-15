"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { PercentageBar } from "@/components/ui/percentage-bar";
import { getAreaColor } from "@/lib/area-colors";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Edit, Trash2, ListTree, GraduationCap, Shapes, Copy, ArrowLeft, Save, Layers,
} from "lucide-react";

// ============================================================
// PLAN DE ESTUDIOS — módulo de parámetros
// Estructura normalizada: Áreas y Grados (catálogos) + Planes
// con detalle asignatura × grado (intensidad horaria).
// La estructura se preserva entre años académicos (PDF pág 1).
// ============================================================

interface PlanItem {
  id: string;
  subjectId: string;
  gradeLevelId: string;
  weeklyHours: number;
  sortOrder: number;
  subject: { id: string; name: string; abbreviation: string | null; averages: boolean; percentage: number; area: { id: string; name: string; abbreviation: string | null } | null };
  gradeLevel: { id: string; code: string; name: string; sortOrder: number };
}

interface PlanSummary {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  gradesCount: number;
  subjectsCount: number;
  totalHours: number;
  _count?: { items: number };
}

interface PlanDetail extends PlanSummary {
  items: PlanItem[];
}

interface GradeLevelRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  _count?: { groups: number; planItems: number };
}

interface AreaSubject {
  id: string;
  name: string;
  abbreviation: string | null;
  averages: boolean;
  active: boolean;
  percentage: number;
}

interface SubjectFormRow {
  key: string;
  id?: string;
  name: string;
  abbreviation: string;
  averages: boolean;
  active: boolean;
  percentage: number;
}

interface AreaRow {
  id: string;
  name: string;
  abbreviation: string | null;
  sortOrder: number;
  active: boolean;
  subjects?: AreaSubject[];
  _count?: { subjects: number };
}

export function CurriculumView() {
  const [tab, setTab] = useState("planes");

  // Al cambiar de tab interna (Planes/Grados/Áreas), volver al top del contenido
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

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
            <ListTree className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Plan de estudios</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Estructura curricular: asignaturas por grado con intensidad horaria, organizadas por áreas del conocimiento. La estructura se preserva al crear el siguiente año académico.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="planes" className="gap-1.5"><ListTree className="h-3.5 w-3.5" /> Planes</TabsTrigger>
          <TabsTrigger value="grados" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Grados</TabsTrigger>
          <TabsTrigger value="areas" className="gap-1.5"><Shapes className="h-3.5 w-3.5" /> Áreas</TabsTrigger>
        </TabsList>
        <TabsContent value="planes" className="mt-4">
          <PlansTab onNeedGrades={() => setTab("grados")} />
        </TabsContent>
        <TabsContent value="grados" className="mt-4">
          <GradeLevelsTab />
        </TabsContent>
        <TabsContent value="areas" className="mt-4">
          <KnowledgeAreasTab />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

// ============================================================
// TAB: PLANES
// ============================================================

function PlansTab({ onNeedGrades }: { onNeedGrades: () => void }) {
  const user = useAuthStore((s) => s.user)!;
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PlanSummary | null>(null);
  const [duplicating, setDuplicating] = useState<PlanSummary | null>(null);

  const load = useCallback(() => {
    if (!user.institution.id) return;
    setLoading(true);
    fetch(`/api/curriculum-plans?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPlans(d.plans); })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function savePlan(data: { name: string; description: string | null }) {
    if (editing) {
      const d = await crudPatch("/api/curriculum-plans", { id: editing.id, institutionId: user.institution.id, userId: user.id, ...data });
      if (d.ok) { setShowForm(false); setEditing(null); load(); }
    } else {
      const d = await crudPost("/api/curriculum-plans", { institutionId: user.institution.id, userId: user.id, ...data });
      if (d.ok) { setShowForm(false); load(); }
    }
  }

  async function duplicate(plan: PlanSummary, newName: string) {
    const d = await crudPost("/api/curriculum-plans", {
      institutionId: user.institution.id,
      userId: user.id,
      name: newName,
      description: plan.description,
      cloneFromId: plan.id,
    }, "Plan duplicado");
    setDuplicating(null);
    if (d.ok) load();
  }

  async function del(plan: PlanSummary) {
    const items = plan._count?.items ?? 0;
    if (!confirm(`¿Eliminar el plan "${plan.name}"${items ? ` y sus ${items} ítems` : ""}?`)) return;
    const d = await crudDelete("/api/curriculum-plans", plan.id, user.institution.id, user.id);
    if (d.ok) load();
  }

  async function toggleActive(plan: PlanSummary) {
    const d = await crudPatch("/api/curriculum-plans", { id: plan.id, institutionId: user.institution.id, userId: user.id, active: !plan.active });
    if (d.ok) load();
  }

  if (selectedId) {
    return (
      <PlanDetail
        planId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
        onNeedGrades={onNeedGrades}
      />
    );
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Planes de estudios ({plans.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nuevo plan
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin planes de estudios. Cree el plan general de la institución.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Grados</th>
                  <th className="py-2 pr-3 font-medium">Asignaturas</th>
                  <th className="py-2 pr-3 font-medium">Horas/sem</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="hairline-b cursor-pointer hover:bg-secondary/50" onClick={() => setSelectedId(p.id)}>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{p.description}</div>}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{p.gradesCount}</td>
                      <td className="py-2 pr-3 tabular-nums">{p.subjectsCount}</td>
                      <td className="py-2 pr-3 tabular-nums">{p.totalHours % 1 === 0 ? p.totalHours : p.totalHours.toFixed(1)}</td>
                      <td className="py-2 pr-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(p); }}>
                          {p.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedId(p.id)}>Ver</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => { setEditing(p); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar" onClick={() => setDuplicating(p)}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Eliminar" onClick={() => del(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PlanForm open={showForm} onOpenChange={setShowForm} plan={editing} onSave={savePlan} />
      <DuplicateDialog plan={duplicating} onClose={() => setDuplicating(null)} onConfirm={duplicate} />
    </>
  );
}

function PlanForm({ open, onOpenChange, plan, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; plan: PlanSummary | null; onSave: (d: { name: string; description: string | null }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (plan) { setName(plan.name); setDescription(plan.description || ""); }
    else { setName(""); setDescription(""); }
  }, [plan, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>{plan ? "Editar plan de estudios" : "Crear plan de estudios"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan de estudios general" /></div>
          <div><Label>Descripción</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave({ name, description: description || null })} disabled={!name.trim()} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({ plan, onClose, onConfirm }: { plan: PlanSummary | null; onClose: () => void; onConfirm: (plan: PlanSummary, name: string) => void }) {
  const [name, setName] = useState("");
  useEffect(() => { setName(plan ? `${plan.name} (copia)` : ""); }, [plan]);
  return (
    <Dialog open={!!plan} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Duplicar plan</DialogTitle>
          <DialogDescription>Se copiarán todos los ítems (asignatura × grado con intensidad horaria) al nuevo plan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nombre del nuevo plan *</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => plan && name.trim() && onConfirm(plan, name)} disabled={!name.trim()} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Duplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DETALLE DEL PLAN (ítems por grado)
// ============================================================

function PlanDetail({ planId, onBack, onNeedGrades }: { planId: string; onBack: () => void; onNeedGrades: () => void }) {
  const user = useAuthStore((s) => s.user)!;
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [defaultGrade, setDefaultGrade] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/curriculum-plans?institutionId=${user.institution.id}&id=${planId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPlan(d.plan); })
      .finally(() => setLoading(false));
  }, [planId, user]);

  useEffect(() => { load(); }, [load]);

  async function delItem(item: PlanItem) {
    if (!confirm(`¿Quitar "${item.subject.name}" de ${item.gradeLevel.name}?`)) return;
    const d = await crudDelete("/api/curriculum-plan-items", item.id, user.institution.id, user.id);
    if (d.ok) load();
  }

  async function updateItem(item: PlanItem, data: { weeklyHours: number; sortOrder: number }) {
    const d = await crudPatch("/api/curriculum-plan-items", { id: item.id, institutionId: user.institution.id, userId: user.id, ...data });
    if (d.ok) { setEditingItem(null); load(); }
  }

  if (loading && !plan) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 skeleton-pulse rounded" />)}</div>;
  }
  if (!plan) return <p className="text-sm text-muted-foreground py-8 text-center">Plan no encontrado.</p>;

  // Agrupar ítems por grado (orden por sortOrder del grado)
  const byGrade = new Map<string, { grade: PlanItem["gradeLevel"]; items: PlanItem[] }>();
  for (const it of plan.items) {
    const entry = byGrade.get(it.gradeLevelId) ?? { grade: it.gradeLevel, items: [] };
    entry.items.push(it);
    byGrade.set(it.gradeLevelId, entry);
  }
  const grades = [...byGrade.values()].sort((a, b) => a.grade.sortOrder - b.grade.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al listado
          </Button>
          <div>
            <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
              {plan.name}
              {plan.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}
            </h2>
            {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
          </div>
        </div>
        <Button size="sm" onClick={() => { setDefaultGrade(grades[0]?.grade.id || ""); setShowAdd(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Agregar asignatura
        </Button>
      </div>

      {grades.length === 0 ? (
        <Card className="hairline">
          <CardContent className="py-10 text-center space-y-3">
            <Layers className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              El plan no tiene asignaturas todavía. Use «Agregar asignatura» para definir qué se dicta en cada grado y con cuántas horas semanales.
            </p>
          </CardContent>
        </Card>
      ) : (
        grades.map(({ grade, items }) => {
          const total = items.reduce((s, i) => s + i.weeklyHours, 0);
          return (
            <Card key={grade.id} className="hairline">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> {grade.name}
                  <Badge variant="outline" className="hairline text-[10px]">{items.length} asignaturas</Badge>
                  <Badge variant="outline" className="hairline text-[10px] tabular-nums">{total % 1 === 0 ? total : total.toFixed(1)} h/sem</Badge>
                </CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setDefaultGrade(grade.id); setShowAdd(true); }}>
                  <Plus className="h-3 w-3" /> Agregar
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="hairline-b text-left">
                      <th className="py-2 pr-3 font-medium w-14">Orden</th>
                      <th className="py-2 pr-3 font-medium">Asignatura</th>
                      <th className="py-2 pr-3 font-medium">Área</th>
                      <th className="py-2 pr-3 font-medium">Promedia</th>
                      <th className="py-2 pr-3 font-medium">Horas/sem</th>
                      <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                    </tr></thead>
                    <tbody>
                      {items.sort((a, b) => a.sortOrder - b.sortOrder).map((it) => (
                        <tr key={it.id} className="hairline-b">
                          <td className="py-2 pr-3 font-mono text-xs">{it.sortOrder}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-col gap-1">
                              <span>
                                {it.subject.name}
                                {it.subject.abbreviation && <span className="ml-1.5 rounded bg-secondary px-1 font-mono text-[10px] text-muted-foreground">{it.subject.abbreviation}</span>}
                              </span>
                              <PercentageBar
                                value={it.subject.percentage ?? 0}
                                color={getAreaColor(it.subject.area?.id ?? it.subject.area?.abbreviation ?? "")}
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{it.subject.area?.name ?? "—"}</td>
                          <td className="py-2 pr-3">{it.subject.averages ? <Badge className="chip-superior text-[10px]">Sí</Badge> : <Badge variant="outline" className="hairline text-[10px]">No</Badge>}</td>
                          <td className="py-2 pr-3 tabular-nums">{it.weeklyHours % 1 === 0 ? it.weeklyHours : it.weeklyHours.toFixed(1)}</td>
                          <td className="py-2 pr-3 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(it)}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delItem(it)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <AddItemDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        plan={plan}
        defaultGrade={defaultGrade}
        onNeedGrades={onNeedGrades}
        onAdded={load}
      />
      <EditItemDialog item={editingItem} onClose={() => setEditingItem(null)} onSave={updateItem} />
    </div>
  );
}

function AddItemDialog({ open, onOpenChange, plan, defaultGrade, onNeedGrades, onAdded }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: PlanDetail;
  defaultGrade: string;
  onNeedGrades: () => void;
  onAdded: () => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [subjects, setSubjects] = useState<{ id: string; name: string; area: string | null; active: boolean }[]>([]);
  const [levels, setLevels] = useState<GradeLevelRow[]>([]);
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [weeklyHours, setWeeklyHours] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`/api/subjects?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/grade-levels?institutionId=${user.institution.id}`).then((r) => r.json()),
    ]).then(([s, l]) => {
      if (s.ok) setSubjects(s.subjects);
      if (l.ok) setLevels(l.gradeLevels);
    });
  }, [open, user]);

  useEffect(() => {
    if (open) {
      setGradeLevelId(defaultGrade);
      setSubjectId("");
      setWeeklyHours(3);
    }
  }, [open, defaultGrade]);

  // Excluir asignaturas ya incluidas en el grado seleccionado
  const existing = new Set(
    plan.items.filter((i) => i.gradeLevelId === gradeLevelId).map((i) => i.subjectId)
  );
  const available = subjects.filter((s) => !existing.has(s.id));
  const activeLevels = levels.filter((l) => l.active);

  async function add() {
    if (!gradeLevelId || !subjectId) { toast.error("Seleccione grado y asignatura"); return; }
    setSaving(true);
    const d = await crudPost("/api/curriculum-plan-items", {
      institutionId: user.institution.id,
      planId: plan.id,
      subjectId,
      gradeLevelId,
      weeklyHours,
      userId: user.id,
    }, "Asignatura agregada al plan");
    setSaving(false);
    if (d.ok) { onOpenChange(false); onAdded(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Agregar asignatura al plan</DialogTitle>
          <DialogDescription>Define qué asignatura se dicta en un grado y su intensidad horaria semanal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Grado *</Label>
            <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
              <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
              <SelectContent>
                {activeLevels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeLevels.length === 0 && (
              <p className="text-xs text-destructive mt-1">
                No hay grados activos.{" "}
                <button className="underline" onClick={onNeedGrades}>Configurar grados</button>
              </p>
            )}
          </div>
          <div>
            <Label>Asignatura *</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
              <SelectContent>
                {available.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.area ? ` — ${s.area}` : ""}{!s.active ? " (inactiva)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available.length === 0 && <p className="text-xs text-muted-foreground mt-1">Todas las asignaturas ya están en este grado.</p>}
          </div>
          <div>
            <Label>Intensidad horaria semanal *</Label>
            <Input type="number" step="0.5" min="0" value={weeklyHours} onChange={(e) => setWeeklyHours(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={add} disabled={!gradeLevelId || !subjectId || saving} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditItemDialog({ item, onClose, onSave }: {
  item: PlanItem | null;
  onClose: () => void;
  onSave: (item: PlanItem, data: { weeklyHours: number; sortOrder: number }) => void;
}) {
  const [weeklyHours, setWeeklyHours] = useState(1);
  const [sortOrder, setSortOrder] = useState(1);

  useEffect(() => {
    if (item) { setWeeklyHours(item.weeklyHours); setSortOrder(item.sortOrder); }
  }, [item]);

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Editar ítem del plan</DialogTitle>
          {item && <DialogDescription>{item.subject.name} — {item.gradeLevel.name}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Intensidad horaria semanal</Label><Input type="number" step="0.5" min="0" value={weeklyHours} onChange={(e) => setWeeklyHours(Number(e.target.value))} /></div>
          <div><Label>Orden (boletín / planilla)</Label><Input type="number" min="1" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => item && onSave(item, { weeklyHours, sortOrder })} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TAB: GRADOS (catálogo)
// ============================================================

function GradeLevelsTab() {
  const user = useAuthStore((s) => s.user)!;
  const [levels, setLevels] = useState<GradeLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GradeLevelRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", sortOrder: 0, active: true });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/grade-levels?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setLevels(d.gradeLevels); })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.code.trim() || !form.name.trim()) return;
    const d = editing
      ? await crudPatch("/api/grade-levels", { id: editing.id, institutionId: user.institution.id, userId: user.id, ...form })
      : await crudPost("/api/grade-levels", { institutionId: user.institution.id, userId: user.id, ...form });
    if (d.ok) { setShowForm(false); setEditing(null); load(); }
  }

  async function del(l: GradeLevelRow) {
    if (!confirm(`¿Eliminar el grado "${l.name}"?`)) return;
    const d = await crudDelete("/api/grade-levels", l.id, user.institution.id, user.id);
    if (d.ok) load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Grados ({levels.length})</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setForm({ code: "", name: "", sortOrder: levels.length + 1, active: true }); setShowForm(true); }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : levels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin grados. Cree Prejardín, Jardín, Transición y 1° a 11°.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Orden</th>
                  <th className="py-2 pr-3 font-medium">Código</th>
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Grupos</th>
                  <th className="py-2 pr-3 font-medium">En planes</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {levels.map((l) => (
                    <tr key={l.id} className="hairline-b">
                      <td className="py-2 pr-3 font-mono">{l.sortOrder}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{l.code}</td>
                      <td className="py-2 pr-3">{l.name}</td>
                      <td className="py-2 pr-3 tabular-nums">{l._count?.groups ?? 0}</td>
                      <td className="py-2 pr-3 tabular-nums">{l._count?.planItems ?? 0}</td>
                      <td className="py-2 pr-3">{l.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(l); setForm({ code: l.code, name: l.name, sortOrder: l.sortOrder, active: l.active }); setShowForm(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editing ? "Editar grado" : "Crear grado"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Código *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="6, T, PJ..." className="font-mono" /></div>
              <div><Label>Orden</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Grado 6°" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} id="gl-act" /><Label htmlFor="gl-act" className="cursor-pointer">Activo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.code.trim() || !form.name.trim()} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// TAB: ÁREAS (catálogo)
// ============================================================

function KnowledgeAreasTab() {
  const user = useAuthStore((s) => s.user)!;
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AreaRow | null>(null);
  const [form, setForm] = useState({ name: "", abbreviation: "", sortOrder: 0, active: true });
  const [subjects, setSubjects] = useState<SubjectFormRow[]>([]);

  // Validación bloqueante: con ≥1 asignatura, la suma de porcentajes debe ser 100
  const totalPct = subjects.reduce((s, r) => s + (r.percentage || 0), 0);
  const pctValid = subjects.length === 0 || totalPct === 100;
  const missingNames = subjects.some((r) => !r.name.trim());
  const canSave = form.name.trim().length > 0 && pctValid && !missingNames;

  function addSubj() {
    setSubjects((prev) => [...prev, { key: crypto.randomUUID(), name: "", abbreviation: "", averages: true, active: true, percentage: 0 }]);
  }

  function updSubj(key: string, patch: Partial<SubjectFormRow>) {
    setSubjects((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function delSubj(key: string) {
    setSubjects((prev) => prev.filter((r) => r.key !== key));
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", abbreviation: "", sortOrder: areas.length + 1, active: true });
    setSubjects([]);
    setShowForm(true);
  }

  function openEdit(a: AreaRow) {
    setEditing(a);
    setForm({ name: a.name, abbreviation: a.abbreviation || "", sortOrder: a.sortOrder, active: a.active });
    setSubjects((a.subjects ?? []).map((s) => ({ key: s.id, id: s.id, name: s.name, abbreviation: s.abbreviation || "", averages: s.averages, active: s.active, percentage: s.percentage ?? 0 })));
    setShowForm(true);
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/knowledge-areas?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setAreas(d.areas); })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!canSave) return;
    const payload = {
      ...form,
      abbreviation: form.abbreviation || null,
      subjects: subjects.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(),
        abbreviation: r.abbreviation || null,
        averages: r.averages,
        active: r.active,
        percentage: r.percentage,
      })),
    };
    const d = editing
      ? await crudPatch("/api/knowledge-areas", { id: editing.id, institutionId: user.institution.id, userId: user.id, ...payload }, "Área y asignaturas actualizadas")
      : await crudPost("/api/knowledge-areas", { institutionId: user.institution.id, userId: user.id, ...payload }, "Área y asignaturas creadas");
    if (d.ok) { setShowForm(false); setEditing(null); setSubjects([]); load(); }
  }

  async function del(a: AreaRow) {
    const count = a._count?.subjects ?? 0;
    if (!confirm(`¿Eliminar el área "${a.name}"?${count ? ` ${count} asignatura(s) quedarán sin área.` : ""}`)) return;
    const d = await crudDelete("/api/knowledge-areas", a.id, user.institution.id, user.id);
    if (d.ok) load();
  }

  return (
    <>
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Áreas del conocimiento ({areas.length})</CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
          ) : areas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin áreas. Cree Humanidades, Ciencias, Artes, Tecnología...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Orden</th>
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Abreviatura</th>
                  <th className="py-2 pr-3 font-medium">Asignaturas</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.id} className="hairline-b">
                      <td className="py-2 pr-3 font-mono">{a.sortOrder}</td>
                      <td className="py-2 pr-3">{a.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{a.abbreviation || "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{a._count?.subjects ?? 0}</td>
                      <td className="py-2 pr-3">{a.active ? <Badge className="chip-superior text-[10px]">Activo</Badge> : <Badge variant="outline" className="hairline text-[10px]">Inactivo</Badge>}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="sm:max-w-[680px] flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
          <DialogHeader className="flex-shrink-0"><DialogTitle>{editing ? "Editar área" : "Crear área"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 overflow-y-auto flex-1">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Humanidades, Ciencias Naturales..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Abreviatura</Label><Input value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} placeholder="HUM" className="font-mono" /></div>
              <div><Label>Orden</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} id="ka-act" /><Label htmlFor="ka-act" className="cursor-pointer">Activo</Label></div>

            <div className="hairline-t pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Plus className="h-3.5 w-3.5" /> Asignaturas
              </div>
              {subjects.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span className="col-span-3">Nombre *</span>
                  <span className="col-span-2">Abreviatura</span>
                  <span className="col-span-1 text-center">Promedio</span>
                  <span className="col-span-1 text-center">Estado</span>
                  <span className="col-span-4">Porcentaje</span>
                  <span className="col-span-1" />
                </div>
              )}
              {subjects.map((r) => (
                <div key={r.key} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-3 h-8" placeholder="Matemáticas" value={r.name} onChange={(e) => updSubj(r.key, { name: e.target.value })} />
                  <Input className="col-span-2 h-8 font-mono" placeholder="MAT" value={r.abbreviation} onChange={(e) => updSubj(r.key, { abbreviation: e.target.value })} />
                  <div className="col-span-1 flex justify-center"><Checkbox checked={r.averages} onCheckedChange={(v) => updSubj(r.key, { averages: v === true })} aria-label="Promedia" /></div>
                  <div className="col-span-1 flex justify-center"><Checkbox checked={r.active} onCheckedChange={(v) => updSubj(r.key, { active: v === true })} aria-label="Activa" /></div>
                  <div className="col-span-4 flex items-center gap-2">
                    <Slider className="flex-1" value={[r.percentage]} min={0} max={100} step={1} onValueChange={(v) => updSubj(r.key, { percentage: v[0] ?? 0 })} />
                    <Input type="number" min={0} max={100} className="h-8 w-14 tabular-nums" value={r.percentage} onChange={(e) => updSubj(r.key, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                  </div>
                  <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-destructive" onClick={() => delSubj(r.key)} aria-label="Eliminar asignatura"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addSubj}><Plus className="h-3.5 w-3.5" /> Agregar asignatura</Button>
              {subjects.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="tabular-nums text-muted-foreground">Total: {totalPct}%</span>
                  {!pctValid && <span className="text-destructive">Los porcentajes deben sumar 100% (actual: {totalPct}%)</span>}
                  {pctValid && missingNames && <span className="text-destructive">Completa el nombre de todas las asignaturas</span>}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!canSave} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// Helpers CRUD (mismo contrato que params-view)
// ============================================================

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
