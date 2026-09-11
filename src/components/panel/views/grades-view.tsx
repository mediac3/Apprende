"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Save,
  Calculator,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Group { id: string; name: string; }
interface Subject { id: string; name: string; area?: string | null; }
interface Period { id: string; name: string; active?: boolean; closed?: boolean; }
interface Grade {
  id: string;
  value: number | null;
  performance: string | null;
  observations: string | null;
  student: { id: string; firstName: string; lastName: string; code: string; };
  studentId: string;
  subjectId: string;
  periodId: string;
}
interface Student {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  groupId?: string | null;
}

const INDICADORES = ["Razonamiento", "Comunicación", "Resolución de problemas"];

export function GradesView({ mode = "default" }: { mode?: "default" | "indicadores" }) {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [periodId, setPeriodId] = useState<string>("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { value: string; obs: string }>>({});
  const [indicators, setIndicators] = useState<Record<string, Record<string, string>>>({});
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/groups?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/subjects?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/periods?institutionId=${user.institution.id}`).then((r) => r.json()),
    ])
      .then(([g, s, p]) => {
        if (g.ok) {
          setGroups(g.groups);
          if (g.groups[0]) setGroupId(g.groups[0].id);
        }
        if (s.ok) {
          setSubjects(s.subjects);
          if (s.subjects[0]) setSubjectId(s.subjects[0].id);
        }
        if (p.ok) {
          setPeriods(p.periods);
          const active = p.periods.find((x: Period) => x.active);
          setPeriodId(active?.id ?? p.periods[0]?.id ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || !groupId || !subjectId || !periodId) return;
    setLoading(true);
    fetch(
      `/api/grades?institutionId=${user.institution.id}&groupId=${groupId}&subjectId=${subjectId}&periodId=${periodId}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setGrades(d.grades);
          const studentMap: Record<string, Student> = {};
          d.grades.forEach((g: Grade) => {
            if (!studentMap[g.student.id]) {
              studentMap[g.student.id] = {
                id: g.student.id,
                code: g.student.code,
                firstName: g.student.firstName,
                lastName: g.student.lastName,
                groupId,
              };
            }
          });
          setStudents(Object.values(studentMap));
        }
      })
      .finally(() => setLoading(false));
  }, [user, groupId, subjectId, periodId]);

  function perfFromValue(v: number | null): string {
    if (v === null || isNaN(v as any)) return "—";
    if (v >= 90) return "superior";
    if (v >= 75) return "alto";
    if (v >= 60) return "basico";
    return "bajo";
  }

  function perfChip(perf: string): string {
    if (perf === "superior") return "chip-superior";
    if (perf === "alto") return "chip-alto";
    if (perf === "basico") return "chip-basico";
    return "chip-bajo";
  }

  function saveGrade(studentId: string, value: string, obs: string) {
    if (!user || !subjectId || !periodId) return;
    const num = value === "" ? null : Number(value);
    if (num !== null && (isNaN(num) || num < 0 || num > 100)) {
      toast.error("La nota debe estar entre 0 y 100");
      return;
    }
    setSaving((s) => ({ ...s, [studentId]: true }));
    // optimistic update
    setGrades((prev) => {
      const exists = prev.find((g) => g.studentId === studentId);
      const performance = num === null ? null : perfFromValue(num);
      if (exists) {
        return prev.map((g) =>
          g.studentId === studentId
            ? { ...g, value: num, performance, observations: obs }
            : g
        );
      } else {
        const student = students.find((s) => s.id === studentId);
        return [
          ...prev,
          {
            id: `opt-${studentId}`,
            value: num,
            performance,
            observations: obs,
            student: student
              ? { id: student.id, firstName: student.firstName, lastName: student.lastName, code: student.code }
              : { id: studentId, firstName: "", lastName: "", code: "" },
            studentId,
            subjectId,
            periodId,
          },
        ];
      }
    });

    fetch(`/api/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: user.institution.id,
        studentId,
        subjectId,
        periodId,
        teacherId: user.id,
        userId: user.id,
        value: num,
        performance: num === null ? null : perfFromValue(num),
        observations: obs,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) toast.error("No se pudo guardar la nota");
      })
      .catch(() => toast.error("Error de red al guardar"))
      .finally(() => {
        setSaving((s) => ({ ...s, [studentId]: false }));
      });
  }

  function onNoteChange(studentId: string, value: string) {
    setDrafts((d) => ({ ...d, [studentId]: { value, obs: d[studentId]?.obs ?? "" } }));
    if (debounceRef.current[studentId]) clearTimeout(debounceRef.current[studentId]);
    debounceRef.current[studentId] = setTimeout(() => {
      saveGrade(studentId, value, drafts[studentId]?.obs ?? "");
    }, 700);
  }

  function onObsBlur(studentId: string, value: string) {
    const v = drafts[studentId]?.value ?? "";
    saveGrade(studentId, v, value);
  }

  function onIndicatorChange(studentId: string, ind: string, value: string) {
    setIndicators((p) => ({
      ...p,
      [studentId]: { ...(p[studentId] ?? {}), [ind]: value },
    }));
    toast.success(`Indicador "${ind}" actualizado`);
  }

  const summary = useMemo(() => {
    const valid = grades.filter((g) => g.value !== null && g.value !== undefined);
    const avg =
      valid.length > 0
        ? valid.reduce((s, g) => s + (g.value as number), 0) / valid.length
        : 0;
    const count = (p: string) => valid.filter((g) => g.performance === p).length;
    return {
      avg: Math.round(avg * 10) / 10,
      superior: count("superior"),
      alto: count("alto"),
      basico: count("basico"),
      bajo: count("bajo"),
      total: valid.length,
    };
  }, [grades]);

  const rows = students.length > 0 ? students : grades.map((g) => ({
    id: g.student.id,
    code: g.student.code,
    firstName: g.student.firstName,
    lastName: g.student.lastName,
  }));
  const uniqueRows = Array.from(new Map(rows.map((r) => [r.id, r])).values());

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">
            {mode === "indicadores" ? "Indicadores de desempeño" : "Notas parciales"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Planilla de calificaciones por grupo, asignatura y periodo. Cada celda es editable: al
            perder el foco se guarda automáticamente con auditoría. El desempeño se calcula según la
            escala institucional (Superior ≥90, Alto ≥75, Básico ≥60, Bajo &lt;60) y se muestra como
            chip de color para lectura rápida.
          </p>
        </div>
        <Button variant="secondary" className="gap-2" disabled>
          <Calculator className="h-4 w-4" /> Recalcular
        </Button>
      </header>

      {/* Selectors */}
      <Card className="hairline rounded-xl">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Grupo</label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Asignatura</label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Asignatura" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Periodo</label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.active ? " (activo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> Guardado automático
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Promedio del grupo" value={summary.avg.toString()} hint={`${summary.total} notas`} />
        <SummaryCard label="Superior" value={summary.superior.toString()} chip="chip-superior" />
        <SummaryCard label="Alto" value={summary.alto.toString()} chip="chip-alto" />
        <SummaryCard label="Básico" value={summary.basico.toString()} chip="chip-basico" />
        <SummaryCard label="Bajo" value={summary.bajo.toString()} chip="chip-bajo" />
      </section>

      {/* Spreadsheet */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Planilla de calificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : uniqueRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">No hay estudiantes en este grupo</div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Seleccione otro grupo o verifique que el grupo actual tenga estudiantes matriculados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead className="min-w-[180px]">Estudiante</TableHead>
                  <TableHead className="w-32">Nota</TableHead>
                  <TableHead className="w-32">Desempeño</TableHead>
                  {mode === "indicadores" && (
                    <>
                      <TableHead>Razonamiento</TableHead>
                      <TableHead>Comunicación</TableHead>
                      <TableHead>Resolución</TableHead>
                    </>
                  )}
                  <TableHead className="min-w-[240px]">Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueRows.map((s) => {
                  const g = grades.find((x) => x.studentId === s.id);
                  const draft = drafts[s.id];
                  const value = draft?.value ?? (g?.value !== null && g?.value !== undefined ? String(g.value) : "");
                  const obs = g?.observations ?? "";
                  const perf = g?.value !== null && g?.value !== undefined ? perfFromValue(g.value) : "—";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="font-medium">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={value}
                          onChange={(e) => onNoteChange(s.id, e.target.value)}
                          onBlur={(e) => saveGrade(s.id, e.target.value, drafts[s.id]?.obs ?? obs)}
                          className="h-8 w-24 tabular-nums"
                          aria-label={`Nota de ${s.firstName} ${s.lastName}`}
                        />
                        {saving[s.id] && (
                          <span className="text-[10px] text-muted-foreground ml-1">guardando…</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", perfChip(perf))}>
                          {perf}
                        </span>
                      </TableCell>
                      {mode === "indicadores" &&
                        INDICADORES.map((ind) => (
                          <TableCell key={ind}>
                            <Select
                              value={indicators[s.id]?.[ind] ?? ""}
                              onValueChange={(v) => onIndicatorChange(s.id, ind, v)}
                            >
                              <SelectTrigger className="h-8 w-28" size="sm">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="S">Superior</SelectItem>
                                <SelectItem value="A">Alto</SelectItem>
                                <SelectItem value="B">Básico</SelectItem>
                                <SelectItem value="N">Bajo</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        ))}
                      <TableCell>
                        <Textarea
                          defaultValue={obs}
                          onBlur={(e) => onObsBlur(s.id, e.target.value)}
                          rows={1}
                          className="h-8 text-xs resize-none"
                          placeholder="Observaciones cualitativas…"
                          aria-label={`Observaciones de ${s.firstName}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="text-xs text-muted-foreground">
                    Total estudiantes: {uniqueRows.length}
                  </TableCell>
                  <TableCell colSpan={mode === "indicadores" ? 6 : 3} className="text-right text-xs text-muted-foreground">
                    Promedio <span className="font-semibold text-foreground tabular-nums">{summary.avg}</span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  chip,
}: {
  label: string;
  value: string;
  hint?: string;
  chip?: string;
}) {
  return (
    <div className="hairline rounded-xl bg-[var(--app-card)] p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-heading font-semibold tabular-nums">{value}</span>
        {chip && (
          <span className={cn("h-2 w-2 rounded-full", chip)} style={{ backgroundColor: "currentColor" }} />
        )}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
