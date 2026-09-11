"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  BookOpen,
  ClipboardCheck,
  Calendar,
  Building2,
  Users,
  Settings,
  Check,
  X,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface Member {
  id: string;
  fullName: string;
  role: string;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  badgeCount?: number;
}

interface Subject { id: string; name: string; area?: string | null; }
interface Group { id: string; name: string; }
interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weight?: number | null;
  active?: boolean;
  closed?: boolean;
}
interface Enrollment {
  id: string;
  applicantName: string;
  applicantGrade?: string | null;
  guardianName: string;
  guardianPhone: string;
  status: string;
  createdAt: string;
}

const BOOKS = [
  { id: "matricula", title: "Libro de matrícula", desc: "Registro oficial de matrículas de estudiantes con su número de folio y estado." },
  { id: "calificaciones", title: "Libro de calificaciones", desc: "Historial de notas por periodo y asignatura con promedios consolidados." },
  { id: "observador", title: "Libro del observador", desc: "Ficha acumulada de observaciones académicas y convivenciales por estudiante." },
  { id: "convivencia", title: "Libro de convivencia", desc: "Actas y situaciones del comité escolar de convivencia con sus resoluciones." },
];

const BOOK_SAMPLES: Record<string, Array<Record<string, string>>> = {
  matricula: [
    { folio: "001", estudiante: "Ana Torres", grupo: "8°A", fecha: "2024-02-01", estado: "Activa" },
    { folio: "002", estudiante: "Bruno Díaz", grupo: "8°A", fecha: "2024-02-01", estado: "Activa" },
    { folio: "003", estudiante: "Carla Ruiz", grupo: "9°B", fecha: "2024-02-02", estado: "Activa" },
    { folio: "004", estudiante: "David Gómez", grupo: "9°B", fecha: "2024-02-02", estado: "Retirada" },
    { folio: "005", estudiante: "Elena Vargas", grupo: "10°", fecha: "2024-02-03", estado: "Activa" },
  ],
  calificaciones: [
    { estudiante: "Ana Torres", asignatura: "Matemáticas", p1: "85", p2: "78", p3: "—", final: "—" },
    { estudiante: "Bruno Díaz", asignatura: "Lenguaje", p1: "72", p2: "80", p3: "—", final: "—" },
    { estudiante: "Carla Ruiz", asignatura: "Ciencias", p1: "90", p2: "88", p3: "—", final: "—" },
    { estudiante: "David Gómez", asignatura: "Sociales", p1: "65", p2: "70", p3: "—", final: "—" },
    { estudiante: "Elena Vargas", asignatura: "Inglés", p1: "92", p2: "95", p3: "—", final: "—" },
  ],
  observador: [
    { fecha: "2024-03-12", estudiante: "Ana Torres", categoria: "Académico", tipo: "—", estado: "Cerrada" },
    { fecha: "2024-03-15", estudiante: "Bruno Díaz", categoria: "Convivencia", tipo: "TIPO_I", estado: "Abierta" },
    { fecha: "2024-04-02", estudiante: "Carla Ruiz", categoria: "Asistencia", tipo: "—", estado: "Cerrada" },
    { fecha: "2024-04-10", estudiante: "David Gómez", categoria: "Convivencia", tipo: "TIPO_II", estado: "Seguimiento" },
    { fecha: "2024-04-22", estudiante: "Elena Vargas", categoria: "Académico", tipo: "—", estado: "Cerrada" },
  ],
  convivencia: [
    { fecha: "2024-03-01", caso: "C-001", tipo: "TIPO_I", descripcion: "Uso de celular en clase", estado: "Cerrada" },
    { fecha: "2024-03-18", caso: "C-002", tipo: "TIPO_II", descripcion: "Agresión verbal entre pares", estado: "Seguimiento" },
    { fecha: "2024-04-05", caso: "C-003", tipo: "TIPO_I", descripcion: "Llegadas tarde reiteradas", estado: "Cerrada" },
    { fecha: "2024-04-19", caso: "C-004", tipo: "TIPO_III", descripcion: "Presunta sustracción de objetos", estado: "Abierta" },
    { fecha: "2024-05-02", caso: "C-005", tipo: "TIPO_II", descripcion: "Incumplimiento de compromisos", estado: "Seguimiento" },
  ],
};

export function AcademicoView({ module }: { module: "libros" | "matricula" | "asignacion" | "periodos" | "configuracion" | "talento-humano" }) {
  if (module === "libros") return <LibrosView />;
  if (module === "matricula") return <MatriculaView />;
  if (module === "asignacion") return <AsignacionView />;
  if (module === "periodos") return <PeriodosView />;
  if (module === "configuracion") return <ConfiguracionView />;
  return <TalentoHumanoView />;
}

