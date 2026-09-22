"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ClipboardList,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AddActivityModal,
  type ActivityFormData,
  type EditableActivity,
} from "./add-activity-modal";

// === [F3] Módulo "Gestión de Actividades" (captura 3) ===
// Vista consolidada: todas las asignaciones del plan activo × sus actividades
// del periodo seleccionado, agrupadas por concepto evaluativo.
// Semántica documentada:
//  - Barra de progreso: cobertura de notas = registros / (estudiantes activos × actividades).
//  - Toggle "Agrupar": filas anidadas bajo su grupo vs. listado plano.
//  - Selección masiva: por asignación; acción = eliminar TODAS sus actividades.

interface PlanLite {
  id: string;
  name: string;
  active: boolean;
  educationalModelId: string;
}
interface PlanItemLite {
  subjectId: string;
  subject: { name: string };
  gradeLevelId: string;
}
interface PeriodLite {
  id: string;
  name: string;
  active: boolean;
  closed: boolean;
  order: number | null;
  educationalModelId: string | null;
}
interface ConceptLite {
  id: string;
  name: string;
  percentage: number;
  order: number;
  educationalModelId: string;
}
interface GroupLite {
  id: string;
  name: string;
  gradeLevel: { id: string; code: string; name: string } | null;
}
interface BulkActivity {
  id: string;
  name: string;
  label?: string | null;
  isGeneral: boolean;
  evaluativeConceptId: string;
  groupId: string;
  subjectId: string;
  group: { id: string; name: string };
  subject: { id: string; name: string };
  evaluativeConcept: { id: string; name: string; percentage: number; order: number };
  _count: { records: number };
}

interface Assignment {
  key: string; // `${groupId}::${subjectId}`
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ActivitiesManagementView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id ?? null;

