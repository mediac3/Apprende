"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StudentRow } from "../student-detail-view";

interface GradeRow {
  id: string;
  value: number | null;
  performance: string | null;
  subjectId: string;
  periodId: string;
  subject?: { id: string; name: string; abbreviation?: string | null } | null;
  period?: { id: string; name: string; weight?: number } | null;
}

interface PeriodRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weight: number;
}

interface AcademicYear {
  id: string;
  year: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  academicYearId: string | null;
}

function inYear(p: PeriodRow, y?: AcademicYear | null): boolean {
  if (!y?.startDate || !y?.endDate) return true;
  const start = new Date(p.startDate).getTime();
  const end = new Date(p.endDate).getTime();
  const ys = new Date(y.startDate).getTime();
  const ye = new Date(y.endDate).getTime();
  return start >= ys && start <= ye && end <= ye && end >= ys;
}

export function GradesTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [yearId, setYearId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      fetch(`/api/grades?institutionId=${user.institution.id}&studentId=${student.id}`).then((r) => r.json()),
      fetch(`/api/periods?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/academic-years?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/groups?institutionId=${user.institution.id}`).then((r) => r.json()),
    ])
      .then(([dg, dp, dy, dgr]) => {
        if (!alive) return;
        if (dg.ok) setGrades(dg.grades ?? []);
        if (dp.ok) setPeriods(dp.periods);
        if (dy.ok) {
          setYears(dy.years);
          const active = dy.years.find((y: AcademicYear) => y.active) ?? dy.years[0];
          if (active) setYearId((prev) => prev || active.id);
        }
        if (dgr.ok) setGroups(dgr.groups);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, student.id, reloadKey]);

  const selectedYear = useMemo(() => years.find((y) => y.id === yearId) ?? null, [years, yearId]);

  // Selector estilo PDF pág 2: "2026 - Principal | 6A"
  const selectorLabel = useMemo(() => {
    const y = selectedYear?.year ?? "—";
    const g = groups.find((gr) => gr.academicYearId === yearId && gr.id === student.group?.id)
      ?? groups.find((gr) => gr.id === student.group?.id);
    const sede = g?.branch?.name;
    return `${y} - ${sede ? `${sede} | ` : ""}${g?.name ?? ""}`;
  }, [selectedYear, groups, yearId, student.group?.id]);

  const yearPeriods = useMemo(
    () => periods.filter((p) => inYear(p, selectedYear)).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [periods, selectedYear]
  );

  // Matriz asignatura × periodo (PDF pág 2)
  const matrix = useMemo(() => {
    const periodIds = new Set(yearPeriods.map((p) => p.id));
    const bySubject = new Map<string, { name: string; abbr?: string | null; cells: Map<string, GradeRow> }>();
    grades
      .filter((g) => periodIds.has(g.periodId))
      .forEach((g) => {
        if (!bySubject.has(g.subjectId)) {
          bySubject.set(g.subjectId, {
            name: g.subject?.name ?? "—",
            abbr: g.subject?.abbreviation,
            cells: new Map(),
          });
        }
        bySubject.get(g.subjectId)!.cells.set(g.periodId, g);
      });
    return Array.from(bySubject.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [grades, yearPeriods]);

  // DEFINITIVA ponderada por peso del periodo
  function definitiva(cells: Map<string, GradeRow>): number | null {
    let sum = 0;
    let weights = 0;
    yearPeriods.forEach((p) => {
      const g = cells.get(p.id);
      if (g && g.value != null) {
        sum += g.value * (p.weight || 25);
        weights += p.weight || 25;
      }
    });
    if (!weights) return null;
    return Math.round((sum / weights) * 10) / 10;
  }

  function valueClass(v: number | null): string {
    if (v == null) return "text-muted-foreground";
    return v < 30 ? "text-destructive font-medium" : "font-medium";
  }

  return (
    <Card className="hairline rounded-xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Historial de calificaciones del estudiante
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{selectorLabel}</span>
          <Select value={yearId} onValueChange={setYearId}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>{y.year}{y.active ? " ✓" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {matrix.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sin calificaciones registradas para el año seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Asignatura</TableHead>
                  {yearPeriods.map((p) => (
                    <TableHead key={p.id} className="text-center w-20">{p.name}</TableHead>
                  ))}
                  <TableHead className="text-center w-24">DEFINITIVA</TableHead>
                  <TableHead className="text-center w-20">R. FINAL</TableHead>
                  <TableHead className="text-center w-20">M. FINAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row) => {
                  const def = definitiva(row.cells);
                  return (
                    <TableRow key={row.name}>
                      <TableCell className="text-sm">{row.name}</TableCell>
                      {yearPeriods.map((p) => {
                        const g = row.cells.get(p.id);
                        return (
                          <TableCell key={p.id} className="text-center tabular-nums text-sm">
                            <span className={valueClass(g?.value ?? null)}>{g?.value ?? "—"}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className={cn("text-center tabular-nums text-sm", def != null && def < 30 ? "text-destructive font-semibold" : "font-semibold")}>
                        {def ?? "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-center tabular-nums text-sm font-semibold">
                        {def ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          DEFINITIVA: promedio ponderado por peso del periodo. R. FINAL: recuperaciones (no disponibles).
        </p>
      </CardContent>
    </Card>
  );
}
