"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import {
  parseImportWorkbook,
  summarizeCells,
  type ImportCell,
  type ParsedSheet,
} from "./xlsx-parse";
import {
  applyGradeImport,
  previewGradeImport,
  type ImportPlan,
  type ImportSummary,
} from "@/lib/actions/grades-import";

type GroupOpt = { id: string; name: string };
type SubjectOpt = { groupId: string; groupName: string; subjectId: string; subjectName: string };
type PeriodOpt = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: GroupOpt[];
  subjects: SubjectOpt[];
  periods: PeriodOpt[];
  onImported: () => void;
};

// Wizard de importación Excel (dentro de Notas parciales):
// Paso 1 archivo+alcance → Paso 2 preview del plan → Paso 3 aplicar (transacción).
export function ImportWizardModal({ open, onOpenChange, groups, subjects, periods, onImported }: Props) {
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectOptions = useMemo(
    () => subjects.filter((s) => !groupId || s.groupId === groupId),
    [subjects, groupId]
  );
  const cellStats = useMemo(
    () => (parsed ? summarizeCells(parsed.rows, parsed.columns.length) : null),
    [parsed]
  );

  const reset = () => {
    setStep(1);
    setParsed(null);
    setPlan(null);
    setSummary(null);
    setError(null);
    setBusy(false);
    setFileName("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File | null) => {
    setParsed(null);
    setPlan(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const result = parseImportWorkbook(buf);
      setParsed(result);
      if (result.errors.length) setError(result.errors.join(" "));
    } catch {
      setError("No se pudo leer el archivo. Asegúrate de que sea .xlsx válido.");
    }
  };

  const handlePreview = async () => {
    if (!user || !parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await previewGradeImport({
        userId: user.id,
        groupId,
        subjectId,
        periodId,
        sheet: { columns: parsed.columns, rows: parsed.rows },
      });
      if (!res.success || !res.plan) {
        setError(res.error ?? "No se pudo generar el preview.");
        return;
      }
      setPlan(res.plan);
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!user || !parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await applyGradeImport({
        userId: user.id,
        groupId,
        subjectId,
        periodId,
        sheet: { columns: parsed.columns, rows: parsed.rows },
      });
      if (!res.success || !res.summary) {
        setError(res.error ?? "No se pudo aplicar la importación.");
        return;
      }
      setSummary(res.summary);
      setStep(3);
      toast.success(
        `Importación aplicada: ${res.summary.gradesUpserted} nota(s), ${res.summary.attendanceCreated + res.summary.attendanceUpdated} asistencia(s)`
      );
      onImported();
    } finally {
      setBusy(false);
    }
  };

  const step1Ready = Boolean(groupId && subjectId && periodId && parsed && parsed.columns.length > 0 && parsed.rows.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Importar Excel — Actividades, Notas y Asistencias
          </DialogTitle>
          <DialogDescription>
            Columnas: &quot;Concepto - Actividad - dd/mm/aaaa&quot;. Celdas: nota 0–5, fecha (asistencia
            presente), X falta, E excusa, T tarde, T(3.5) tarde con nota. Siempre verás un preview
            antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        {/* Paso 1: alcance + archivo */}
        <section className="space-y-3">
          <p className="text-sm font-medium">1. Alcance y archivo</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select
              value={groupId}
              onValueChange={(v) => {
                setGroupId(v);
                setSubjectId("");
              }}
            >
              <SelectTrigger aria-label="Grupo"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!groupId}>
              <SelectTrigger aria-label="Asignatura"><SelectValue placeholder="Asignatura" /></SelectTrigger>
              <SelectContent>
                {subjectOptions.map((s) => (
                  <SelectItem key={s.subjectId} value={s.subjectId}>
                    {s.subjectName} · {s.groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger aria-label="Periodo"><SelectValue placeholder="Periodo" /></SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
          />
          {fileName && <p className="text-xs text-muted-foreground">Archivo: {fileName}</p>}
          {parsed && cellStats && (
            <div className="rounded-md border bg-muted/40 p-2 text-xs">
              {parsed.columns.length} columna(s) · {parsed.rows.length} estudiante(s) ·{" "}
              {cellStats.grades} nota(s) · {cellStats.presente} presente · {cellStats.ausente} faltas ·{" "}
              {cellStats.excusa} excusas · {cellStats.tarde} tardes · {cellStats.tardeConNota} tarde+nota ·{" "}
              {cellStats.empty} vacías
              {cellStats.invalid.length > 0 && (
                <div className="mt-1 text-destructive">
                  Celdas inválidas ({cellStats.invalid.length}):{" "}
                  {cellStats.invalid.slice(0, 5).map((i) => `${i.student} → "${i.raw}" (${i.reason})`).join("; ")}
                  {cellStats.invalid.length > 5 ? " …" : ""}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handlePreview} disabled={!step1Ready || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Ver preview"}
            </Button>
          </div>
        </section>

        {/* Paso 2: preview del plan */}
        {plan && step >= 2 && (
          <section className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">2. Preview — se aplicará esto:</p>
            <div className="space-y-1 text-xs">
              {plan.activities.map((a) => (
                <div key={a.index} className="flex items-center gap-2">
                  {a.error ? (
                    <span className="text-destructive">✗ {a.concept} - {a.activityName}: {a.error}</span>
                  ) : a.willCreate ? (
                    <span>+ Crear actividad <b>{a.activityName}</b> ({a.concept})</span>
                  ) : (
                    <span>✓ Reutilizar <b>{a.activityName}</b> ({a.concept})</span>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-md bg-muted/40 p-2 text-xs">
              Estudiantes: {plan.students.filter((s) => s.studentId).length}/{plan.students.length} reconocidos
              {plan.students.some((s) => !s.studentId) && (
                <span className="text-amber-600">
                  {" "}· Omitidos: {plan.students.filter((s) => !s.studentId).map((s) => s.name).join(", ")}
                </span>
              )}
            </div>
            {plan.warnings.length > 0 && (
              <ul className="list-inside list-disc text-xs text-amber-600">
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={busy || plan.activities.some((a) => a.error)}
                className="bg-emerald-600 hover:bg-emerald-600/90"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Aplicar importación"}
              </Button>
            </div>
          </section>
        )}

        {/* Paso 3: resultado */}
        {summary && step >= 3 && (
          <section className="space-y-1 border-t pt-3 text-xs">
            <p className="text-sm font-medium text-emerald-600">3. Importación aplicada</p>
            <p>
              Actividades creadas: <b>{summary.activitiesCreated}</b> · reutilizadas:{" "}
              <b>{summary.activitiesReused}</b> · notas: <b>{summary.gradesUpserted}</b> · asistencias
              nuevas: <b>{summary.attendanceCreated}</b> · actualizadas: <b>{summary.attendanceUpdated}</b>
            </p>
            {summary.skippedStudents.length > 0 && (
              <p className="text-amber-600">Filas omitidas: {summary.skippedStudents.join(", ")}</p>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Re-exportado para tipado del caller sin exponer el union completo.
export type { ImportCell };
