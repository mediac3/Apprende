"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowRight, Download, GraduationCap, RefreshCw } from "lucide-react";
import { usePromocion } from "./use-promocion";

// === [F3] Wizard "Promoción de grado" — Administración ===
// 4 pasos: 1) Selección origen→destino · 2) Vista previa con selección ·
// 3) Confirmación · 4) Resultado. Regla dura: solo pasan los estudiantes con
// promedio final ≥ umbral (los no promovibles van deshabilitados y el
// servidor re-valida); ejecución transaccional con rollback completo.

const STEPS = ["Selección", "Vista previa", "Confirmación", "Resultado"];

export default function PromocionWizardView() {
  const user = useAuthStore((s) => s.user);
  const setModule = useUIStore((s) => s.setModule);
  const w = usePromocion(user?.institution?.id, user?.id);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  async function handleCreateGroup() {
    setCreatingGroup(true);
    try {
      await w.createDestGroup(w.suggestedName);
    } finally {
      setCreatingGroup(false);
    }
  }

  const promovidosCount = w.preview?.students.filter((s) => s.promovido).length ?? 0;
  const noPromovidosCount = (w.preview?.students.length ?? 0) - promovidosCount;
  const visibleRows = (w.preview?.students ?? []).filter((s) =>
    w.tab === "todos" ? true : w.tab === "promovidos" ? s.promovido : !s.promovido
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <GraduationCap className="h-5 w-5" />
          Promoción de grado
        </h1>
        <p className="text-sm text-muted-foreground">
          Previsualiza y ejecuta el pase de estudiantes al siguiente grado y año académico.
        </p>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                w.step > i + 1
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : w.step === i + 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className={w.step === i + 1 ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {w.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{w.error}</AlertDescription>
        </Alert>
      )}

      {/* Paso 1 — Selección */}
      {w.step === 1 && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">AÑO ORIGEN</p>
                <Select value={w.fromYearId} onValueChange={w.setFromYearId}>
                  <SelectTrigger><SelectValue placeholder="Año origen" /></SelectTrigger>
                  <SelectContent>
                    {w.years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.year}{y.active ? " (activo)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">AÑO DESTINO (siguiente)</p>
                <Select value={w.toYearId} onValueChange={w.setToYearId}>
                  <SelectTrigger><SelectValue placeholder="Año destino" /></SelectTrigger>
                  <SelectContent>
                    {w.years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.year}{y.active ? " (activo)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">GRUPO ORIGEN</p>
                <Select value={w.fromGroupId} onValueChange={w.setFromGroupId}>
                  <SelectTrigger><SelectValue placeholder="Grupo origen" /></SelectTrigger>
                  <SelectContent>
                    {w.groupsFrom.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  GRUPO DESTINO
                  {w.nextLevel && (
                    <span className="ml-1 font-normal">
                      (grado siguiente: {w.nextLevel.name})
                    </span>
                  )}
                </p>
                <Select value={w.toGroupId} onValueChange={w.setToGroupId}>
                  <SelectTrigger><SelectValue placeholder="Grupo destino" /></SelectTrigger>
                  <SelectContent>
                    {w.groupsTo.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {w.nextLevel && w.suggestedDestGroups.length === 0 && w.toYearId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 w-fit"
                    onClick={handleCreateGroup}
                    disabled={creatingGroup || !w.fromGroup}
                  >
                    {creatingGroup ? "Creando…" : `Crear "${w.suggestedName}" en ${w.toYear?.year ?? "el año destino"}`}
                  </Button>
                )}
              </div>
            </div>
            {w.fromGroup && !w.nextLevel && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  El grupo origen pertenece al último grado; no hay grado siguiente para promover.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button
                onClick={w.loadPreview}
                disabled={!w.fromGroupId || !w.toGroupId || w.loading || !w.nextLevel}
              >
                {w.loading ? (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> Calculando…
                  </>
                ) : (
                  "Calcular promoción"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2 — Vista previa */}
      {w.step === 2 && w.preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {promovidosCount} promovidos
            </Badge>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              {noPromovidosCount} no promovidos
            </Badge>
            <span className="text-sm text-muted-foreground">
              Umbral: {w.preview.umbral} · {w.preview.from.name} ({w.preview.from.year}) →{" "}
              {w.preview.to.name} ({w.preview.to.year})
            </span>
            <div className="ml-auto flex gap-1">
              {(["todos", "promovidos", "no"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={w.tab === t ? "default" : "outline"}
                  onClick={() => w.setTab(t)}
                >
                  {t === "todos" ? "Todos" : t === "promovidos" ? "Promovidos" : "No promovidos"}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"> </TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead className="text-center">Promedio final</TableHead>
                  <TableHead className="text-center">DEF completa</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Grupo destino</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        checked={w.selected.has(s.id)}
                        disabled={!s.promovido}
                        onCheckedChange={() => w.toggle(s.id)}
                        aria-label={`Seleccionar ${s.fullName}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.fullName}
                      {s.defCompleta === false && (
                        <span className="ml-1 text-amber-600" title="DEF incompleta">•</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{s.promFinal ?? "—"}</TableCell>
                    <TableCell className="text-center">{s.defCompleta ? "Sí" : "No"}</TableCell>
                    <TableCell className="text-center">
                      {s.promovido ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">PROMOVIDO</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">NO PROMOVIDO</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{w.preview?.to.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={w.reset}>Volver</Button>
            <Button onClick={() => w.setStep(3)} disabled={w.selected.size === 0}>
              Continuar ({w.selected.size} seleccionados)
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Confirmación */}
      {w.step === 3 && w.preview && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Acción destructiva</AlertTitle>
              <AlertDescription>
                Se promoverán <strong>{w.selected.size}</strong> estudiantes del grupo{" "}
                <strong>{w.preview.from.name}</strong> ({w.preview.from.year}) al grupo{" "}
                <strong>{w.preview.to.name}</strong> ({w.preview.to.year}). La matrícula del año
                origen se cerrará como &quot;promovido&quot; y se creará la del año destino como
                &quot;matriculado&quot;. La operación es transaccional: si algo falla, no se
                aplica ningún cambio.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm-list"
                checked={confirmChecked}
                onCheckedChange={(v) => setConfirmChecked(v === true)}
              />
              <label htmlFor="confirm-list" className="text-sm">
                Confirmo que revisé la lista de estudiantes a promover.
              </label>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => w.setStep(2)}>Volver</Button>
              <Button
                variant="destructive"
                onClick={w.execute}
                disabled={!confirmChecked || w.executing || w.selected.size === 0}
              >
                {w.executing ? "Ejecutando…" : "Ejecutar promoción"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 4 — Resultado */}
      {w.step === 4 && w.result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {w.result.promovidos.length} estudiantes promovidos
            </Badge>
            {w.result.rechazados.length > 0 && (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                {w.result.rechazados.length} no promovidos
              </Badge>
            )}
          </div>
          {w.result.rechazados.length > 0 && (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {w.result.rechazados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.fullName}</TableCell>
                      <TableCell>{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={w.exportCsv}>
              <Download className="mr-1 h-4 w-4" /> Descargar CSV
            </Button>
            <Button variant="outline" onClick={w.reset}>Volver al listado</Button>
            <Button onClick={() => setModule("gestion-grupos")}>Ir al grupo destino</Button>
          </div>
        </div>
      )}
    </div>
  );
}
