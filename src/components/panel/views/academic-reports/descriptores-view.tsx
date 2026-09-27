"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

// === [F3] Descriptores de desempeño por asignatura y periodo (CRUD) ===
// Alimenta la sección de logros (Bajo/Básico/Alto/Superior) del informe valorativo.

interface YearOption { id: string; year: number; active: boolean }
interface PeriodOption { id: string; name: string }
interface SubjectOption { id: string; name: string }

interface Indicator {
  id: string;
  subjectId: string;
  periodId: string;
  year: number;
  description: string;
  bajo: string | null;
  basico: string | null;
  alto: string | null;
  superior: string | null;
  subject?: { id: string; name: string };
  period?: { id: string; name: string };
}

const EMPTY_FORM = { description: "", bajo: "", basico: "", alto: "", superior: "" };

export function DescriptoresView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;

  const [years, setYears] = useState<YearOption[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [items, setItems] = useState<Indicator[]>([]);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      fetch(`/api/academic-years?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/periods?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/subjects?institutionId=${institutionId}`).then((r) => r.json()),
    ]).then(([y, p, s]) => {
      const yearList: YearOption[] = y.ok ? y.years : [];
      setYears(yearList);
      const active = yearList.find((yy) => yy.active) ?? yearList[0];
      if (active) setYearId(active.id);
      setPeriods(p.ok ? p.periods : []);
      setSubjects(s.ok ? s.subjects : []);
    });
  }, [institutionId]);

  function load() {
    if (!institutionId || !yearId) return;
    const year = years.find((y) => y.id === yearId)?.year ?? "";
    fetch(`/api/performance-indicators?institutionId=${institutionId}&year=${year}${periodId ? `&periodId=${periodId}` : ""}${subjectId ? `&subjectId=${subjectId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setItems(d.ok ? d.indicators : []));
  }

  useEffect(load, [institutionId, yearId, periodId, subjectId]);

  async function save() {
    if (!institutionId || !subjectId || !periodId || !yearId || !form.description.trim()) {
      toast.error("Complete asignatura, periodo y descripción");
      return;
    }
    const year = years.find((y) => y.id === yearId)?.year;
    setSaving(true);
    try {
      const payload = { ...form, institutionId, subjectId, periodId, year };
      const res = editingId
        ? await fetch(`/api/performance-indicators`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...form }) })
        : await fetch(`/api/performance-indicators`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Error");
      toast.success(editingId ? "Descriptor actualizado" : "Descriptor creado");
      setForm({ ...EMPTY_FORM });
      setEditingId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const d = await fetch(`/api/performance-indicators?id=${id}`, { method: "DELETE" }).then((r) => r.json());
    if (d.ok) {
      toast.success("Descriptor eliminado");
      load();
    } else {
      toast.error("No se pudo eliminar");
    }
  }

  function edit(it: Indicator) {
    setEditingId(it.id);
    setForm({
      description: it.description,
      bajo: it.bajo ?? "",
      basico: it.basico ?? "",
      alto: it.alto ?? "",
      superior: it.superior ?? "",
    });
    setSubjectId(it.subjectId);
    setPeriodId(it.periodId);
  }

  return (
    <div className="space-y-6">
      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" /> {editingId ? "Editar descriptor" : "Nuevo descriptor de desempeño"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Asignatura *</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Periodo *</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descripción del desempeño *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Reconoce los objetos tecnológicos de su entorno" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(["bajo", "basico", "alto", "superior"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label className="capitalize">{k === "basico" ? "Básico" : k}</Label>
                <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={`Descriptor ${k}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); }}>
                Cancelar
              </Button>
            )}
            <Button onClick={save} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Descriptores registrados ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin descriptores para los filtros seleccionados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asignatura</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Bajo</TableHead>
                  <TableHead>Básico</TableHead>
                  <TableHead>Alto</TableHead>
                  <TableHead>Superior</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-xs font-medium">{it.subject?.name ?? it.subjectId}</TableCell>
                    <TableCell className="text-xs">{it.period?.name ?? it.periodId}</TableCell>
                    <TableCell className="text-xs">{it.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{it.bajo ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{it.basico ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{it.alto ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{it.superior ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar" onClick={() => edit(it)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Eliminar" onClick={() => remove(it.id)}>
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
    </div>
  );
}
