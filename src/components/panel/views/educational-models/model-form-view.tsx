"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Bold,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Plus,
  Save,
  Strikethrough,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

// --- Tipos compartidos del módulo Modelos educativos ---
export type PeriodRow = {
  id?: string;
  name: string;
  percentage: number;
  open: boolean;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
};

export type ConceptRow = {
  id?: string; // [C1] presente en filas cargadas del modelo → upsert conserva identidad
  name: string;
  percentage: number;
  open: boolean;
};

export type EducationalModelFull = {
  id: string;
  name: string;
  periodCount: number;
  details: string | null;
  concepts: { id: string; name: string; percentage: number; open: boolean; order: number }[];
  periods: { id: string; name: string; weight: number; closed: boolean; order: number; startDate: string; endDate: string }[];
};

const BASE_CONCEPTS: ConceptRow[] = [
  { name: "Ser", percentage: 20, open: true },
  { name: "Saber", percentage: 40, open: true },
  { name: "Hacer", percentage: 40, open: true },
  { name: "Autoevaluación", percentage: 0, open: true },
];

// Label del bloque de periodos según la cantidad (regla funcional de la captura)
function periodsLabel(count: number): { singular: string; plural: string } {
  if (count === 2) return { singular: "Semestre", plural: "Semestres" };
  if (count === 3) return { singular: "Cuatrimestre", plural: "Cuatrimestres" };
  if (count === 4) return { singular: "Trimestre", plural: "Trimestres" };
  if (count === 6) return { singular: "Bimestre", plural: "Bimestres" };
  return { singular: "Periodo", plural: "Periodos" };
}

