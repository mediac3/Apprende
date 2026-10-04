"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  countNewActivities,
  generateGradeSheet,
  type GradeSheetGeneratorInput,
} from "./use-grade-sheet-generator";

// [F1] Modal generador de planilla imprimible. Se monta solo cuando `open`:
// el remount reinicia los filtros vía initializers de useState (sin effects).

export interface GradeSheetModalProps {
  open: true;
  onOpenChange: (open: false) => void;
  input: GradeSheetGeneratorInput;
}

export function GradeSheetModal({ open, onOpenChange, input }: GradeSheetModalProps) {
  const [teacher, setTeacher] = useState(input.defaultTeacher);
  const [journey, setJourney] = useState("");
  const [conceptIds, setConceptIds] = useState<string[]>(input.concepts.map((c) => c.id));
  const [includeProm, setIncludeProm] = useState(true);
  // [F1] total de actividades a imprimir por concepto (déficit se crea en BD)
  const [totals, setTotals] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      input.concepts.map((c) => [c.id, Math.max(1, (input.activitiesByConcept[c.id] ?? []).length)])
    )
  );
  const [size, setSize] = useState<"a4" | "letter">("a4");
  const [busy, setBusy] = useState<null | "preview" | "download">(null);

  const optsForCount = useMemo(
    () => ({ teacher: "", journey: "", conceptIds, includeProm, totals, size }),
    [conceptIds, includeProm, totals, size]
  );
  const newCount = useMemo(() => countNewActivities(input, optsForCount), [input, optsForCount]);

  const summary = useMemo(() => {
    const cols = input.concepts
      .filter((c) => conceptIds.includes(c.id))
      .reduce((acc, c) => acc + Math.max(1, totals[c.id] ?? 1), 0);
    return `${input.students.length} estudiantes · ${conceptIds.length} concepto(s) · ${cols} columnas`;
  }, [input, conceptIds, totals]);

  function toggleConcept(id: string) {
    setConceptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function run(mode: "preview" | "download") {
    if (conceptIds.length === 0) {
      toast.error("Selecciona al menos un concepto");
      return;
    }
    setBusy(mode);
    try {
      await generateGradeSheet(
        input,
        { teacher: teacher.trim() || "Todos", journey: journey.trim() || "—", conceptIds, includeProm, totals, size },
        mode
      );
      if (mode === "preview") toast.success("Vista previa abierta en una pestaña nueva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la planilla");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generar planilla imprimible</DialogTitle>
          <DialogDescription>
            {input.groupName} · {input.subjectName} · {input.periodName} · {input.yearLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gs-docente">Docente</Label>
              <Input
                id="gs-docente"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="Quien imparte la asignatura"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gs-jornada">Jornada</Label>
              <Input
                id="gs-jornada"
                value={journey}
                onChange={(e) => setJourney(e.target.value)}
                placeholder="Ej. Mañana"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Conceptos y actividades</Label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Total a imprimir</span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setConceptIds(input.concepts.map((c) => c.id))}>
                    Todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setConceptIds([])}>
                    Ninguno
                  </Button>
                </div>
              </div>
            </div>
            <ScrollArea className="h-36 rounded-md border p-2">
              {input.concepts.map((c) => {
                const created = (input.activitiesByConcept[c.id] ?? []).length;
                const total = totals[c.id] ?? created;
                const willCreate = Math.max(0, total - created);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded px-1 py-1.5">
                    <label
                      className={cn(
                        "flex flex-1 cursor-pointer items-center gap-2 text-sm",
                        !conceptIds.includes(c.id) && "opacity-50"
                      )}
                    >
                      <Checkbox
                        checked={conceptIds.includes(c.id)}
                        onCheckedChange={() => toggleConcept(c.id)}
                      />
                      {c.name}
                      <span className="text-[11px] text-muted-foreground">({created} creadas)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={total}
                        disabled={!conceptIds.includes(c.id)}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                          setTotals((prev) => ({ ...prev, [c.id]: v }));
                        }}
                        className="h-7 w-16 text-xs"
                        aria-label={`Total de actividades para ${c.name}`}
                      />
                      {willCreate > 0 && (
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          +{willCreate} nuevas
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </ScrollArea>
            <p className="text-[11px] text-muted-foreground">
              {newCount > 0
                ? `Se crearán ${newCount} actividad(es) nueva(s) en el sistema (N${"\u2026"}) antes de generar el PDF; podrán renombrarse en Gestión de Actividades.`
                : "Se imprimen solo las actividades ya creadas."}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={includeProm} onCheckedChange={(v) => setIncludeProm(v === true)} />
              Incluir columna PROM
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Tamaño</Label>
              <Select value={size} onValueChange={(v) => setSize(v === "letter" ? "letter" : "a4")}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4 horizontal</SelectItem>
                  <SelectItem value="letter">Carta horizontal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => run("preview")}>
            {busy === "preview" ? "Generando…" : "Vista previa"}
          </Button>
          <Button disabled={busy !== null} onClick={() => run("download")}>
            {busy === "download" ? "Generando…" : "Generar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
