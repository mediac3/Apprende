"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore, type AiQuickAction } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Copy, ExternalLink, Eye, FileText, Image as ImageIcon, Link2,
  Plus, Sparkles, Trash2, Video, X,
} from "lucide-react";

// === Base de conocimientos ===
// Material pedagógico embebido por URL, agrupado por categoría curricular:
// Materiales, DBA, Estándares Básicos de Competencia, Evaluación y Mallas de
// aprendizaje. Evaluación y Materiales se registran para un Grado.
// Generación de documentos con IA → link público /kb/[id].

const CATEGORIAS = [
  { id: "materiales", label: "Materiales", conGrado: true },
  { id: "dba", label: "Derechos básicos de aprendizaje", conGrado: false },
  { id: "ebc", label: "Estándares básicos de competencia", conGrado: false },
  { id: "evaluacion", label: "Evaluación", conGrado: true },
  { id: "mallas", label: "Mallas de aprendizaje", conGrado: false },
];
const TIPOS = [
  { id: "documento", label: "Documento", icon: FileText },
  { id: "video", label: "Video", icon: Video },
  { id: "imagen", label: "Imagen", icon: ImageIcon },
  { id: "enlace", label: "Enlace", icon: Link2 },
];
const catLabel = (id: string) => CATEGORIAS.find((c) => c.id === id)?.label ?? id;
const tipoIcon = (id: string) => TIPOS.find((t) => t.id === id)?.icon ?? FileText;

interface KbItem {
  id: string;
  title: string;
  url: string;
  type: string;
  category: string;
  description: string | null;
  gradeLevel?: { id: string; name: string; code: string } | null;
  createdAt: string;
}

interface GradeLevelRow { id: string; name: string; code: string }

