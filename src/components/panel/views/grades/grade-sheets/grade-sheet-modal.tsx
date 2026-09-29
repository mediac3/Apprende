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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
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
  const [fillToN10, setFillToN10] = useState(false);
  const [size, setSize] = useState<"a4" | "letter">("a4");
  const [busy, setBusy] = useState<null | "preview" | "download">(null);

  const summary = useMemo(() => {
    const cols = input.concepts
      .filter((c) => conceptIds.includes(c.id))
      .reduce((acc, c) => acc + 1 + (fillToN10 ? 10 : (input.activitiesByConcept[c.id] ?? []).length), 0);
    return `${input.students.length} estudiantes · ${conceptIds.length} concepto(s) · ${cols} columnas`;
  }, [input, conceptIds, fillToN10]);

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
        { teacher: teacher.trim() || "Todos", journey: journey.trim() || "—", conceptIds, includeProm, fillToN10, size },
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
              <Label>Conceptos</Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setConceptIds(input.concepts.map((c) => c.id))}>
                  Todos
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setConceptIds([])}>
                  Ninguno
                </Button>
              </div>
            </div>
            <ScrollArea className="h-28 rounded-md border p-2">
              {input.concepts.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                  <Checkbox checked={conceptIds.includes(c.id)} onCheckedChange={() => toggleConcept(c.id)} />
                  {c.name}
                </label>
              ))}
            </ScrollArea>
          </div>

          <div className="grid gap-2">
            <Label>Actividades por concepto</Label>
            <RadioGroup value={fillToN10 ? "n10" : "creadas"} onValueChange={(v) => setFillToN10(v === "n10")} className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="creadas" /> Solo las creadas
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="n10" /> Bloque fijo N1..N10 (vacías para llenar a mano)
              </label>
            </RadioGroup>
            <p className="text-[11px] text-muted-foreground">
              Las celdas sin actividad creada en el sistema no pueden registrarse desde el scanner.
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
