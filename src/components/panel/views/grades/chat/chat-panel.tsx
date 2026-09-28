"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { ApplyChangesResult, ParseContext } from "@/lib/nlu/types";
import { useChatState } from "./use-chat-state";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatConfirmationCard, type ConfirmPayload } from "./chat-confirmation-card";
import { useCommandParser, type QueryHandlers } from "./use-command-parser";

const UNDO_WINDOW_MS = 30_000;

type Props = {
  ctx: ParseContext | null;
  groupLabel?: string;
  currentValues?: Record<string, string>;
  onApply: (payload: ConfirmPayload) => Promise<ApplyChangesResult>;
  onUndo: () => Promise<void> | void;
  queryHandlers?: QueryHandlers;
};

// Panel del asistente: drawer 400px en desktop, bottom sheet 90vh en móvil.
export function ChatPanel({ ctx, groupLabel, currentValues, onApply, onUndo, queryHandlers }: Props) {
  const isOpen = useChatState((s) => s.isOpen);
  const setOpen = useChatState((s) => s.setOpen);
  const pendingCommand = useChatState((s) => s.pendingCommand);
  const setPendingCommand = useChatState((s) => s.setPendingCommand);
  const cancelCommand = useChatState((s) => s.cancelCommand);
  const clearMessages = useChatState((s) => s.clearMessages);
  const lastApplied = useChatState((s) => s.lastApplied);

  const [applying, setApplying] = useState(false);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const { parse } = useCommandParser(ctx, queryHandlers);

  // Latido de 1s para la ventana de undo de 30s (el render inicial ya calcula
  // la disponibilidad con Date.now(); el intervalo la va actualizando).
  useEffect(() => {
    if (!lastApplied) return;
    const id = setInterval(() => {
      setUndoSecondsLeft(
        Math.max(0, Math.ceil((lastApplied.timestamp + UNDO_WINDOW_MS - Date.now()) / 1000))
      );
    }, 1000);
    return () => clearInterval(id);
  }, [lastApplied]);

  const undoAvailable =
    lastApplied !== null && Date.now() - lastApplied.timestamp < UNDO_WINDOW_MS;

  const handleConfirm = async (payload: ConfirmPayload) => {
    setApplying(true);
    try {
      await onApply(payload);
      setPendingCommand(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="top-auto h-[90vh] w-full gap-0 rounded-t-xl border-t p-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[400px] sm:rounded-none sm:border-l sm:border-t-0"
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b p-3">
          <div>
            <SheetTitle className="text-base">Asistente de notas</SheetTitle>
            <SheetDescription className="text-xs">
              Registra notas por voz o texto. Confirma antes de aplicar.
            </SheetDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Limpiar historial"
            onClick={clearMessages}
            className="gap-1 text-xs"
          >
            <Trash2 className="size-3.5" />
            Limpiar
          </Button>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatHistory onUndo={onUndo} undoAvailable={undoAvailable} undoSecondsLeft={undoSecondsLeft} />
        </div>

        {pendingCommand && ctx && (
          <div className="border-t bg-muted/30 p-3">
            <ChatConfirmationCard
              command={pendingCommand}
              ctx={ctx}
              groupLabel={groupLabel}
              currentValues={currentValues}
              onConfirm={handleConfirm}
              onCancel={() => cancelCommand()}
              applying={applying}
            />
          </div>
        )}

        <ChatInput onParse={parse} disabled={applying} />
      </SheetContent>
    </Sheet>
  );
}
