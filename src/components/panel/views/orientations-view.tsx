"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  HeartHandshake,
  Eye,
  Calendar,
  User,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Orientation {
  id: string;
  date: string;
  modality: string;
  reason: string;
  notes?: string | null;
  followUp?: string | null;
  referral?: string | null;
  status: string;
  student: { id: string; firstName: string; lastName: string; code: string; group?: { name: string } | null };
  orientedBy?: { id: string; fullName: string } | null;
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

const MODALITY_LABEL: Record<string, string> = {
  individual: "Individual",
  familiar: "Familiar",
  grupal: "Grupal",
  remision: "Remisión externa",
};

export function OrientationsView() {
  const user = useAuthStore((s) => s.user);
  const [orientations, setOrientations] = useState<Orientation[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [modality, setModality] = useState<string>("");
  const [detail, setDetail] = useState<Orientation | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/orientations?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setOrientations(d.orientations);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    return orientations.filter((o) => {
      if (status && o.status !== status) return false;
      if (modality && o.modality !== modality) return false;
      return true;
    });
  }, [orientations, status, modality]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          Orientación escolar
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Registro de los procesos de orientación realizados con estudiantes y familias. Cada
          orientación documenta el motivo, la modalidad, las notas de la sesión, el seguimiento
          acordado y las remisiones a entidades externas cuando aplica. Use los filtros para
          monitorear casos abiertos o cerrados.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="abierta">Abierta</SelectItem>
                <SelectItem value="en_seguimiento">En seguimiento</SelectItem>
                <SelectItem value="cerrada">Cerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Modalidad</Label>
            <Select value={modality || "all"} onValueChange={(v) => setModality(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="familiar">Familiar</SelectItem>
                <SelectItem value="grupal">Grupal</SelectItem>
                <SelectItem value="remision">Remisión externa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="ml-auto">{filtered.length} orientaciones</Badge>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="h-4 w-4 text-primary" /> Procesos de orientación
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Sin orientaciones</div>
              <p className="text-xs text-muted-foreground max-w-xs">
                No hay procesos de orientación con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead className="min-w-[200px]">Motivo</TableHead>
                  <TableHead>Orientador</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.date).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{o.student.firstName} {o.student.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">{o.student.group?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {MODALITY_LABEL[o.modality] ?? o.modality}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {o.reason}
                    </TableCell>
                    <TableCell className="text-xs">{o.orientedBy?.fullName ?? "—"}</TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[o.status] ?? "chip-basico")}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetail(o)} aria-label="Ver orientación">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-primary" />
              Orientación · {detail?.student.firstName} {detail?.student.lastName}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {detail && new Date(detail.date).toLocaleDateString("es-CO")}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {detail?.orientedBy?.fullName ?? "Sin orientador"}
              </span>
              <Badge variant="outline">{detail && MODALITY_LABEL[detail.modality]}</Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Motivo de la orientación</Label>
              <p className="text-sm mt-1 hairline rounded-md p-3 bg-secondary/30">
                {detail?.reason}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notas de la sesión</Label>
              <Textarea defaultValue={detail?.notes ?? ""} rows={4} placeholder="Sin notas registradas…" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Seguimiento</Label>
              <Textarea defaultValue={detail?.followUp ?? ""} rows={3} placeholder="Acciones de seguimiento y compromisos…" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Remisión</Label>
              <Textarea defaultValue={detail?.referral ?? ""} rows={2} placeholder="Entidad externa y motivo de remisión…" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>
            <Button
              onClick={() => {
                if (!detail) return;
                setOrientations((p) =>
                  p.map((o) => (o.id === detail.id ? { ...o, status: "cerrada" } : o))
                );
                setDetail({ ...detail, status: "cerrada" });
                toast.success("Orientación cerrada");
              }}
              disabled={detail?.status === "cerrada"}
              className="gap-1.5"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Cerrar orientación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
