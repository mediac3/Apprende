"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ParseContext, ParsedCommand } from "@/lib/nlu/types";

export type ConfirmPayload = {
  studentIds: string[];
  activityIds: string[];
  value: number;
};

type Props = {
  command: ParsedCommand;
  ctx: ParseContext;
  groupLabel?: string;
  currentValues?: Record<string, string>;
  onConfirm: (payload: ConfirmPayload) => void;
  onCancel: () => void;
  applying?: boolean;
};

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

// Tarjeta de confirmación previa (CRÍTICO: nunca aplica sin confirmación explícita).
// Bloquea Confirmar si hay ambigüedad sin resolver o valor fuera de rango 0.0–5.0.
export function ChatConfirmationCard({
  command,
  ctx,
  groupLabel,
  currentValues,
  onConfirm,
  onCancel,
  applying,
}: Props) {
  const isAll = command.target.type === "all_students";
  const [value, setValue] = useState<string>(command.value !== null ? String(command.value) : "");
  const [editing, setEditing] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(
    command.target.studentIds[0] ?? null
  );
  const [activityIds, setActivityIds] = useState<string[]>([]);

  // Actividades candidatas según el alcance del comando.
  const candidateActivities = useMemo(() => {
    if (command.scope.ambiguousActivities?.length) return command.scope.ambiguousActivities;
    if (command.scope.scopeLevel === "specific_activity" && command.scope.activity) {
      const conceptId = ctx.concepts.find((c) => c.name === command.scope.component)?.id;
      const hits = ctx.activities.filter(
        (a) =>
          (a.label ?? a.name) === command.scope.activity &&
          (conceptId ? a.conceptId === conceptId : true)
      );
      if (hits.length) return hits;
    }
    if (command.scope.scopeLevel === "all_activities_of_component" && command.scope.component) {
      const conceptId = ctx.concepts.find((c) => c.name === command.scope.component)?.id;
      return ctx.activities.filter((a) => a.conceptId === conceptId);
    }
    if (command.scope.scopeLevel === "all_components") return ctx.activities;
    return []; // unknown: el usuario debe elegir actividad(es)
  }, [command, ctx]);

  const resolvedActivityIds = useMemo(() => {
    if (activityIds.length) return activityIds;
    if (candidateActivities.length >= 1 && command.scope.scopeLevel !== "unknown") {
      return candidateActivities.map((a) => a.id);
    }
    return [];
  }, [activityIds, candidateActivities, command.scope.scopeLevel]);

  const studentIds = isAll ? command.target.studentIds : studentId ? [studentId] : [];
  const numValue = Number(value.replace(",", "."));
  const valueValid = value !== "" && !isNaN(numValue) && numValue >= 0 && numValue <= 5;
  const needsStudent = !isAll && studentIds.length === 0;
  const needsActivity = resolvedActivityIds.length === 0;
  const blocked = !valueValid || needsStudent || needsActivity || applying;

  // Preview de impacto: celdas a modificar y cuántas ya tenían nota.
  const impact = useMemo(() => {
    let cells = 0;
    let hadNote = 0;
    for (const s of studentIds) {
      for (const a of resolvedActivityIds) {
        cells += 1;
        const cur = currentValues?.[`${s}::${a}`];
        if (cur !== undefined && cur !== null && cur !== "") hadNote += 1;
      }
    }
    return { cells, hadNote };
  }, [studentIds, resolvedActivityIds, currentValues]);

  const verb = "Registrar nota";

  return (
    <div className="rounded-xl border bg-background p-3 text-sm shadow-sm">
      <p className="mb-2 font-medium">{verb}</p>

      <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1.5">
        <span className="text-muted-foreground">Valor:</span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          aria-label="Nota a registrar"
          className="h-7 w-20 px-2 text-sm"
        />
        {!valueValid && value !== "" && (
          <span className="col-start-2 text-xs text-destructive">
            La nota debe estar entre 0.0 y 5.0.
          </span>
        )}

        <span className="text-muted-foreground">Estudiante(s):</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {isAll ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Todos los estudiantes ({command.target.studentIds.length}
              {groupLabel ? ` · ${groupLabel}` : ""})
            </span>
          ) : command.target.ambiguous.length > 0 ? (
            command.target.ambiguous.map((s) => (
              <Chip key={s.id} selected={studentId === s.id} onClick={() => setStudentId(s.id)}>
                {s.fullName}
              </Chip>
            ))
          ) : (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {command.target.studentName}
            </span>
          )}
        </div>

        <span className="text-muted-foreground">Actividad(es):</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {command.scope.scopeLevel === "unknown" && candidateActivities.length === 0 ? (
            ctx.activities.map((a) => (
              <Chip
                key={a.id}
                selected={activityIds.includes(a.id)}
                onClick={() =>
                  setActivityIds((prev) =>
                    prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                  )
                }
              >
                {a.label ?? a.name}
                {command.scope.component
                  ? ""
                  : ` · ${ctx.concepts.find((c) => c.id === a.conceptId)?.name ?? ""}`}
              </Chip>
            ))
          ) : candidateActivities.length === 1 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
              {candidateActivities[0].label ?? candidateActivities[0].name}
              {command.scope.component ? ` · ${command.scope.component}` : ""}
            </span>
          ) : (
            candidateActivities.map((a) => (
              <Chip
                key={a.id}
                selected={activityIds.includes(a.id)}
                onClick={() =>
                  setActivityIds((prev) =>
                    prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                  )
                }
              >
                {a.label ?? a.name}
                <span className="opacity-60">
                  {" · "}
                  {ctx.concepts.find((c) => c.id === a.conceptId)?.name}
                </span>
              </Chip>
            ))
          )}
        </div>
      </div>

      {editing && (
        <p className="mt-2 text-xs text-muted-foreground">
          Edita el valor o selecciona otra actividad/estudiante con los chips.
        </p>
      )}

      {studentIds.length > 0 && resolvedActivityIds.length > 0 && valueValid && (
        <p className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
          Se modificarán <b>{impact.cells}</b> celda{impact.cells !== 1 ? "s" : ""}
          {impact.hadNote > 0 && (
            <>
              {" · "}
              <b>{impact.hadNote}</b> ya tenían nota (se sobreescribirá)
            </>
          )}
          .
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={blocked}
          onClick={() =>
            onConfirm({ studentIds, activityIds: resolvedActivityIds, value: numValue })
          }
          className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          <Check className="size-4" />
          {applying ? "Aplicando…" : "Confirmar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing((e) => !e)}
          className="gap-1"
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} className="gap-1">
          <X className="size-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}
