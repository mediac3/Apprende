"use client";

// [Dashboard Padre] Bloque A — selector multi-hijo (solo si hay más de un hijo).
// Cambiar de hijo recarga todo el dashboard (refetch con childId).
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ParentChild } from "@/lib/queries/parent-dashboard";

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function ChildSelector({
  items,
  activeId,
  onSelect,
}: {
  items: ParentChild[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (items.length <= 1) return null; // regla dura: un solo hijo → sin selector
  return (
    <Card className="p-2" role="tablist" aria-label="Seleccionar hijo">
      <div className="flex gap-2 overflow-x-auto">
        {items.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                  active ? "bg-primary-foreground/20" : "bg-muted"
                )}
                aria-hidden
              >
                {initials(c.firstName, c.lastName)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">{c.firstName}</span>
                <span className={cn("block text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {c.groupName ?? "Estudiante"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
