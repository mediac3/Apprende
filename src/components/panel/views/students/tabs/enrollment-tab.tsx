"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { StudentRow } from "../student-detail-view";
import { EditEnrollmentModal } from "../modals/edit-enrollment-modal";

interface AcademicYear { id: string; year: number; active: boolean }
interface Branch { id: string; name: string }
interface Group { id: string; name: string; branchId?: string | null }
interface EnrollmentEventRow {
  id: string;
  type: string;
  reason: string | null;
  date: string;
}
export interface EnrollmentRow {
  id: string;
  studentId: string;
  academicYearId: string | null;
  groupId: string | null;
  status: string;
  libro: number | null;
  folio: number | null;
  code: string | null;
  enrolledAt: string | null;
  academicYear?: { id: string; year: number } | null;
  group?: { id: string; name: string; branch?: { id: string; name: string } | null } | null;
  events?: EnrollmentEventRow[];
}

const STATUS_OPTIONS = [
  ["matriculado", "Matriculado"],
  ["renovado", "Renovado"],
  ["retirado", "Retirado"],
  ["sin_formalizar", "Sin formalizar"],
] as const;

const STATUS_CHIP: Record<string, string> = {
  matriculado: "chip-superior",
  renovado: "chip-superior",
  retirado: "chip-bajo",
  sin_formalizar: "chip-basico",
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS);

const EVENT_TYPE_LABEL: Record<string, string> = {
  retiro: "Retiro",
  traslado: "Traslado",
  repitente: "Repitente",
  nuevo: "Nuevo",
  otra: "Otra novedad",
};

function toISODate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

