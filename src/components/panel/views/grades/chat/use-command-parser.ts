"use client";

import { useCallback } from "react";
import { parseCommand } from "@/lib/nlu/parse-command";
import type { ParseContext, ParsedCommand } from "@/lib/nlu/types";
import { useChatState } from "./use-chat-state";

// Handlers de consultas de solo lectura (FASE 9), provistos por la integración.
export type QueryHandlers = {
  onQueryGrades?: (cmd: ParsedCommand) => void;
  onAggregateQuery?: (cmd: ParsedCommand) => void;
};

// Conecta el input del chat con el parser NLU y el store del chat.
// Escritura → pendingCommand (tarjeta de confirmación). Consultas → handlers.
export function useCommandParser(ctx: ParseContext | null, handlers?: QueryHandlers) {
  const addMessage = useChatState((s) => s.addMessage);
  const setPendingCommand = useChatState((s) => s.setPendingCommand);

  const parse = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      addMessage({ role: "user", kind: "text", text });
      if (!ctx) {
        addMessage({
          role: "assistant",
          kind: "text",
          text: "Un momento: todavía estoy cargando los datos de la planilla (grupo, actividades y estudiantes).",
        });
        return;
      }
      const command = parseCommand(text, ctx);
      if (command.error) {
        addMessage({ role: "assistant", kind: "text", text: command.error });
        return;
      }
      if (command.action === "query_grades") {
        if (handlers?.onQueryGrades) handlers.onQueryGrades(command);
        else addMessage({ role: "assistant", kind: "text", text: "Las consultas no están disponibles ahora." });
        return;
      }
      if (command.action === "aggregate_query") {
        if (handlers?.onAggregateQuery) handlers.onAggregateQuery(command);
        else addMessage({ role: "assistant", kind: "text", text: "Las consultas no están disponibles ahora." });
        return;
      }
      setPendingCommand(command);
    },
    [ctx, addMessage, setPendingCommand, handlers]
  );

  return { parse };
}
