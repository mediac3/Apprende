"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useChatState } from "./use-chat-state";
import { ChatMessageBubble } from "./chat-message";

type Props = {
  onUndo?: () => void;
  undoAvailable?: boolean;
  undoSecondsLeft?: number;
};

// Historial de mensajes con auto-scroll al final.
export function ChatHistory({ onUndo, undoAvailable, undoSecondsLeft }: Props) {
  const messages = useChatState((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
        <Sparkles className="size-6 text-primary" />
        <p className="font-medium text-foreground">Asistente de notas</p>
        <p>Registra notas en lenguaje natural, por voz o texto. Siempre verás una confirmación antes de aplicar cambios.</p>
        <p className="text-xs">Ej.: &quot;Pon 4.7 a Juan Carlos Moreno en la Actividad 3 de Ser&quot;</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((m) => (
        <ChatMessageBubble
          key={m.id}
          message={m}
          onUndo={onUndo}
          undoAvailable={undoAvailable}
          undoSecondsLeft={undoSecondsLeft}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
