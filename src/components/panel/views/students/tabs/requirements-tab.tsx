"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StudentRow } from "../student-detail-view";

interface RequirementRow {
  id: string;
  name: string;
  notes: string | null;
  fulfilled: boolean;
}

export function RequirementsTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch(`/api/student-requirements?institutionId=${user.institution.id}&studentId=${student.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setRequirements(d.requirements);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, student.id, reloadKey]);

  const filtered = requirements.filter((r) =>
    search.trim() ? r.name.toLowerCase().includes(search.toLowerCase()) : true
  );
  const pending = requirements.filter((r) => !r.fulfilled).length;

  function openCreate() {
    setEditingId(null);
    setFName("");
    setFNotes("");
    setFormOpen(true);
  }

  function openEdit(r: RequirementRow) {
    setEditingId(r.id);
    setFName(r.name);
    setFNotes(r.notes ?? "");
    setFormOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!fName.trim()) {
      toast.error("El nombre del requisito es obligatorio");
      return;
    }
    const res = await fetch("/api/student-requirements", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        institutionId: user.institution.id,
        studentId: student.id,
        userId: user.id,
        name: fName.trim(),
        notes: fNotes,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success(editingId ? "Requisito actualizado" : "Requisito agregado");
      setFormOpen(false);
      setReloadKey((k) => k + 1);
    } else {
      toast.error(d.error || "No se pudo guardar el requisito");
    }
  }

  async function toggle(r: RequirementRow) {
    if (!user) return;
    const res = await fetch("/api/student-requirements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, institutionId: user.institution.id, userId: user.id, fulfilled: !r.fulfilled }),
    });
    const d = await res.json();
    if (d.ok) setReloadKey((k) => k + 1);
    else toast.error(d.error || "No se pudo actualizar");
  }

  async function remove(r: RequirementRow) {
    if (!user || !confirm(`¿Eliminar el requisito "${r.name}"?`)) return;
    const res = await fetch(
      `/api/student-requirements?id=${r.id}&institutionId=${user.institution.id}&userId=${user.id}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (d.ok) {
      toast.success("Requisito eliminado");
      setReloadKey((k) => k + 1);
    } else toast.error(d.error || "No se pudo eliminar");
  }

  return (
    <Card className="hairline rounded-xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Requisitos pendientes{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({pending} pendiente{pending === 1 ? "" : "s"} de {requirements.length})
          </span>
        </CardTitle>
        <Button size="sm" className="gap-1.5" onClick={formOpen ? () => setFormOpen(false) : openCreate}>
          {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {formOpen ? "Cerrar" : "Agregar requisito"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {formOpen && (
          <div className="hairline rounded-lg p-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="Ej. Certificado de notas del año anterior"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <Input
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Detalle del requisito (opcional)"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={save}>{editingId ? "Actualizar" : "Agregar"}</Button>
            </div>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar requisito…" className="pl-8" />
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sin requisitos registrados.
          </p>
        ) : (
          <ul className="divide-y hairline rounded-lg">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox checked={r.fulfilled} onCheckedChange={() => toggle(r)} aria-label={`Marcar ${r.name}`} />
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm truncate", r.fulfilled && "line-through text-muted-foreground")}>
                    {r.name}
                  </div>
                  {r.notes && <div className="text-xs text-muted-foreground truncate">{r.notes}</div>}
                </div>
                {r.fulfilled && <Check className="h-4 w-4 text-emerald-600" />}
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar requisito" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Eliminar requisito" onClick={() => remove(r)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
