"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, X, RotateCcw } from "lucide-react";

// === Asistente de IA contextual (widget flotante del panel) ===
// Muestra hallazgos del módulo activo (p.ej. Consolidado anual) y responde
// consultas sobre esos datos y sobre la plataforma. La clave del proveedor
// se configura en Parámetros → Inteligencia artificial.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SALUDO_SIN_DATOS =
  "Hola, soy tu asistente de IA. Abre un módulo con datos (por ejemplo, Consolidado anual) y podré analizarlos contigo: riesgos de deserción, análisis por grupo, asignatura y sede.";

export function AiChatWidget() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;
  const aiContext = useUIStore((s) => s.aiContext);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const enviar = useCallback(
    async (contenido: string, base: ChatMessage[]) => {
      if (!institutionId || !contenido.trim()) return null;
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          messages: [...base, { role: "user", content: contenido }],
          context: aiContext ? { moduleTitle: aiContext.moduleTitle, ...aiContext.data } : null,
        }),
      });
      const j = await res.json();
      return j.ok ? String(j.reply) : `${j.error ?? "Error del asistente."}`;
    },
    [institutionId, aiContext]
  );

  // Nuevo chat al abrir o al cambiar de módulo; pide un análisis inicial
  useEffect(() => {
    if (!open) return;
    setMessages([]);
    if (!aiContext?.data) {
      setMessages([{ role: "assistant", content: SALUDO_SIN_DATOS }]);
      return;
    }
    setSending(true);
    enviar(
      "Dame un breve análisis del módulo actual: 3 o 4 hallazgos clave y cualquier alerta de riesgo que veas en los datos.",
      []
    )
      .then((reply) => {
        setMessages([{ role: "assistant", content: reply ?? "No pude generar el análisis." }]);
      })
      .finally(() => setSending(false));
  }, [open, aiContext?.moduleId, aiContext?.moduleTitle]);

  // Autoscroll al último mensaje
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSend() {
    const texto = input.trim();
    if (!texto || sending) return;
    setInput("");
    await send(texto);
  }

  async function send(texto: string) {
    if (sending) return;
    const base = messagesRef.current;
    setMessages((m) => [...m, { role: "user", content: texto }]);
    setSending(true);
    try {
      const reply = await enviar(texto, base);
      setMessages((m) => [...m, { role: "assistant", content: reply ?? "No hubo respuesta." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[480px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border bg-background shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Asistente IA
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {aiContext ? aiContext.moduleTitle : "Sin módulo activo"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Nuevo chat"
                onClick={() => setMessages([])}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Cerrar" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && !sending && (
              <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                Escribe una pregunta sobre los datos del módulo activo (riesgo de deserción,
                análisis por grupo, asignatura o sede) o sobre los módulos de la plataforma.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted/70 text-foreground"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                Analizando…
              </div>
            )}
          </div>

          {/* Acciones rápidas sugeridas por el módulo activo */}
          {aiContext?.quickActions && aiContext.quickActions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t px-3 pt-2">
              {aiContext.quickActions.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => send(qa.prompt)}
                  disabled={sending}
                  className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                  title={qa.prompt}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={aiContext?.data ? "Pregunta sobre estos datos…" : "Pregunta sobre la plataforma…"}
              className="h-8 text-xs"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={sending || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 h-11 rounded-full shadow-lg"
        title="Asistente de IA"
      >
        <Sparkles className="mr-1 h-4 w-4" />
        IA
      </Button>
    </>
  );
}
