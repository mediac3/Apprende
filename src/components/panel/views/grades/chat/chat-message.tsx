"use client";

import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "./use-chat-state";

type Props = {
  message: ChatMessage;
  onUndo?: () => void;
  undoAvailable?: boolean;
  undoSecondsLeft?: number;
};

// Burbuja individual del chat. Usuario: derecha/gris. Asistente: izquierda/primary.
export function ChatMessageBubble({ message, onUndo, undoAvailable, undoSecondsLeft }: Props) {
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>

        {message.kind === "table" && message.table && (
          <div className="mt-2 overflow-x-auto rounded-md border bg-background text-foreground">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  {message.table.columns.map((c) => (
                    <th key={c} className="px-2 py-1 text-left font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.table.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message.kind === "result" && message.applied && undoAvailable && onUndo && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUndo}
            className="mt-2 h-7 gap-1 text-xs"
          >
            <Undo2 className="size-3" />
            Deshacer{typeof undoSecondsLeft === "number" ? ` (${undoSecondsLeft}s)` : ""}
          </Button>
        )}
      </div>
    </div>
  );
}
