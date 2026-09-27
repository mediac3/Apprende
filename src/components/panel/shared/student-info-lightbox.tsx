"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

/**
 * Lightbox de información del estudiante [F1] — captura ficha.
 * Acepta el objeto del listado (`student`) o solo `studentId` (fetch on-open).
 * Reutiliza el payload existente; no duplica queries en los listados.
 */
export interface StudentInfoData {
  id: string;
  firstName: string;
  lastName: string;
  firstName2?: string | null;
  lastName2?: string | null;
  photoUrl?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  simatMunicipioExp?: string | null;
  documentIssueDate?: string | null;
  bloodType?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  observaciones?: string | null;
  occupation?: string | null;
  residenceCity?: string | null;
  address?: string | null;
  simatEps?: string | null;
  ethnicGroup?: string | null;
  populationGroup?: string | null;
  simatSisben?: string | null;
  simatEstrato?: string | null;
}

const DOC_LABELS: Record<string, string> = { RC: "T.I", TI: "T.I", CC: "C.C", CE: "C.E", PE: "P.E" };

function fullName(s: StudentInfoData): string {
  return [s.lastName, s.lastName2, s.firstName, s.firstName2].filter(Boolean).join(" ");
}

function docLabel(type?: string | null): string {
  if (!type) return "";
  return DOC_LABELS[type.toUpperCase()] ?? type;
}

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const empty = value === undefined || value === null || String(value).trim() === "";
  return (
    <div>
      <p className="text-sm font-semibold leading-5">{label}</p>
      <p className={empty ? "text-sm text-muted-foreground/50" : "text-sm text-muted-foreground"}>
        {empty ? "—" : String(value)}
      </p>
    </div>
  );
}

export function StudentInfoLightbox({
  student: studentProp,
  studentId,
  open,
  onOpenChange,
}: {
  /** Objeto del listado, si ya está disponible en el cliente */
  student?: StudentInfoData | null;
  /** Si no se pasa `student`, se busca por id al abrir */
  studentId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fetched, setFetched] = useState<StudentInfoData | null>(null);

  useEffect(() => {
    if (!open || studentProp || !studentId) return;
    let alive = true;
    fetch(`/api/students/${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok) setFetched(d.student);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, studentProp, studentId]);

  const student = studentProp ?? fetched;
  if (!student) return null;
  const num = student.documentNumber?.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Información del estudiante</DialogTitle>
        <DialogDescription className="sr-only">Ficha de datos personales del estudiante</DialogDescription>

        <div className="flex flex-col items-center gap-2 pt-2">
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={fullName(student)}
              className="h-[120px] w-[120px] rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-lg bg-muted text-muted-foreground/50">
              <User className="h-12 w-12" />
            </div>
          )}
          <h2 className="text-xl font-semibold tracking-tight text-center">{fullName(student)}</h2>
          {num && (
            <p className="text-sm font-semibold text-muted-foreground/70">
              {docLabel(student.documentType)} {num}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 px-2 pb-2">
          <div className="flex flex-col gap-4">
            <Field label="Lugar expedición documento" value={student.simatMunicipioExp} />
            <Field label="Fecha expedición documento" value={student.documentIssueDate ? fmtDate(student.documentIssueDate) : null} />
            <Field label="Grupo Sanguíneo" value={student.bloodType} />
            <Field label="Sexo" value={student.gender} />
            <Field label="Lugar nacimiento" value={student.birthPlace} />
            <Field label="Fecha de nacimiento" value={student.birthDate ? fmtDate(student.birthDate) : null} />
            <Field label="Celular" value={student.phone} />
            <Field label="Email" value={student.email} />
            <Field label="Observaciones" value={student.observaciones} />
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Ocupación" value={student.occupation} />
            <Field label="Lugar residencia" value={student.residenceCity} />
            <Field label="Dirección" value={student.address} />
            <Field label="Eps" value={student.simatEps} />
            <Field label="Grupo étnico" value={student.ethnicGroup} />
            <Field label="Grupo poblacional" value={student.populationGroup} />
            <Field label="Puntaje Sisben" value={student.simatSisben} />
            <Field label="Estrato" value={student.simatEstrato} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
