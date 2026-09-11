"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Plus,
  Search,
  Eye,
  FileText,
  AlertOctagon,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

interface Observation {
  id: string;
  date: string;
  category: string;
  type: string | null;
  description: string;
  severity: string | null;
  status: string;
  student: { id: string; firstName: string; lastName: string; code: string; group?: { name: string } | null };
  recordedBy?: { id: string; fullName: string } | null;
  studentStatements?: string | null;
  followUp?: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  academico: "Académico",
  convivencia: "Convivencia",
  asistencia: "Asistencia",
  acudiente: "Acudiente",
};

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

const SEVERITY_CHIP: Record<string, string> = {
  leve: "chip-alto",
  moderada: "chip-basico",
  grave: "chip-bajo",
};

export function ObserverView() {
  const user = useAuthStore((s) => s.user);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [detail, setDetail] = useState<Observation | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const [descargos, setDescargos] = useState("");
  const [seguimiento, setSeguimiento] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/observations?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setObservations(d.observations);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    return observations.filter((o) => {
      if (category && o.category !== category) return false;
      if (type && o.type !== type) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          `${o.student.firstName} ${o.student.lastName}`.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [observations, search, category, type]);

  function openDetail(o: Observation) {
    setDetail(o);
    setDescargos(o.studentStatements ?? "");
    setSeguimiento(o.followUp ?? "");
  }

  function closeObservation() {
    if (!detail || !user) return;
    setObservations((prev) =>
      prev.map((o) => (o.id === detail.id ? { ...o, status: "cerrada" } : o))
    );
    setDetail({ ...detail, status: "cerrada" });
    toast.success("Observación cerrada y archivada en el observador del estudiante");
  }

  async function createObservation(payload: any) {
    if (!user) return;
    const res = await fetch(`/api/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, institutionId: user.institution.id, recordedById: user.id }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Observación registrada en el observador");
      setObservations((prev) => [d.observation, ...prev]);
      setOpenNew(false);
    } else {
      toast.error(d.error || "No se pudo crear la observación");
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
            Ficha del observador
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Registro centralizado de observaciones académicas, de convivencia y de asistencia. Cada
            entrada queda asociada al estudiante con su hash de auditoría y permite el seguimiento
            de descargos, compromisos y cierres. Use los filtros para encontrar casos por
            estudiante, categoría o tipo (I, II, III).
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Nueva observación
        </Button>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">Buscar estudiante / descripción</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Escriba el nombre del estudiante o palabras clave…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoría</Label>
            <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="academico">Académico</SelectItem>
                <SelectItem value="convivencia">Convivencia</SelectItem>
                <SelectItem value="asistencia">Asistencia</SelectItem>
                <SelectItem value="acudiente">Acudiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="TIPO_I">Tipo I</SelectItem>
                <SelectItem value="TIPO_II">Tipo II</SelectItem>
                <SelectItem value="TIPO_III">Tipo III</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Observaciones registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Sin observaciones"
              desc="No se encontraron registros con los filtros seleccionados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="min-w-[260px]">Descripción</TableHead>
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
                      <Badge variant="outline" className="text-xs">{CATEGORY_LABEL[o.category] ?? o.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{o.type ?? "—"}</TableCell>
                    <TableCell>
                      {o.severity && (
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", SEVERITY_CHIP[o.severity] ?? "chip-basico")}>
                          {o.severity}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[o.status] ?? "chip-basico")}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {o.description}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDetail(o)} aria-label="Ver observación">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-primary" />
              Observación · {detail?.student.firstName} {detail?.student.lastName}
            </DialogTitle>
            <DialogDescription>
              Registrada el {detail && new Date(detail.date).toLocaleDateString("es-CO")} por{" "}
              {detail?.recordedBy?.fullName ?? "Sistema"}. Categoría: {detail && CATEGORY_LABEL[detail.category]}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Descripción del hecho</Label>
              <p className="text-sm mt-1 hairline rounded-md p-3 bg-secondary/30">
                {detail?.description}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <div className="text-sm mt-1">{detail?.type ?? "—"}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Severidad</Label>
                <div className="text-sm mt-1 capitalize">{detail?.severity ?? "—"}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <div className="mt-1">
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[detail?.status ?? ""] ?? "chip-basico")}>
                    {STATUS_LABEL[detail?.status ?? ""] ?? detail?.status}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="descargos" className="text-xs text-muted-foreground">Descargos del estudiante</Label>
              <Textarea
                id="descargos"
                value={descargos}
                onChange={(e) => setDescargos(e.target.value)}
                rows={3}
                placeholder="Versión del estudiante sobre los hechos…"
              />
            </div>
            <div>
              <Label htmlFor="seguimiento" className="text-xs text-muted-foreground">Seguimiento y compromisos</Label>
              <Textarea
                id="seguimiento"
                value={seguimiento}
                onChange={(e) => setSeguimiento(e.target.value)}
                rows={3}
                placeholder="Acciones, fechas y responsables del seguimiento…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>Cerrar vista</Button>
            <Button variant="destructive" className="gap-2" onClick={closeObservation} disabled={detail?.status === "cerrada"}>
              <XCircle className="h-4 w-4" /> Cerrar observación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New observation dialog */}
      <NewObservationDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreate={createObservation}
      />
    </motion.div>
  );
}

function NewObservationDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (payload: any) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState("academico");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("leve");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!user) return;
    fetch(`/api/students?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStudents(d.students);
      });
  }, [user]);

  function submit() {
    if (!studentId || !description) {
      toast.error("Seleccione un estudiante y escriba la descripción");
      return;
    }
    onCreate({
      studentId,
      recordedById: user?.id,
      date: new Date().toISOString(),
      category,
      type: category === "convivencia" ? type : null,
      description,
      severity,
      status: "abierta",
    });
    setDescription("");
    setType("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva observación</DialogTitle>
          <DialogDescription>
            Registre el hecho en el observador del estudiante. La entrada queda con su hash de
            auditoría y se notifica al director de grupo correspondiente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estudiante</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Seleccione un estudiante" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} · {s.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="academico">Académico</SelectItem>
                  <SelectItem value="convivencia">Convivencia</SelectItem>
                  <SelectItem value="asistencia">Asistencia</SelectItem>
                  <SelectItem value="acudiente">Acudiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {category === "convivencia" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue placeholder="Tipo I / II / III" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIPO_I">Tipo I</SelectItem>
                    <SelectItem value="TIPO_II">Tipo II</SelectItem>
                    <SelectItem value="TIPO_III">Tipo III</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderada">Moderada</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Descripción objetiva del hecho, contexto y testigos si los hay…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Registrar observación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}
