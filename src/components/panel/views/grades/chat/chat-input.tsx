"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "./use-speech-recognition";
import { useChatState } from "./use-chat-state";

const PLACEHOLDERS = [
  "Pon 4.7 a Juan Carlos Moreno en Actividad 3 de Ser…",
  "Asigna 5.0 a todos en Hacer…",
  "Muestra las notas de Juan Carlos…",
];

type Props = {
  onParse: (text: string) => void;
  disabled?: boolean;
};

// Input del chat: texto (Enter envía, Shift+Enter salto de línea) + micrófono
// push-to-talk (mantener presionado) con fallback a toggle si el toque fue corto.
export function ChatInput({ onParse, disabled }: Props) {
  const [value, setValue] = useState("");
  const [stickyRecording, setStickyRecording] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const pressStart = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechRecognition("es-CO");
  const addMessage = useChatState((s) => s.addMessage);

  // Placeholder rotativo.
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Errores de voz (permiso, red, etc.) como mensaje del asistente.
  useEffect(() => {
    if (speech.error) {
      addMessage({ role: "assistant", kind: "text", text: speech.error });
    }
  }, [speech.error, addMessage]);

  // Al terminar de grabar con transcripción final → enviar al parser automáticamente.
  useEffect(() => {
    if (!speech.isRecording && speech.transcript) {
      const text = speech.transcript;
      speech.reset();
      onParse(text);
    }
  }, [speech.isRecording, speech.transcript, speech, onParse]);

  const submitText = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onParse(text);
  }, [value, disabled, onParse]);

  // Auto-expansión del textarea.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const startRecording = useCallback(() => {
    if (disabled) return;
    speech.start();
  }, [disabled, speech]);

  const stopRecording = useCallback(() => {
    speech.stop();
  }, [speech]);

  // Push-to-talk: presionar = grabar; soltar = detener.
  // Toque corto (<300ms) → modo toggle: el segundo toque detiene.
  const onPointerDown = () => {
    if (!speech.isSupported) return;
    pressStart.current = Date.now();
    if (speech.isRecording && stickyRecording) {
      stopRecording();
      setStickyRecording(false);
      return;
    }
    startRecording();
  };

  const onPointerUp = () => {
    if (!speech.isSupported) return;
    const held = Date.now() - pressStart.current >= 300;
    if (held) {
      stopRecording();
      setStickyRecording(false);
    } else if (speech.isRecording) {
      setStickyRecording(true);
    }
  };

  const recording = speech.isRecording;

  return (
    <div className="border-t p-3">
      {!speech.isSupported && (
        <p className="mb-2 text-xs text-muted-foreground">
          Dictado no soportado en este navegador. Usa texto.
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value || speech.interimTranscript}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitText();
            }
          }}
          onInput={autoResize}
          placeholder={PLACEHOLDERS[placeholderIdx]}
          aria-label="Mensaje para el asistente de notas"
          className="max-h-[120px] min-h-[44px] flex-1 resize-none"
          rows={1}
        />
        {recording ? (
          <Button
            type="button"
            size="icon"
            aria-label="Detener grabación"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            className="h-11 w-11 shrink-0 rounded-full bg-destructive text-white hover:bg-destructive/90"
          >
            <span className="flex items-end gap-0.5" aria-hidden>
              <span className="w-1 animate-pulse rounded-sm bg-current" style={{ height: 14 }} />
              <span className="w-1 animate-pulse rounded-sm bg-current [animation-delay:150ms]" style={{ height: 20 }} />
              <span className="w-1 animate-pulse rounded-sm bg-current [animation-delay:300ms]" style={{ height: 10 }} />
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            aria-label="Mantén presionado para hablar"
            title="Mantén presionado para hablar"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            disabled={!speech.isSupported || disabled}
            className={cn("h-11 w-11 shrink-0 rounded-full")}
          >
            <Mic className="size-5" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          aria-label="Enviar"
          onClick={submitText}
          disabled={disabled || !value.trim()}
          className="h-11 w-11 shrink-0 rounded-full"
        >
          <Send className="size-5" />
        </Button>
      </div>
      {recording && (
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          {stickyRecording ? "Grabando (toggle) — toca de nuevo para terminar…" : "Escuchando… suelta para enviar."}
        </p>
      )}
    </div>
  );
}
