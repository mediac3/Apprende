"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Bell,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AtRiskStudent {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  group?: { name: string } | null;
  average: number;
  failingSubjects: Array<{
    subjectId: string;
    subjectName: string;
    value: number;
    performance: string;
  }>;
}

function perfChip(p: string) {
  if (p === "superior") return "chip-superior";
  if (p === "alto") return "chip-alto";
  if (p === "basico") return "chip-basico";
  return "chip-bajo";
}

function suggestedAction(avg: number) {
  if (avg < 50) return { label: "Plan de mejora urgente", chip: "chip-bajo" };
  if (avg < 70) return { label: "Refuerzo dirigido", chip: "chip-basico" };
  return { label: "Seguimiento", chip: "chip-alto" };
}

export function PreInformeView() {
  const user = useAuthStore((s) => s.user);
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/dashboard/students-at-risk?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStudents(d.students);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => ({
    total: students.length,
    urgent: students.filter((s) => s.average < 50).length,
    reinforcement: students.filter((s) => s.average >= 50 && s.average < 70).length,
    followUp: students.filter((s) => s.average >= 70).length,
  }), [students]);

  async function generateObservations() {
    if (!user) return;
    setGenerating(true);
    let created = 0;
    for (const s of students) {
      try {
        const res = await fetch(`/api/observations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutionId: user.institution.id,
            studentId: s.id,
            recordedById: user.id,
            date: new Date().toISOString(),
            category: "academico",
            description: "Estudiante en riesgo académico — pre-informe periodo 2",
            severity: s.average < 50 ? "grave" : s.average < 70 ? "moderada" : "leve",
            status: "abierta",
          }),
        });
        const d = await res.json();
        if (d.ok) created++;
      } catch {
        // ignore individual errors
      }
    }
    setGenerating(false);
    toast.success(`Se generaron ${created} observaciones de pre-informe`);
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
          <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Pre-Informe
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Detección temprana de estudiantes en riesgo antes del cierre del periodo 2. La tabla
            prioriza los casos por promedio académico y asignaturas reprobadas, sugiriendo la acción
            pedagógica recomendada. Use el botón para generar observaciones masivas en el observador
            de cada estudiante detectado.
          </p>
        </div>
        <Button className="gap-2" onClick={generateObservations} disabled={generating || students.length === 0}>
          <Sparkles className="h-4 w-4" /> {generating ? "Generando…" : "Generar observaciones"}
        </Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Estudiantes en riesgo" value={stats.total} tone="var(--app-error)" />
        <StatBox label="Plan de mejora urgente" value={stats.urgent} tone="var(--app-error)" />
        <StatBox label="Refuerzo dirigido" value={stats.reinforcement} tone="var(--app-warning)" />
        <StatBox label="Seguimiento" value={stats.followUp} tone="var(--app-info)" />
      </section>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-[var(--perf-bajo)]" /> Listado prioritario
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Sin estudiantes en riesgo</div>
              <p className="text-xs text-muted-foreground max-w-sm">
                No se detectaron estudiantes con desempeño bajo o básico en el periodo activo.
                ¡Buen trabajo académico!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="w-28">Promedio</TableHead>
                  <TableHead className="w-32"># Reprobadas</TableHead>
                  <TableHead className="min-w-[200px]">Acción sugerida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const action = suggestedAction(s.average);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="font-medium">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell className="text-xs">{s.group?.name ?? "—"}</TableCell>
                      <TableCell>
                        <span className={cn("text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md", perfChip(s.average < 60 ? "bajo" : s.average < 75 ? "basico" : "alto"))}>
                          {s.average}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{s.failingSubjects.length}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", action.chip)}>
                            {action.label}
                          </span>
                          {s.failingSubjects.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {s.failingSubjects.map((f) => f.subjectName).slice(0, 2).join(", ")}
                              {s.failingSubjects.length > 2 && "…"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Recomendaciones de uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Revise el listado al menos 15 días antes del cierre del periodo para activar refuerzos.</li>
            <li>Las observaciones generadas quedan en estado "abierta" con severidad según el promedio.</li>
            <li>Active citaciones a acudientes para los casos con plan de mejora urgente.</li>
            <li>Coordine con orientación escolar los casos que requieran remisión externa.</li>
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="hairline rounded-xl bg-[var(--app-card)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {tone && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />}
      </div>
      <div className="text-2xl font-heading font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
