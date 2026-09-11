"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Plus,
  Check,
  X,
  Vote,
  Users,
  Crown,
  TrendingUp,
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

interface Enrollment {
  id: string;
  applicantName: string;
  applicantGrade?: string | null;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  type: string;
  status: string;
  createdAt: string;
  notes?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const STATUS_CHIP: Record<string, string> = {
  solicitada: "chip-basico",
  en_revision: "chip-alto",
  aprobada: "chip-superior",
  rechazada: "chip-bajo",
};

interface Candidate {
  id: string;
  role: string;
  name: string;
  grade?: string;
}

const CANDIDATES: Candidate[] = [
  { id: "c1", role: "Representante docente", name: "María González", grade: "Primaria" },
  { id: "c2", role: "Representante docente", name: "Carlos Pérez", grade: "Secundaria" },
  { id: "c3", role: "Representante estudiantil", name: "Laura Gómez", grade: "11°" },
  { id: "c4", role: "Representante estudiantil", name: "Andrés Torres", grade: "10°" },
  { id: "c5", role: "Personero estudiantil", name: "Valentina Ruiz", grade: "11°" },
  { id: "c6", role: "Personero estudiantil", name: "Santiago Díaz", grade: "11°" },
];

export function EnrollmentsView({ module }: { module: "gobierno-escolar" | "inscripcion" | "pre-matricula" }) {
  if (module === "gobierno-escolar") return <VotingView />;
  return <EnrollmentListView module={module} />;
}

function EnrollmentListView({ module }: { module: "inscripcion" | "pre-matricula" }) {
  const user = useAuthStore((s) => s.user);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/enrollments?institutionId=${user.institution.id}&type=${module}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setEnrollments(d.enrollments);
      })
      .finally(() => setLoading(false));
  }, [user, module]);

  const stats = useMemo(() => ({
    total: enrollments.length,
    pendientes: enrollments.filter((e) => e.status === "solicitada" || e.status === "en_revision").length,
    aprobadas: enrollments.filter((e) => e.status === "aprobada").length,
    rechazadas: enrollments.filter((e) => e.status === "rechazada").length,
  }), [enrollments]);

  async function updateStatus(id: string, status: "aprobada" | "rechazada") {
    if (!user) return;
    setEnrollments((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
    const res = await fetch(`/api/enrollments/update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, processedById: user.id }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success(`Solicitud ${status === "aprobada" ? "aprobada" : "rechazada"}`);
    } else {
      toast.error("No se pudo actualizar el estado");
    }
  }

  async function createEnrollment(payload: any) {
    if (!user) return;
    const res = await fetch(`/api/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, institutionId: user.institution.id, type: module, userId: user.id }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Solicitud registrada");
      setEnrollments((p) => [d.enrollment, ...p]);
      setOpenNew(false);
    } else {
      toast.error(d.error || "No se pudo registrar la solicitud");
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
            {module === "inscripcion" ? "Inscripción en línea" : "Pre-Matrícula"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Gestión de solicitudes de {module === "inscripcion" ? "inscripción" : "pre-matrícula"} recibidas
            a través del portal institucional. Cada solicitud incluye los datos del aspirante y del
            acudiente. Apruebe o rechace las solicitudes; el sistema notifica automáticamente al
            acudiente y deja trazabilidad en auditoría.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Nueva solicitud
        </Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total" value={stats.total} />
        <StatBox label="Pendientes" value={stats.pendientes} tone="var(--app-warning)" />
        <StatBox label="Aprobadas" value={stats.aprobadas} tone="var(--app-success)" />
        <StatBox label="Rechazadas" value={stats.rechazadas} tone="var(--app-error)" />
      </section>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Solicitudes recibidas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Sin solicitudes</div>
              <p className="text-xs text-muted-foreground max-w-xs">
                No hay solicitudes de {module === "inscripcion" ? "inscripción" : "pre-matrícula"} registradas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Aspirante</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Acudiente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell className="font-medium">{e.applicantName}</TableCell>
                    <TableCell className="text-xs">{e.applicantGrade ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.guardianName}</TableCell>
                    <TableCell className="text-xs">{e.guardianPhone}</TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[e.status] ?? "chip-basico")}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {e.status === "solicitada" || e.status === "en_revision" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => updateStatus(e.id, "aprobada")}>
                            <Check className="h-3 w-3" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => updateStatus(e.id, "rechazada")}>
                            <X className="h-3 w-3" /> Rechazar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewEnrollmentDialog
        open={openNew}
        onOpenChange={setOpenNew}
        type={module}
        onCreate={createEnrollment}
      />
    </motion.div>
  );
}

