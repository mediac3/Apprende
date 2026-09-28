import { create } from "zustand";
import type { ApplyChangesResult, GradeChange, ParsedCommand } from "@/lib/nlu/types";

export type ChatMessageKind = "text" | "confirmation" | "result" | "table";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  kind: ChatMessageKind;
  text: string;
  createdAt: number;
  // Datos para kind === "table" (consultas de solo lectura).
  table?: { columns: string[]; rows: (string | number)[][] };
  // Datos para kind === "result" (resumen de aplicación + ventana de undo).
  applied?: { updated: number; changes: GradeChange[] };
};

export type LastApplied = { changes: GradeChange[]; timestamp: number };

let seq = 0;
function nextId() {
  seq += 1;
  return `chat-${Date.now()}-${seq}`;
}

type ChatState = {
  messages: ChatMessage[];
  isRecording: boolean;
  // Visibilidad del drawer/bottom sheet del chat.
  isOpen: boolean;
  pendingCommand: ParsedCommand | null;
  // Snapshot de la última aplicación exitosa (ventana de undo de 30s).
  lastApplied: LastApplied | null;
  addMessage: (m: Omit<ChatMessage, "id" | "createdAt">) => void;
  clearMessages: () => void;
  setIsRecording: (v: boolean) => void;
  setOpen: (v: boolean) => void;
  setPendingCommand: (c: ParsedCommand | null) => void;
  cancelCommand: () => void;
  setLastApplied: (changes: GradeChange[]) => void;
  clearLastApplied: () => void;
};

export const useChatState = create<ChatState>((set) => ({
  messages: [],
  isRecording: false,
  isOpen: false,
  pendingCommand: null,
  lastApplied: null,

  addMessage: (m) =>
    set((s) => ({
      messages: [...s.messages, { ...m, id: nextId(), createdAt: Date.now() }],
    })),

  clearMessages: () => set({ messages: [] }),

  setIsRecording: (v) => set({ isRecording: v }),

  setOpen: (v) => set({ isOpen: v }),

  setPendingCommand: (c) => set({ pendingCommand: c }),

  cancelCommand: () =>
    set((s) => ({
      pendingCommand: null,
      messages:
        s.pendingCommand === null
          ? s.messages
          : [
              ...s.messages,
              {
                id: nextId(),
                role: "assistant" as const,
                kind: "text" as const,
                text: "Operación cancelada. No se modificó ninguna nota.",
                createdAt: Date.now(),
              },
            ],
    })),

  setLastApplied: (changes) => set({ lastApplied: { changes, timestamp: Date.now() } }),

  clearLastApplied: () => set({ lastApplied: null }),
}));

// La aplicación y el undo (IO con el servidor) se resuelven en el panel con las
// server actions de src/lib/actions/grades-chat.ts y devuelven ApplyChangesResult.
export type { ApplyChangesResult };