export function EnrollmentTab({
  student,
  yearId,
  onStudentUpdated,
}: {
  student: StudentRow;
  yearId: string;
  onStudentUpdated: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [formYearId, setFormYearId] = useState(yearId);
  const [fBranchId, setFBranchId] = useState("");
  const [fGroupId, setFGroupId] = useState("");
  const [fStatus, setFStatus] = useState("matriculado");
  const [fEnrolledAt, setFEnrolledAt] = useState("");
  const [fLibro, setFLibro] = useState("1");
  const [fFolio, setFFolio] = useState("");
  const [fCode, setFCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [novedadOpen, setNovedadOpen] = useState(false);
  const [nType, setNType] = useState("retiro");
  const [nReason, setNReason] = useState("");
  const [nDate, setNDate] = useState(new Date().toISOString().slice(0, 10));
  const formYearIdRef = useRef(yearId);

  // Prefill del formulario según la ficha del año (llamado solo desde callbacks/handlers)
  function applyForm(e: EnrollmentRow | null, allGroups: Group[], fallbackGroupId?: string | null) {
    if (e) {
      setFBranchId(e.group?.branch?.id ?? "");
      setFGroupId(e.groupId ?? "");
      setFStatus(e.status);
      setFEnrolledAt(toISODate(e.enrolledAt));
      setFLibro(String(e.libro ?? 1));
      setFFolio(e.folio != null ? String(e.folio) : "");
      setFCode(e.code ?? "");
    } else {
      const g = allGroups.find((gr) => gr.id === (fallbackGroupId ?? student.group?.id));
      setFBranchId(g?.branchId ?? "");
      setFGroupId(fallbackGroupId ?? student.group?.id ?? "");
      setFStatus("matriculado");
      setFEnrolledAt(new Date().toISOString().slice(0, 10));
      setFLibro("1");
      setFFolio("");
      setFCode("");
    }
  }

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      fetch(`/api/academic-years?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/branches?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/groups?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/student-enrollments?institutionId=${user.institution.id}&studentId=${student.id}`).then((r) => r.json()),
    ])
      .then(([dy, db_, dg, de]) => {
        if (!alive) return;
        if (dy.ok) setYears(dy.years);
        if (db_.ok) setBranches(db_.branches);
        const loadedGroups: Group[] = dg.ok ? dg.groups : [];
        if (dg.ok) setGroups(loadedGroups);
        const loaded: EnrollmentRow[] = de.ok ? de.enrollments : [];
        if (de.ok) {
          setEnrollments(loaded);
          applyForm(
            loaded.find((e) => e.academicYearId === formYearIdRef.current) ?? null,
            loadedGroups
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, student.id, reloadKey]);

  function changeFormYear(v: string) {
    formYearIdRef.current = v;
    setFormYearId(v);
    applyForm(enrollments.find((e) => e.academicYearId === v) ?? null, groups);
  }

  // Ficha cargada según el año seleccionado
  const current = useMemo(
    () => enrollments.find((e) => e.academicYearId === formYearId) ?? null,
    [enrollments, formYearId]
  );

  const filteredGroups = useMemo(
    () => (fBranchId ? groups.filter((g) => g.branchId === fBranchId) : groups),
    [groups, fBranchId]
  );

  const allEvents = useMemo(
    () =>
      enrollments
        .flatMap((e) => (e.events ?? []).map((ev) => ({ ...ev, year: e.academicYear?.year })))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [enrollments]
  );

  async function saveEnrollment() {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        institutionId: user.institution.id,
        studentId: student.id,
        userId: user.id,
        academicYearId: formYearId || null,
        groupId: fGroupId || null,
        status: fStatus,
        libro: fLibro ? Number(fLibro) : null,
        folio: fFolio ? Number(fFolio) : null,
        enrolledAt: fEnrolledAt || null,
      };
      const res = await fetch("/api/student-enrollments", {
        method: current ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current ? { ...payload, id: current.id } : payload),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(current ? "Matrícula actualizada" : "Matrícula registrada");
        setReloadKey((k) => k + 1);
        onStudentUpdated();
      } else {
        toast.error(d.error || "No se pudo guardar la matrícula");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addEvent() {
    if (!user || !current) return;
    const res = await fetch("/api/enrollment-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: current.id,
        institutionId: user.institution.id,
        userId: user.id,
        type: nType,
        reason: nReason,
        date: nDate,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Novedad agregada");
      setNovedadOpen(false);
      setNReason("");
      setReloadKey((k) => k + 1);
    } else {
      toast.error(d.error || "No se pudo agregar la novedad");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="hairline rounded-xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Registro de matrícula</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!current} onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar matrícula
            </Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={saveEnrollment} disabled={saving}>
              <RefreshCw className="h-3.5 w-3.5" /> {current ? "Actualizar" : "Nueva matrícula / Renovación"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!current} onClick={() => setNovedadOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Agregar novedad
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Año matrícula</Label>
            <Select value={formYearId} onValueChange={changeFormYear}>
              <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.year}{y.active ? " ✓" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sede</Label>
            <Select value={fBranchId || "none"} onValueChange={(v) => { setFBranchId(v === "none" ? "" : v); setFGroupId(""); }}>
              <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin sede</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Grupo</Label>
            <Select value={fGroupId || "none"} onValueChange={(v) => setFGroupId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin grupo</SelectItem>
                {filteredGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha matrícula</Label>
            <Input type="date" value={fEnrolledAt} onChange={(e) => setFEnrolledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Libro</Label>
            <Select value={fLibro} onValueChange={setFLibro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Folio</Label>
            <Input type="number" min={1} value={fFolio} onChange={(e) => setFFolio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Código</Label>
            <Input value={fCode} disabled className="bg-muted" />
            <p className="text-[10px] text-muted-foreground">(deprecado)</p>
          </div>
        </CardContent>
      </Card>

      {/* Fichas de matrícula (histórico por folio) — PDF pág 11 */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Fichas de matrícula (histórico por folio)</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Sin fichas de matrícula registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Año</TableHead>
                  <TableHead>Libro</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => e.academicYearId && changeFormYear(e.academicYearId)}>
                    <TableCell className="font-medium">{e.academicYear?.year ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{e.libro ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{e.folio ?? "—"}</TableCell>
                    <TableCell>{e.group?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[e.status] ?? "chip-basico")}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString("es-CO") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Novedades de matrícula — PDF pág 11 */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Novedades de matrícula</CardTitle>
        </CardHeader>
        <CardContent>
          {allEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Sin novedades registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEvents.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs">{new Date(ev.date).toLocaleDateString("es-CO")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{EVENT_TYPE_LABEL[ev.type] ?? ev.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{ev.reason || "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Eliminar novedad"
                        onClick={async () => {
                          if (!user || !confirm("¿Eliminar esta novedad?")) return;
                          const res = await fetch(
                            `/api/enrollment-events?id=${ev.id}&institutionId=${user.institution.id}&userId=${user.id}`,
                            { method: "DELETE" }
                          );
                          const d = await res.json();
                          if (d.ok) {
                            toast.success("Novedad eliminada");
                            setReloadKey((k) => k + 1);
                          } else toast.error(d.error || "No se pudo eliminar");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {current && (
        <EditEnrollmentModal
          open={editOpen}
          onOpenChange={setEditOpen}
          enrollment={current}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}

      {/* Dialog: agregar novedad */}
      <Dialog open={novedadOpen} onOpenChange={setNovedadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar novedad de matrícula</DialogTitle>
            <DialogDescription>
              Registre novedades como retiro, traslado o repitencia para la ficha del año seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={nType} onValueChange={setNType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fecha</Label>
              <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Motivo</Label>
              <Input value={nReason} onChange={(e) => setNReason(e.target.value)} placeholder="Ej. Cambio de residencia" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovedadOpen(false)}>Cancelar</Button>
            <Button onClick={addEvent}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
