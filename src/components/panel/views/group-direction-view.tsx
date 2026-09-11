"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Users,
  Cake,
  Phone,
  Mail,
  Smartphone,
  Send,
  Star,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Group { id: string; name: string; }
interface Student {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianRelation?: string | null;
  group?: { id: string; name: string } | null;
  grades?: Array<{ value: number | null; performance: string | null; subject?: { name: string } | null }>;
  observations?: Array<{ id: string; date: string; category: string }>;
}

interface SmsLogEntry {
  id: string;
  to: string;
  message: string;
  sentAt: string;
  status: "enviado" | "pendiente" | "fallido";
}

const SMS_LOG: SmsLogEntry[] = [
  { id: "1", to: "Padres 8°A", message: "Recordatorio: reunión de padres mañana 6:00 pm.", sentAt: "2024-10-12T14:30:00Z", status: "enviado" },
  { id: "2", to: "Acudiente Laura Gómez", message: "Su hijo presenta ausencia el día de hoy.", sentAt: "2024-10-12T11:15:00Z", status: "enviado" },
  { id: "3", to: "Padres 11°", message: "Cierre de periodo 2 el próximo viernes.", sentAt: "2024-10-11T16:00:00Z", status: "enviado" },
  { id: "4", to: "Acudiente Carlos Ruiz", message: "Citación a reunión de seguimiento.", sentAt: "2024-10-10T09:45:00Z", status: "pendiente" },
  { id: "5", to: "Padres generales", message: "Suspensión de actividades por jornada pedagógica.", sentAt: "2024-10-09T18:20:00Z", status: "enviado" },
];

export function GroupDirectionView({ module }: { module: "direccion-grupo" | "notas-acudientes" | "sms" }) {
  if (module === "direccion-grupo") return <DireccionGrupoView />;
  if (module === "notas-acudientes") return <NotasAcudientesView />;
  return <SmsView />;
}

