"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  FileText,
  Plus,
  Eye,
  CheckCircle2,
  PenLine,
  Eraser,
  Calendar,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Signer {
  id: string;
  signedAt: string;
  signatureData?: string | null;
  user: { id: string; fullName: string; role: string; jobTitle?: string | null; avatarUrl?: string | null };
}
interface Meeting {
  id: string;
  title: string;
  type: string;
  date: string;
  location?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  signed: boolean;
  signedAt?: string | null;
  signedBy?: string | null;
  hash?: string | null;
  signers: Signer[];
}

const TYPE_LABEL: Record<string, string> = {
  consejo: "Consejo directivo",
  academico: "Comité académico",
  convivencia: "Comité de convivencia",
  evaluacion: "Comité de evaluación",
  operativo: "Equipo operativo",
  general: "Acta general",
};

export function MeetingsView() {
  const user = useAuthStore((s) => s.user);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState<Meeting | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/meetings?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMeetings(d.meetings);
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function createMeeting(payload: any) {
    if (!user) return;
    const res = await fetch(`/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, institutionId: user.institution.id, userId: user.id }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Acta creada");
      setMeetings((p) => [d.meeting, ...p]);
      setOpenNew(false);
    } else {
      toast.error(d.error || "No se pudo crear el acta");
    }
  }

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
            Actas institucionales
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Registro y firma digital de las actas de los comités y consejos institucionales. Cada
            acta cuenta con un hash de auditoría inmutable que garantiza la trazabilidad de las
            decisiones. Las firmas se capturan con trazo manuscrito sobre el lienzo digital.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Nueva acta
        </Button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl skeleton-pulse" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <Card className="hairline rounded-xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div className="text-base font-medium">Sin actas registradas</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Cree la primera acta institucional para documentar las decisiones de los comités.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => (
            <Card key={m.id} className="hairline rounded-xl">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">{m.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABEL[m.type] ?? m.type}
                      </Badge>
                    </div>
                  </div>
                  {m.signed ? (
                    <Badge className="gap-1 bg-[var(--app-success)] text-white">
                      <CheckCircle2 className="h-3 w-3" /> Firmada
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pendiente</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(m.date).toLocaleDateString("es-CO")}
                  </span>
                  {m.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {m.location}
                    </span>
                  )}
                </div>
                {m.hash && (
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {m.hash.slice(0, 24)}…
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {m.signers.length} firmante(s)
                  </span>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDetail(m)}>
                    <Eye className="h-3.5 w-3.5" /> Ver acta
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewMeetingDialog open={openNew} onOpenChange={setOpenNew} onCreate={createMeeting} />
      <MeetingDetailDialog
        meeting={detail}
        onClose={() => setDetail(null)}
        onSigned={(updated) => {
          setMeetings((p) => p.map((m) => (m.id === updated.id ? updated : m)));
          setDetail(updated);
        }}
      />
    </motion.div>
  );
}

function NewMeetingDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (p: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("consejo");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [minutes, setMinutes] = useState("");

  function submit() {
    if (!title || !type || !date) {
      toast.error("Título, tipo y fecha son obligatorios");
      return;
    }
    onCreate({ title, type, date, location, agenda, minutes });
    setTitle(""); setLocation(""); setAgenda(""); setMinutes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva acta</DialogTitle>
          <DialogDescription>
            Cree el acta con la agenda y las decisiones preliminares. Podrá añadir el desarrollo y
            las firmas posteriormente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acta N° 001 — Sesión ordinaria" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consejo">Consejo directivo</SelectItem>
                  <SelectItem value="academico">Comité académico</SelectItem>
                  <SelectItem value="convivencia">Comité de convivencia</SelectItem>
                  <SelectItem value="evaluacion">Comité de evaluación</SelectItem>
                  <SelectItem value="operativo">Equipo operativo</SelectItem>
                  <SelectItem value="general">Acta general</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Lugar</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sala de juntas" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Agenda</Label>
            <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder="Puntos a tratar, uno por línea…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Acta / minutos</Label>
            <Textarea value={minutes} onChange={(e) => setMinutes(e.target.value)} rows={4} placeholder="Desarrollo de la sesión, decisiones y compromisos…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Crear acta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingDetailDialog({
  meeting,
  onClose,
  onSigned,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onSigned: (m: Meeting) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  function getCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    return { c, ctx };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    setDrawing(true);
    const { c, ctx } = getCtx() ?? {};
    if (!c || !ctx) return;
    ctx.beginPath();
    const rect = c.getBoundingClientRect();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  function moveDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const { c, ctx } = getCtx() ?? {};
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "var(--app-fg)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  function endDraw() {
    setDrawing(false);
  }
  function clearCanvas() {
    const { c, ctx } = getCtx() ?? {};
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }

  async function sign() {
    if (!meeting || !user) return;
    const c = canvasRef.current;
    const signatureData = c ? c.toDataURL("image/png") : null;
    const res = await fetch(`/api/meetings/sign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: meeting.id,
        userId: user.id,
        signatureData,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Acta firmada correctamente");
      onSigned(d.meeting);
      clearCanvas();
    } else {
      toast.error("No se pudo registrar la firma");
    }
  }

  if (!meeting) return null;

  return (
    <Dialog open={!!meeting} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {meeting.title}
          </DialogTitle>
          <DialogDescription>
            {TYPE_LABEL[meeting.type] ?? meeting.type} · {new Date(meeting.date).toLocaleDateString("es-CO")}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Agenda</Label>
            <pre className="text-sm mt-1 hairline rounded-md p-3 bg-secondary/30 whitespace-pre-wrap font-sans">
              {meeting.agenda || "Sin agenda definida."}
            </pre>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Acta / minutos</Label>
            <pre className="text-sm mt-1 hairline rounded-md p-3 bg-secondary/30 whitespace-pre-wrap font-sans">
              {meeting.minutes || "Sin desarrollo registrado."}
            </pre>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Firmantes</Label>
            <div className="space-y-1 mt-1">
              {meeting.signers.length === 0 && (
                <p className="text-xs text-muted-foreground">Aún no hay firmas registradas.</p>
              )}
              {meeting.signers.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--app-success)]" />
                  <span className="font-medium">{s.user.fullName}</span>
                  <span className="text-muted-foreground">· {s.user.jobTitle ?? s.user.role}</span>
                  <span className="text-muted-foreground ml-auto">
                    {new Date(s.signedAt).toLocaleString("es-CO")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" /> Lienzo de firma
            </Label>
            <div className="mt-1 hairline rounded-md overflow-hidden bg-[var(--app-card)]">
              <canvas
                ref={canvasRef}
                width={640}
                height={180}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={clearCanvas}>
                <Eraser className="h-3.5 w-3.5" /> Limpiar
              </Button>
              <Button size="sm" className="gap-1.5 ml-auto" onClick={sign}>
                <PenLine className="h-3.5 w-3.5" /> Firmar acta
              </Button>
            </div>
          </div>

          {meeting.hash && (
            <div className="text-[10px] font-mono text-muted-foreground break-all">
              Hash: {meeting.hash}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
