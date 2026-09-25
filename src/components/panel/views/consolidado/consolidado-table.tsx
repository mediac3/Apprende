"use client";

import type { ConsolidadoResult } from "@/lib/queries/consolidado";
import { Badge } from "@/components/ui/badge";

// === [F2] Consolidado anual: tabla principal ===
// Columnas: # | ESTUDIANTE | por asignatura: P1..Pn + DEF | % | DBJ | PT |
// Inas | ESTADO. Filas finales: Prom y NM por asignatura (DEF final).
// DEF < umbral → rojo suave; DEF ≥ umbral → verde suave. Primeras columnas
// fijas al scroll horizontal (mismo criterio que Calificaciones).

function defCellClass(v: number | null, umbral: number): string {
  if (v === null) return "text-muted-foreground";
  return v < umbral ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
}

function periodLabel(p: { name: string; order: number | null }): string {
  return p.order ? `P${p.order}` : p.name;
}

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "promovido":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">PROMOVIDO</Badge>;
    case "promovido_nivelacion":
      return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">PROM. CON NIVELACIÓN</Badge>;
    case "nivelacion":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">NIVELACIÓN</Badge>;
    case "no_promovido":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">NO PROMOVIDO</Badge>;
    case "no_promovido_inasistencia":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">NO PROM. INA.</Badge>;
    default:
      return <Badge variant="secondary">SIN DATOS</Badge>;
  }
}

export function ConsolidadoTable({
  data,
  onStudentClick,
}: {
  data: ConsolidadoResult;
  onStudentClick?: (studentId: string) => void;
}) {
  const { subjects, periods, students, umbral, resumen } = data;
  const stickyLeft = "sticky left-0 bg-background dark:bg-card z-10";
  const corner = "sticky left-0 z-30 bg-muted dark:bg-card";

  return (
    <div className="overflow-auto rounded-lg border max-h-[70vh]">
      <table className="min-w-max border-collapse text-xs">
        <thead className="sticky top-0 z-20 bg-muted dark:bg-card">
          <tr>
            <th rowSpan={2} className={`border px-2 py-1 text-left ${corner}`}>#</th>
            <th rowSpan={2} className={`border px-2 py-1 text-left min-w-[200px] ${corner}`}>ESTUDIANTE</th>
            {subjects.map((s) => (
              <th
                key={s.id}
                colSpan={periods.length + 1}
                className="border px-2 py-1 text-left font-semibold whitespace-nowrap"
                title={[s.areaName, s.teacherName].filter(Boolean).join(" · ") || undefined}
              >
                {s.abbreviation ?? s.name}
                {!s.averages && <span className="ml-1 text-muted-foreground">(no prom.)</span>}
              </th>
            ))}
            <th rowSpan={2} className="border px-2 py-1">%</th>
            <th rowSpan={2} className="border px-2 py-1">DBJ</th>
            <th rowSpan={2} className="border px-2 py-1">PT</th>
            <th rowSpan={2} className="border px-2 py-1">Inas</th>
            <th rowSpan={2} className="border px-2 py-1">% Ina.</th>
            <th rowSpan={2} className="border px-2 py-1">ESTADO</th>
          </tr>
          <tr>
            {subjects.map((s) => (
              periods.map((p) => (
                <th key={`${s.id}::${p.id}`} className="border px-1.5 py-1 font-normal text-muted-foreground">
                  {periodLabel(p)}
                </th>
              )).concat(
                <th key={`${s.id}::def`} className="border px-1.5 py-1 font-semibold">DEF</th>
              )
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((st, i) => (
            <tr
              key={st.id}
              className={onStudentClick ? "cursor-pointer hover:bg-muted/60" : "hover:bg-muted/40"}
              onClick={onStudentClick ? () => onStudentClick(st.id) : undefined}
            >
              <td className={`border px-2 py-1 tabular-nums text-muted-foreground ${stickyLeft}`}>{i + 1}</td>
              <td className={`border px-2 py-1 whitespace-nowrap ${stickyLeft}`}>
                {st.fullName}
                {st.blankCount > 0 && (
                  <span
                    className="ml-1 inline-flex min-w-4 justify-center rounded bg-amber-100 px-1 align-middle text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    title={`${st.blankCount} nota(s) en blanco`}
                  >
                    {st.blankCount}
                  </span>
                )}
              </td>
              {subjects.map((s) =>
                periods.map((p) => (
                  <td key={`${st.id}::${s.id}::${p.id}`} className={`border px-1.5 py-1 text-center tabular-nums ${defCellClass(st.def[s.id]?.[p.id] ?? null, umbral)}`}>
                    {st.def[s.id]?.[p.id] ?? "—"}
                  </td>
                )).concat(
                  <td key={`${st.id}::${s.id}::def`} className={`border px-1.5 py-1 text-center font-semibold tabular-nums ${defCellClass(st.defFinal[s.id] ?? null, umbral)}`}>
                    {st.defFinal[s.id] ?? "—"}
                  </td>
                )
              )}
              <td className="border px-2 py-1 text-center tabular-nums">
                {st.promFinal !== null ? `${Math.round((st.promFinal / 5) * 100)}%` : "—"}
              </td>
              <td className="border px-2 py-1 text-center tabular-nums">{st.dbj}</td>
              <td className="border px-2 py-1 text-center tabular-nums">{st.pt ?? "—"}</td>
              <td className="border px-2 py-1 text-center tabular-nums">{st.inas}</td>
              <td className="border px-2 py-1 text-center tabular-nums">
                {st.pctInasistencia !== null ? `${st.pctInasistencia}%` : "—"}
              </td>
              <td className="border px-2 py-1 text-center whitespace-nowrap">
                <EstadoBadge estado={st.estado} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/60 font-semibold">
            <td colSpan={2} className={`border px-2 py-1 ${stickyLeft}`}>Prom</td>
            {subjects.map((s) =>
              periods.map((p) => (
                <td key={`prom::${s.id}::${p.id}`} className="border px-1.5 py-1" />
              )).concat(
                <td key={`prom::${s.id}::def`} className="border px-1.5 py-1 text-center tabular-nums">
                  {resumen[s.id]?.prom ?? "—"}
                </td>
              )
            )}
            <td colSpan={6} className="border" />
          </tr>
          <tr className="bg-muted/60">
            <td colSpan={2} className={`border px-2 py-1 ${stickyLeft}`}>NM</td>
            {subjects.map((s) =>
              periods.map((p) => (
                <td key={`nm::${s.id}::${p.id}`} className="border px-1.5 py-1" />
              )).concat(
                <td key={`nm::${s.id}::def`} className="border px-1.5 py-1 text-center tabular-nums">
                  {resumen[s.id]?.nm ?? "—"}
                </td>
              )
            )}
            <td colSpan={6} className="border" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
