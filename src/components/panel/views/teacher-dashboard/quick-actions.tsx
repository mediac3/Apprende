"use client";

// [Dashboard Docente] Bloque E — Atajos: las 5 acciones frecuentes a 1 click.
// Regla dura: cada atajo lleva directo al módulo destino (todos existen en el panel).
import { FilePlus2, CalendarCheck, ClipboardPen, Library, MessageSquare, type LucideIcon } from "lucide-react";
import type { ModuleKey } from "@/store/ui-store";

interface Shortcut {
  icon: LucideIcon;
  label: string;
  module: ModuleKey;
  accent: string;
}

const SHORTCUTS: Shortcut[] = [
  { icon: FilePlus2, label: "Crear tarea", module: "gestion-actividades", accent: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
  { icon: CalendarCheck, label: "Asistencia", module: "asistencia", accent: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950" },
  { icon: ClipboardPen, label: "Calificar", module: "notas", accent: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
  { icon: Library, label: "Recursos", module: "talleres", accent: "text-violet-600 bg-violet-100 dark:bg-violet-950" },
  { icon: MessageSquare, label: "Comunicación", module: "mensajeria", accent: "text-rose-600 bg-rose-100 dark:bg-rose-950" },
];

export function QuickActions({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2 mb-6">
      {SHORTCUTS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onNavigate(s.module)}
          className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <span className={`rounded-lg p-2 ${s.accent}`}>
            <s.icon className="h-5 w-5" />
          </span>
          <span className="text-[11px] md:text-xs font-medium text-center leading-tight">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
