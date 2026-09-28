"use client";

import { MessageCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatState } from "./use-chat-state";

// FAB de entrada al asistente de notas (esquina inferior derecha del módulo).
export function ChatFab() {
  const setOpen = useChatState((s) => s.setOpen);
  const hasPending = useChatState((s) => s.pendingCommand !== null);

  return (
    <div className="fixed right-6 bottom-6 z-40">
      <Button
        type="button"
        aria-label="Abrir asistente de notas"
        title="Asistente de notas (voz y texto)"
        onClick={() => setOpen(true)}
        className="relative h-14 w-14 rounded-full shadow-lg"
      >
        <MessageCircle className="size-6" />
        <Mic className="absolute right-2.5 bottom-2 size-3 opacity-70" />
        {hasPending && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold text-white"
          >
            !
          </span>
        )}
      </Button>
    </div>
  );
}
