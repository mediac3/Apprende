"use client";

import { useCallback } from "react";
import { parseCommand } from "@/lib/nlu/parse-command";
import type { ParseContext } from "@/lib/nlu/types";
import { useChatState } from "./use-chat-state";

// Conecta el input del chat con el parser NLU y el store del chat.
// El contexto (estudiantes/actividades/conceptos) proviene del grid activo.
export function useCommandParser(ctx: ParseContext | null) {
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
      setPendingCommand(command);
    },
    [ctx, addMessage, setPendingCommand]
  );

  return { parse };
}
