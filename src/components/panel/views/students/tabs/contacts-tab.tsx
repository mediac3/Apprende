"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { StudentRow } from "../student-detail-view";

interface ContactRow {
  id: string;
  fullName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  isPrimary: boolean;
}

const RELATIONSHIPS = [
  ["madre", "Madre"],
  ["padre", "Padre"],
  ["acudiente", "Acudiente"],
  ["otro", "Otro"],
] as const;

const RELATIONSHIP_LABEL: Record<string, string> = Object.fromEntries(RELATIONSHIPS);

const EMPTY_FORM = {
  fullName: "",
  relationship: "madre",
  phone: "",
  email: "",
  occupation: "",
  isPrimary: false,
};

export function ContactsTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch(`/api/student-contacts?institutionId=${user.institution.id}&studentId=${student.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setContacts(d.contacts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, student.id, reloadKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(c: ContactRow) {
    setEditingId(c.id);
    setForm({
      fullName: c.fullName,
      relationship: c.relationship,
      phone: c.phone ?? "",
      email: c.email ?? "",
      occupation: c.occupation ?? "",
      isPrimary: c.isPrimary,
    });
    setFormOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!form.fullName.trim() || !form.relationship) {
      toast.error("El nombre y el parentesco son obligatorios");
      return;
    }
    const res = await fetch("/api/student-contacts", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        institutionId: user.institution.id,
        studentId: student.id,
        userId: user.id,
        fullName: form.fullName.trim(),
        relationship: form.relationship,
        phone: form.phone,
        email: form.email,
        occupation: form.occupation,
        isPrimary: form.isPrimary,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success(editingId ? "Contacto actualizado" : "Contacto guardado");
      setFormOpen(false);
      setReloadKey((k) => k + 1);
    } else {
      toast.error(d.error || "No se pudo guardar el contacto");
    }
  }

  async function remove(c: ContactRow) {
    if (!user || !confirm(`¿Eliminar el contacto "${c.fullName}"?`)) return;
    const res = await fetch(
      `/api/student-contacts?id=${c.id}&institutionId=${user.institution.id}&userId=${user.id}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (d.ok) {
      toast.success("Contacto eliminado");
      setReloadKey((k) => k + 1);
    } else toast.error(d.error || "No se pudo eliminar");
  }

  return (
    <Card className="hairline rounded-xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contactos</CardTitle>
        <Button size="sm" className="gap-1.5" onClick={formOpen ? () => setFormOpen(false) : openCreate}>
          {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {formOpen ? "Cerrar" : "Agregar contacto"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {formOpen && (
          <div className="hairline rounded-lg p-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parentesco</Label>
              <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="300 000 0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="acudiente@correo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ocupación</Label>
              <Input
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                placeholder="Ingeniera, Comerciante…"
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Checkbox
                  id="contact-primary-checkbox"
                  checked={form.isPrimary}
                  onCheckedChange={(v) => setForm({ ...form, isPrimary: v === true })}
                />
                <label htmlFor="contact-primary-checkbox" className="cursor-pointer">
                  Contacto principal
                </label>
              </div>
              <Button size="sm" onClick={save}>
                {editingId ? "Actualizar contacto" : "Guardar contacto"}
              </Button>
            </div>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contacto…"
            className="pl-8"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sin contactos registrados para este estudiante.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Parentesco</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ocupación</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {c.fullName}
                      {c.isPrimary && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Star className="h-3 w-3" /> Principal
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{RELATIONSHIP_LABEL[c.relationship] ?? c.relationship}</TableCell>
                  <TableCell className="text-xs">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.occupation ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar contacto" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Eliminar contacto" onClick={() => remove(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
