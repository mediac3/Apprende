"use client";

import { useState } from "react";
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

export interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concepts: { id: string; name: string; percentage: number }[];
  onCreate: (data: {
    evaluativeConceptId: string;
    name: string;
    isGeneral: boolean;
  }) => Promise<boolean>; // true = creado (cierra el modal)
}

export function AddActivityModal({
  open,
  onOpenChange,
  concepts,
  onCreate,
}: AddActivityModalProps) {
  const [conceptId, setConceptId] = useState("");
  const [isGeneral, setIsGeneral] = useState(false);
  const [name, setName] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!conceptId || creating) return;
    setCreating(true);
    try {
      const ok = await onCreate({
        evaluativeConceptId: conceptId,
        name: name.trim(),
        isGeneral,
      });
      if (ok) {
        setConceptId("");
        setIsGeneral(false);
        setName("");
        setExtraOpen(false);
        onOpenChange(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar actividad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
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

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!conceptId || creating}
            onClick={handleCreate}
          >
            {creating ? "Creando…" : "Crear"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
