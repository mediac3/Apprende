"use client";

// Dialog "Nuevo estudiante" [F2] — formulario SIMAT por secciones para
// Gestión de Estudiantes. Labels en formato "Inicial mayúscula, resto minúscula".
// La creación hace POST /api/students (validaciones de documento/correo en servidor).

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type GradeLevel = { id: string; name: string; code: string };
type GroupRow = { id: string; name: string; gradeLevelId?: string | null };

const TIPOS_DOCUMENTO = ["TI", "CC", "RC", "PPT", "Pasaporte", "Otro"] as const;
const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
const SI_NO = ["Sí", "No"] as const;
const DISCAPACIDADES = ["Ninguna", "Visual", "Auditiva", "Intelectual", "Psicosocial", "Múltiple", "Otra"] as const;
const FUENTES_RECURSOS = ["SGP", "Recursos propios", "Mixto", "Otro"] as const;
const GENEROS = ["Masculino", "Femenino", "Otro"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      {children}
    </div>
  );
}

export function NewStudentDialog({
  open,
  onOpenChange,
  institutionId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  institutionId: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [gradeId, setGradeId] = useState("");

  const makeInitial = () => ({
    paisOrigen: "Colombia",
    code: `EST-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  });
  const [f, setF] = useState<Record<string, any>>(makeInitial);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  // Reset desde handlers (apertura/cierre), no en effects
  const resetForm = () => { setF(makeInitial()); setGradeId(""); };

  // Catálogos Grado (Plan de estudios) y Grupo, al abrir
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`/api/grade-levels?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/groups?institutionId=${institutionId}`).then((r) => r.json()),
    ])
      .then(([dl, dg]) => {
        if (dl.ok) setGrades(dl.gradeLevels);
        if (dg.ok) setGroups(dg.groups);
      })
      .catch(() => toast.error("No se pudieron cargar Grado y Grupo"));
  }, [open, institutionId]);

  const groupsOfGrade = useMemo(
    () => (gradeId ? groups.filter((g) => g.gradeLevelId === gradeId) : groups),
    [groups, gradeId]
  );

  function submit() {
    if (!f.lastName1?.trim() || !f.firstName1?.trim()) {
      toast.error("Apellido1 y Nombre1 son obligatorios");
      return;
    }
    if (!f.documentNumber?.trim() || !f.documentType) {
      toast.error("Documento y Tipo documento son obligatorios");
      return;
    }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      toast.error("Correo con formato inválido");
      return;
    }
    if (f.birthDate && isNaN(new Date(f.birthDate).getTime())) {
      toast.error("Fecha nacimiento inválida");
      return;
    }
    setSaving(true);
    fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId,
        code: f.code || `EST-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        firstName: f.firstName1,
        lastName: f.lastName1,
        firstName2: f.firstName2 || null,
        lastName2: f.lastName2 || null,
        documentType: f.documentType,
        documentNumber: f.documentNumber,
        simatNui: f.nui || null,
        simatRui: f.rui || null,
        simatEstrato: f.estrato || null,
        birthDate: f.birthDate || null,
        gender: f.genero || null,
        birthPlace: f.birthPlace || null,
        barrio: f.barrio || null,
        email: f.email || null,
        simatEps: f.eps || null,
        bloodType: f.bloodType || null,
        discapacidad: f.discapacidad || null,
        paisOrigen: f.paisOrigen || null,
        groupId: f.groupId || null,
        motivo: f.motivo || null,
        matriculaContratada: f.matriculaContratada ? f.matriculaContratada === "Sí" : null,
        fuenteRecursos: f.fuenteRecursos || null,
        internado: f.internado ? f.internado === "Sí" : null,
        apoyoAcademico: f.apoyoAcademico ? f.apoyoAcademico === "Sí" : null,
        status: "activo",
      }),
    })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.ok) {
          toast.success(`Estudiante ${f.firstName1} ${f.lastName1} creado`);
          resetForm();
          onOpenChange(false);
          onCreated();
        } else {
          toast.error(d.error || "No se pudo crear el estudiante");
        }
      })
      .catch(() => toast.error("Error de red al crear el estudiante"))
      .finally(() => setSaving(false));
  }

  const siNo = (key: string) => (
    <Select value={f[key] || ""} onValueChange={(v) => set(key, v)}>
      <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
      <SelectContent>
        {SI_NO.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo estudiante</DialogTitle>
          <DialogDescription>
            Registro con datos SIMAT. Los campos con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Identificación">
            <Field label="Tipo documento" required>
              <Select value={f.documentType || ""} onValueChange={(v) => set("documentType", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Documento" required>
              <Input value={f.documentNumber || ""} onChange={(e) => set("documentNumber", e.target.value)} placeholder="Número de documento" />
            </Field>
            <Field label="Nui">
              <Input value={f.nui || ""} onChange={(e) => set("nui", e.target.value)} />
            </Field>
            <Field label="Rui">
              <Input value={f.rui || ""} onChange={(e) => set("rui", e.target.value)} />
            </Field>
          </Section>

          <Section title="Nombres">
            <Field label="Apellido1" required>
              <Input value={f.lastName1 || ""} onChange={(e) => set("lastName1", e.target.value)} />
            </Field>
            <Field label="Apellido2">
              <Input value={f.lastName2 || ""} onChange={(e) => set("lastName2", e.target.value)} />
            </Field>
            <Field label="Nombre1" required>
              <Input value={f.firstName1 || ""} onChange={(e) => set("firstName1", e.target.value)} />
            </Field>
            <Field label="Nombre2">
              <Input value={f.firstName2 || ""} onChange={(e) => set("firstName2", e.target.value)} />
            </Field>
          </Section>

          <Section title="Datos personales">
            <Field label="Genero">
              <Select value={f.genero || ""} onValueChange={(v) => set("genero", v)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  {GENEROS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha nacimiento">
              <Input type="date" value={f.birthDate || ""} onChange={(e) => set("birthDate", e.target.value)} />
            </Field>
            <Field label="Barrio">
              <Input value={f.barrio || ""} onChange={(e) => set("barrio", e.target.value)} />
            </Field>
            <Field label="Pais origen">
              <Input value={f.paisOrigen || ""} onChange={(e) => set("paisOrigen", e.target.value)} placeholder="Colombia" />
            </Field>
            <Field label="Correo">
              <Input type="email" value={f.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="estudiante@correo.com" />
            </Field>
            <Field label="Estrato">
              <Select value={f.estrato || ""} onValueChange={(v) => set("estrato", v)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  {["0", "1", "2", "3", "4", "5", "6"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Salud">
            <Field label="Eps">
              <Input value={f.eps || ""} onChange={(e) => set("eps", e.target.value)} placeholder="Nombre de la EPS" />
            </Field>
            <Field label="Tipo de sangre">
              <Select value={f.bloodType || ""} onValueChange={(v) => set("bloodType", v)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_SANGRE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Discapacidad">
              <Select value={f.discapacidad || ""} onValueChange={(v) => set("discapacidad", v)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  {DISCAPACIDADES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Matrícula">
            <Field label="Grado">
              <Select
                value={gradeId}
                onValueChange={(v) => { setGradeId(v); set("groupId", ""); }}
              >
                <SelectTrigger><SelectValue placeholder="Sin grado" /></SelectTrigger>
                <SelectContent>
                  {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Grupo">
              <Select value={f.groupId || ""} onValueChange={(v) => set("groupId", v)}>
                <SelectTrigger><SelectValue placeholder="Sin grupo" /></SelectTrigger>
                <SelectContent>
                  {groupsOfGrade.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Motivo">
              <Input value={f.motivo || ""} onChange={(e) => set("motivo", e.target.value)} />
            </Field>
            <Field label="Matrícula contratada">{siNo("matriculaContratada")}</Field>
            <Field label="Fuente recursos">
              <Select value={f.fuenteRecursos || ""} onValueChange={(v) => set("fuenteRecursos", v)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  {FUENTES_RECURSOS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Internado">{siNo("internado")}</Field>
          </Section>

          <Section title="Otros">
            <Field label="Apoyo académico especial">{siNo("apoyoAcademico")}</Field>
            <Field label="Código">
              <Input value={f.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="Autogenerado" />
            </Field>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Crear estudiante"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
