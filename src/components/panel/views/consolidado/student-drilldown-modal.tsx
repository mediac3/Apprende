"use client";

import { Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ConsolidadoResult, ConsolidadoSubject, ConsolidadoStudentRow } from "@/lib/queries/consolidado";

// === [F2] Consolidado anual: drill-down por estudiante ===
// Desglose por área → asignaturas con DEF por periodo y DEF final,
// promedio por periodo, promedio final, puesto, estado e inasistencias.
// Reutiliza los datos ya calculados por /api/consolidado (sin nuevas queries).

function defClass(v: number | null, umbral: number): string {
  if (v === null) return "text-muted-foreground";
  return v < umbral
    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
}

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "promovido":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">PROMOVIDO</Badge>;
    case "promovido_nivelacion":
      return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">PROM. CON NIVELACIÓN</Badge>;
    case "nivelacion":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">NIVELACIÓN (1-2 ÁREAS)</Badge>;
    case "no_promovido":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">NO PROMOVIDO</Badge>;
    case "no_promovido_inasistencia":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">NO PROM. INA.</Badge>;
    default:
      return <Badge variant="secondary">SIN DATOS</Badge>;
  }
}

export function StudentDrilldownModal({
  data,
  studentId,
  onClose,
}: {
  data: ConsolidadoResult;
  studentId: string | null;
  onClose: () => void;
}) {
  const st = studentId ? data.students.find((s) => s.id === studentId) ?? null : null;
  const { subjects, periods, umbral } = data;

  // Asignaturas agrupadas por área (preservando el orden del plan)
  const areas: { name: string; subjects: ConsolidadoSubject[] }[] = [];
  for (const subj of subjects) {
    const key = subj.areaName ?? "Sin área";
    const last = areas[areas.length - 1];
    if (last && last.name === key) last.subjects.push(subj);
    else areas.push({ name: key, subjects: [subj] });
  }

  return (
    <Dialog open={st !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        {st && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                {st.fullName}
                <EstadoBadge estado={st.estado} />
                {st.defCompleta === false && (
                  <Badge variant="outline" className="text-amber-600 border-amber-400">
                    DEF incompleta
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {st.document ?? "Sin documento"} · Grupo {data.group.name} ·{" "}
                {data.group.gradeLevelName ?? "—"} · Año {data.group.year ?? "—"} ·{" "}
                {data.group.institutionName}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Promedio final</p>
                <p className="text-xl font-semibold tabular-nums">{st.promFinal ?? "—"}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Puesto (PT)</p>
                <p className="text-xl font-semibold tabular-nums">{st.pt ?? "—"}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Asignaturas en bajo (DBJ)</p>
                <p className="text-xl font-semibold tabular-nums">{st.dbj}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Inasistencias</p>
                <p className="text-xl font-semibold tabular-nums">{st.inas}</p>
              </div>
            </div>

            {(st.areasBajo.length > 0 || st.pendientesNivelacion.length > 0) && (
              <div className="space-y-1 rounded-lg border p-2 text-xs">
                <p>
                  <span className="font-medium">Áreas en bajo:</span>{" "}
                  {st.areasBajo.length ? (
                    <span className="text-red-700">{st.areasBajo.join(" · ")}</span>
                  ) : (
                    <span className="text-muted-foreground">ninguna</span>
                  )}
                </p>
                <p>
                  <span className="font-medium">Pendientes de nivelación (Pár. 3):</span>{" "}
                  {st.pendientesNivelacion.length ? (
                    <span className="text-amber-700">{st.pendientesNivelacion.join(" · ")}</span>
                  ) : (
                    <span className="text-muted-foreground">ninguna</span>
                  )}
                </p>
                <p>
                  <span className="font-medium">Inasistencia injustificada:</span>{" "}
                  {st.pctInasistencia !== null ? `${st.pctInasistencia}% (${st.inas} ausencias)` : "sin registros"}
                </p>
              </div>
            )}

            <div className="overflow-auto rounded-lg border">
              <table className="min-w-max border-collapse text-xs">
                <thead className="bg-muted dark:bg-card">
                  <tr>
                    <th className="border px-2 py-1 text-left">ASIGNATURA</th>
                    {periods.map((p) => (
                      <th key={p.id} className="border px-1.5 py-1 font-normal text-muted-foreground">
                        {p.order ? `P${p.order}` : p.name}
                      </th>
                    ))}
                    <th className="border px-2 py-1">DEF</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area) => (
                    <Fragment key={`${area.name}::group`}>
                      <tr className="bg-muted/60">
                        <td colSpan={periods.length + 2} className="border px-2 py-1 font-semibold">
                          {area.name}
                        </td>
                      </tr>
                      {area.subjects.map((s) => (
                        <tr key={s.id}>
                          <td className="border px-2 py-1 whitespace-nowrap">
                            {s.name}
                            {!s.averages && (
                              <span className="ml-1 text-muted-foreground">(no promedia)</span>
                            )}
                          </td>
                          {periods.map((p) => (
                            <td
                              key={`${s.id}::${p.id}`}
                              className={`border px-1.5 py-1 text-center tabular-nums ${defClass(st.def[s.id]?.[p.id] ?? null, umbral)}`}
                            >
                              {st.def[s.id]?.[p.id] ?? "—"}
                            </td>
                          ))}
                          <td
                            className={`border px-2 py-1 text-center font-semibold tabular-nums ${defClass(st.defFinal[s.id] ?? null, umbral)}`}
                          >
                            {st.defFinal[s.id] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="bg-muted/60 font-semibold">
                    <td className="border px-2 py-1">Promedio del periodo</td>
                    {periods.map((p) => (
                      <td key={`pp::${p.id}`} className="border px-1.5 py-1 text-center tabular-nums">
                        {st.promPeriod[p.id] ?? "—"}
                      </td>
                    ))}
                    <td className="border px-2 py-1 text-center tabular-nums">{st.promFinal ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Umbral de promoción: {umbral} · DEF = definitiva ponderada por peso de periodo ·
              La fila inferior muestra el promedio del estudiante en cada periodo.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