function NewEnrollmentDialog({
  open,
  onOpenChange,
  type,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: string;
  onCreate: (p: any) => void;
}) {
  const [applicantName, setApplicantName] = useState("");
  const [applicantBirthDate, setApplicantBirthDate] = useState("");
  const [applicantGrade, setApplicantGrade] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!applicantName || !guardianName || !guardianPhone) {
      toast.error("Aspirante, acudiente y teléfono son obligatorios");
      return;
    }
    onCreate({
      applicantName,
      applicantBirthDate: applicantBirthDate || null,
      applicantGrade: applicantGrade || null,
      guardianName,
      guardianPhone,
      guardianEmail: guardianEmail || null,
      type,
      notes: notes || null,
    });
    setApplicantName(""); setApplicantBirthDate(""); setApplicantGrade("");
    setGuardianName(""); setGuardianPhone(""); setGuardianEmail(""); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva solicitud de {type === "inscripcion" ? "inscripción" : "pre-matrícula"}</DialogTitle>
          <DialogDescription>
            Complete los datos del aspirante y del acudiente. La solicitud queda en estado
            "solicitada" para su revisión posterior.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre del aspirante</Label>
              <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fecha de nacimiento</Label>
              <Input type="date" value={applicantBirthDate} onChange={(e) => setApplicantBirthDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Grado al que aspira</Label>
            <Input value={applicantGrade} onChange={(e) => setApplicantGrade(e.target.value)} placeholder="Ej. 6°" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Acudiente</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="+57 300 000 0000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Correo</Label>
            <Input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="acudiente@correo.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observaciones</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Registrar solicitud</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VotingView() {
  const [votes, setVotes] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    CANDIDATES.forEach((c) => (m[c.id] = 0));
    return m;
  });
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const m: Record<string, Candidate[]> = {};
    CANDIDATES.forEach((c) => {
      if (!m[c.role]) m[c.role] = [];
      m[c.role].push(c);
    });
    return m;
  }, []);

  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;

  function vote(c: Candidate) {
    if (voted[c.id]) return;
    setVotes((p) => ({ ...p, [c.id]: (p[c.id] ?? 0) + 1 }));
    setVoted((p) => ({ ...p, [c.id]: true }));
    toast.success(`Voto registrado para ${c.name}`);
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
          <Vote className="h-6 w-6 text-primary" /> Gobierno escolar
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Proceso democrático de elección de representantes al gobierno escolar. Cada miembro de la
          comunidad puede votar una vez por categoría. Los resultados se actualizan en tiempo real
          y son públicos para garantizar la transparencia del proceso.
        </p>
      </header>

      <Card className="hairline rounded-xl bg-secondary/30">
        <CardContent className="py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium">Total de votos emitidos</div>
            <div className="text-xs text-muted-foreground">
              {total} votos · Proceso en vivo (demostración)
            </div>
          </div>
          <div className="ml-auto text-3xl font-heading font-semibold tabular-nums">{total}</div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        {Object.entries(grouped).map(([role, candidates]) => {
          const roleTotal = candidates.reduce((s, c) => s + (votes[c.id] ?? 0), 0) || 1;
          const leader = candidates.reduce((max, c) => ((votes[c.id] ?? 0) > (votes[max.id] ?? 0) ? c : max), candidates[0]);
          return (
            <Card key={role} className="hairline rounded-xl">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Crown className="h-4 w-4 text-[var(--app-brass)]" /> {role}
                </CardTitle>
                <Badge variant="secondary">{candidates.length} candidatos</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {candidates.map((c) => {
                  const v = votes[c.id] ?? 0;
                  const pct = Math.round((v / roleTotal) * 100);
                  const isLeader = c.id === leader.id && v > 0;
                  return (
                    <div key={c.id} className="hairline rounded-md p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2">
                            {c.name}
                            {isLeader && <Crown className="h-3.5 w-3.5 text-[var(--app-brass)]" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{c.grade ?? "—"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-semibold tabular-nums">{v} votos</div>
                            <div className="text-[11px] text-muted-foreground">{pct}%</div>
                          </div>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => vote(c)}
                            disabled={voted[c.id]}
                          >
                            <Vote className="h-3.5 w-3.5" />
                            {voted[c.id] ? "Votado" : "Votar"}
                          </Button>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isLeader ? "var(--app-brass)" : "var(--app-primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </motion.div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="hairline rounded-xl bg-[var(--app-card)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {tone && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />}
      </div>
      <div className="text-2xl font-heading font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
