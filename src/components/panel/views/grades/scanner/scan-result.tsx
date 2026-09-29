"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScannerWizardApi } from "./use-scanner-wizard";

// [F2] Paso 5 — Resultado: confirmación, deshacer (30s, igual que el chat de
// comandos) y reporte CSV.

export interface ScanResultProps {
  wiz: ScannerWizardApi;
  /** La vista debe recargar la planilla tras aplicar. */
  onApplied?: () => void;
}

export function ScanResult({ wiz, onApplied }: ScanResultProps) {
  const registered = wiz.result?.registered ?? 0;
  const errored = wiz.cells.filter((c) => c.status === "error").length;
  const excluded = wiz.cells.filter((c) => c.excluded).length;

  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ {registered} nota(s) registrada(s) en el módulo Notas parciales.
        {(errored > 0 || excluded > 0) && (
          <span className="mt-1 block text-xs opacity-80">
            No registradas: {errored} con error, {excluded} excluidas manualmente.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={wiz.undoLeft === 0 || wiz.busy !== null}
          onClick={() => void wiz.undo()}
        >
          Deshacer {wiz.undoLeft > 0 ? `(${wiz.undoLeft}s)` : ""}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => wiz.csv()}>
            Descargar reporte CSV
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onApplied?.();
              wiz.close();
            }}
          >
            Cerrar
          </Button>
        </div>
      </div>

      <p className={cn("text-[11px]", wiz.undoLeft > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
        {wiz.undoLeft > 0
          ? `Puedes deshacer el registro completo durante ${wiz.undoLeft}s más.`
          : "La ventana de deshacer expiró; puedes corregir valores manualmente en Notas parciales."}
      </p>
    </div>
  );
}
