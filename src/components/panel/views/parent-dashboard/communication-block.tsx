"use client";

// [Dashboard Padre] Bloque I — comunicación con el colegio: 1 clic para escribir + historial.
// Solo acciones reales del sistema (mensajería existe); sin botones muertos.
import { ArrowUpRight, ArrowDownLeft, MessageSquarePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RecentMessage } from "@/lib/queries/parent-dashboard";
import { relativeTime } from "./use-parent-dashboard";

export function CommunicationBlock({
  messages,
  onNavigate,
}: {
  messages: RecentMessage[];
  onNavigate: () => void;
}) {
  return (
    <Card data-testid="parent-comunicacion">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Comunicación</CardTitle>
        <Button size="sm" className="gap-1.5" onClick={onNavigate}>
          <MessageSquarePlus className="h-4 w-4" aria-hidden /> Escribir
        </Button>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tienes mensajes. Escríbele al docente cuando lo necesites: estás a un clic. 💬
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {messages.map((m) => (
              <li key={m.id} className="flex items-start gap-2.5 py-2">
                <span className="mt-0.5 text-muted-foreground" aria-hidden>
                  {m.direction === "sent" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.counterpart}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.preview}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(m.createdAtISO)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