  // Catálogos
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [planItems, setPlanItems] = useState<PlanItemLite[]>([]);
  const [periods, setPeriods] = useState<PeriodLite[]>([]);
  const [concepts, setConcepts] = useState<ConceptLite[]>([]);
  const [groups, setGroups] = useState<GroupLite[]>([]);
  const [yearLabel, setYearLabel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Selección / UI
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [periodCardVisible, setPeriodCardVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Datos
  const [bulkActivities, setBulkActivities] = useState<BulkActivity[]>([]);
  const [countsByGroup, setCountsByGroup] = useState<Record<string, number>>({});
  const [loadingActs, setLoadingActs] = useState(false);

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [createIsGeneral, setCreateIsGeneral] = useState(false);
  const [editTarget, setEditTarget] = useState<(BulkActivity & { key: string }) | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const activePlan = useMemo(() => plans.find((p) => p.active) ?? plans[0] ?? null, [plans]);
  const modelPeriods = useMemo(
    () =>
      periods
        .filter((p) => p.educationalModelId === activePlan?.educationalModelId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [periods, activePlan]
  );
  const modelConcepts = useMemo(
    () =>
      concepts
        .filter((c) => c.educationalModelId === activePlan?.educationalModelId)
        .sort((a, b) => a.order - b.order),
    [concepts, activePlan]
  );

  // Bootstrap de catálogos (misma cadena que Calificaciones)
  useEffect(() => {
    if (!institutionId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/curriculum-plans?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/periods?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/evaluative-concepts?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/groups?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/academic-years?institutionId=${institutionId}`).then((r) => r.json()),
    ])
      .then(([plansR, periodsR, conceptsR, groupsR, yearsR]) => {
        if (plansR?.ok) setPlans(plansR.plans ?? []);
        if (periodsR?.ok) setPeriods(periodsR.periods ?? []);
        if (conceptsR?.ok) setConcepts(conceptsR.concepts ?? []);
        if (groupsR?.ok) setGroups(groupsR.groups ?? []);
        const activeYear = (yearsR?.years ?? []).find((y: { active?: boolean }) => y.active);
        if (activeYear?.year) setYearLabel(String(activeYear.year));
      })
      .catch(() => toast.error("Error cargando catálogos"))
      .finally(() => setLoading(false));
  }, [institutionId]);

  useEffect(() => {
    if (!institutionId || !activePlan?.id) return;
    fetch(`/api/curriculum-plans?institutionId=${institutionId}&id=${activePlan.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) setPlanItems(res.plan?.items ?? []);
      })
      .catch(() => toast.error("Error cargando el plan de estudios"));
  }, [institutionId, activePlan?.id]);

  useEffect(() => {
    if (modelPeriods.length === 0 || modelPeriods.some((p) => p.id === selectedPeriodId)) return;
    setSelectedPeriodId(modelPeriods.find((p) => p.active)?.id ?? modelPeriods[0].id);
  }, [modelPeriods, selectedPeriodId]);

  // Asignaciones del plan activo (grupo con grado × asignaturas del grado)
  const assignments = useMemo<Assignment[]>(() => {
    const out: Assignment[] = [];
    const sortedGroups = [...groups].sort(
      (a, b) =>
        (a.gradeLevel?.code ?? a.name).localeCompare(b.gradeLevel?.code ?? b.name, "es") ||
        a.name.localeCompare(b.name, "es")
    );
    for (const g of sortedGroups) {
      if (!g.gradeLevel) continue;
      const items = planItems.filter((i) => i.gradeLevelId === g.gradeLevel!.id);
      for (const it of items) {
        out.push({
          key: `${g.id}::${it.subjectId}`,
          groupId: g.id,
          groupName: g.name,
          subjectId: it.subjectId,
          subjectName: it.subject.name,
        });
      }
    }
    return out;
  }, [groups, planItems]);

  // Actividades del periodo (listado institucional)
  const loadActivities = useCallback(() => {
    if (!institutionId || !selectedPeriodId) return;
    setLoadingActs(true);
    fetch(`/api/activities?institutionId=${institutionId}&periodId=${selectedPeriodId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) {
          setBulkActivities(res.activities ?? []);
          setCountsByGroup(res.countsByGroup ?? {});
        } else {
          toast.error(res?.error ?? "Error cargando actividades");
        }
      })
      .catch(() => toast.error("Error cargando actividades"))
      .finally(() => setLoadingActs(false));
  }, [institutionId, selectedPeriodId]);

  useEffect(() => {
    loadActivities();
    setSelected(new Set());
  }, [loadActivities]);

  const selectedPeriod = modelPeriods.find((p) => p.id === selectedPeriodId) ?? null;
  const periodClosed = selectedPeriod?.closed ?? false;

  // Actividades indexadas por asignación y por concepto
  const actsByAssignment = useMemo(() => {
    const m = new Map<string, BulkActivity[]>();
    for (const a of bulkActivities) {
      const k = `${a.groupId}::${a.subjectId}`;
      const arr = m.get(k) ?? [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort((x, y) => x.evaluativeConcept.order - y.evaluativeConcept.order || x.name.localeCompare(y.name));
    }
    return m;
  }, [bulkActivities]);

  const filteredAssignments = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return assignments;
    return assignments.filter(
      (a) => norm(a.groupName).includes(q) || norm(a.subjectName).includes(q)
    );
  }, [assignments, query]);

  const coverage = useCallback(
    (a: Assignment): number => {
      const acts = actsByAssignment.get(a.key) ?? [];
      if (acts.length === 0) return 0;
      const students = countsByGroup[a.groupId] ?? 0;
      if (students === 0) return 0;
      const records = acts.reduce((n, act) => n + act._count.records, 0);
      return Math.min(100, Math.round((records / (students * acts.length)) * 100));
    },
    [actsByAssignment, countsByGroup]
  );

  // Crear actividad desde F3 (dropdown: general / personalizada)
  const handleCreate = useCallback(
    async (assignmentKey: string, data: ActivityFormData) => {
      const a = assignments.find((x) => x.key === assignmentKey);
      if (!a || !institutionId || !selectedPeriodId) return false;
      try {
        const res = await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutionId,
            groupId: a.groupId,
            subjectId: a.subjectId,
            periodId: selectedPeriodId,
            ...data,
          }),
        }).then((r) => r.json());
        if (res?.ok) {
          toast.success(`Actividad "${res.activity?.name ?? ""}" creada`);
          loadActivities();
          return true;
        }
        toast.error(res?.error ?? "Error creando la actividad");
        return false;
      } catch {
        toast.error("Error creando la actividad");
        return false;
      }
    },
    [assignments, institutionId, selectedPeriodId, loadActivities]
  );

  // Editar actividad (chip → lápiz)
  const handleUpdate = useCallback(
    async (id: string, data: ActivityFormData) => {
      try {
        const res = await fetch("/api/activities", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...data }),
        }).then((r) => r.json());
        if (res?.ok) {
          toast.success("Actividad actualizada");
          setEditTarget(null);
          loadActivities();
          return true;
        }
        toast.error(res?.error ?? "Error actualizando la actividad");
        return false;
      } catch {
        toast.error("Error actualizando la actividad");
        return false;
      }
    },
    [loadActivities]
  );

  // Eliminación masiva (todas las actividades de las asignaciones seleccionadas)
  const selectedActs = useMemo(() => {
    const out: BulkActivity[] = [];
    for (const key of selected) out.push(...(actsByAssignment.get(key) ?? []));
    return out;
  }, [selected, actsByAssignment]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedActs.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/activities?ids=${selectedActs.map((a) => a.id).join(",")}`, {
        method: "DELETE",
      }).then((r) => r.json());
      if (res?.ok) {
        toast.success(
          `${res.deleted} actividad(es) eliminada(s)` +
            (res.recordsDeleted > 0 ? ` · ${res.recordsDeleted} nota(s) borrada(s)` : "")
        );
        setBulkConfirm(false);
        setSelected(new Set());
        loadActivities();
      } else {
        toast.error(res?.error ?? "Error eliminando actividades");
      }
    } catch {
      toast.error("Error eliminando actividades");
    } finally {
      setBusy(false);
    }
  }, [selectedActs, busy, loadActivities]);

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Cargando gestión de actividades…
      </div>
    );
  }
  if (!activePlan) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No hay un plan de estudios activo. Configúrelo en Plan de estudios.
      </div>
    );
  }

  const periodLabel = selectedPeriod
    ? [yearLabel, selectedPeriod.name].filter(Boolean).join(" - ")
    : "Seleccione un periodo";

  // Fila de una asignación
  const renderAssignmentRow = (a: Assignment) => {
    const acts = actsByAssignment.get(a.key) ?? [];
    const isSelected = selected.has(a.key);
    return (
      <tr key={a.key} className="border-b transition-colors hover:bg-muted/30">
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-start gap-3">
            <Checkbox
              aria-label={`Seleccionar ${a.groupName} ${a.subjectName}`}
              checked={isSelected}
              onCheckedChange={() => toggleSelected(a.key)}
              className="mt-1"
            />
            <div className="min-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="inline-flex shrink-0 items-center rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  {a.groupName}
                </span>
                <span className="truncate text-sm font-semibold uppercase">{a.subjectName}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Progress value={coverage(a)} className="h-2 w-40" />
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {coverage(a)}%
                </span>
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {modelConcepts.map((c) => {
              const cActs = acts.filter((x) => x.evaluativeConceptId === c.id);
              return (
                <div key={c.id} className="min-w-[140px]">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {c.name} [{c.percentage}%]
                  </p>
                  {cActs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/70">Sin actividades</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {cActs.map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          disabled={periodClosed}
                          onClick={() => setEditTarget({ ...act, key: a.key })}
                          title={
                            periodClosed
                              ? `${act.name} — periodo cerrado`
                              : `${act.name} · ${act._count.records} nota(s)`
                          }
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ListChecks className="h-3 w-3" />
                          {act.label ?? act.name}
                          {act.isGeneral ? " ★" : ""}
                          {!periodClosed && <Pencil className="h-2.5 w-2.5 opacity-60" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold uppercase">
          <ClipboardList className="h-6 w-6 text-primary" />
          Gestión de Actividades
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Card de periodo con chevron (cambiar) y X (ocultar) */}
          {periodCardVisible ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      periodClosed
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    )}
                  >
                    {periodClosed ? "Periodo cerrado" : "Periodo abierto"}
                  </span>
                  <span className="font-semibold">{periodLabel}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {modelPeriods.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setSelectedPeriodId(p.id)}>
                    {[yearLabel, p.name].filter(Boolean).join(" - ")}
                    {p.id === selectedPeriodId ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setPeriodCardVisible(true)}>
              {periodLabel}
            </Button>
          )}
          {periodCardVisible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Ocultar tarjeta de periodo"
              onClick={() => setPeriodCardVisible(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar: buscador + agregar + agrupar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar asignación"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="agrupar" className="cursor-pointer text-xs text-muted-foreground">
              Agrupar
            </Label>
            <Switch id="agrupar" checked={grouped} onCheckedChange={setGrouped} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={periodClosed}>
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setCreateIsGeneral(true);
                  setCreateOpen(true);
                }}
              >
                Actividad general
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCreateIsGeneral(false);
                  setCreateOpen(true);
                }}
              >
                Actividad personalizada
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-muted-foreground"
                onClick={() => toast.info("Banco de cuestionarios: próximamente")}
              >
                Banco cuestionarios
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {periodClosed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          El periodo está cerrado: las actividades no se pueden agregar, editar ni eliminar.
        </p>
      )}

      {/* Selección masiva */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2 text-xs">
          <span>
            {selected.size} asignación(es) seleccionada(s) · {selectedActs.length} actividad(es)
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedActs.length === 0}
            onClick={() => setBulkConfirm(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Eliminar actividades
          </Button>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="w-[380px] px-3 py-2">Asignación</th>
              <th className="px-3 py-2">Actividades por concepto evaluativo</th>
            </tr>
          </thead>
          {grouped ? (
            Object.entries(
              filteredAssignments.reduce<Record<string, Assignment[]>>((acc, a) => {
                (acc[a.groupName] = acc[a.groupName] ?? []).push(a);
                return acc;
              }, {})
            ).map(([groupName, rows]) => (
              <tbody key={groupName}>
                <tr className="border-b bg-muted/30">
                  <td colSpan={2} className="px-3 py-1.5 text-xs font-bold uppercase text-muted-foreground">
                    {groupName} ({rows.length})
                  </td>
                </tr>
                {rows.map(renderAssignmentRow)}
              </tbody>
            ))
          ) : (
            <tbody>{filteredAssignments.map(renderAssignmentRow)}</tbody>
          )}
        </table>
        {!loadingActs && filteredAssignments.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No hay asignaciones que coincidan con la búsqueda.
          </p>
        )}
        {loadingActs && (
          <p className="p-6 text-center text-sm text-muted-foreground">Cargando actividades…</p>
        )}
      </div>

      {/* Crear actividad (con selector de asignación) */}
      <AddActivityModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        concepts={modelConcepts.map((c) => ({ id: c.id, name: c.name, percentage: c.percentage }))}
        assignments={assignments.map((a) => ({
          key: a.key,
          label: `${a.groupName} · ${a.subjectName}`,
        }))}
        presetIsGeneral={createIsGeneral}
        onCreate={async (data, assignmentKey) => {
          if (!assignmentKey) return false;
          return handleCreate(assignmentKey, data);
        }}
      />

      {/* Editar actividad (chip) */}
      <AddActivityModal
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        concepts={modelConcepts.map((c) => ({ id: c.id, name: c.name, percentage: c.percentage }))}
        editActivity={
          editTarget
            ? {
                id: editTarget.id,
                name: editTarget.label ?? editTarget.name, // se edita el título visual
                conceptId: editTarget.evaluativeConceptId,
                isGeneral: editTarget.isGeneral,
              }
            : null
        }
        onUpdate={handleUpdate}
      />

      {/* Confirmación de borrado masivo */}
      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {selectedActs.length} actividad(es) de {selected.size} asignación(es)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también las notas registradas para estas actividades.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
