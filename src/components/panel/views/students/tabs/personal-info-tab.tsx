"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { StudentRow } from "../student-detail-view";

const DOC_TYPES = [
  ["RC", "R.C. — Registro civil"],
  ["TI", "T.I. — Tarjeta de identidad"],
  ["CC", "C.C. — Cédula de ciudadanía"],
  ["CE", "C.E. — Cédula de extranjería"],
  ["PE", "P.E. — Permiso especial"],
] as const;

function toISODate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

export function PersonalInfoTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [fDocType, setFDocType] = useState(student.documentType ?? "TI");
  const [fDocNumber, setFDocNumber] = useState(student.documentNumber ?? "");
  const [fFirstName, setFFirstName] = useState(student.firstName);
  const [fLastName, setFLastName] = useState(student.lastName);
  const [fGender, setFGender] = useState(student.gender ?? "M");
  const [fBirthDate, setFBirthDate] = useState(toISODate(student.birthDate));
  const [fBirthPlace, setFBirthPlace] = useState(student.birthPlace ?? "");
  const [fAddress, setFAddress] = useState(student.address ?? "");
  const [fEstrato, setFEstrato] = useState(student.simatEstrato ?? "");
  const [fEps, setFEps] = useState(student.simatEps ?? "");
  const [fMunicipioExp, setFMunicipioExp] = useState(student.simatMunicipioExp ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) return;
    if (!fFirstName.trim() || !fLastName.trim()) {
      toast.error("Nombres y apellidos son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: student.id,
          institutionId: user.institution.id,
          userId: user.id,
          documentType: fDocType,
          documentNumber: fDocNumber,
          firstName: fFirstName.trim(),
          lastName: fLastName.trim(),
          gender: fGender,
          birthDate: fBirthDate || null,
          birthPlace: fBirthPlace,
          address: fAddress,
          simatEstrato: fEstrato,
          simatEps: fEps,
          simatMunicipioExp: fMunicipioExp,
        }),
      });
      const d = await res.json();
      if (d.ok) toast.success("Información personal actualizada");
      else toast.error(d.error || "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo de documento</Label>
            <Select value={fDocType} onValueChange={setFDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Número de documento</Label>
            <Input value={fDocNumber} onChange={(e) => setFDocNumber(e.target.value)} placeholder="1030234567" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Género</Label>
            <Select value={fGender} onValueChange={setFGender}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Femenino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nombres</Label>
            <Input value={fFirstName} onChange={(e) => setFFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Apellidos</Label>
            <Input value={fLastName} onChange={(e) => setFLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha de nacimiento</Label>
            <Input type="date" value={fBirthDate} onChange={(e) => setFBirthDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Lugar de nacimiento</Label>
            <Input value={fBirthPlace} onChange={(e) => setFBirthPlace(e.target.value)} placeholder="Ej. Medellín" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Dirección</Label>
            <Input value={fAddress} onChange={(e) => setFAddress(e.target.value)} placeholder="Calle 100 # 45-20" />
          </div>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Datos SIMAT</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estrato</Label>
            <Select value={fEstrato || "none"} onValueChange={(v) => setFEstrato(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin definir" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin definir</SelectItem>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">EPS</Label>
            <Input value={fEps} onChange={(e) => setFEps(e.target.value)} placeholder="Ej. Sanitas" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Municipio de expedición</Label>
            <Input value={fMunicipioExp} onChange={(e) => setFMunicipioExp(e.target.value)} placeholder="Ej. Medellín" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}
