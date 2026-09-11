"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  Eye,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

interface Group { id: string; name: string; }
interface Student {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  status: string;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianRelation?: string | null;
  group?: { id: string; name: string; } | null;
  grades?: Array<{
    id: string;
    value: number | null;
    performance: string | null;
    subject?: { name: string } | null;
    period?: { name: string } | null;
  }>;
  observations?: Array<{
    id: string;
    date: string;
    category: string;
    description: string;
    status: string;
  }>;
  attendances?: Array<{
    id: string;
    date: string;
    status: string;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  retirado: "Retirado",
  suspendido: "Suspendido",
};

const STATUS_CHIP: Record<string, string> = {
  activo: "chip-superior",
  inactivo: "chip-basico",
  retirado: "chip-bajo",
  suspendido: "chip-bajo",
};

export function StudentsView() {
  const user = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [openNew, setOpenNew] = useState(false);

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
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({ institutionId: user.institution.id });
    if (groupId) params.set("groupId", groupId);
    if (status) params.set("status", status);
    fetch(`/api/students?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStudents(d.students);
      })
      .finally(() => setLoading(false));
  }, [user, groupId, status]);

  const filtered = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.guardianName?.toLowerCase().includes(q)
    );
  }, [students, search]);

  async function createStudent(payload: any) {
    if (!user) return;
    const res = await fetch(`/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, institutionId: user.institution.id, userId: user.id }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Estudiante creado");
      setStudents((p) => [d.student, ...p]);
      setOpenNew(false);
    } else {
      toast.error(d.error || "No se pudo crear el estudiante");
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
            Estudiantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Directorio institucional de estudiantes con ficha 360°: contactos del acudiente,
            calificaciones del último periodo, observaciones recientes y asistencia. Use los filtros
            para acotar por grupo o estado, y haga clic en una fila para abrir el detalle completo.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Nuevo estudiante
        </Button>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, código o acudiente…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Grupo</Label>
            <Select value={groupId || "all"} onValueChange={(v) => setGroupId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="retirado">Retirado</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="ml-auto">{filtered.length} resultados</Badge>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Listado de estudiantes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
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
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acudiente</TableHead>
                  <TableHead className="w-32">Teléfono</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium">
                      {s.firstName} {s.lastName}
                    </TableCell>
                    <TableCell className="text-xs">{s.group?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[s.status] ?? "chip-basico")}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{s.guardianName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.guardianPhone ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver detalle">
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

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="hairline-b">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {selected?.firstName} {selected?.lastName}
            </SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Info label="Código" value={selected.code} />
                <Info label="Grupo" value={selected.group?.name ?? "—"} />
                <Info label="Estado" value={STATUS_LABEL[selected.status] ?? selected.status} />
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Contacto del acudiente
                </h3>
                <div className="space-y-1.5 text-sm">
                  <ContactRow icon={<Users className="h-3.5 w-3.5" />} value={selected.guardianName ?? "—"} hint={selected.guardianRelation ?? ""} />
                  <ContactRow icon={<Phone className="h-3.5 w-3.5" />} value={selected.guardianPhone ?? "—"} />
                  <ContactRow icon={<Mail className="h-3.5 w-3.5" />} value={selected.guardianEmail ?? "—"} />
                </div>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> Calificaciones recientes
                </h3>
                {selected.grades && selected.grades.length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.grades.slice(0, 5).map((g) => (
                      <div key={g.id} className="flex items-center justify-between hairline rounded-md px-3 py-1.5 text-xs">
                        <span>{g.subject?.name ?? "—"}</span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">{g.value ?? "—"}</span>
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded uppercase", `chip-${g.performance ?? "bajo"}`)}>
                            {g.performance ?? "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin calificaciones registradas.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Observaciones recientes
                </h3>
                {selected.observations && selected.observations.length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.observations.slice(0, 5).map((o) => (
                      <div key={o.id} className="hairline rounded-md px-3 py-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{o.category}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(o.date).toLocaleDateString("es-CO")}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{o.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin observaciones registradas.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Asistencia reciente
                </h3>
                {selected.attendances && selected.attendances.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.attendances.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex flex-col items-center hairline rounded-md px-2 py-1 text-[10px]">
                        <span className="text-muted-foreground">{new Date(a.date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                        <span className={cn("font-medium capitalize", `chip-${a.status === "presente" ? "superior" : a.status === "ausente" ? "bajo" : "basico"}`)}>
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin registros de asistencia.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <NewStudentDialog
        open={openNew}
        onOpenChange={setOpenNew}
        groups={groups}
        onCreate={createStudent}
      />
    </motion.div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="hairline rounded-md p-2">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function ContactRow({ icon, value, hint }: { icon: React.ReactNode; value: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 hairline rounded-md px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function NewStudentDialog({
  open,
  onOpenChange,
  groups,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: Group[];
  onCreate: (p: any) => void;
}) {
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  function submit() {
    if (!code || !firstName || !lastName) {
      toast.error("Código y nombres completos son obligatorios");
      return;
    }
    onCreate({
      code,
      firstName,
      lastName,
      groupId: groupId || null,
      guardianName: guardianName || null,
      guardianPhone: guardianPhone || null,
      guardianEmail: guardianEmail || null,
      status: "activo",
    });
    setCode(""); setFirstName(""); setLastName(""); setGuardianName(""); setGuardianPhone(""); setGuardianEmail("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo estudiante</DialogTitle>
          <DialogDescription>
            Registre un nuevo estudiante en la institución. La ficha quedará disponible para matrícula,
            calificaciones y observaciones.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. EST-2024-001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grupo</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Sin grupo" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombres</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Apellidos</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Acudiente</Label>
            <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Nombre completo del acudiente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="+57 300 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Correo</Label>
              <Input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="acudiente@correo.com" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Crear estudiante</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
