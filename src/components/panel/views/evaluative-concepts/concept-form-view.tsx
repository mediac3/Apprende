"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface EducationalModelOption {
  id: string;
  name: string;
}

export interface ConceptRecord {
  id: string;
  name: string;
  percentage: number;
  open: boolean;
  educationalModelId: string;
  educationalModel?: { id: string; name: string } | null;
}

interface ConceptFormViewProps {
  mode: "new" | "edit";
  concept?: ConceptRecord | null;
  models: EducationalModelOption[];
  institutionId: string;
  userId: string;
  onBack: () => void;
  onSaved: () => void;
  onModelsChanged: () => void;
}

export function ConceptFormView({
  mode,
  concept,
  models,
  institutionId,
  userId,
  onBack,
  onSaved,
  onModelsChanged,
}: ConceptFormViewProps) {
  const [name, setName] = useState(concept?.name ?? "");
  const [modelId, setModelId] = useState(concept?.educationalModelId ?? "");
  const [percentage, setPercentage] = useState(concept?.percentage ?? 0);
  const [status, setStatus] = useState<"abierto" | "cerrado">(concept ? (concept.open ? "abierto" : "cerrado") : "abierto");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog para crear un modelo educativo en línea (siembra Ser/Saber/Hacer/Autoevaluación)
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [creatingModel, setCreatingModel] = useState(false);

  async function handleSave() {
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!modelId) return toast.error("El modelo educativo es obligatorio");
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100)
      return toast.error("El porcentaje debe estar entre 0 y 100");

    setSaving(true);
    try {
      const res = await fetch("/api/evaluative-concepts", {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: concept?.id,
          institutionId,
          userId,
          educationalModelId: modelId,
          name: name.trim(),
          percentage,
          open: status === "abierto",
        }),
      });
      const data = await res.json();
      if (!data.ok) return toast.error(data.error || "No se pudo guardar");
      toast.success(mode === "new" ? "Concepto creado" : "Concepto actualizado");
      onSaved();
    } catch {
      toast.error("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!concept) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/evaluative-concepts?id=${concept.id}&institutionId=${institutionId}&userId=${userId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.ok) return toast.error(data.error || "No se pudo eliminar");
      toast.success("Concepto eliminado");
      onSaved();
    } catch {
      toast.error("Error de red al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateModel() {
    if (!newModelName.trim()) return toast.error("Escribe un nombre para el modelo");
    setCreatingModel(true);
    try {
      const res = await fetch("/api/educational-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, userId, name: newModelName.trim() }),
      });
      const data = await res.json();
      if (!data.ok) return toast.error(data.error || "No se pudo crear el modelo");
      toast.success(`Modelo "${newModelName.trim()}" creado con los 4 conceptos base`);
      setNewModelOpen(false);
      setNewModelName("");
      onModelsChanged();
      if (data.id) setModelId(data.id);
    } catch {
      toast.error("Error de red al crear el modelo");
    } finally {
      setCreatingModel(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver al listado
        </Button>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === "new" ? "Nuevo concepto evaluativo" : "Editar concepto evaluativo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="concept-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="concept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ser, Saber, Hacer, Autoevaluación..."
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Modelo educativo <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escuela nueva" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setNewModelOpen(true)}
                title="Crear modelo educativo"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Al crear un modelo nuevo se generan automáticamente los conceptos Ser, Saber, Hacer y Autoevaluación.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Porcentaje <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[percentage]}
                onValueChange={(v) => setPercentage(Math.round(v[0] ?? 0))}
                min={0}
                max={100}
                step={1}
                className="flex-1"
                aria-label="Porcentaje"
              />
              <span className="text-2xl font-bold tabular-nums w-20 text-right">{percentage}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Estado <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as "abierto" | "cerrado")}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="abierto" id="status-abierto" />
                <Label htmlFor="status-abierto" className="font-normal cursor-pointer">Abierto</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cerrado" id="status-cerrado" />
                <Label htmlFor="status-cerrado" className="font-normal cursor-pointer">Cerrado</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button variant="outline" onClick={onBack}>
              Volver al listado
            </Button>
            {mode === "edit" && concept && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting} className="ml-auto">
                    <Trash2 className="h-4 w-4 mr-1" /> {deleting ? "Eliminando..." : "Eliminar"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar concepto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará "{concept.name}" ({concept.educationalModel?.name ?? "modelo"} — {concept.percentage}%).
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={newModelOpen} onOpenChange={setNewModelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo modelo educativo</DialogTitle>
            <DialogDescription>
              Se crearán automáticamente los conceptos Ser (20%), Saber (40%), Hacer (40%) y Autoevaluación (0%).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="new-model-name">Nombre</Label>
            <Input
              id="new-model-name"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Escuela nueva"
              maxLength={80}
              onKeyDown={(e) => e.key === "Enter" && handleCreateModel()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewModelOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateModel} disabled={creatingModel}>
              {creatingModel ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
