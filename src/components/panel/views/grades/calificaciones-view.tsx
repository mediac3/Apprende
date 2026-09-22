"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { GradesSidebar, type SidebarSubject } from "./grades-sidebar";
import { GradesToolbar } from "./grades-toolbar";
import {
  GradesSpreadsheet,
  type SheetConcept,
  type SheetActivity,
} from "./grades-spreadsheet";
import {
  AddActivityModal,
  type EditableActivity,
} from "./add-activity-modal";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useGradesCalculations,
  type ConceptColumn,
  type StudentRow,
  isValidNote,
  parseNote,
} from "./use-grades-calculations";

// === Módulo Calificaciones: contenedor principal ===
// Cadena: Grupo → Grado (GradeLevel) → Plan activo (CurriculumPlan) →
// Modelo educativo (periodos + conceptos con %).

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

const ORDINALS = ["1ER", "2DO", "3ER", "4TO", "5TO", "6TO"];

function periodSubtitle(periods: PeriodLite[], periodId: string | null): string {
  const idx = periods.findIndex((p) => p.id === periodId);
  if (idx < 0) return "NOTAS PARCIALES";
  return `NOTAS PARCIALES · ${ORDINALS[idx] ?? `${idx + 1}º`} PERIODO`;
}

export function CalificacionesView() {
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

  // Selección
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selected, setSelected] = useState<SidebarSubject | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // [C4] modal overlay, se abre con la Lupa

  // Planilla
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [activities, setActivities] = useState<SheetActivity[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  // [comentarios] comentarios por celda + modo edición + diálogo
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentMode, setCommentMode] = useState(false);
  const [commentsVersion, setCommentsVersion] = useState(0);
  const [commentDialog, setCommentDialog] = useState<{
    key: string;
    studentName: string;
    activityName: string;
  } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // [F1] concepto precargado al abrir el modal desde el botón "+" del concepto
  const [modalPresetConceptId, setModalPresetConceptId] = useState<string | null>(null);
  // [F2] actividad en edición / en confirmación de borrado
  const [editingActivity, setEditingActivity] = useState<EditableActivity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<SheetActivity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activePlan = useMemo(
    () => plans.find((p) => p.active) ?? plans[0] ?? null,
    [plans]
  );
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

  // Bootstrap: catálogos de la institución
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
      .catch(() => toast.error("Error cargando catálogos de calificaciones"))
      .finally(() => setLoading(false));
  }, [institutionId]);

  // Detalle del plan activo: asignaturas por grado
  useEffect(() => {
    if (!institutionId || !activePlan?.id) return;
    fetch(`/api/curriculum-plans?institutionId=${institutionId}&id=${activePlan.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) setPlanItems(res.plan?.items ?? []);
      })
      .catch(() => toast.error("Error cargando el plan de estudios"));
  }, [institutionId, activePlan?.id]);

  // Periodo por defecto: el activo del modelo, si no el primero
  useEffect(() => {
    if (modelPeriods.length === 0 || modelPeriods.some((p) => p.id === selectedPeriodId)) return;
    setSelectedPeriodId(modelPeriods.find((p) => p.active)?.id ?? modelPeriods[0].id);
  }, [modelPeriods, selectedPeriodId]);

  // Asignaturas del sidebar: grupo × asignatura del plan para su grado
  const sidebarSubjects = useMemo<SidebarSubject[]>(() => {
    const out: SidebarSubject[] = [];
    const sortedGroups = [...groups].sort((a, b) =>
      (a.gradeLevel?.code ?? a.name).localeCompare(b.gradeLevel?.code ?? b.name, "es") ||
      a.name.localeCompare(b.name, "es")
    );
    for (const g of sortedGroups) {
      if (!g.gradeLevel) continue;
      const items = planItems.filter((i) => i.gradeLevelId === g.gradeLevel!.id);
      for (const it of items) {
        out.push({
          groupId: g.id,
          groupName: g.name,
          subjectId: it.subjectId,
          subjectName: it.subject.name,
        });
      }
    }
    return out;
  }, [groups, planItems]);

  // Selección efectiva [C4]: la elegida por el usuario o, por defecto, la primera
  // disponible (derivado, sin efecto: al recargar vuelve al primer item).
  const activeSubject = selected ?? sidebarSubjects[0] ?? null;

  // Cargar planilla al cambiar selección o periodo
  const loadSheet = useCallback(
    (sel: SidebarSubject, periodId: string) => {
      fetch(
        `/api/grade-records?groupId=${sel.groupId}&subjectId=${sel.subjectId}&periodId=${periodId}`
      )
        .then((r) => r.json())
        .then((res) => {
          if (!res?.ok) {
            toast.error(res?.error ?? "Error cargando la planilla");
            return;
          }
          setStudents(
            (res.students ?? []).map((s: { id: string; code: string; firstName: string; lastName: string }) => ({
              studentId: s.id,
              code: s.code,
              fullName: `${s.lastName} ${s.firstName}`.trim(),
            }))
          );
          setActivities(
            (res.activities ?? []).map((a: { id: string; name: string; label?: string | null; evaluativeConceptId: string; isGeneral: boolean }) => ({
              id: a.id,
              name: a.name,
              label: a.label ?? null,
              conceptId: a.evaluativeConceptId,
              isGeneral: a.isGeneral,
            }))
          );
          const v: Record<string, string> = {};
          for (const r of res.records ?? []) {
            v[`${r.studentId}::${r.activityId}`] = String(r.value);
          }
          setValues(v);
          setDirty(new Set());
        })
        .catch(() => toast.error("Error cargando la planilla"));
      // [comentarios] comentarios existentes de la planilla
      fetch(
        `/api/grade-comments?groupId=${sel.groupId}&subjectId=${sel.subjectId}&periodId=${periodId}`
      )
        .then((r) => r.json())
        .then((res) => {
          if (res?.ok) setComments(res.comments ?? {});
        })
        .catch(() => {});
    },
    []
  );

  useEffect(() => {
    if (activeSubject && selectedPeriodId) loadSheet(activeSubject, selectedPeriodId);
  }, [activeSubject, selectedPeriodId, loadSheet]);

  // [comentarios] precargar el texto del comentario al abrir el diálogo
  useEffect(() => {
    setCommentText(commentDialog ? comments[commentDialog.key] ?? "" : "");
  }, [commentDialog, comments]);

  // [comentarios] guardar/eliminar el comentario de la celda
  const handleSaveComment = useCallback(() => {
    if (!commentDialog || !user) return;
    const [studentId, activityId] = commentDialog.key.split("::");
    const text = commentText.trim();
    fetch("/api/grade-comments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: user.institution.id,
        userId: user.id,
        studentId,
        activityId,
        text,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res?.ok) {
          toast.error(res?.error ?? "Error guardando el comentario");
          return;
        }
        setComments((prev) => {
          const next = { ...prev };
          if (text) next[commentDialog.key] = text;
          else delete next[commentDialog.key];
          return next;
        });
        setCommentsVersion((v) => v + 1);
        setCommentDialog(null);
        toast.success(text ? "Comentario guardado" : "Comentario eliminado");
      })
      .catch(() => toast.error("Error de red al guardar el comentario"));
  }, [commentDialog, commentText, user]);

  // Cálculos al vuelo
  const conceptColumns = useMemo<ConceptColumn[]>(
    () =>
      modelConcepts.map((c) => ({
        conceptId: c.id,
        name: c.name,
        percentage: c.percentage,
        color: "",
        activityIds: activities.filter((a) => a.conceptId === c.id).map((a) => a.id),
      })),
    [modelConcepts, activities]
  );
  const calculations = useGradesCalculations(students, conceptColumns, values);

  const selectedPeriod = modelPeriods.find((p) => p.id === selectedPeriodId) ?? null;
  const periodClosed = selectedPeriod?.closed ?? false;
  const periodLabel = (p: PeriodLite) =>
    [yearLabel, p.name].filter(Boolean).join(" - ");

  // Edición de celda: valida 0.0-5.0 (vacío permitido)
  const handleCellChange = useCallback(
    (studentId: string, activityId: string, raw: string) => {
      if (periodClosed) return;
      if (raw.trim() !== "" && !isValidNote(raw)) {
        toast.error("Nota fuera de rango: debe estar entre 0.0 y 5.0");
        return;
      }
      const key = `${studentId}::${activityId}`;
      setValues((prev) => ({ ...prev, [key]: raw }));
      setDirty((prev) => new Set(prev).add(key));
    },
    [periodClosed]
  );

  // Guardar lote (transacción en servidor)
  const handleSave = useCallback(async () => {
    if (!activeSubject || dirty.size === 0 || saving) return;
    setSaving(true);
    try {
      const records = [...dirty].map((k) => {
        const [studentId, activityId] = k.split("::");
        return { studentId, activityId, value: parseNote(values[k] ?? "") };
      });
      const res = await fetch("/api/grade-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      }).then((r) => r.json());
      if (res?.ok) {
        toast.success(`Notas guardadas (${records.length} celdas)`);
        setDirty(new Set());
      } else {
        toast.error(res?.error ?? "Error guardando notas");
      }
    } catch {
      toast.error("Error guardando notas");
    } finally {
      setSaving(false);
    }
  }, [activeSubject, dirty, saving, values]);

  // Crear actividad (nueva sub-columna N… del concepto)
  const handleCreateActivity = useCallback(
    async (data: { evaluativeConceptId: string; name: string; isGeneral: boolean }) => {
      if (!activeSubject || !institutionId || !selectedPeriodId) return false;
      try {
        const res = await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutionId,
            groupId: activeSubject.groupId,
            subjectId: activeSubject.subjectId,
            periodId: selectedPeriodId,
            ...data,
          }),
        }).then((r) => r.json());
        if (res?.ok) {
          toast.success(`Actividad "${res.activity?.name ?? ""}" creada`);
          loadSheet(activeSubject, selectedPeriodId);
          return true;
        }
        toast.error(res?.error ?? "Error creando la actividad");
        return false;
      } catch {
        toast.error("Error creando la actividad");
        return false;
      }
    },
    [activeSubject, institutionId, selectedPeriodId, loadSheet]
  );

  // [F1] abrir modal con concepto precargado (botón "+" del header del concepto)
  const handleAddForConcept = useCallback((conceptId: string) => {
    setEditingActivity(null);
    setModalPresetConceptId(conceptId);
    setModalOpen(true);
  }, []);

  // Toolbar "Agregar": modal sin precarga (comportamiento original)
  const openCreateModal = useCallback(() => {
    setEditingActivity(null);
    setModalPresetConceptId(null);
    setModalOpen(true);
  }, []);

  // [F2] abrir modal de edición con nombre/tipo precargados (lápiz)
  const handleEditActivity = useCallback((a: SheetActivity) => {
    setModalPresetConceptId(null);
    setEditingActivity({
      id: a.id,
      name: a.label ?? a.name, // se edita el título visual
      conceptId: a.conceptId,
      isGeneral: a.isGeneral,
    });
    setModalOpen(true);
  }, []);

  // [F2] actualizar actividad (PUT /api/activities)
  const handleUpdateActivity = useCallback(
    async (
      id: string,
      data: { evaluativeConceptId: string; name: string; isGeneral: boolean }
    ) => {
      if (!activeSubject || !selectedPeriodId) return false;
      try {
        const res = await fetch("/api/activities", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...data }),
        }).then((r) => r.json());
        if (res?.ok) {
          toast.success("Actividad actualizada");
          loadSheet(activeSubject, selectedPeriodId);
          return true;
        }
        toast.error(res?.error ?? "Error actualizando la actividad");
        return false;
      } catch {
        toast.error("Error actualizando la actividad");
        return false;
      }
    },
    [activeSubject, selectedPeriodId, loadSheet]
  );

  // [F2] eliminar actividad con confirmación (borra notas en cascada)
  const handleDeleteActivity = useCallback(async () => {
    if (!deletingActivity || !activeSubject || !selectedPeriodId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/activities?id=${deletingActivity.id}`, {
        method: "DELETE",
      }).then((r) => r.json());
      if (res?.ok) {
        toast.success(
          res.recordsDeleted > 0
            ? `Actividad eliminada (${res.recordsDeleted} nota(s) borrada(s))`
            : "Actividad eliminada"
        );
        setDeletingActivity(null);
        loadSheet(activeSubject, selectedPeriodId);
      } else {
        toast.error(res?.error ?? "Error eliminando la actividad");
      }
    } catch {
      toast.error("Error eliminando la actividad");
    } finally {
      setDeleting(false);
    }
  }, [deletingActivity, activeSubject, selectedPeriodId, loadSheet, deleting]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Cargando sistema de calificaciones…
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
  if (modelConcepts.length === 0 || modelPeriods.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        El modelo educativo del plan activo no tiene periodos o conceptos evaluativos.
      </div>
    );
  }

  // [C3] min-h-full: la vista crece con la planilla; el scroll es el de la página
  return (
    <div className="flex min-h-full gap-2 p-2 md:gap-4 md:p-4">
      {/* [C4] Sidebar Modal overlay: se abre con la Lupa del toolbar */}
      <GradesSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        periods={modelPeriods.map((p) => ({ id: p.id, label: periodLabel(p) }))}
        selectedPeriodId={selectedPeriodId}
        onSelectPeriod={setSelectedPeriodId}
        currentPeriodLabel={
          selectedPeriod ? periodLabel(selectedPeriod) : modelPeriods[0]?.name ?? ""
        }
        subjects={sidebarSubjects}
        selected={activeSubject ? { groupId: activeSubject.groupId, subjectId: activeSubject.subjectId } : null}
        onSelectSubject={(s) => {
          setSelected(s);
          setSidebarOpen(false);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3">
        {activeSubject ? (
          <>
            <GradesToolbar
              groupName={activeSubject.groupName}
              subjectName={activeSubject.subjectName}
              subtitle={periodSubtitle(modelPeriods, selectedPeriodId)}
              onOpenSearch={() => setSidebarOpen(true)}
              onAdd={openCreateModal}
              onSave={handleSave}
              saving={saving}
              dirty={dirty.size > 0}
              commentMode={commentMode}
              onToggleCommentMode={() => setCommentMode((v) => !v)}
            />
            {periodClosed && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                El periodo está cerrado: las notas no se pueden editar.
              </p>
            )}
            {commentMode && (
              <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
                Modo comentario activo: toque una celda de actividad para escribir o editar su comentario.
              </p>
            )}
            <GradesSpreadsheet
              students={students}
              concepts={modelConcepts.map((c) => ({
                id: c.id,
                name: c.name,
                percentage: c.percentage,
                order: c.order,
              }))}
              activities={activities}
              values={values}
              calculations={calculations}
              periodClosed={periodClosed}
              onCellChange={handleCellChange}
              onAddActivityForConcept={handleAddForConcept}
              onEditActivity={handleEditActivity}
              onDeleteActivity={setDeletingActivity}
              comments={comments}
              commentMode={commentMode}
              commentsVersion={commentsVersion}
              onCellCommentRequest={setCommentDialog}
            />
            <p className={cn("text-[11px] text-muted-foreground", dirty.size > 0 && "text-amber-600")}>
              {dirty.size > 0
                ? `Hay ${dirty.size} celda(s) sin guardar. Use Guardar para persistir.`
                : "PROM y DEF se calculan automáticamente. Celdas en rojo: nota < 3.0."}
            </p>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border bg-card p-8 text-sm text-muted-foreground">
            No hay asignaturas para sus grupos en el plan activo. Use la lupa para
            buscar una asignatura y ver la planilla.
          </div>
        )}
      </div>

      <AddActivityModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        concepts={modelConcepts.map((c) => ({
          id: c.id,
          name: c.name,
          percentage: c.percentage,
        }))}
        onCreate={handleCreateActivity}
        presetConceptId={modalPresetConceptId}
        editActivity={editingActivity}
        onUpdate={handleUpdateActivity}
      />

      {/* [comentarios] diálogo de edición del comentario de una celda */}
      <Dialog open={!!commentDialog} onOpenChange={(o) => !o && setCommentDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base">Comentario de la celda</DialogTitle>
            <DialogDescription className="text-xs">
              {commentDialog?.studentName} · {commentDialog?.activityName}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Escriba el comentario de esta celda…"
            className="text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setCommentText("")}>
              Limpiar
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCommentDialog(null)}>
                Cancelar
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveComment}>
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* [F2] Confirmación de borrado: advierte que las notas se eliminan en cascada */}
      <AlertDialog
        open={deletingActivity !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingActivity(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la actividad "{deletingActivity?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también las notas registradas para esta actividad.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault(); // mantener el dialog abierto hasta terminar
                handleDeleteActivity();
              }}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
