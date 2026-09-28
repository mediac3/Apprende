"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { applyGradeChanges, undoGradeChanges } from "@/lib/actions/grades-chat";
import type { ApplyChangesResult, ParseContext, ParsedCommand } from "@/lib/nlu/types";
import { useAuthStore } from "@/store/auth-store";
import { useChatState } from "./use-chat-state";
import type { ConfirmPayload } from "./chat-confirmation-card";
import type { QueryHandlers } from "./use-command-parser";

export type CellUpdate = { studentId: string; activityId: string; value: number };
export type CellRevert = { studentId: string; activityId: string; before: number | null };

type Props = {
  ctx: ParseContext | null;
  currentValues: Record<string, string>;
  // Reconciliación del grid (optimistic update del módulo Calificaciones).
  onApplied: (updates: CellUpdate[]) => void;
  onReverted: (reverts: CellRevert[]) => void;
};

// Pegamento chat ↔ server actions ↔ grid: aplicar, undo (30s) y consultas.
export function useChatIntegration({
  ctx,
  currentValues,
  onApplied,
  onReverted,
}: Props): QueryHandlers & {
  handleApply: (payload: ConfirmPayload) => Promise<ApplyChangesResult>;
  handleUndo: () => Promise<void>;
} {
  const addMessage = useChatState((s) => s.addMessage);
  const setLastApplied = useChatState((s) => s.setLastApplied);
  const clearLastApplied = useChatState((s) => s.clearLastApplied);
  const undoRef = useRef<() => Promise<void>>(async () => {});

  const handleUndo = useCallback(async () => {
    const last = useChatState.getState().lastApplied;
    if (!last) return;
    const r = await undoGradeChanges(last.changes);
    if (r.success) {
      onReverted(last.changes);
      clearLastApplied();
      addMessage({ role: "assistant", kind: "text", text: "↩️ Cambios deshechos. Valores restaurados." });
      toast.success("Cambios deshechos");
    } else {
      const msg = r.error ?? "No se pudo deshacer.";
      addMessage({ role: "assistant", kind: "text", text: `❌ ${msg}` });
      toast.error(msg);
    }
  }, [onReverted, clearLastApplied, addMessage]);

  useEffect(() => {
    undoRef.current = handleUndo;
  }, [handleUndo]);

  const handleApply = useCallback(
    async (payload: ConfirmPayload): Promise<ApplyChangesResult> => {
      const user = useAuthStore.getState().user;
      if (!user) {
        addMessage({ role: "assistant", kind: "text", text: "❌ Sesión no válida." });
        return { success: false, error: "Sesión no válida." };
      }
      const result = await applyGradeChanges({ userId: user.id, ...payload });
      if (!result.success || !result.changes) {
        const msg = result.error ?? "No se pudo aplicar el cambio.";
        addMessage({ role: "assistant", kind: "text", text: `❌ ${msg}` });
        toast.error(msg);
        return result;
      }
      // Reconciliar grid + snapshot para undo (FASE 8 y 10).
      onApplied(result.changes.map((c) => ({ studentId: c.studentId, activityId: c.activityId, value: c.after })));
      setLastApplied(result.changes);
      if (result.updated === 0) {
        addMessage({ role: "assistant", kind: "text", text: "Las celdas ya tenían ese valor. No se cambió nada." });
      } else {
        addMessage({
          role: "assistant",
          kind: "result",
          text: `✅ ${result.updated} nota(s) actualizada(s). Tienes 30 segundos para deshacer.`,
          applied: { updated: result.updated ?? 0, changes: result.changes },
        });
        toast.success(`${result.updated} nota(s) actualizada(s)`, {
          description: "Ventana de undo: 30 s",
          action: { label: "Deshacer", onClick: () => void undoRef.current() },
        });
      }
      return result;
    },
    [addMessage, onApplied, setLastApplied]
  );

  // FASE 9 — consultas de solo lectura con los datos ya cargados del grid.
  const handleQueryGrades = useCallback(
    (cmd: ParsedCommand) => {
      if (!ctx) return;
      if (cmd.target.ambiguous.length > 0) {
        addMessage({
          role: "assistant",
          kind: "text",
          text: `¿A cuál te refieres? ${cmd.target.ambiguous.map((a) => a.fullName).join(" · ")}`,
        });
        return;
      }
      const sid = cmd.target.studentIds[0];
      if (!sid) return;
      const rows = ctx.activities.map((a) => [
        a.label ?? a.name,
        ctx.concepts.find((c) => c.id === a.conceptId)?.name ?? "",
        currentValues[`${sid}::${a.id}`] ?? "—",
      ]);
      addMessage({
        role: "assistant",
        kind: "table",
        text: `Notas de ${cmd.target.studentName} en la planilla activa:`,
        table: { columns: ["Actividad", "Componente", "Nota"], rows },
      });
    },
    [ctx, currentValues, addMessage]
  );

  const handleAggregateQuery = useCallback(
    (cmd: ParsedCommand) => {
      if (!ctx || cmd.value === null || !cmd.comparator) return;
      const conceptId = cmd.scope.component
        ? ctx.concepts.find((c) => c.name === cmd.scope.component)?.id
        : null;
      const activityIds = ctx.activities
        .filter((a) => (conceptId ? a.conceptId === conceptId : true))
        .map((a) => a.id);
      const matching = new Set<string>();
      for (const s of ctx.students) {
        for (const aid of activityIds) {
          const raw = currentValues[`${s.id}::${aid}`];
          if (raw === undefined || raw === "") continue;
          const v = Number(raw);
          if (isNaN(v)) continue;
          if (
            (cmd.comparator === "lt" && v < cmd.value) ||
            (cmd.comparator === "gt" && v > cmd.value)
          ) {
            matching.add(s.id);
            break;
          }
        }
      }
      const scopeTxt = cmd.scope.component ? `en ${cmd.scope.component}` : "en la planilla";
      const op = cmd.comparator === "lt" ? "menor" : "mayor";
      addMessage({
        role: "assistant",
        kind: "text",
        text:
          matching.size === 0
            ? `Ningún estudiante tiene notas con valor ${op} a ${cmd.value} ${scopeTxt}.`
            : `${matching.size} estudiante(s) tienen al menos una nota con valor ${op} a ${cmd.value} ${scopeTxt}.`,
      });
    },
    [ctx, currentValues, addMessage]
  );

  return {
    handleApply,
    handleUndo,
    onQueryGrades: handleQueryGrades,
    onAggregateQuery: handleAggregateQuery,
  };
}