function LibrosView() {
  const [openBook, setOpenBook] = useState<string | null>(null);
  const current = BOOKS.find((b) => b.id === openBook);
  const sample = openBook ? BOOK_SAMPLES[openBook] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Libros reglamentarios
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Libros oficiales digitales exigidos por la normativa educativa colombiana. Cada libro
          mantiene un registro inmutable con foliación automática y hash de auditoría. Haga clic en
          un libro para abrir su vista previa con entradas de muestra.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BOOKS.map((b) => (
          <Card key={b.id} className="hairline rounded-xl">
            <CardContent className="py-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-secondary grid place-items-center text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">{b.title}</div>
                <p className="text-xs text-muted-foreground mt-1">{b.desc}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpenBook(b.id)}>
                <Eye className="h-3.5 w-3.5" /> Abrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openBook} onOpenChange={(o) => !o && setOpenBook(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> {current?.title}
            </DialogTitle>
            <DialogDescription>{current?.desc}</DialogDescription>
          </DialogHeader>
          {sample && (
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(sample[0]).map((k) => (
                    <TableHead key={k} className="capitalize">{k}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.map((row, i) => (
                  <TableRow key={i}>
                    {Object.values(row).map((v, j) => (
                      <TableCell key={j} className="text-xs">{v}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBook(null)}>Cerrar</Button>
            <Button onClick={() => toast.info("Exportación disponible en el plan institucional")}>Exportar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function MatriculaView() {
  const user = useAuthStore((s) => s.user);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/enrollments?institutionId=${user.institution.id}&type=matricula`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setEnrollments(d.enrollments);
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function update(id: string, status: "aprobada" | "rechazada") {
    if (!user) return;
    setEnrollments((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
    const res = await fetch(`/api/enrollments/update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, processedById: user.id }),
    });
    const d = await res.json();
    if (d.ok) toast.success(`Matrícula ${status}`);
    else toast.error("No se pudo actualizar");
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
          <ClipboardCheck className="h-6 w-6 text-primary" /> Matrícula
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Gestión del proceso formal de matrícula. Apruebe o rechace las solicitudes recibidas; al
          aprobar, el estudiante queda registrado en el libro de matrícula con su folio
          correspondiente y se notifica al acudiente.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Solicitudes de matrícula</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sin solicitudes de matrícula.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aspirante</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Acudiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.applicantName}</TableCell>
                    <TableCell className="text-xs">{e.applicantGrade ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.guardianName}<br /><span className="text-muted-foreground">{e.guardianPhone}</span></TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", e.status === "aprobada" ? "chip-superior" : e.status === "rechazada" ? "chip-bajo" : "chip-basico")}>
                        {e.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {e.status === "solicitada" || e.status === "en_revision" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => update(e.id, "aprobada")}><Check className="h-3 w-3" /> Aprobar</Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => update(e.id, "rechazada")}><X className="h-3 w-3" /> Rechazar</Button>
                        </div>
                      ) : <span className="text-[11px] text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AsignacionView() {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/groups?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/subjects?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/members?institutionId=${user.institution.id}`).then((r) => r.json()),
    ])
      .then(([g, s, m]) => {
        if (g.ok) setGroups(g.groups);
        if (s.ok) setSubjects(s.subjects);
        if (m.ok) setTeachers(m.members.filter((x: Member) => x.role === "docente"));
      })
      .finally(() => setLoading(false));
  }, [user]);

  function assignCell(subjectId: string, groupId: string, teacherId: string) {
    const key = `${subjectId}:${groupId}`;
    setAssignments((p) => ({ ...p, [key]: teacherId }));
    toast.success("Asignación registrada");
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
          <Building2 className="h-6 w-6 text-primary" /> Asignación académica
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Matriz de asignación de docentes a asignaturas y grupos. Seleccione un docente en cada
          celda para definir quién imparte la asignatura en ese grupo. La asignación alimenta los
          planeadores, planillas de notas y reportes de supervisión.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="py-4 overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Asignatura</TableHead>
                  {groups.map((g) => (
                    <TableHead key={g.id}>{g.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.slice(0, 10).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium sticky left-0 bg-card">
                      {s.name}
                      <div className="text-[10px] text-muted-foreground">{s.area ?? "—"}</div>
                    </TableCell>
                    {groups.map((g) => {
                      const key = `${s.id}:${g.id}`;
                      const teacherId = assignments[key] ?? "";
                      return (
                        <TableCell key={g.id}>
                          <Select value={teacherId} onValueChange={(v) => assignCell(s.id, g.id, v)}>
                            <SelectTrigger className="h-8 w-full min-w-[140px]" size="sm">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PeriodosView() {
  const user = useAuthStore((s) => s.user);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/periods?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPeriods(d.periods);
      })
      .finally(() => setLoading(false));
  }, [user]);

  function togglePeriod(id: string, field: "active" | "closed") {
    setPeriods((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return { ...p, [field]: !p[field] };
        }
        if (field === "active" && p.id !== id) {
          return { ...p, active: false };
        }
        return p;
      })
    );
    toast.success("Periodo actualizado");
  }

  function statusBadge(p: Period) {
    if (p.closed) return <span className="chip-bajo text-[10px] px-2 py-0.5 rounded-md uppercase font-medium">Cerrado</span>;
    if (p.active) return <span className="chip-superior text-[10px] px-2 py-0.5 rounded-md uppercase font-medium">Activo</span>;
    return <span className="chip-basico text-[10px] px-2 py-0.5 rounded-md uppercase font-medium">Programado</span>;
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
          <Calendar className="h-6 w-6 text-primary" /> Periodos académicos
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Configuración de los periodos académicos del año escolar. Active un periodo a la vez; al
          cerrar un periodo, las calificaciones quedan bloqueadas para edición. El peso de cada
          periodo define su ponderación en el promedio anual.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl skeleton-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {periods.map((p) => (
            <Card key={p.id} className="hairline rounded-xl">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{p.name}</div>
                  {statusBadge(p)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.startDate).toLocaleDateString("es-CO")} — {new Date(p.endDate).toLocaleDateString("es-CO")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Peso: <span className="font-medium text-foreground">{p.weight ?? 25}%</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 hairline-t">
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Switch checked={!!p.active} onCheckedChange={() => togglePeriod(p.id, "active")} disabled={p.closed} />
                    Activar
                  </label>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Switch checked={!!p.closed} onCheckedChange={() => togglePeriod(p.id, "closed")} />
                    Cerrar
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ConfiguracionView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configuración institucional
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Ajustes centrales de la institución: roles y permisos, escalas de evaluación y variables
          institucionales. Los cambios se aplican a todos los módulos y quedan registrados en
          auditoría.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Roles y permisos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">Notas</TableHead>
                <TableHead className="text-center">Asistencia</TableHead>
                <TableHead className="text-center">Observador</TableHead>
                <TableHead className="text-center">Actas</TableHead>
                <TableHead className="text-center">Auditoría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { rol: "Rector", perm: [true, true, true, true, true] },
                { rol: "Coordinador", perm: [true, true, true, true, false] },
                { rol: "Director de grupo", perm: [true, true, true, false, false] },
                { rol: "Docente", perm: [true, true, false, false, false] },
                { rol: "Orientador", perm: [false, false, true, false, false] },
                { rol: "Acudiente", perm: [false, false, false, false, false] },
                { rol: "Estudiante", perm: [false, false, false, false, false] },
              ].map((r) => (
                <TableRow key={r.rol}>
                  <TableCell className="font-medium">{r.rol}</TableCell>
                  {r.perm.map((p, i) => (
                    <TableCell key={i} className="text-center">
                      {p ? <Check className="h-3.5 w-3.5 inline text-[var(--app-success)]" /> : <X className="h-3.5 w-3.5 inline text-muted-foreground" />}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Escalas de evaluación</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desempeño</TableHead>
                <TableHead>Rango</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Superior</TableCell>
                <TableCell>90 — 100</TableCell>
                <TableCell><span className="chip-superior text-[10px] px-2 py-0.5 rounded-md">Superior</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">Supera ampliamente los aprendizajes esperados.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Alto</TableCell>
                <TableCell>75 — 89</TableCell>
                <TableCell><span className="chip-alto text-[10px] px-2 py-0.5 rounded-md">Alto</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">Cumple los aprendizajes esperados.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Básico</TableCell>
                <TableCell>60 — 74</TableCell>
                <TableCell><span className="chip-basico text-[10px] px-2 py-0.5 rounded-md">Básico</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">Alcanza los aprendizajes mínimos.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Bajo</TableCell>
                <TableCell>0 — 59</TableCell>
                <TableCell><span className="chip-bajo text-[10px] px-2 py-0.5 rounded-md">Bajo</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">No alcanza los aprendizajes esperados.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Variables institucionales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre de la institución</Label>
              <Input defaultValue="Institución Educativa Demo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Año académico</Label>
              <Input defaultValue="2025" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">DANE</Label>
              <Input defaultValue="305001001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resolución oficial</Label>
              <Input defaultValue="000123 de 2020" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Misión</Label>
            <Textarea rows={2} defaultValue="Formar ciudadanos íntegros con excelencia académica y proyección social." />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => toast.success("Variables guardadas")}>Guardar cambios</Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TalentoHumanoView() {
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/members?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setMembers(d.members);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Talento humano
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Directorio del talento humano de la institución: docentes, coordinadores, administrativos
          y orientación. Cada hoja de vida resume el cargo, datos de contacto e insignias
          obtenidas. Use esta vista para supervisar la planta y planear capacitaciones.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Personal institucional</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sin personal registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-center">Insignias</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.fullName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge></TableCell>
                    <TableCell className="text-xs">{m.jobTitle ?? "—"}</TableCell>
                    <TableCell className="text-xs">{m.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{m.phone ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">{m.badgeCount ?? 0}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver hoja de vida" onClick={() => setSelected(m)}>
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hoja de vida · {selected?.fullName}</DialogTitle>
            <DialogDescription>
              {selected?.jobTitle ?? "Cargo no especificado"} · {selected?.role}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Field label="Correo" value={selected?.email ?? "—"} />
            <Field label="Teléfono" value={selected?.phone ?? "—"} />
            <Field label="Rol" value={selected?.role ?? "—"} />
            <Field label="Insignias obtenidas" value={String(selected?.badgeCount ?? 0)} />
            <Field label="Estado" value="Activo en la institución" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
            <Button onClick={() => toast.info("Descarga disponible próximamente")}>Descargar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between hairline rounded-md px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
