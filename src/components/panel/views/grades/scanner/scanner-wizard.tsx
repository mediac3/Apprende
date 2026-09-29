"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  useScannerWizard,
  type ScannerContextInput,
  type ScannerStep,
} from "./use-scanner-wizard";

// [F2] Scanner Wizard — contenedor de 5 pasos. Se monta solo cuando `open`.
// Pasos 1-2 (carga + alineación) implementados; 3-5 se completan en FASE 8.

export interface ScannerWizardProps {
  open: true;
  onOpenChange: (open: false) => void;
  ctx: ScannerContextInput;
}

const STEP_LABELS = ["Archivo", "Alineación", "Escaneo", "Revisión", "Resultado"] as const;

export function ScannerWizard({ open, onOpenChange, ctx }: ScannerWizardProps) {
  const wiz = useScannerWizard(ctx, () => onOpenChange(false));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && wiz.close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escanear planilla</DialogTitle>
          <DialogDescription>
            {ctx.groupName} · {ctx.subjectName} · {ctx.periodName} · {ctx.yearLabel}
          </DialogDescription>
        </DialogHeader>

        <Stepper step={wiz.step} />

        {wiz.error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {wiz.error}
          </p>
        )}
        {wiz.busy && (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">{wiz.busy}</p>
            <Progress value={undefined} className="h-1" />
          </div>
        )}

        {wiz.step === 1 && (
          <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">
              Sube la planilla escaneada o fotografiada (.pdf, .jpg, .png). Debe ser una planilla
              generada por el sistema (lleva QR de contexto) y coincidir con el contexto mostrado arriba.
            </p>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-accent",
                wiz.previewUrl && "p-2"
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            >
              {wiz.previewUrl ? (
                <img src={wiz.previewUrl} alt="Página cargada" className="max-h-64 w-auto rounded" />
              ) : (
                <span>Haz clic para elegir el archivo</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void wiz.loadFile(f);
                e.target.value = "";
              }}
            />
            {wiz.pageCount > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span>Página</span>
                {Array.from({ length: wiz.pageCount }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={n === wiz.pageNumber ? "default" : "outline"}
                    className="h-6 px-2"
                    disabled={wiz.busy !== null}
                    onClick={() => void wiz.goToPage(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button disabled={!wiz.previewUrl || wiz.busy !== null} onClick={() => wiz.setStep(2)}>
                Continuar a alineación
              </Button>
            </div>
          </div>
        )}

        {wiz.step === 2 && (
          <div className="grid gap-3">
            {wiz.previewUrl && (
              <img src={wiz.previewUrl} alt="Vista previa" className="max-h-72 w-auto justify-self-center rounded border" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void wiz.rotate(-90)}>
                Rotar -90°
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void wiz.rotate(90)}>
                Rotar +90°
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void wiz.rotate(180)}>
                180°
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="outline" size="sm" disabled={wiz.busy !== null} onClick={() => wiz.detect()}>
                Detectar alineación
              </Button>
            </div>
            {wiz.detection && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  wiz.detection.gridOk
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {wiz.detection.gridOk ? "✓ " : "⚠ "}
                {wiz.detection.detail}
                {wiz.detection.qr && (
                  <div className="mt-1 opacity-80">
                    QR: grupo {wiz.detection.qr.group === ctx.groupId ? "coincide" : "NO coincide"} · periodo{" "}
                    {wiz.detection.qr.period === ctx.periodId ? "coincide" : "NO coincide"}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => wiz.setStep(1)}>
                Volver
              </Button>
              <Button disabled={!wiz.detection?.gridOk || wiz.busy !== null} onClick={() => wiz.setStep(3)}>
                Confirmar alineación
              </Button>
            </div>
          </div>
        )}

        {wiz.step === 3 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Se reconocerán las celdas de actividades registrables con el motor local (Tesseract).
              Las columnas Def y PROM son informativas: no se registran.
            </p>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => wiz.setStep(2)}>
                Volver
              </Button>
              <Button disabled={wiz.busy !== null} onClick={() => void wiz.scan()}>
                Escanear
              </Button>
            </div>
          </div>
        )}

        {wiz.step === 4 && (
          <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
            Revisión de celdas: se implementa en FASE 8.
          </p>
        )}
        {wiz.step === 5 && (
          <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
            Resultado: se implementa en FASE 8.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: ScannerStep }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as ScannerStep;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {n}
            </span>
            <span className={cn("text-[11px]", active ? "font-semibold" : "text-muted-foreground")}>{label}</span>
            {i < STEP_LABELS.length - 1 && <span className="mx-0.5 text-muted-foreground">·</span>}
          </div>
        );
      })}
    </div>
  );
}