function DireccionGrupoView() {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/groups?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setGroups(d.groups);
          if (d.groups[0]) setGroupId(d.groups[0].id);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user || !groupId) return;
    setLoading(true);
    fetch(`/api/students?institutionId=${user.institution.id}&groupId=${groupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStudents(d.students);
      })
      .finally(() => setLoading(false));
  }, [user, groupId]);

  const birthdays = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    return students
      .filter((s) => {
        if (!s.birthDate) return false;
        return new Date(s.birthDate).getMonth() === month;
      })
      .slice(0, 6);
  }, [students]);

  const subjectAverages = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    students.forEach((s) => {
      s.grades?.forEach((g) => {
        const name = g.subject?.name ?? "—";
        if (!map[name]) map[name] = { sum: 0, count: 0 };
        if (g.value !== null && g.value !== undefined) {
          map[name].sum += g.value;
          map[name].count++;
        }
      });
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      avg: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
    }));
  }, [students]);

  const convivenciaCount = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    return students.reduce(
      (sum, s) =>
        sum +
        (s.observations?.filter(
          (o) => o.category === "convivencia" && new Date(o.date).getTime() > cutoff
        ).length ?? 0),
      0
    );
  }, [students]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">
            Dirección de grupo
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Resumen integral del grupo a su cargo: cumpleaños del mes para fortalecer el sentido de
            pertenencia, contactos de acudientes para comunicación directa, resumen académico por
            asignatura y situación convivencial de los últimos 30 días.
          </p>
        </div>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Birthdays */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cake className="h-4 w-4 text-[var(--app-brass)]" /> Cumpleaños del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : birthdays.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay cumpleaños este mes en este grupo.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {birthdays.map((s) => (
                <div key={s.id} className="hairline rounded-md p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center font-semibold text-primary">
                    {s.firstName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.birthDate && new Date(s.birthDate).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contact list */}
        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Contactos de acudientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acudiente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Correo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.slice(0, 8).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{s.guardianName ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{s.firstName} {s.lastName}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" /> {s.guardianPhone ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" /> {s.guardianEmail ?? "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Academic summary */}
        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" /> Resumen académico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Promedio del grupo por asignatura en el periodo activo.
            </p>
            {subjectAverages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin calificaciones registradas.</p>
            ) : (
              subjectAverages.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs flex-1 truncate">{s.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full" style={{ width: `${s.avg}%`, backgroundColor: "var(--app-primary)" }} />
                  </div>
                  <span className={cn("text-xs font-semibold tabular-nums w-10 text-right", s.avg >= 80 ? "text-[var(--perf-superior)]" : s.avg >= 70 ? "text-[var(--perf-alto)]" : "text-[var(--perf-basico)]")}>
                    {s.avg}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Convivencia summary */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-[var(--perf-bajo)]" /> Situación convivencial (últimos 30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Número de observaciones de convivencia registradas en el grupo durante el último mes.
            Use este indicador para anticipar conversatorios con el grupo o citaciones individuales.
          </p>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-3xl font-heading font-semibold tabular-nums">{convivenciaCount}</div>
              <div className="text-xs text-muted-foreground">observaciones</div>
            </div>
            <Badge variant="outline" className="capitalize">
              {convivenciaCount === 0
                ? "Sin situaciones"
                : convivenciaCount < 3
                ? "Baja incidencia"
                : convivenciaCount < 6
                ? "Atención requerida"
                : "Intervención prioritaria"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NotasAcudientesView() {
  const user = useAuthStore((s) => s.user);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, { note: string; score: number }>>({});

  useEffect(() => {
    if (!user) return;
    fetch(`/api/students?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStudents(d.students.slice(0, 20));
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function saveNote(s: Student) {
    if (!user) return;
    const payload = notes[s.id];
    if (!payload?.note) {
      toast.error("Escriba una nota para registrar");
      return;
    }
    const res = await fetch(`/api/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: user.institution.id,
        studentId: s.id,
        recordedById: user.id,
        date: new Date().toISOString(),
        category: "acudiente",
        description: `${payload.note} (Puntaje: ${payload.score}/100)`,
        severity: payload.score < 50 ? "grave" : payload.score < 70 ? "moderada" : "leve",
        status: "abierta",
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Nota registrada en el observador del estudiante");
      setNotes((p) => ({ ...p, [s.id]: { note: "", score: 80 } }));
    } else {
      toast.error("No se pudo registrar la nota");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <Star className="h-6 w-6 text-[var(--app-warning)]" /> Notas para acudientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Registro de notas cualitativas y valoraciones dirigidas a los acudientes. Cada nota se
          documenta en el observador del estudiante con su severidad correspondiente y notifica al
          acudiente por los canales configurados. Use el puntaje para indicar el nivel de
          desempeño o actitud observada.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl skeleton-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((s) => {
            const draft = notes[s.id] ?? { note: "", score: 80 };
            return (
              <Card key={s.id} className="hairline rounded-xl">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{s.firstName} {s.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.code} · {s.group?.name ?? "—"} · Acudiente: {s.guardianName ?? "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.score}
                        onChange={(e) => setNotes((p) => ({ ...p, [s.id]: { ...draft, score: Number(e.target.value) } }))}
                        className="h-8 w-20 tabular-nums"
                        aria-label="Puntaje"
                      />
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <Textarea
                    value={draft.note}
                    onChange={(e) => setNotes((p) => ({ ...p, [s.id]: { ...draft, note: e.target.value } }))}
                    rows={2}
                    placeholder="Nota cualitativa para el acudiente (compromisos, logros, dificultades)…"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" className="gap-1.5" onClick={() => saveNote(s)}>
                      <Send className="h-3.5 w-3.5" /> Registrar nota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function SmsView() {
  const [recipient, setRecipient] = useState("Todos los grupos");
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<SmsLogEntry[]>(SMS_LOG);

  function send() {
    if (!message.trim()) {
      toast.error("Escriba el mensaje a enviar");
      return;
    }
    if (message.length > 160) {
      toast.error("El mensaje supera los 160 caracteres");
      return;
    }
    const entry: SmsLogEntry = {
      id: String(Date.now()),
      to: recipient,
      message,
      sentAt: new Date().toISOString(),
      status: "enviado",
    };
    setLog((p) => [entry, ...p]);
    toast.success(`SMS enviado a "${recipient}"`);
    setMessage("");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" /> Comunicación SMS
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Envíe mensajes SMS a grupos completos o acudientes individuales. Cada mensaje se registra
          en el log con su estado de entrega. Use este canal para notificaciones urgentes,
          recordatorios de reuniones o citaciones a acudientes.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Nuevo mensaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Destinatario</Label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos los grupos">Todos los grupos</SelectItem>
                  <SelectItem value="Padres 8°A">Padres 8°A</SelectItem>
                  <SelectItem value="Padres 8°B">Padres 8°B</SelectItem>
                  <SelectItem value="Padres 11°">Padres 11°</SelectItem>
                  <SelectItem value="Docentes">Docentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Mensaje</span>
                <span className={cn("tabular-nums", message.length > 160 ? "text-[var(--app-error)]" : "text-muted-foreground")}>
                  {message.length} / 160
                </span>
              </Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Escriba el mensaje a enviar…"
                maxLength={200}
              />
            </div>
            <Button className="w-full gap-1.5" onClick={send}>
              <Send className="h-4 w-4" /> Enviar SMS
            </Button>
          </CardContent>
        </Card>

        <Card className="hairline rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Mensajes recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {log.map((e) => (
              <div key={e.id} className="hairline rounded-md p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.to}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      e.status === "enviado" ? "chip-superior" : e.status === "pendiente" ? "chip-basico" : "chip-bajo"
                    )}
                  >
                    {e.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.message}</p>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(e.sentAt).toLocaleString("es-CO")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