function toDateInput(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

function htmlToText(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type FormErrors = {
  name?: string;
  periodCount?: string;
  periodNames?: boolean;
  periodDates?: boolean;
  concepts?: boolean;
  totalPeriods?: string;
  totalConcepts?: string;
};

export function ModelFormView({
  mode,
  model,
  institutionId,
  userId,
  onBack,
  onSaved,
}: {
  mode: "new" | "edit";
  model?: EducationalModelFull;
  institutionId: string;
  userId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(model?.name ?? "");
  const [periodCount, setPeriodCount] = useState(model?.periodCount ?? 4);
  const [details, setDetails] = useState<string | null>(model?.details ?? null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [conceptToDelete, setConceptToDelete] = useState<number | null>(null);

  const [periods, setPeriods] = useState<PeriodRow[]>(() => {
    if (model?.periods?.length) {
      return model.periods
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({
          id: p.id,
          name: p.name,
          percentage: Math.round(p.weight ?? 0),
          open: !p.closed,
          startDate: toDateInput(p.startDate),
          endDate: toDateInput(p.endDate),
        }));
    }
    return Array.from({ length: model?.periodCount ?? 4 }, (_, i) => ({
      name: `${periodsLabel(model?.periodCount ?? 4).singular} ${i + 1}`,
      percentage: 0,
      open: true,
      startDate: "",
      endDate: "",
    }));
  });

  const [concepts, setConcepts] = useState<ConceptRow[]>(() => {
    if (model?.concepts?.length) {
      return model.concepts
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((c) => ({ id: c.id, name: c.name, percentage: c.percentage, open: c.open }));
    }
    return mode === "new" ? BASE_CONCEPTS.map((c) => ({ ...c })) : [];
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: model?.details ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => setDetails(editor.getHTML()),
  });

  const label = periodsLabel(periodCount);
  const totalPeriods = useMemo(() => periods.reduce((s, p) => s + (Number(p.percentage) || 0), 0), [periods]);
  const totalConcepts = useMemo(() => concepts.reduce((s, c) => s + (Number(c.percentage) || 0), 0), [concepts]);

  // Regenera la sección de periodos conservando los datos por índice (FASE 10)
  function changePeriodCount(next: number) {
    const n = Math.max(1, Math.min(12, Math.round(next || 1)));
    setPeriodCount(n);
    setPeriods((prev) => {
      if (n === prev.length) return prev;
      const lab = periodsLabel(n);
      const out = prev.slice(0, n);
      for (let i = prev.length; i < n; i++) {
        out.push({ name: `${lab.singular} ${i + 1}`, percentage: 0, open: true, startDate: "", endDate: "" });
      }
      return out;
    });
  }

  function updatePeriod(i: number, patch: Partial<PeriodRow>) {
    setPeriods((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function updateConcept(i: number, patch: Partial<ConceptRow>) {
    setConcepts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addConcept() {
    setConcepts((prev) => [...prev, { name: "", percentage: 0, open: true }]);
  }

  function confirmDeleteConcept() {
    if (conceptToDelete === null) return;
    setConcepts((prev) => prev.filter((_, idx) => idx !== conceptToDelete));
    setConceptToDelete(null);
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!name.trim()) e.name = "El nombre es obligatorio";
    if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 12) {
      e.periodCount = "Debe ser un entero entre 1 y 12";
    }
    e.periodNames = periods.some((p) => !p.name.trim());
    e.periodDates = periods.some((p) => !p.startDate || !p.endDate || Date.parse(p.endDate) <= Date.parse(p.startDate));
    e.concepts = concepts.some((c) => !c.name.trim());
    if (totalPeriods !== 100) e.totalPeriods = `Los ${label.plural.toLowerCase()} deben sumar exactamente 100% (total actual: ${totalPeriods}%)`;
    if (totalConcepts !== 100) e.totalConcepts = `Los conceptos deben sumar exactamente 100% (total actual: ${totalConcepts}%)`;
    setErrors(e);
    return !Object.values(e).some(Boolean);
  }

  async function handleSave() {
    if (!validate()) {
      toast.error("Revisa los campos marcados antes de guardar");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        institutionId,
        userId,
        name: name.trim(),
        periodCount,
        details: details && htmlToText(details) ? details : null,
        periods: periods.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name.trim(),
          percentage: p.percentage,
          open: p.open,
          startDate: new Date(`${p.startDate}T00:00:00`).toISOString(),
          endDate: new Date(`${p.endDate}T23:59:59`).toISOString(),
        })),
        // [C1] id presente en conceptos existentes → el PATCH los actualiza
        // in-place y NO regenera ids (evita perder actividades y notas por cascada)
        concepts: concepts.map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name.trim(), percentage: c.percentage, open: c.open })),
      };
      const res = await fetch("/api/educational-models", {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "new" ? payload : { id: model?.id, ...payload }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "No se pudo guardar");
        return;
      }
      toast.success(mode === "new" ? "Modelo educativo creado" : "Modelo educativo actualizado");
      onSaved();
    } catch {
      toast.error("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: ReactNode;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${active ? "bg-muted" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === "new" ? "Nuevo modelo educativo" : `Editar: ${model?.name}`}</h2>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al listado
          </Button>
        </div>

        {/* Nombre + Cantidad de periodos */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model-name">Nombre *</Label>
            <Input
              id="model-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Escuela nueva"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-period-count">Cantidad de periodos *</Label>
            <Input
              id="model-period-count"
              type="number"
              min={1}
              max={12}
              value={periodCount}
              onChange={(e) => changePeriodCount(Number(e.target.value))}
              className={errors.periodCount ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">Asegúrese de establecer porcentajes equitativamente</p>
            {errors.periodCount && <p className="text-xs text-destructive">{errors.periodCount}</p>}
          </div>
        </div>

        {/* Sección: Periodos académicos (dinámica según cantidad) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{label.plural}</h3>
            <Badge variant="secondary">{periods.length} {label.singular.toLowerCase()}{periods.length !== 1 ? "s" : ""}</Badge>
          </div>
          {errors.periodNames && <p className="text-xs text-destructive">Cada {label.singular.toLowerCase()} requiere un nombre</p>}
          {errors.periodDates && <p className="text-xs text-destructive">Cada {label.singular.toLowerCase()} requiere fechas válidas (fin posterior al inicio)</p>}
          <div className="space-y-3">
            {periods.map((p, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`period-name-${i}`}>{label.singular} {i + 1} — Nombre *</Label>
                    <Input
                      id={`period-name-${i}`}
                      value={p.name}
                      onChange={(e) => updatePeriod(i, { name: e.target.value })}
                      className={errors.periodNames && !p.name.trim() ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`period-start-${i}`}>Inicio *</Label>
                      <Input
                        id={`period-start-${i}`}
                        type="date"
                        value={p.startDate}
                        onChange={(e) => updatePeriod(i, { startDate: e.target.value })}
                        className={errors.periodDates && !p.startDate ? "border-destructive" : ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`period-end-${i}`}>Fin *</Label>
                      <Input
                        id={`period-end-${i}`}
                        type="date"
                        value={p.endDate}
                        onChange={(e) => updatePeriod(i, { endDate: e.target.value })}
                        className={errors.periodDates && !p.endDate ? "border-destructive" : ""}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_220px] items-end">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`period-slider-${i}`}>Porcentaje *</Label>
                      <span className="text-sm font-medium tabular-nums">{p.percentage}%</span>
                    </div>
                    <Slider
                      id={`period-slider-${i}`}
                      value={[p.percentage]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updatePeriod(i, { percentage: v })}
                    />
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={p.percentage}
                    onChange={(e) => updatePeriod(i, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    aria-label={`Porcentaje numérico ${label.singular} ${i + 1}`}
                  />
                  <div className="space-y-1">
                    <Label>Estado</Label>
                    <RadioGroup
                      value={p.open ? "abierto" : "cerrado"}
                      onValueChange={(v) => updatePeriod(i, { open: v === "abierto" })}
                      className="flex items-center gap-4 h-9"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="abierto" id={`period-open-${i}`} />
                        <Label htmlFor={`period-open-${i}`} className="font-normal cursor-pointer">Abierto</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="cerrado" id={`period-closed-${i}`} />
                        <Label htmlFor={`period-closed-${i}`} className="font-normal cursor-pointer">Cerrado</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 rounded-lg border bg-muted/40 px-4 py-2">
            <span className="text-sm text-muted-foreground">Total porcentajes:</span>
            <span className={`text-sm font-bold tabular-nums ${totalPeriods !== 100 ? "text-destructive" : ""}`}>{totalPeriods}%</span>
            {errors.totalPeriods && <span className="text-xs text-destructive">{errors.totalPeriods}</span>}
          </div>
        </div>

        {/* Sección: Conceptos evaluativos (dinámica) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Conceptos evaluativos</h3>
            <Button type="button" size="sm" variant="outline" onClick={addConcept}>
              <Plus className="h-4 w-4 mr-1" /> Añadir concepto
            </Button>
          </div>
          {errors.concepts && <p className="text-xs text-destructive">Cada concepto requiere un nombre</p>}
          <div className="space-y-3">
            {concepts.map((c, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_220px_40px] items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`concept-name-${i}`}>Nombre *</Label>
                    <Input
                      id={`concept-name-${i}`}
                      value={c.name}
                      onChange={(e) => updateConcept(i, { name: e.target.value })}
                      className={errors.concepts && !c.name.trim() ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`concept-slider-${i}`}>Porcentaje *</Label>
                      <span className="text-sm font-medium tabular-nums">{c.percentage}%</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={c.percentage}
                      onChange={(e) => updateConcept(i, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      aria-label={`Porcentaje numérico concepto ${i + 1}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Estado</Label>
                    <RadioGroup
                      value={c.open ? "abierto" : "cerrado"}
                      onValueChange={(v) => updateConcept(i, { open: v === "abierto" })}
                      className="flex items-center gap-4 h-9"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="abierto" id={`concept-open-${i}`} />
                        <Label htmlFor={`concept-open-${i}`} className="font-normal cursor-pointer">Abierto</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="cerrado" id={`concept-closed-${i}`} />
                        <Label htmlFor={`concept-closed-${i}`} className="font-normal cursor-pointer">Cerrado</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-9 w-9 p-0"
                    onClick={() => setConceptToDelete(i)}
                    title="Eliminar concepto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <Slider
                    id={`concept-slider-${i}`}
                    value={[c.percentage]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => updateConcept(i, { percentage: v })}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 rounded-lg border bg-muted/40 px-4 py-2">
            <span className="text-sm text-muted-foreground">Total porcentajes:</span>
            <span className={`text-sm font-bold tabular-nums ${totalConcepts !== 100 ? "text-destructive" : ""}`}>{totalConcepts}%</span>
            {errors.totalConcepts && <span className="text-xs text-destructive">{errors.totalConcepts}</span>}
          </div>
        </div>

        {/* Detalles (rich text) */}
        <div className="space-y-2">
          <Label>Detalles</Label>
          <div className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-1 border-b p-1">
              <ToolbarButton title="Negrita" active={editor?.isActive("bold")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}>
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton title="Itálica" active={editor?.isActive("italic")} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton title="Tachado" active={editor?.isActive("strike")} disabled={!editor} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                <Strikethrough className="h-4 w-4" />
              </ToolbarButton>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarButton title="Lista con viñetas" active={editor?.isActive("bulletList")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                <List className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton title="Lista numerada" active={editor?.isActive("orderedList")} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarButton
                title="Insertar enlace"
                active={editor?.isActive("link")}
                disabled={!editor}
                onClick={() => {
                  if (editor?.isActive("link")) {
                    editor.chain().focus().unsetLink().run();
                    return;
                  }
                  const url = window.prompt("URL del enlace (https://...)");
                  if (url && editor) editor.chain().focus().toggleLink({ href: url }).run();
                }}
              >
                {editor?.isActive("link") ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              </ToolbarButton>
            </div>
            <EditorContent
              editor={editor}
              className="prose-sm min-h-[120px] p-3 focus-within:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
            />
          </div>
          <p className="text-xs text-muted-foreground">Descripción opcional del modelo pedagógico (formato enriquecido)</p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={conceptToDelete !== null} onOpenChange={(o) => !o && setConceptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar concepto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{conceptToDelete !== null ? concepts[conceptToDelete]?.name : ""}" de este modelo educativo.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConcept} className="bg-destructive text-white hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
