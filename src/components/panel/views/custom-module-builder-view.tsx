"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Settings, FileText, Eye, Edit, Trash2, Send, CheckCircle2, XCircle,
  BarChart3, Upload, Download, Users, BookOpen, Save, ArrowLeft, Copy, GripVertical,
} from "lucide-react";
import { FIELD_CATALOG, FIELD_CATEGORIES, createField, type ModuleField, type FieldType } from "@/components/custom-modules/field-catalog";
import { FieldRenderer } from "@/components/custom-modules/field-renderer";

interface CustomModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  area: string;
  menuLabel: string | null;
  tabOrientation: "horizontal" | "vertical";
  tabLabels: string[];
  fields: ModuleField[];
  settings: any;
  successMessage: string;
  errorMessage: string;
  published: boolean;
  status: string;
  rejectionReason: string | null;
  visibleRoles: string[];
  canCreateRoles: string[];
  canEditRoles: string[];
  canDeleteRoles: string[];
  recordsCount: number;
  createdAt: string;
  publishedAt: string | null;
}

const ALL_ROLES = [
  { value: "rector", label: "Rector" },
  { value: "coordinador", label: "Coordinador" },
  { value: "director_grupo", label: "Director de grupo" },
  { value: "docente", label: "Docente" },
  { value: "orientador", label: "Orientador" },
  { value: "acudiente", label: "Acudiente" },
  { value: "estudiante", label: "Estudiante" },
  { value: "administrativo", label: "Administrativo" },
];

const ICONS = ["FileText", "BookOpen", "Users", "Vote", "Bell", "Shield", "HeartHandshake", "ClipboardCheck", "Star", "GraduationCap", "Building2", "Calendar"];

