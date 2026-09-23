"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  UserPlus,
} from "lucide-react";
import { NewStudentDialog } from "./modals/new-student-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StudentDetailView, type StudentRow } from "./student-detail-view";

interface AcademicYear {
  id: string;
  year: number;
  active: boolean;
}

interface EnrollmentRow {
  id: string;
  studentId: string;
  status: string;
  libro: number | null;
  folio: number | null;
}

const ROWS_PER_PAGE = 10;

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  matriculado: "Matriculado",
  renovado: "Renovado",
  retirado: "Retirado",
  sin_formalizar: "Sin formalizar",
};

const STATUS_CHIP: Record<string, string> = {
  matriculado: "chip-superior",
  renovado: "chip-superior",
  retirado: "chip-bajo",
  sin_formalizar: "chip-basico",
};

// Estado mostrado en el listado (PDF pág 3): matrícula del año seleccionado,
// con fallback al estado del estudiante cuando no hay ficha de matrícula.
function resolveStatus(student: StudentRow, enrollment?: EnrollmentRow): string {
  if (enrollment) return enrollment.status;
  if (student.status === "retirado") return "retirado";
  return "sin_formalizar";
}

function bucketOf(status: string): "activos" | "retirados" | "sin_formalizar" {
  if (status === "retirado") return "retirados";
  if (status === "sin_formalizar") return "sin_formalizar";
  return "activos";
}

export function StudentsListView() {
  const user = useAuthStore((s) => s.user);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "activos" | "retirados" | "sin_formalizar">("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Catálogo de años + estudiantes (callbacks async: sin setState síncrono en el effect)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      fetch(`/api/academic-years?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/students?institutionId=${user.institution.id}`).then((r) => r.json()),
    ])
      .then(([dy, ds]) => {
        if (!alive) return;
        if (dy.ok) {
          setYears(dy.years);
          const active = dy.years.find((y: AcademicYear) => y.active) ?? dy.years[0];
          if (active) setYearId((prev) => prev || active.id);
        }
        if (ds.ok) setStudents(ds.students);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user, reloadKey]);

  // Fichas de matrícula del año seleccionado (folio/estado del listado)
  useEffect(() => {
    if (!user || !yearId) return;
    let alive = true;
    fetch(`/api/student-enrollments?institutionId=${user.institution.id}&academicYearId=${yearId}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setEnrollments(d.enrollments);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, yearId, reloadKey]);

  const enrollmentByStudent = useMemo(() => {
    const map = new Map<string, EnrollmentRow>();
    enrollments.forEach((e) => {
      const prev = map.get(e.studentId);
      if (!prev) map.set(e.studentId, e);
    });
    return map;
  }, [enrollments]);

  const rows = useMemo(() => {
    return students.map((s) => {
      const enrollment = enrollmentByStudent.get(s.id);
      return { student: s, enrollment, status: resolveStatus(s, enrollment) };
    });
  }, [students, enrollmentByStudent]);

  const counters = useMemo(
    () => ({
      todos: rows.length,
      activos: rows.filter((r) => bucketOf(r.status) === "activos").length,
      retirados: rows.filter((r) => bucketOf(r.status) === "retirados").length,
      sin_formalizar: rows.filter((r) => bucketOf(r.status) === "sin_formalizar").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== "todos") list = list.filter((r) => bucketOf(r.status) === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          `${r.student.firstName} ${r.student.lastName}`.toLowerCase().includes(q) ||
          r.student.guardianName?.toLowerCase().includes(q) ||
          r.student.documentNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  async function handleDelete(s: StudentRow) {
    if (!user) return;
    if (
      !confirm(
        `¿Eliminar al estudiante "${s.firstName} ${s.lastName}"?\n\nSe eliminarán también sus matrículas, calificaciones, observaciones y asistencias. Esta acción no se puede deshacer.`
      )
    )
      return;
    const res = await fetch(
      `/api/students?id=${s.id}&institutionId=${user.institution.id}&userId=${user.id}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (d.ok) {
      toast.success("Estudiante eliminado");
      setReloadKey((k) => k + 1);
    } else {
      toast.error(d.error || "No se pudo eliminar el estudiante");
    }
  }

  // Ficha de gestión (PDF págs 1-2, 5-12)
  if (selected) {
    return (
      <StudentDetailView
        student={selected}
        yearId={yearId}
        onBack={() => {
          setSelected(null);
          setReloadKey((k) => k + 1);
        }}
      />
    );
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
            Gestión de Estudiantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Listado institucional con ficha 360° por estudiante: matrícula por folio, información
            personal y SIMAT, archivos, contactos, requisitos, certificados anteriores,
            calificaciones y convivencia.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <Select value={yearId} onValueChange={(v) => { setYearId(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.year}
                  {y.active ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["todos", "Todos"],
              ["activos", "Activos"],
              ["retirados", "Retirados"],
              ["sin_formalizar", "Sin formalizar"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {label} ({counters[key]})
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar estudiante, acudiente o N° de documento…"
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Listado de Estudiantes</CardTitle>
            <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
              <UserPlus className="h-4 w-4" /> Nuevo estudiante
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : pageRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Sin estudiantes</div>
              <p className="text-xs text-muted-foreground max-w-xs">
                No se encontraron estudiantes con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead className="w-14">Sexo</TableHead>
                  <TableHead className="w-16">BAP</TableHead>
                  <TableHead className="w-20">EX/ED</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="w-20">Grupo</TableHead>
                  <TableHead className="w-16">Folio</TableHead>
                  <TableHead>Acudiente</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(({ student: s, enrollment, status }) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.photoUrl ? (
                          <img
                            src={s.photoUrl}
                            alt={`${s.firstName} ${s.lastName}`}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{s.firstName} {s.lastName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {s.documentNumber ? `T.I. ${s.documentNumber}` : s.code}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{s.gender === "M" ? "M" : s.gender === "F" ? "F" : "—"}</TableCell>
                    <TableCell className="text-xs">{s.baptized == null ? "—" : s.baptized ? "Sí" : "No"}</TableCell>
                    <TableCell className="text-xs">{s.overage == null ? "—" : s.overage ? "Sí" : "No"}</TableCell>
                    <TableCell className="text-xs">{s.group?.branch?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.group?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">{enrollment?.folio ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.guardianName ?? "—"}</TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[status] ?? "chip-basico")}>
                        {ENROLLMENT_STATUS_LABEL[status] ?? status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label="Gestionar estudiante"
                          title="Gestionar"
                          onClick={() => setSelected(s)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Eliminar estudiante"
                          title="Eliminar"
                          onClick={() => handleDelete(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Paginación (PDF pág 3: "Registro 1-3 de 3") */}
          <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
            <span>
              Registro {filtered.length === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1}-
              {Math.min(safePage * ROWS_PER_PAGE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="Página anterior"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 tabular-nums">{safePage} / {totalPages}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="Página siguiente"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {user ? (
        <NewStudentDialog
          open={showNew}
          onOpenChange={setShowNew}
          institutionId={user.institution.id}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      ) : null}
    </motion.div>
  );
}
