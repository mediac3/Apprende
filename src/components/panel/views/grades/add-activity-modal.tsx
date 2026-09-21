"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// === Módulo Calificaciones: modal "Agregar actividad" (captura 2) ===
// [F1] presetConceptId: abre con el concepto evaluativo ya seleccionado
//      (botón "+" del header del concepto en la planilla).
// [F2] editActivity + onUpdate: modo edición con nombre/tipo precargados.

export interface ActivityFormData {
  evaluativeConceptId: string;
  name: string;
  isGeneral: boolean;
}

export interface EditableActivity {
  id: string;
  name: string;
  conceptId: string;
  isGeneral: boolean;
}

export interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concepts: { id: string; name: string; percentage: number }[];
  /** [F3] si se pasan asignaciones, se muestra un selector requerido (solo creación) */
  assignments?: { key: string; label: string }[];
  /** onCreate recibe la asignación elegida cuando `assignments` está presente */
  onCreate?: (data: ActivityFormData, assignmentKey?: string) => Promise<boolean>; // true = creado (cierra el modal)
  /** [F1] concepto precargado al abrir (create) */
  presetConceptId?: string | null;
  /** [F3] valor inicial de Act. General al abrir (create) */
  presetIsGeneral?: boolean;
  /** [F2] actividad en edición: activa modo edición */
  editActivity?: EditableActivity | null;
  onUpdate?: (id: string, data: ActivityFormData) => Promise<boolean>;
}

export function AddActivityModal({
  open,
  onOpenChange,
  concepts,
  assignments,
  onCreate,
  presetConceptId,
  presetIsGeneral,
  editActivity,
  onUpdate,
}: AddActivityModalProps) {
  const [conceptId, setConceptId] = useState("");
  const [assignmentKey, setAssignmentKey] = useState("");
  const [isGeneral, setIsGeneral] = useState(false);
  const [name, setName] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(editActivity);
  const needsAssignment = !isEdit && Boolean(assignments && assignments.length > 0);

  // Al abrir: precarga [F1] (concepto del botón "+") o [F2] (datos de la actividad)
  useEffect(() => {
    if (!open) return;
    if (editActivity) {
      setConceptId(editActivity.conceptId);
      setIsGeneral(editActivity.isGeneral);
      setName(editActivity.name);
      setExtraOpen(true); // en edición el nombre es visible por defecto
    } else {
      setConceptId(presetConceptId ?? "");
      setAssignmentKey("");
      setIsGeneral(presetIsGeneral ?? false);
      setName("");
      setExtraOpen(false);
    }
  }, [open, editActivity, presetConceptId, presetIsGeneral]);

  const handleSubmit = async () => {
    if (!conceptId || saving || (needsAssignment && !assignmentKey)) return;
    setSaving(true);
    try {
      const data: ActivityFormData = {
        evaluativeConceptId: conceptId,
        name: name.trim(),
        isGeneral,
      };
      const ok = isEdit && editActivity
        ? await onUpdate?.(editActivity.id, data)
        : await onCreate?.(data, needsAssignment ? assignmentKey : undefined);
      if (ok) {
        setConceptId("");
        setAssignmentKey("");
        setIsGeneral(false);
        setName("");
        setExtraOpen(false);
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar actividad" : "Agregar actividad"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {needsAssignment && (
            <div className="space-y-1.5">
              <Label htmlFor="asignacion">Asignación:</Label>
              <Select value={assignmentKey} onValueChange={setAssignmentKey}>
                <SelectTrigger id="asignacion" className="w-full">
                  <SelectValue placeholder="Seleccione grupo y asignatura" />
                </SelectTrigger>
                <SelectContent>
                  {assignments!.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tipo-actividad">Tipo actividad:</Label>
            <Select value={conceptId} onValueChange={setConceptId}>
              <SelectTrigger id="tipo-actividad" className="w-full">
                <SelectValue placeholder="Seleccione el concepto evaluativo" />
              </SelectTrigger>
              <SelectContent>
                {concepts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} [{c.percentage}%]
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="act-general" className="cursor-pointer text-sm">
              Act. General
            </Label>
            <Switch
              id="act-general"
              checked={isGeneral}
              onCheckedChange={setIsGeneral}
            />
          </div>

          {isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="nombre-actividad">Nombre de la actividad</Label>
              <Input
                id="nombre-actividad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vacío = automático (N1, N2, N3…)"
                maxLength={60}
              />
            </div>
          ) : (
            <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                Nombre de la actividad (opcional)
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-1 pt-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vacío = automático (N1, N2, N3…)"
                  maxLength={60}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!conceptId || saving || (needsAssignment && !assignmentKey)}
            onClick={handleSubmit}
          >
            {saving ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar cambios" : "Crear"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