export function CustomModuleBuilderView() {
  const user = useAuthStore((s) => s.user);
  const setModule = useUIStore((s) => s.setModule);
  const [modules, setModules] = useState<CustomModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    fetch(`/api/custom-modules?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setModules(d.modules);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  if (selectedModuleId) {
    const mod = modules.find((m) => m.id === selectedModuleId);
    if (mod) {
      return <ModuleEditor module={mod} onBack={() => { setSelectedModuleId(null); load(); }} />;
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
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Constructor de módulos</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cree formularios personalizados con campos básicos, avanzados, académicos y especiales.
            Cada módulo se publica en el panel con dos tabs: tabla de registros y formulario.
            El rector aprueba la publicación final.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo módulo
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg skeleton-pulse" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <Card className="hairline">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-heading font-semibold">No hay módulos todavía</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cree su primer módulo personalizado. Se generará un formulario configurable y un menú en el panel institucional con tabla y formulario.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Crear primer módulo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <ModuleCard key={m.id} module={m} onOpen={() => setSelectedModuleId(m.id)} onChanged={load} />
          ))}
        </div>
      )}

      <CreateModuleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={async (data) => {
          const res = await fetch("/api/custom-modules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, institutionId: user.institution.id, createdById: user.id, fields: [] }),
          });
          const d = await res.json();
          if (d.ok) {
            toast.success("Módulo creado");
            setShowCreateDialog(false);
            load();
            setSelectedModuleId(d.moduleId);
          } else {
            toast.error(d.error || "Error al crear");
          }
        }}
      />
    </motion.div>
  );
}

function ModuleCard({ module, onOpen, onChanged }: { module: CustomModule; onOpen: () => void; onChanged: () => void }) {
  const user = useAuthStore((s) => s.user);

  async function submitForReview() {
    const res = await fetch("/api/custom-modules/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: module.id, institutionId: user!.institution.id, action: "submit_review", userId: user!.id }),
    });
    const d = await res.json();
    if (d.ok) { toast.success("Enviado para aprobación del rector"); onChanged(); }
    else toast.error(d.error || "Error");
  }

  async function del() {
    if (!confirm(`¿Eliminar el módulo "${module.name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/custom-modules?id=${module.id}&institutionId=${user!.institution.id}&deletedById=${user!.id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) { toast.success("Módulo eliminado"); onChanged(); }
    else toast.error(d.error || "Error");
  }

  const statusBadge = {
    draft: <Badge variant="outline" className="hairline">Borrador</Badge>,
    pending_review: <Badge className="chip-basico">Pendiente aprobación</Badge>,
    published: <Badge className="chip-superior">Publicado</Badge>,
    rejected: <Badge className="chip-bajo">Rechazado</Badge>,
  }[module.status] || <Badge variant="outline">{module.status}</Badge>;

  return (
    <Card className="hairline module-glow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="h-9 w-9 rounded-md bg-secondary grid place-items-center text-primary flex-shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          {statusBadge}
        </div>
        <h3 className="font-heading font-semibold text-base line-clamp-1">{module.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">{module.description || "Sin descripción"}</p>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="hairline text-[10px]">{module.area}</Badge>
          <Badge variant="outline" className="hairline text-[10px]">{module.fields.length} campos</Badge>
          <Badge variant="outline" className="hairline text-[10px]">{module.recordsCount} registros</Badge>
          <Badge variant="outline" className="hairline text-[10px] capitalize">{module.tabOrientation}</Badge>
        </div>

        {module.status === "rejected" && module.rejectionReason && (
          <div className="mt-2 p-2 rounded-md bg-destructive/5 hairline text-xs text-destructive">
            <strong>Rechazado:</strong> {module.rejectionReason}
          </div>
        )}

        <div className="mt-4 flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onOpen} className="gap-1.5 flex-1">
            <Edit className="h-3.5 w-3.5" /> Editar
          </Button>
          {module.status === "draft" && (
            <Button variant="outline" size="sm" onClick={submitForReview} className="gap-1.5" title="Enviar para aprobación">
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={del} className="h-8 w-8 text-destructive" aria-label="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateModuleDialog({ open, onOpenChange, onCreate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("Personalizado");
  const [icon, setIcon] = useState("FileText");
  const [tabOrientation, setTabOrientation] = useState<"horizontal" | "vertical">("horizontal");

  useEffect(() => {
    if (name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  }, [name, slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nuevo módulo</DialogTitle>
          <DialogDescription>
            Configure los datos básicos. Luego podrá agregar campos y publicar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Nombre del módulo *</Label>
            <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Permiso de salida estudiantil" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-slug">Slug (identificador interno) *</Label>
            <Input id="m-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="permiso_salida" className="font-mono" />
            <p className="text-xs text-muted-foreground">Se usa en la URL y como clave interna. Solo minúsculas, números y guiones bajos.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Descripción</Label>
            <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="¿Para qué sirve este módulo?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-area">Área del menú</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger id="m-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personalizado">Personalizado</SelectItem>
                  <SelectItem value="Académico">Académico</SelectItem>
                  <SelectItem value="Convivencia">Convivencia</SelectItem>
                  <SelectItem value="Comunidad">Comunidad</SelectItem>
                  <SelectItem value="Administración">Administración</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-orient">Orientación tabs</Label>
              <Select value={tabOrientation} onValueChange={(v: any) => setTabOrientation(v)}>
                <SelectTrigger id="m-orient"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal (arriba)</SelectItem>
                  <SelectItem value="vertical">Vertical (izquierda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Icono</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`h-8 w-8 rounded-md grid place-items-center hairline ${icon === ic ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  <span className="text-xs">{ic.charAt(0)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onCreate({ name, slug, description, area, icon, tabOrientation, menuLabel: name })}
            disabled={!name || !slug}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// EDITOR COMPLETO DE UN MÓDULO
// ============================================================

function ModuleEditor({ module, onBack }: { module: CustomModule; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("fields");
  const [fields, setFields] = useState<ModuleField[]>(module.fields);
  const [settings, setSettings] = useState({
    name: module.name,
    description: module.description || "",
    icon: module.icon,
    area: module.area,
    menuLabel: module.menuLabel || module.name,
    tabOrientation: module.tabOrientation,
    tabLabels: module.tabLabels,
    successMessage: module.successMessage,
    errorMessage: module.errorMessage,
    visibleRoles: module.visibleRoles,
    canCreateRoles: module.canCreateRoles,
    canEditRoles: module.canEditRoles,
    canDeleteRoles: module.canDeleteRoles,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/custom-modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: module.id,
        institutionId: user!.institution.id,
        updatedById: user!.id,
        fields,
        ...settings,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) toast.success("Módulo guardado");
    else toast.error(d.error || "Error al guardar");
  }

  async function submitForReview() {
    const res = await fetch("/api/custom-modules/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: module.id, institutionId: user!.institution.id, action: "submit_review", userId: user!.id }),
    });
    const d = await res.json();
    if (d.ok) { toast.success("Enviado para aprobación"); onBack(); }
    else toast.error(d.error || "Error");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-heading font-semibold tracking-tight truncate">{module.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{module.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={save} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
          {module.status === "draft" && (
            <Button size="sm" onClick={submitForReview} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Enviar a aprobación
            </Button>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fields" className="gap-1.5"><Edit className="h-3.5 w-3.5" /> Campos</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Configuración</TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Vista previa</TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Registros ({module.recordsCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-4">
          <FieldsEditor fields={fields} setFields={setFields} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ModuleSettings settings={settings} setSettings={setSettings} />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <ModulePreview fields={fields} settings={settings} />
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <ModuleRecords moduleId={module.id} fields={fields} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function FieldsEditor({ fields, setFields }: { fields: ModuleField[]; setFields: (f: ModuleField[]) => void }) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function addField(type: FieldType) {
    const newField = createField(type, fields.length + 1);
    setFields([...fields, newField]);
    setEditingIdx(fields.length);
  }

  function removeField(idx: number) {
    setFields(fields.filter((_, i) => i !== idx));
    setEditingIdx(null);
  }

  function duplicateField(idx: number) {
    const f = fields[idx];
    const copy = { ...f, id: `${f.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: `${f.name}_copy` };
    const next = [...fields];
    next.splice(idx + 1, 0, copy);
    setFields(next);
  }

  function updateField(idx: number, patch: Partial<ModuleField>) {
    const next = [...fields];
    next[idx] = { ...next[idx], ...patch };
    setFields(next);
  }

  function onDragStart(idx: number) { setDraggedIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const next = [...fields];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, moved);
    setFields(next);
    setDraggedIdx(idx);
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Paleta de campos */}
      <Card className="hairline h-fit lg:sticky lg:top-20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Agregar campo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FIELD_CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-medium">{cat}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FIELD_CATALOG.filter((f) => f.category === cat).map((f) => (
                  <button
                    key={f.type}
                    onClick={() => addField(f.type)}
                    title={f.description}
                    className="flex items-center gap-1.5 p-2 rounded-md hairline text-xs hover:bg-secondary transition-colors text-left"
                  >
                    <span className="text-primary font-semibold">{f.icon.charAt(0)}</span>
                    <span className="truncate">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Lista de campos del formulario */}
      <div className="space-y-2">
        {fields.length === 0 ? (
          <Card className="hairline">
            <CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Agregue campos desde la paleta de la izquierda.</p>
            </CardContent>
          </Card>
        ) : (
          fields.map((f, idx) => (
            <Card
              key={f.id}
              className={`hairline cursor-move ${draggedIdx === idx ? "opacity-50" : ""} ${editingIdx === idx ? "ring-2 ring-primary" : ""}`}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragEnd={() => setDraggedIdx(null)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="pt-1.5 text-muted-foreground/60 cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{f.label}</span>
                      {f.required && <span className="text-xs text-destructive">*</span>}
                      <Badge variant="outline" className="hairline text-[10px]">{f.type}</Badge>
                      {f.width !== "full" && <Badge variant="outline" className="hairline text-[10px]">{f.width}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{f.name}</div>
                    {f.helpText && <div className="text-xs text-muted-foreground mt-0.5">{f.helpText}</div>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateField(idx)} aria-label="Duplicar">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeField(idx)} aria-label="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {editingIdx === idx && (
                  <FieldConfigEditor field={f} onChange={(patch) => updateField(idx, patch)} />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function FieldConfigEditor({ field, onChange }: { field: ModuleField; onChange: (patch: Partial<ModuleField>) => void }) {
  return (
    <div className="mt-3 pt-3 hairline-t space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Etiqueta</Label>
          <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Nombre (clave)</Label>
          <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8 text-sm font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Placeholder</Label>
          <Input value={field.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Ancho</Label>
          <Select value={field.width || "full"} onValueChange={(v: any) => onChange({ width: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Completo</SelectItem>
              <SelectItem value="half">Medio</SelectItem>
              <SelectItem value="third">Tercio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Texto de ayuda</Label>
        <Input value={field.helpText || ""} onChange={(e) => onChange({ helpText: e.target.value })} className="h-8 text-sm" placeholder="Opcional" />
      </div>

      {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
        <div>
          <Label className="text-xs">Opciones</Label>
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={opt.label} onChange={(e) => {
                  const options = [...(field.options || [])];
                  options[i] = { ...options[i], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") };
                  onChange({ options });
                }} className="h-8 text-sm" />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange({ options: (field.options || []).filter((_, j) => j !== i) })}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onChange({ options: [...(field.options || []), { label: `Opción ${(field.options?.length || 0) + 1}`, value: `opcion_${(field.options?.length || 0) + 1}` }] })} className="gap-1.5">
              <Plus className="h-3 w-3" /> Agregar opción
            </Button>
          </div>
        </div>
      )}

      {(field.type === "number" || field.type === "slider") && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Mín</Label>
            <Input type="number" value={field.min ?? ""} onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Máx</Label>
            <Input type="number" value={field.max ?? ""} onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Step</Label>
            <Input type="number" value={field.step ?? ""} onChange={(e) => onChange({ step: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={!!field.required} onCheckedChange={(c) => onChange({ required: c })} id="req" />
        <Label htmlFor="req" className="text-xs cursor-pointer">Campo obligatorio</Label>
      </div>
    </div>
  );
}

function ModuleSettings({ settings, setSettings }: { settings: any; setSettings: (s: any) => void }) {
  function toggleRole(key: string, role: string) {
    const arr = settings[key] as string[];
    setSettings({ ...settings, [key]: arr.includes(role) ? arr.filter((r) => r !== role) : [...arr, role] });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="hairline">
        <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Etiqueta del menú</Label>
            <Input value={settings.menuLabel} onChange={(e) => setSettings({ ...settings, menuLabel: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Área</Label>
              <Select value={settings.area} onValueChange={(v) => setSettings({ ...settings, area: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personalizado">Personalizado</SelectItem>
                  <SelectItem value="Académico">Académico</SelectItem>
                  <SelectItem value="Convivencia">Convivencia</SelectItem>
                  <SelectItem value="Comunidad">Comunidad</SelectItem>
                  <SelectItem value="Administración">Administración</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Orientación tabs</Label>
              <Select value={settings.tabOrientation} onValueChange={(v: any) => setSettings({ ...settings, tabOrientation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Etiquetas de los 2 tabs (separadas por coma)</Label>
            <Input
              value={settings.tabLabels.join(", ")}
              onChange={(e) => setSettings({ ...settings, tabLabels: e.target.value.split(",").map((s: string) => s.trim()).slice(0, 2) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="hairline">
        <CardHeader><CardTitle className="text-sm">Mensajes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Mensaje de éxito</Label>
            <Textarea value={settings.successMessage} onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Mensaje de error</Label>
            <Textarea value={settings.errorMessage} onChange={(e) => setSettings({ ...settings, errorMessage: e.target.value })} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card className="hairline lg:col-span-2">
        <CardHeader><CardTitle className="text-sm">Roles y permisos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Configure qué roles pueden interactuar con este módulo en el panel institucional.</p>
          {[
            { key: "visibleRoles", label: "Pueden ver el módulo en el menú" },
            { key: "canCreateRoles", label: "Pueden crear registros (enviar formulario)" },
            { key: "canEditRoles", label: "Pueden editar registros" },
            { key: "canDeleteRoles", label: "Pueden eliminar registros" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs font-medium">{label}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(key, r.value)}
                    className={`px-2.5 py-1 rounded-full text-xs hairline transition-colors ${(settings[key] as string[]).includes(r.value) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ModulePreview({ fields, settings }: { fields: ModuleField[]; settings: any }) {
  const [values, setValues] = useState<Record<string, any>>({});

  return (
    <Card className="hairline">
      <CardHeader>
        <CardTitle className="text-sm">Vista previa del formulario</CardTitle>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Agregue campos para ver la vista previa.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <FieldRenderer
                key={f.id}
                field={f}
                value={values[f.id]}
                onChange={(v) => setValues({ ...values, [f.id]: v })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModuleRecords({ moduleId, fields }: { moduleId: string; fields: ModuleField[] }) {
  const user = useAuthStore((s) => s.user);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    fetch(`/api/custom-modules/records?moduleId=${moduleId}&institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRecords(d.records); })
      .finally(() => setLoading(false));
  }, [user, moduleId]);

  useEffect(() => { load(); }, [load]);

  const dataFields = fields.filter((f) => !["section", "column"].includes(f.type));

  async function exportCsv() {
    window.open(`/api/custom-modules/export?moduleId=${moduleId}&institutionId=${user!.institution.id}`, "_blank");
  }

  const filtered = search
    ? records.filter((r) => JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase()))
    : records;

  return (
    <Card className="hairline">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Registros ({records.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-sm" />
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton-pulse rounded" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="hairline-b text-left">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Usuario</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  {dataFields.slice(0, 4).map((f) => (
                    <th key={f.id} className="py-2 pr-3 font-medium">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="hairline-b">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleString("es-CO")}</td>
                    <td className="py-2 pr-3">{r.user?.fullName || "Anónimo"}</td>
                    <td className="py-2 pr-3"><Badge variant="outline" className="hairline text-[10px]">{r.status}</Badge></td>
                    {dataFields.slice(0, 4).map((f) => (
                      <td key={f.id} className="py-2 pr-3 max-w-[160px] truncate">{String(r.data[f.id] ?? r.data[f.name] ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
