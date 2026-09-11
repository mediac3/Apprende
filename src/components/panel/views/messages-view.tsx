"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  MessageSquare,
  Send,
  Search,
  MessagesSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Thread {
  partnerId: string;
  partner: { id: string; fullName: string; avatarUrl?: string | null; role: string; jobTitle?: string | null };
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; fullName: string; avatarUrl?: string | null };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export function MessagesView() {
  const user = useAuthStore((s) => s.user);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/messages?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setThreads(d.threads);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || !active) return;
    setLoadingThread(true);
    fetch(`/api/messages?userId=${user.id}&otherUserId=${active.partnerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMessages(d.messages);
      })
      .finally(() => {
        setLoadingThread(false);
        setTimeout(() => {
          threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
        }, 50);
      });
  }, [user, active]);

  async function send() {
    if (!user || !active || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      senderId: user.id,
      sender: { id: user.id, fullName: user.fullName, avatarUrl: null },
    };
    setMessages((p) => [...p, optimistic]);
    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: active.partnerId,
          content,
        }),
      });
      const d = await res.json();
      if (!d.ok) toast.error("No se pudo enviar el mensaje");
    } catch {
      toast.error("Error de red");
    }
  }

  const filteredThreads = search
    ? threads.filter((t) => t.partner.fullName.toLowerCase().includes(search.toLowerCase()))
    : threads;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-9rem)]"
    >
      {/* Left: thread list */}
      <Card className="hairline rounded-xl flex flex-col overflow-hidden">
        <CardContent className="py-4 flex flex-col flex-1 gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <MessagesSquare className="h-4 w-4 text-primary" /> Conversaciones
            </h2>
            <Badge variant="secondary" className="text-[10px]">{threads.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar persona…"
              className="pl-8 h-8"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-md skeleton-pulse" />
              ))
            ) : filteredThreads.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Sin conversaciones. Inicie una nueva desde el directorio institucional.
              </div>
            ) : (
              filteredThreads.map((t) => (
                <button
                  key={t.partnerId}
                  onClick={() => setActive(t)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                    active?.partnerId === t.partnerId ? "bg-secondary" : "hover:bg-secondary"
                  )}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-secondary text-xs">{t.partner.fullName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{t.partner.fullName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {relativeTime(t.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.lastMessage.content}
                    </div>
                  </div>
                  {t.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 px-1 grid place-items-center text-[10px]">
                      {t.unreadCount}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right: conversation */}
      <Card className="hairline rounded-xl lg:col-span-2 flex flex-col overflow-hidden">
        {active ? (
          <>
            <CardContent className="py-3 hairline-b flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-secondary text-xs">{active.partner.fullName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium">{active.partner.fullName}</div>
                <div className="text-[11px] text-muted-foreground capitalize">
                  {active.partner.role}{active.partner.jobTitle ? ` · ${active.partner.jobTitle}` : ""}
                </div>
              </div>
            </CardContent>
            <div
              ref={threadRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--app-bg)]"
            >
              {loadingThread ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-md skeleton-pulse max-w-md" />
                ))
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Aún no hay mensajes en esta conversación. Sea el primero en escribir.
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-secondary text-[10px]">
                          {m.sender.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "max-w-md rounded-md px-3 py-2 text-sm",
                          mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                        )}
                      >
                        <p>{m.content}</p>
                        <div className={cn("text-[10px] mt-0.5", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {relativeTime(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <CardContent className="py-3 hairline-t flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Escriba un mensaje…"
              />
              <Button size="icon" onClick={send} aria-label="Enviar mensaje">
                <Send className="h-4 w-4" />
              </Button>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-secondary grid place-items-center text-muted-foreground">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div className="text-base font-medium">Seleccione una conversación</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Seleccione una conversación de la lista o inicie una nueva desde el directorio
              institucional para comenzar a mensajear.
            </p>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
