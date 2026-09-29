"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { ScannerWizardApi, CellStatus } from "./use-scanner-wizard";

// [F2] Paso 4 — Revisión CRÍTICA: tabla editable de notas detectadas con
// filtros, umbral de confianza y confirmación explícita antes de registrar.

const STATUS_LABEL: Record<CellStatus, string> = {
  ok: "OK",
  low: "Baja confianza",
  empty: "Vacía",
  error: "Error",
};

const STATUS_CLASS: Record<CellStatus, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  low: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  empty: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  error: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

type Filter = "todas" | "baja" | "vacias" | "errores";

export function ScanPreview({ wiz }: { wiz: ScannerWizardApi }) {
  const [filter, setFilter] = useState<Filter>("todas");

  const counts = useMemo(() => {
    const total = wiz.cells.length;
    const ok = wiz.cells.filter((c) => c.status === "ok").length;
    const review = wiz.cells.filter((c) => c.status === "low" || c.status === "error").length;
    return { total, ok, review };
  }, [wiz.cells]);

  const visible = useMemo(() => {
    switch (filter) {
      case "baja":
        return wiz.cells.filter((c) => c.status === "low");
      case "vacias":
        return wiz.cells.filter((c) => c.status === "empty");
      case "errores":
        return wiz.cells.filter((c) => c.status === "error");
      default:
        return wiz.cells;
    }
  }, [wiz.cells, filter]);

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        {counts.total} celdas detectadas · {counts.ok} con alta confianza · {counts.review} requieren revisión ·{" "}
        <span className="font-semibold">{wiz.included.length} se registrarán</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["todas", "Todas"],
            ["baja", "Solo baja confianza"],
            ["vacias", "Solo vacías"],
            ["errores", "Solo errores"],
          ] as Array<[Filter, string]>
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "default" : "outline"}
            className="h-6 px-2 text-xs"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <Label htmlFor="sc-threshold" className="text-xs">
            Umbral
          </Label>
          <Input
            id="sc-threshold"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={wiz.threshold}
            onChange={(e) => wiz.setThreshold(Math.min(1, Math.max(0, Number(e.target.value) || 0.7)))}
            className="h-7 w-16 text-xs"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b text-left">
              <th className="px-2 py-1.5">Estudiante</th>
              <th className="px-2 py-1.5">Concepto</th>
              <th className="px-2 py-1.5">Act.</th>
              <th className="px-2 py-1.5">Detectado</th>
              <th className="px-2 py-1.5">Valor</th>
              <th className="px-2 py-1.5">Conf.</th>
              <th className="px-2 py-1.5 text-center">Incluir</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const concept = c.target.kind === "grade" ? c.target.conceptName : "—";
              return (
                <tr key={c.key} className={cn("border-b", c.excluded && "opacity-50")}>
                  <td className="px-2 py-1">{c.studentName}</td>
                  <td className="px-2 py-1">{concept}</td>
                  <td className="px-2 py-1">{c.target.label}</td>
                  <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{c.raw || "—"}</td>
                  <td className="px-2 py-1">
                    <Input
                      value={c.raw}
                      onChange={(e) => wiz.updateCell(c.key, e.target.value)}
                      aria-label={`Valor ${c.studentName} ${c.target.label}`}
                      className={cn("h-6 w-16 text-xs", c.status === "error" && "border-red-400")}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <span className={cn("inline-block rounded border px-1 py-0.5 text-[10px]", STATUS_CLASS[c.status])}>
                      {Math.round(c.confidence * 100)}% · {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <Checkbox checked={!c.excluded} onCheckedChange={() => wiz.toggleExclude(c.key)} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                  Sin celdas para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={() => wiz.setStep(2)}>
          Volver
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={wiz.included.length === 0 || !wiz.canRegister || wiz.busy !== null}>
              Registrar en Notas parciales ({wiz.included.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Registrar {wiz.included.length} notas?</AlertDialogTitle>
              <AlertDialogDescription>
                Se escribirán en Notas parciales. Podrás deshacer durante 30 segundos después de confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => void wiz.apply()}>Confirmar registro</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
