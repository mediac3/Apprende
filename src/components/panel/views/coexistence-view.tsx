"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Shield,
  ShieldAlert,
  ShieldX,
  Eye,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Observation {
  id: string;
  date: string;
  type: string | null;
  description: string;
  severity: string | null;
  status: string;
  studentStatements?: string | null;
  followUp?: string | null;
  student: { id: string; firstName: string; lastName: string; code: string; group?: { name: string } | null };
  recordedBy?: { id: string; fullName: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_seguimiento: "En seguimiento",
  cerrada: "Cerrada",
};

const STATUS_CHIP: Record<string, string> = {
  abierta: "chip-bajo",
  en_seguimiento: "chip-basico",
  cerrada: "chip-superior",
};

const TYPE_META: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  TIPO_I: {
    label: "Tipo I",
    icon: Shield,
    color: "var(--app-info)",
    desc: "Situaciones esporádicas que afectan la convivencia y no incurren en daño físico o psicológico. Manejo pedagógico por el docente o director de grupo.",
  },
  TIPO_II: {
    label: "Tipo II",
    icon: ShieldAlert,
    color: "var(--app-warning)",
    desc: "Situaciones de agresión escolar, acoso o vejación que no revisten lesiones. Requieren mediación y seguimiento por coordinación.",
  },
  TIPO_III: {
    label: "Tipo III",
    icon: ShieldX,
    color: "var(--app-error)",
    desc: "Situaciones que constituyen presuntas infracciones a la ley. Remisión obligatoria a entidades externas y activación de ruta de atención.",
  },
};

export function CoexistenceView() {
  const user = useAuthStore((s) => s.user);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Observation | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/observations?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setObservations(d.observations.filter((o: Observation) => o.category === "convivencia"));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    return {
      abiertas: observations.filter((o) => o.status === "abierta").length,
      seguimiento: observations.filter((o) => o.status === "en_seguimiento").length,
      cerradas: observations.filter((o) => o.status === "cerrada").length,
      total: observations.length,
    };
  }, [observations]);

  const byType = (type: string) => observations.filter((o) => o.type === type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          Convivencia escolar
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Gestión de situaciones convivenciales tipificadas según el manual de convivencia. Las
          situaciones se clasifican en Tipo I, II y III, cada una con su ruta de atención
          correspondiente. Los descargos del estudiante y el seguimiento pedagógico quedan
          documentados en cada caso para respaldar las decisiones del comité escolar de
          convivencia.
        </p>
      </header>

      {/* Stats header */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Total casos" value={stats.total} color="var(--app-primary)" />
        <StatBox label="Abiertas" value={stats.abiertas} color="var(--app-error)" />
        <StatBox label="En seguimiento" value={stats.seguimiento} color="var(--app-warning)" />
        <StatBox label="Cerradas" value={stats.cerradas} color="var(--app-success)" />
      </section>

      {/* 3 columns by type */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Object.entries(TYPE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const items = byType(key);
          return (
            <Card key={key} className="hairline rounded-xl">
              <CardHeader className="flex-row items-center gap-3">
                <div
                  className="h-9 w-9 rounded-md grid place-items-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
                >
                  <Icon className="h-5 w-5" style={{ color: meta.color }} />
                </div>
                <div>
                  <CardTitle className="text-base">{meta.label}</CardTitle>
                  <div className="text-[11px] text-muted-foreground">{items.length} casos</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{meta.desc}</p>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 rounded-md skeleton-pulse" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-6 gap-1.5">
                    <Inbox className="h-5 w-5 text-muted-foreground" />
                    <div className="text-xs font-medium">Sin casos {meta.label}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.slice(0, 6).map((o) => (
                      <div key={o.id} className="hairline rounded-md p-3 space-y-2 bg-secondary/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {o.student.firstName} {o.student.lastName}
                          </div>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[o.status] ?? "chip-basico")}>
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(o.date).toLocaleDateString("es-CO")} · {o.student.group?.name ?? "Sin grupo"}
                        </div>
                        <p className="text-xs line-clamp-2">{o.description}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 h-7 text-xs"
                          onClick={() => setDetail(o)}
                        >
                          <Eye className="h-3 w-3" /> Ver descargos
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              {detail?.type} · {detail?.student.firstName} {detail?.student.lastName}
            </DialogTitle>
            <DialogDescription>
              Caso registrado el {detail && new Date(detail.date).toLocaleDateString("es-CO")} por{" "}
              {detail?.recordedBy?.fullName ?? "Sistema"}. Severidad: {detail?.severity ?? "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Descripción del hecho</Label>
              <p className="text-sm mt-1 hairline rounded-md p-3 bg-secondary/30">
                {detail?.description}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descargos del estudiante</Label>
              <Textarea
                defaultValue={detail?.studentStatements ?? ""}
                rows={3}
                placeholder="Sin descargos registrados…"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Seguimiento y compromisos</Label>
              <Textarea
                defaultValue={detail?.followUp ?? ""}
                rows={3}
                placeholder="Acciones, responsables y fechas…"
              />
            </div>
          </div>
          <DialogFooter>
            <Badge variant="outline">
              Estado: {detail && STATUS_LABEL[detail.status]}
            </Badge>
            <Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!detail) return;
                setObservations((prev) =>
                  prev.map((o) => (o.id === detail.id ? { ...o, status: "cerrada" } : o))
                );
                setDetail({ ...detail, status: "cerrada" });
                toast.success("Caso cerrado y archivado en el libro de convivencia");
              }}
              disabled={detail?.status === "cerrada"}
            >
              Cerrar caso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="hairline rounded-xl bg-[var(--app-card)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="text-2xl font-heading font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
