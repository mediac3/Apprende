"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Trash2 } from "lucide-react";
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
import type { EnrollmentRow } from "../tabs/enrollment-tab";

// Editar matrícula (PDF pág 5/11): Libro, Folio y Código (deprecado, deshabilitado)
export function EditEnrollmentModal({
  open,
  onOpenChange,
  enrollment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  enrollment: EnrollmentRow;
  onSaved: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [libro, setLibro] = useState(String(enrollment.libro ?? 1));
  const [folio, setFolio] = useState(enrollment.folio != null ? String(enrollment.folio) : "");

  async function update() {
    if (!user) return;
    const res = await fetch("/api/student-enrollments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: enrollment.id,
        institutionId: user.institution.id,
        userId: user.id,
        libro: libro ? Number(libro) : null,
        folio: folio ? Number(folio) : null,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Matrícula actualizada");
      onOpenChange(false);
      onSaved();
    } else {
      toast.error(d.error || "No se pudo actualizar");
    }
  }

  async function remove() {
    if (!user) return;
    if (!confirm(`¿Eliminar la ficha de matrícula ${enrollment.academicYear?.year ?? ""} (folio ${enrollment.folio ?? "—"})?\nSe eliminarán también sus novedades.`)) return;
    const res = await fetch(
      `/api/student-enrollments?id=${enrollment.id}&institutionId=${user.institution.id}&userId=${user.id}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (d.ok) {
      toast.success("Ficha de matrícula eliminada");
      onOpenChange(false);
      onSaved();
    } else {
      toast.error(d.error || "No se pudo eliminar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar matrícula</DialogTitle>
          <DialogDescription>
            Libro y folio del registro de matrícula {enrollment.academicYear ? `del año ${enrollment.academicYear.year}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Libro</Label>
            <Select value={libro} onValueChange={setLibro}>
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
            <Input type="number" min={1} value={folio} onChange={(e) => setFolio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Código</Label>
            <Input value={enrollment.code ?? ""} disabled className="bg-muted font-mono text-xs" />
            <p className="text-[10px] text-muted-foreground">(deprecado)</p>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="destructive" className="gap-1.5" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button onClick={update}>Actualizar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
