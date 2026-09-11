"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  Plus,
  Search,
  Library,
  Clock,
  Tag,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Subject { id: string; name: string; area?: string | null; }
interface Workshop {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: number | null;
  tags?: string | null;
  subject?: { id: string; name: string } | null;
}

const LEVEL_LABEL: Record<string, string> = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const LEVEL_CHIP: Record<string, string> = {
  basico: "chip-basico",
  intermedio: "chip-alto",
  avanzado: "chip-superior",
};

export function WorkshopsView() {
  const user = useAuthStore((s) => s.user);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectId, setSubjectId] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/subjects?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/workshops?institutionId=${user.institution.id}`).then((r) => r.json()),
    ])
      .then(([s, w]) => {
        if (s.ok) setSubjects(s.subjects);
        if (w.ok) setWorkshops(w.workshops);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    return workshops.filter((w) => {
      if (subjectId && w.subject?.id !== subjectId) return false;
      if (level && w.level !== level) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.title.toLowerCase().includes(q) ||
          w.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [workshops, subjectId, level, search]);

  async function createWorkshop(payload: any) {
    if (!user) return;
    const res = await fetch(`/api/workshops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, institutionId: user.institution.id, userId: user.id }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Taller creado");
      setWorkshops((p) => [d.workshop, ...p]);
      setOpenNew(false);
    } else {
      toast.error(d.error || "No se pudo crear el taller");
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
            Banco de talleres
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Repositorio institucional de talleres y actividades pedagógicas clasificadas por
            asignatura, nivel y duración. Cada taller puede asignarse a uno o varios grupos y
            vincularse a planeaciones de clase. Use el buscador para encontrar recursos por
            palabra clave.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Nuevo taller
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
                placeholder="Título o descripción…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Asignatura</Label>
            <Select value={subjectId || "all"} onValueChange={(v) => setSubjectId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nivel</Label>
            <Select value={level || "all"} onValueChange={(v) => setLevel(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="intermedio">Intermedio</SelectItem>
                <SelectItem value="avanzado">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="ml-auto">{filtered.length} talleres</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl skeleton-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="hairline rounded-xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">
              <Library className="h-6 w-6" />
            </div>
            <div className="text-base font-medium">Sin talleres</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Aún no hay talleres en el banco que coincidan con los filtros seleccionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => {
            const tags = w.tags ? w.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
            return (
              <Card key={w.id} className="hairline rounded-xl flex flex-col">
                <CardContent className="py-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-base font-semibold leading-tight">{w.title}</div>
                    {w.level && (
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase shrink-0", LEVEL_CHIP[w.level] ?? "chip-basico")}>
                        {LEVEL_LABEL[w.level] ?? w.level}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {w.subject && <Badge variant="outline" className="text-[10px]">{w.subject.name}</Badge>}
                    {w.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {w.duration} min
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                    {w.description ?? "Sin descripción."}
                  </p>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {tags.slice(0, 4).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={() => toast.success(`Taller "${w.title}" asignado a su planeador`)}>
                    <Send className="h-3.5 w-3.5" /> Asignar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewWorkshopDialog
        open={openNew}
        onOpenChange={setOpenNew}
        subjects={subjects}
        onCreate={createWorkshop}
      />
    </motion.div>
  );
}

function NewWorkshopDialog({
  open,
  onOpenChange,
  subjects,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subjects: Subject[];
  onCreate: (p: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("basico");
  const [duration, setDuration] = useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  function submit() {
    if (!title) {
      toast.error("El título es obligatorio");
      return;
    }
    onCreate({
      title,
      subjectId: subjectId || null,
      level,
      duration: duration ? Number(duration) : null,
      tags: tags || null,
      description: description || null,
    });
    setTitle(""); setDuration(""); setTags(""); setDescription("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo taller</DialogTitle>
          <DialogDescription>
            Cree un taller en el banco institucional. Podrá asignarlo posteriormente a grupos y
            planeaciones de clase.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Taller de fracciones…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Asignatura</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Sin asignatura" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nivel</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermedio">Intermedio</SelectItem>
                  <SelectItem value="avanzado">Avanzado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Duración (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Etiquetas (coma)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lúdico, colaborativo" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Objetivos, materiales y secuencia…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Crear taller</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
