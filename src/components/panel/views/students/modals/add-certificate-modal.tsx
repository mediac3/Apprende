"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface GradeLevelRow {
  id: string;
  code: string;
  name: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
}

function fileExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

// Agregar certificado de matrícula de otra institución (PDF pág 8)
export function AddCertificateModal({
  open,
  onOpenChange,
  studentId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  studentId: string;
  onSaved: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [gradeLevel, setGradeLevel] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [city, setCity] = useState("");
  const [observation, setObservation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelRow[]>([]);

  // Catálogo de grados para el select (solo mientras el modal está abierto)
  useEffect(() => {
    if (!open || !user || gradeLevels.length) return;
    let alive = true;
    fetch(`/api/grade-levels?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setGradeLevels(d.gradeLevels);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, user, gradeLevels.length]);

  function reset() {
    setYear(String(new Date().getFullYear() - 1));
    setGradeLevel("");
    setInstitutionName("");
    setCity("");
    setObservation("");
    setFile(null);
  }

  async function save() {
    if (!user) return;
    if (!year || !institutionName.trim()) {
      toast.error("Año y establecimiento son obligatorios");
      return;
    }
    let fileData: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;
    if (file) {
      const ext = fileExt(file.name);
      if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
        toast.error("Adjunto debe ser PDF, JPG o PNG");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("El adjunto supera el límite de 2MB");
        return;
      }
      fileData = await readAsDataURL(file);
      fileName = file.name;
      fileType = ext === "jpeg" ? "jpg" : ext;
    }
    const res = await fetch("/api/external-certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: user.institution.id,
        studentId,
        userId: user.id,
        year: Number(year),
        gradeLevel: gradeLevel || null,
        institutionName: institutionName.trim(),
        city: city || null,
        observation: observation || null,
        fileName,
        fileType,
        fileData,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Certificado agregado");
      reset();
      onOpenChange(false);
      onSaved();
    } else {
      toast.error(d.error || "No se pudo guardar el certificado");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar certificado</DialogTitle>
          <DialogDescription>
            Certificado de estudios expedido por otra institución educativa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Año</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grado</Label>
              <Select value={gradeLevel || "none"} onValueChange={(v) => setGradeLevel(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Grado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin grado</SelectItem>
                  {gradeLevels.map((g) => (
                    <SelectItem key={g.id} value={g.code}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Establecimiento</Label>
            <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Ej. Colegio San José" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ciudad</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Medellín" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observación</Label>
            <Input value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Observación sobre el certificado (opcional)" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Adjunto (PDF, JPG o PNG — máx. 2MB)</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-[10px] text-muted-foreground">{file.name}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
