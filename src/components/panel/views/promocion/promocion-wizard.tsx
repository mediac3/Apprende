"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowRight, Download, GraduationCap, Printer, RefreshCw } from "lucide-react";
import { DECISIONES_COMISION, usePromocion, type PromocionRow } from "./use-promocion";

// === [F3] Wizard "Promoción de grado" — criterios oficiales de la comisión ===
// 4 pasos: 1) Selección origen→destino (con umbral de inasistencia) ·
// 2) Vista previa: valoración por áreas, nivelación (Pár. 3), % inasistencia,
//    estado y decisiones de comisión con justificación · 3) Confirmación ·
// 4) Resultado con CSV y acta imprimible.
// Regla dura: los no promovibles solo se habilitan con decisión de comisión
// + justificación (≥10 caracteres); el servidor re-valida todo.

const STEPS = ["Selección", "Vista previa", "Confirmación", "Resultado"];

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

  /** ¿Debe quedar fuera de la promoción por decisión de comisión? */
  function excluidoPorDecision(row: PromocionRow): boolean {
    return (w.decisions[row.id]?.decision ?? "").startsWith("no_");
  }

  const rows = w.preview?.students ?? [];
  const promovidosCount = rows.filter((s) => w.selected.has(s.id)).length;
  const nivelacionCount = rows.filter(
    (s) => s.estado === "promovido_nivelacion" || s.estado === "nivelacion"
  ).length;
  const noPromovidosCount = rows.length - rows.filter((s) => s.promovible).length;
  const visibleRows = rows.filter((s) => {
    if (w.tab === "promovidos") return s.estado === "promovido";
    if (w.tab === "nivelacion")
      return s.estado === "promovido_nivelacion" || s.estado === "nivelacion";
    if (w.tab === "no")
      return s.estado === "no_promovido" || s.estado === "no_promovido_inasistencia" || s.estado === "sin_datos";
    return true;
  });
  const decisionesLista = Object.values(w.decisions).filter((d) => d.decision);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <GraduationCap className="h-5 w-5" />
          Promoción de grado
        </h1>
        <p className="text-sm text-muted-foreground">
          Promoción según criterios de la comisión: valoración final de todas las áreas,
          nivelaciones (Parágrafo 3) e inasistencia injustificada.
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
                  {w.nextLevel && <span className="ml-1 font-normal">(grado siguiente: {w.nextLevel.name})</span>}
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
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  UMBRAL DE INASISTENCIA INJUSTIFICADA (%)
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={w.umbralInasistencia}
                    onChange={(e) => w.setUmbralInasistencia(Number(e.target.value) || 25)}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    Causal de no promoción (default 25% — ausencias sin excusa / total)
                  </span>
                </div>
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
          {w.preview.preescolar && (
            <Alert>
              <AlertTitle>Preescolar — promoción automática</AlertTitle>
              <AlertDescription>
                En preescolar no se reprueban grados ni actividades (Parágrafo 1, Decreto 1411
                de 2022). Todos los estudiantes vienen seleccionados.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {promovidosCount} promovidos
            </Badge>
            {nivelacionCount > 0 && (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                {nivelacionCount} con nivelación
              </Badge>
            )}
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              {noPromovidosCount} no promovidos
            </Badge>
            <span className="text-sm text-muted-foreground">
              Umbral áreas: {w.preview.umbral} · Inasistencia: {w.preview.umbralInasistencia}% ·{" "}
              {w.preview.from.name} ({w.preview.from.year}) → {w.preview.to.name} ({w.preview.to.year})
            </span>
            <div className="ml-auto flex gap-1">
              {([
                ["todos", "Todos"],
                ["promovidos", "Promovidos"],
                ["nivelacion", "Nivelación"],
                ["no", "No promovidos"],
              ] as const).map(([t, label]) => (
                <Button key={t} size="sm" variant={w.tab === t ? "default" : "outline"} onClick={() => w.setTab(t)}>
                  {label}
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
                  <TableHead className="text-center">Prom.</TableHead>
                  <TableHead>Áreas en bajo</TableHead>
                  <TableHead>Pendientes de nivelación (Pár. 3)</TableHead>
                  <TableHead className="text-center">% Ina.</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Decisión de comisión (opcional)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((s) => {
                  const excluido = excluidoPorDecision(s);
                  const habilitado = w.canSelect(s);
                  const dec = w.decisions[s.id];
                  return (
                    <TableRow key={s.id} className={excluido ? "opacity-60" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={w.selected.has(s.id) && !excluido}
                          disabled={excluido || !habilitado}
                          onCheckedChange={() => w.toggle(s.id)}
                          aria-label={`Seleccionar ${s.fullName}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {s.fullName}
                        {s.defCompleta === false && (
                          <span className="ml-1 text-amber-600" title="DEF incompleta">•</span>
                        )}
                        {excluido && (
                          <Badge variant="outline" className="ml-2 text-muted-foreground">excluido por comisión</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{s.promFinal ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {s.areasBajo.length ? (
                          <span className="text-red-700">{s.areasBajo.join("; ")}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.pendientesNivelacion.length ? (
                          <span className="text-amber-700">{s.pendientesNivelacion.join("; ")}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-center tabular-nums ${
                        s.pctInasistencia !== null && s.pctInasistencia >= (w.preview?.umbralInasistencia ?? 25)
                          ? "font-semibold text-red-700"
                          : ""
                      }`}>
                        {s.pctInasistencia !== null ? `${s.pctInasistencia}%` : "—"}
                      </TableCell>
                      <TableCell className="text-center"><EstadoBadge estado={s.estado} /></TableCell>
                      <TableCell className="min-w-[260px]">
                        <Select
                          value={dec?.decision ?? "none"}
                          onValueChange={(v) => w.setDecision(s.id, v === "none" ? "" : v, dec?.justificacion ?? "")}
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Sin decisión —</SelectItem>
                            {DECISIONES_COMISION.map((d) => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {dec?.decision && (
                          <Input
                            className="mt-1 h-7 text-xs"
                            placeholder="Justificación (mín. 10 caracteres, va al acta)"
                            value={dec.justificacion}
                            onChange={(e) => w.setDecision(s.id, dec.decision, e.target.value)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            • DEF incompleta. Los estudiantes no promovibles (3+ áreas en bajo, inasistencia ≥{" "}
            {w.preview.umbralInasistencia}% o sin notas) solo se habilitan con una decisión de
            comisión de promoción y justificación — queda registrada en el acta y en la matrícula.
          </p>

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
                &quot;matriculado&quot;. Operación transaccional: si algo falla, no se aplica
                ningún cambio.
              </AlertDescription>
            </Alert>
            {decisionesLista.length > 0 && (
              <div className="rounded-lg border p-3 text-xs">
                <p className="mb-2 font-medium">Decisiones de comisión registradas ({decisionesLista.length}):</p>
                <ul className="list-disc space-y-1 pl-4">
                  {decisionesLista.map((d) => (
                    <li key={d.id}>
                      <span className="font-medium">{w.preview?.students.find((s) => s.id === d.id)?.fullName ?? d.id}</span>{" "}
                      — {DECISIONES_COMISION.find((x) => x.value === d.decision)?.label ?? d.decision}:{" "}
                      <i>{d.justificacion}</i>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            {w.result.decisions.length > 0 && (
              <Badge variant="outline">{w.result.decisions.length} decisiones de comisión en el acta</Badge>
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
            <Button variant="outline" onClick={w.printActa}>
              <Printer className="mr-1 h-4 w-4" /> Imprimir acta de comisión
            </Button>
            <Button variant="outline" onClick={w.reset}>Volver al listado</Button>
            <Button onClick={() => setModule("gestion-grupos")}>Ir al grupo destino</Button>
          </div>
        </div>
      )}
    </div>
  );
}
