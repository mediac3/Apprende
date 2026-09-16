"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// === Módulo Calificaciones: sidebar modal "Sistema de calificaciones" [C4] ===
// Overlay izquierdo sobre la app (Sheet = Radix Dialog, side left).
// Se reabre con la Lupa del toolbar; al elegir asignatura se cierra solo.

export interface SidebarSubject {
  groupId: string;
  groupName: string; // chip "7-A"
  subjectId: string;
  subjectName: string;
}

export interface GradesSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periods: { id: string; label: string }[]; // ej. "2026 - Tercero"
  selectedPeriodId: string;
  onSelectPeriod: (periodId: string) => void;
  currentPeriodLabel: string; // "PERIODO ABIERTO · 2026 - Tercero"
  subjects: SidebarSubject[];
  selected: { groupId: string; subjectId: string } | null;
  onSelectSubject: (s: SidebarSubject) => void;
}

export function GradesSidebar({
  open,
  onOpenChange,
  periods,
  selectedPeriodId,
  onSelectPeriod,
  currentPeriodLabel,
  subjects,
  selected,
  onSelectSubject,
}: GradesSidebarProps) {
  const [query, setQuery] = useState("");
  const [cardOpen, setCardOpen] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.subjectName.toLowerCase().includes(q) || s.groupName.toLowerCase().includes(q)
    );
  }, [subjects, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-80 gap-3 p-3 sm:max-w-none"
        onOpenAutoFocus={(e) => {
          // Foco inicial en el buscador (spec [C4])
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          Sistema de calificaciones
        </SheetTitle>
        <SheetDescription className="sr-only">
          Seleccione el periodo y la asignatura cuya planilla de notas desea ver.
        </SheetDescription>

        {/* Periodo abierto (colapsable) */}
        {cardOpen && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                PERIODO ABIERTO · {currentPeriodLabel}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setCardOpen(false)}
                  aria-label="Cerrar tarjeta de periodo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setCardOpen(false)}
                  aria-label="Colapsar"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {!cardOpen && (
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => setCardOpen(true)}
          >
            <ChevronDown className="mr-1 h-3.5 w-3.5" /> Mostrar periodo abierto
          </Button>
        )}

        {/* Selector de periodo */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Periodo</label>
          <Select value={selectedPeriodId} onValueChange={onSelectPeriod}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccione periodo" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Asignaturas */}
        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          Asignaturas <ChevronDown className="h-3.5 w-3.5" />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar asignatura o grupo…"
            className="pl-8"
          />
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-1 py-4 text-xs text-muted-foreground">
              No hay asignaturas asignadas a sus grupos para el plan activo.
            </p>
          )}
          {filtered.map((s) => {
            const isActive =
              selected?.groupId === s.groupId && selected?.subjectId === s.subjectId;
            return (
              <button
                key={`${s.groupId}-${s.subjectId}`}
                type="button"
                onClick={() => onSelectSubject(s)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <span className="inline-flex shrink-0 items-center rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-semibold">
                  {s.groupName}
                </span>
                <span className="truncate">{s.subjectName}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
