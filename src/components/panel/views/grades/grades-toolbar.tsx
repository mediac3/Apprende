"use client";

import { MessageSquarePlus, Plus, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

// === Módulo Calificaciones: header de contexto (capturas 2, 3, 6) ===

export interface GradesToolbarProps {
  groupName: string; // chip "7-A"
  subjectName: string; // "TECNOLOGÍA E INFORMÁTICA"
  subtitle: string; // "NOTAS PARCIALES · 3ER PERIODO"
  onOpenSearch: () => void; // [C4] Lupa: reabre el sidebar modal
  onAdd: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  /** [R1] false → planilla en solo lectura (docente no asignado): Agregar/Guardar deshabilitados */
  canEdit?: boolean;
  /** [comentarios] modo edición de comentarios por celda */
  commentMode?: boolean;
  onToggleCommentMode?: () => void;
}

export function GradesToolbar({
  groupName,
  subjectName,
  subtitle,
  onOpenSearch,
  onAdd,
  onSave,
  saving,
  dirty,
  canEdit = true,
  commentMode,
  onToggleCommentMode,
}: GradesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 md:flex-nowrap md:gap-3 md:px-4 md:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={onOpenSearch}
          aria-label="Buscar asignatura o grupo (abrir selector)"
          title="Buscar asignatura o grupo"
        >
          <Search className="h-5 w-5" />
        </Button>
        <span className="inline-flex shrink-0 items-center rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
          {groupName}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold uppercase">{subjectName}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        <Button
          variant={commentMode ? "default" : "outline"}
          size="sm"
          onClick={onToggleCommentMode}
          title="Agregar o editar comentarios en las celdas"
          aria-pressed={commentMode}
        >
          <MessageSquarePlus className="mr-1 h-4 w-4" /> Comentar
        </Button>
        <Button variant="outline" size="sm" onClick={onAdd} disabled={!canEdit}>
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={onSave}
          disabled={!canEdit || !dirty || saving}
        >
          <Save className="mr-1 h-4 w-4" />
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
