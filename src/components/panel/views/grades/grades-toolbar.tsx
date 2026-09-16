"use client";

import { Plus, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

// === Módulo Calificaciones: header de contexto (capturas 2, 3, 6) ===

export interface GradesToolbarProps {
  groupName: string; // chip "7-A"
  subjectName: string; // "TECNOLOGÍA E INFORMÁTICA"
  subtitle: string; // "NOTAS PARCIALES · 3ER PERIODO"
  onAdd: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function GradesToolbar({
  groupName,
  subjectName,
  subtitle,
  onAdd,
  onSave,
  saving,
  dirty,
}: GradesToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="inline-flex shrink-0 items-center rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
          {groupName}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold uppercase">{subjectName}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
