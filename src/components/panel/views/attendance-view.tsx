"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  AlertTriangle,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Group { id: string; name: string; }
interface Attendance {
  id: string;
  status: string;
  date: string;
  student: { id: string; firstName: string; lastName: string; code: string; };
}
interface StudentRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  status: string;
}

const STATUSES = [
  { value: "presente", label: "Presente", icon: CheckCircle2, color: "var(--app-success)", chip: "chip-superior" },
  { value: "ausente", label: "Ausente", icon: XCircle, color: "var(--app-error)", chip: "chip-bajo" },
  { value: "tarde", label: "Tarde", icon: Clock, color: "var(--app-warning)", chip: "chip-basico" },
  { value: "excusa", label: "Excusa", icon: FileText, color: "var(--app-info)", chip: "chip-alto" },
];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function AttendanceView() {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [rows, setRows] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<Array<{ id: string; code: string; firstName: string; lastName: string; }>>([]);
  const [loading, setLoading] = useState(true);

  const isAcudiente = user?.role === "acudiente";

  useEffect(() => {
    if (!user) return;
    fetch(`/api/groups?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setGroups(d.groups);
          if (d.groups[0]) setGroupId(d.groups[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || !groupId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/students?institutionId=${user.institution.id}&groupId=${groupId}`).then((r) => r.json()),
      fetch(`/api/attendance?institutionId=${user.institution.id}&groupId=${groupId}&date=${date}`).then((r) => r.json()),
    ])
      .then(([s, a]) => {
        if (s.ok) {
          setStudents(
            s.students.map((st: any) => ({
              id: st.id,
              code: st.code,
              firstName: st.firstName,
              lastName: st.lastName,
            }))
          );
        }
        if (a.ok) {
          const map: Record<string, string> = {};
          a.attendances.forEach((at: Attendance) => {
            map[at.student.id] = at.status;
          });
          setRows(map);
        }
      })
      .finally(() => setLoading(false));
  }, [user, groupId, date]);

  function setStatus(studentId: string, status: string) {
    if (!user || !groupId) return;
    setRows((p) => ({ ...p, [studentId]: status }));
    fetch(`/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: user.institution.id,
        studentId,
        groupId,
        date,
        status,
        recordedById: user.id,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) toast.success(`Asistencia registrada: ${status}`);
        else toast.error("No se pudo registrar la asistencia");
      })
      .catch(() => toast.error("Error de red"));
  }

  const summary = useMemo(() => {
    const total = students.length || 1;
    const counts: Record<string, number> = { presente: 0, ausente: 0, tarde: 0, excusa: 0 };
    Object.values(rows).forEach((s) => {
      if (counts[s] !== undefined) counts[s]++;
    });
    return STATUSES.map((st) => ({
      ...st,
      count: counts[st.value],
      pct: Math.round((counts[st.value] / total) * 100),
    }));
  }, [rows, students]);

  if (isAcudiente) {
    return <AcudienteView />;
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
            Control de asistencia
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Registro diario de asistencia por grupo. Seleccione un grupo y una fecha para cargar la
            lista de estudiantes. Cada cambio se guarda de inmediato y dispara una auditoría; cuando
            un estudiante queda ausente o llega tarde, el sistema notifica automáticamente al
            acudiente registrado.
          </p>
        </div>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Fecha
            </Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Grupo
            </Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {students.length} estudiantes
          </Badge>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Lista de asistencia · {date}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-5 w-5" />}
              title="No hay estudiantes en este grupo"
              desc="Seleccione otro grupo o verifique la matrícula asociada."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const current = rows[s.id] ?? "";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="font-medium">
                        {s.firstName} {s.lastName}
                      </TableCell>
                      <TableCell>
                        <RadioGroup
                          value={current}
                          onValueChange={(v) => setStatus(s.id, v)}
                          className="flex items-center justify-end gap-2"
                        >
                          {STATUSES.map((st) => {
                            const Icon = st.icon;
                            const active = current === st.value;
                            return (
                              <Label
                                key={st.value}
                                htmlFor={`${s.id}-${st.value}`}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 rounded-md hairline text-xs cursor-pointer transition-colors",
                                  active ? "text-foreground bg-secondary" : "text-muted-foreground hover:bg-secondary"
                                )}
                              >
                                <RadioGroupItem
                                  id={`${s.id}-${st.value}`}
                                  value={st.value}
                                  className="sr-only"
                                />
                                <Icon className="h-3.5 w-3.5" style={{ color: active ? st.color : undefined }} />
                                <span>{st.label}</span>
                              </Label>
                            );
                          })}
                        </RadioGroup>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Resumen del día</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Distribución porcentual por estado de asistencia. Use estos indicadores para detectar
            patrones de ausentismo que requieran contacto con acudientes o remisión a orientación.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.value} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-semibold tabular-nums">{s.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{s.pct}%</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AcudienteView() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Simulación de datos del acudido (en producción se usaría el studentId asociado)
    fetch(`/api/attendance?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRows(d.attendances.slice(0, 14));
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
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          Asistencia de mi acudido
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Resumen de los últimos 14 días de asistencia del estudiante a su cargo. Cada registro
          muestra el estado y la fecha. Si observa ausencias reiteradas, le sugerimos contactar al
          director de grupo para articular un seguimiento conjunto.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Histórico (14 días)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title="Sin registros recientes"
              desc="Aún no se ha registrado asistencia en los últimos 14 días."
            />
          ) : (
            rows.map((a) => {
              const st = STATUSES.find((s) => s.value === a.status) ?? STATUSES[0];
              const Icon = st.icon;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hairline"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md grid place-items-center" style={{ backgroundColor: `color-mix(in srgb, ${st.color} 14%, transparent)` }}>
                      <Icon className="h-4 w-4" style={{ color: st.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(a.date).toLocaleDateString("es-CO", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.student.firstName} {a.student.lastName}</div>
                    </div>
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-1 rounded-md capitalize", st.chip)}>
                    {st.label}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
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