export default function KnowledgeBaseView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;
  const setAiContext = useUIStore((s) => s.setAiContext);

  const [items, setItems] = useState<KbItem[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFiltro, setCatFiltro] = useState<string>("all");
  const [gradoFiltro, setGradoFiltro] = useState<string>("all");
  const [busqueda, setBusqueda] = useState("");

  const [formUrlOpen, setFormUrlOpen] = useState(false);
  const [formGenOpen, setFormGenOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ publicUrl: string; title: string } | null>(null);
  const [embedItem, setEmbedItem] = useState<KbItem | null>(null);

  // formulario URL
  const [fTitle, setFTitle] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fType, setFType] = useState("documento");
  const [fCategory, setFCategory] = useState("materiales");
  const [fGrade, setFGrade] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fError, setFError] = useState("");

  // formulario IA
  const [gTopic, setGTopic] = useState("");
  const [gCategory, setGCategory] = useState("mallas");
  const [gGrade, setGGrade] = useState("");
  const [gError, setGError] = useState("");

  const catActual = CATEGORIAS.find((c) => c.id === fCategory);
  const catGen = CATEGORIAS.find((c) => c.id === gCategory);

  const cargar = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const [kbRes, glRes] = await Promise.all([
        fetch(`/api/knowledge-base?institutionId=${institutionId}`),
        fetch(`/api/grade-levels?institutionId=${institutionId}`),
      ]);
      const kb = await kbRes.json();
      const gl = await glRes.json();
      setItems(kb.ok ? (kb.items ?? []) : []);
      setGradeLevels(gl.ok ? (gl.gradeLevels ?? []) : []);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarUrl() {
    setFError("");
    if (!fTitle.trim() || !fUrl.trim()) {
      setFError("Título y URL son obligatorios.");
      return;
    }
    if (catActual?.conGrado && !fGrade) {
      setFError(`Para ${catActual.label} debes seleccionar el Grado.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          title: fTitle.trim(),
          url: fUrl.trim(),
          type: fType,
          category: fCategory,
          gradeLevelId: catActual?.conGrado ? fGrade : null,
          description: fDesc.trim(),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setItems((prev) => [j.item, ...prev]);
        setFTitle(""); setFUrl(""); setFDesc(""); setFGrade("");
        setFormUrlOpen(false);
      } else {
        setFError(j.error ?? "No se pudo guardar.");
      }
    } catch {
      setFError("Error de red.");
    } finally {
      setSaving(false);
    }
  }

  async function generarDoc() {
    setGError("");
    if (catGen?.conGrado && !gGrade) {
      setGError(`Para ${catGen.label} debes seleccionar el Grado.`);
      return;
    }
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/knowledge-base/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          category: gCategory,
          gradeLevelId: catGen?.conGrado ? gGrade : null,
          topic: gTopic.trim(),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setGenResult({ publicUrl: j.publicUrl, title: j.item.title });
        setItems((prev) => [j.item, ...prev]);
        setGTopic("");
      } else {
        setGError(j.error ?? "No se pudo generar el documento.");
      }
    } catch {
      setGError("Error de red al generar.");
    } finally {
      setGenerating(false);
    }
  }

  async function eliminar(item: KbItem) {
    if (!window.confirm(`¿Eliminar "${item.title}" de la Base de conocimientos?`)) return;
    const res = await fetch(`/api/knowledge-base?id=${item.id}`, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) setItems((prev) => prev.filter((x) => x.id !== item.id));
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(
      (it) =>
        (catFiltro === "all" || it.category === catFiltro) &&
        (gradoFiltro === "all" || it.gradeLevel?.id === gradoFiltro || (!it.gradeLevel && gradoFiltro === "sin-grado")) &&
        (!q || it.title.toLowerCase().includes(q) || (it.description ?? "").toLowerCase().includes(q))
    );
  }, [items, catFiltro, gradoFiltro, busqueda]);

  // Contexto para el asistente de IA + acciones rápidas del módulo
  useEffect(() => {
    if (loading) return;
    const porCategoria = Object.fromEntries(
      CATEGORIAS.map((c) => [c.label, items.filter((i) => i.category === c.id).length])
    );
    const quickActions: AiQuickAction[] = [
      { label: "¿Qué materiales hay y para qué grados?", prompt: "Resume qué materiales hay en la Base de conocimientos, organizados por categoría y grado, e indica qué categorías están vacías." },
      { label: "¿Qué falta documentar?", prompt: "Con base en las categorías con pocos o ningún documento, recomiéndame qué materiales priorizar para completar la Base de conocimientos." },
    ];
    setAiContext({
      moduleId: "base-conocimientos",
      moduleTitle: "Base de conocimientos",
      data: {
        totalItems: items.length,
        itemsPorCategoria: porCategoria,
        items: filtrados.slice(0, 20).map((i) => ({
          titulo: i.title,
          categoria: catLabel(i.category),
          tipo: i.type,
          grado: i.gradeLevel?.name ?? null,
          descripcion: i.description ?? null,
        })),
      },
      quickActions,
    });
    return () => setAiContext(null);
  }, [items, filtrados, loading, setAiContext]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="h-5 w-5" />
            Base de conocimientos
          </h1>
          <p className="text-sm text-muted-foreground">
            Materiales, DBA, estándares, evaluación y mallas embebidos por URL — con generación de documentos por IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setFormGenOpen((v) => !v); setFormUrlOpen(false); }}>
            <Sparkles className="mr-1 h-4 w-4" />
            Generar con IA
          </Button>
          <Button size="sm" onClick={() => { setFormUrlOpen((v) => !v); setFormGenOpen(false); }}>
            <Plus className="mr-1 h-4 w-4" />
            Agregar por URL
          </Button>
        </div>
      </div>

      {/* Formulario: embeber por URL */}
      {formUrlOpen && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Embeber material por URL</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFormUrlOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Ej.: Guía de fuerza corporal" />
              </div>
              <div className="space-y-1.5">
                <Label>URL *</Label>
                <Input value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={fCategory} onValueChange={(v) => { setFCategory(v); setFGrade(""); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {catActual?.conGrado && (
                <div className="space-y-1.5">
                  <Label>Grado *</Label>
                  <Select value={fGrade} onValueChange={setFGrade}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona el grado" /></SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descripción</Label>
                <Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Descripción breve (opcional)" />
              </div>
            </div>
            {fError && <p className="text-xs text-red-600">{fError}</p>}
            <Button onClick={guardarUrl} disabled={saving}>{saving ? "Guardando…" : "Guardar material"}</Button>
          </CardContent>
        </Card>
      )}

      {/* Formulario: generar con IA */}
      {formGenOpen && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Generar documento con IA
              </h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFormGenOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">
              La IA redacta el documento según la categoría y el grado, lo guarda aquí y te entrega un link público para compartirlo.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Tema (opcional)</Label>
                <Input value={gTopic} onChange={(e) => setGTopic(e.target.value)} placeholder="Ej.: Fuerza y movimiento en el cuerpo humano" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={gCategory} onValueChange={(v) => { setGCategory(v); setGGrade(""); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {catGen?.conGrado && (
                <div className="space-y-1.5">
                  <Label>Grado *</Label>
                  <Select value={gGrade} onValueChange={setGGrade}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona el grado" /></SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {gError && <p className="text-xs text-red-600">{gError}</p>}
            {genResult && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/30">
                <span className="font-medium">Documento generado:</span>
                <code className="rounded bg-background px-1.5 py-0.5">{genResult.publicUrl}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Copiar link"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${genResult.publicUrl}`); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <a href={genResult.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                  Abrir documento <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <Button onClick={generarDoc} disabled={generating}>
              {generating ? "Generando documento… (puede tardar ~30 s)" : "Generar documento"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Select value={catFiltro} onValueChange={setCatFiltro}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {CATEGORIAS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gradoFiltro} onValueChange={setGradoFiltro}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Grado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grados</SelectItem>
              {gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              <SelectItem value="sin-grado">Sin grado</SelectItem>
            </SelectContent>
          </Select>
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="w-[200px]" />
          <span className="text-xs text-muted-foreground">{filtrados.length} de {items.length}</span>
        </CardContent>
      </Card>

      {/* Listado */}
      {loading ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay materiales para los filtros actuales. Agrega uno por URL o genera un documento con IA.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((it) => {
            const Icon = tipoIcon(it.type);
            const esGenerado = it.url.startsWith("/kb/");
            return (
              <Card key={it.id} className="py-0">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <h3 className="truncate text-sm font-semibold" title={it.title}>{it.title}</h3>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
                      title="Eliminar" onClick={() => eliminar(it)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{catLabel(it.category)}</Badge>
                    {it.gradeLevel && <Badge variant="outline">{it.gradeLevel.name}</Badge>}
                    {esGenerado && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Generado con IA</Badge>}
                  </div>
                  {it.description && <p className="line-clamp-2 text-xs text-muted-foreground">{it.description}</p>}
                  <div className="flex items-center gap-1.5 pt-1">
                    <a href={it.url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm"><ExternalLink className="mr-1 h-3.5 w-3.5" />Abrir</Button>
                    </a>
                    {it.type === "video" || it.type === "imagen" || it.type === "documento" ? (
                      <Button variant="ghost" size="sm" onClick={() => setEmbedItem(it)}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Ver
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vista embebida */}
      {embedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEmbedItem(null)}>
          <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="truncate text-sm font-semibold">{embedItem.title}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEmbedItem(null)}><X className="h-4 w-4" /></Button>
            </div>
            {embedItem.type === "imagen" ? (
              <div className="flex flex-1 items-center justify-center overflow-auto p-2">
                <img src={embedItem.url} alt={embedItem.title} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <iframe src={embedItem.url} className="flex-1" title={embedItem.title} sandbox="allow-scripts allow-same-origin allow-presentation" />
            )}
            <div className="border-t px-3 py-1.5 text-center text-[11px] text-muted-foreground">
              Si el recurso bloquea su visualización embebida, ábrelo con el botón "Abrir".
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
