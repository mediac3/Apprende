"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Download, Eye, FileText, Send, Trash2, CheckCircle2, XCircle, Loader2, Search, Filter,
} from "lucide-react";
import { FieldRenderer, FieldValueDisplay } from "@/components/custom-modules/field-renderer";
import type { ModuleField } from "@/components/custom-modules/field-catalog";

interface RuntimeModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  area: string;
  tabOrientation: "horizontal" | "vertical";
  tabLabels: string[];
  fields: ModuleField[];
  successMessage: string;
  errorMessage: string;
  visibleRoles: string[];
  canCreateRoles: string[];
  canEditRoles: string[];
  canDeleteRoles: string[];
}

interface RuntimeRecord {
  id: string;
  data: Record<string, any>;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; fullName: string; role: string; avatarUrl: string | null } | null;
}

export function CustomModuleRuntimeView({ moduleId }: { moduleId: string }) {
  const user = useAuthStore((s) => s.user);
  const [module, setModule] = useState<RuntimeModule | null>(null);
  const [records, setRecords] = useState<RuntimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("0");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RuntimeRecord | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Datos para selectores académicos
  const [academicOptions, setAcademicOptions] = useState<Record<string, { id: string; label: string }[]>>({});

  const load = useCallback(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/custom-modules?institutionId=${user.institution.id}`).then((r) => r.json()),
      fetch(`/api/custom-modules/records?moduleId=${moduleId}&institutionId=${user.institution.id}`).then((r) => r.json()),
    ]).then(([mods, recs]) => {
      if (mods.ok) {
        const m = mods.modules.find((x: any) => x.id === moduleId);
        if (m) setModule(m);
      }
      if (recs.ok) setRecords(recs.records);
    }).finally(() => setLoading(false));
  }, [user, moduleId]);

  useEffect(() => { load(); }, [load]);

  // Precargar opciones para campos académicos
  useEffect(() => {
    if (!user || !module) return;
    const academicFields = module.fields.filter((f) =>
      ["student", "group", "subject", "teacher"].includes(f.type)
    );
    if (academicFields.length === 0) return;

    Promise.all([
      fetch(`/api/students?institutionId=${user.institution.id}`).then((r) => r.json()).catch(() => ({ ok: false })),
      fetch(`/api/groups?institutionId=${user.institution.id}`).then((r) => r.json()).catch(() => ({ ok: false })),
      fetch(`/api/subjects?institutionId=${user.institution.id}`).then((r) => r.json()).catch(() => ({ ok: false })),
      fetch(`/api/members?institutionId=${user.institution.id}`).then((r) => r.json()).catch(() => ({ ok: false })),
    ]).then(([st, gr, su, me]) => {
      const opts: Record<string, { id: string; label: string }[]> = {};
      if (st.ok) opts.student = (st.students || []).map((s: any) => ({ id: s.id, label: `${s.firstName} ${s.lastName} (${s.code})` }));
      if (gr.ok) opts.group = (gr.groups || []).map((g: any) => ({ id: g.id, label: g.name }));
      if (su.ok) opts.subject = (su.subjects || []).map((s: any) => ({ id: s.id, label: s.name }));
      if (me.ok) opts.teacher = (me.members || []).filter((m: any) => m.role === "docente" || m.role === "director_grupo").map((m: any) => ({ id: m.id, label: m.fullName }));
      setAcademicOptions(opts);
    });
  }, [user, module]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 skeleton-pulse rounded" />)}
      </div>
    );
  }

  if (!module) {
    return <p className="text-sm text-muted-foreground">Módulo no encontrado o no publicado.</p>;
  }

  if (!user) return null;

  // Verificar permisos de visualización
  if (!module.visibleRoles.includes(user.role)) {
    return (
      <Card className="hairline">
        <CardContent className="py-12 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tiene permisos para ver este módulo.</p>
        </CardContent>
      </Card>
    );
  }

  const canCreate = module.canCreateRoles.includes(user.role);
  const canEdit = module.canEditRoles.includes(user.role);
  const canDelete = module.canDeleteRoles.includes(user.role);

  const dataFields = module.fields.filter((f) => !["section", "column"].includes(f.type));

  async function submitForm() {
    if (!user || !module) return;
    // Validar campos requeridos
    const errors: Record<string, string> = {};
    module.fields.forEach((f) => {
      if (f.required && !["section", "column"].includes(f.type)) {
        const v = formValues[f.id];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
          errors[f.id] = "Campo obligatorio";
        }
      }
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Complete los campos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/custom-modules/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: module.id,
          institutionId: user.institution.id,
          userId: user.id,
          data: formValues,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(d.successMessage || module.successMessage);
        setFormValues({});
        setActiveTab("0");
        load();
      } else {
        toast.error(d.error || module.errorMessage);
      }
    } catch (e) {
      toast.error(module.errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    const res = await fetch(`/api/custom-modules/records?id=${id}&institutionId=${user!.institution.id}&deletedById=${user!.id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) { toast.success("Registro eliminado"); load(); }
    else toast.error(d.error || "Error");
  }

  async function updateRecordStatus(record: RuntimeRecord, status: string, notes?: string) {
    const res = await fetch("/api/custom-modules/records", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: record.id,
        institutionId: user!.institution.id,
        updatedById: user!.id,
        status,
        reviewNotes: notes || "",
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success(`Estado actualizado: ${status}`);
      setSelectedRecord(null);
      load();
    } else toast.error(d.error || "Error");
  }

  function exportCsv() {
    window.open(`/api/custom-modules/export?moduleId=${module.id}&institutionId=${user.institution.id}`, "_blank");
  }

  const filtered = search
    ? records.filter((r) => JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase()))
    : records;

  const isVertical = module.tabOrientation === "vertical";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">{module.name}</h1>
        {module.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{module.description}</p>}
      </header>

      {isVertical ? (
        <div className="grid lg:grid-cols-[200px_1fr] gap-4">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
            <button
              onClick={() => setActiveTab("0")}
              className={`px-3 py-2 rounded-md text-sm text-left whitespace-nowrap ${activeTab === "0" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {module.tabLabels[0] || "Registros"} ({filtered.length})
            </button>
            {canCreate && (
              <button
                onClick={() => setActiveTab("1")}
                className={`px-3 py-2 rounded-md text-sm text-left whitespace-nowrap ${activeTab === "1" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {module.tabLabels[1] || "Nuevo"}
              </button>
            )}
          </nav>
          <div>
            {activeTab === "0" && <RecordsTable />}
            {activeTab === "1" && canCreate && <FormView />}
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="0" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {module.tabLabels[0] || "Registros"} ({filtered.length})
            </TabsTrigger>
            {canCreate && (
              <TabsTrigger value="1" className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {module.tabLabels[1] || "Nuevo"}
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="0" className="mt-4"><RecordsTable /></TabsContent>
          {canCreate && <TabsContent value="1" className="mt-4"><FormView /></TabsContent>}
        </Tabs>
      )}

      {/* Dialog de detalle de registro */}
      <Dialog open={!!selectedRecord} onOpenChange={(v) => !v && setSelectedRecord(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalle del registro</DialogTitle>
            <DialogDescription>
              Enviado el {selectedRecord && new Date(selectedRecord.createdAt).toLocaleString("es-CO")} por {selectedRecord?.user?.fullName || "Anónimo"}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {dataFields.map((f) => (
                <div key={f.id} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <div className="text-muted-foreground">{f.label}</div>
                  <div><FieldValueDisplay field={f} value={selectedRecord.data[f.id] ?? selectedRecord.data[f.name]} /></div>
                </div>
              ))}
              <div className="grid grid-cols-[140px_1fr] gap-2 text-sm pt-2 hairline-t">
                <div className="text-muted-foreground">Estado</div>
                <div><Badge variant="outline" className="hairline">{selectedRecord.status}</Badge></div>
              </div>
              {selectedRecord.reviewNotes && (
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <div className="text-muted-foreground">Notas de revisión</div>
                  <div>{selectedRecord.reviewNotes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {canEdit && selectedRecord && selectedRecord.status === "submitted" && (
              <>
                <Button variant="outline" size="sm" onClick={() => updateRecordStatus(selectedRecord, "approved")} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateRecordStatus(selectedRecord, "rejected")} className="gap-1.5">
                  <XCircle className="h-3.5 w-3.5" /> Rechazar
                </Button>
              </>
            )}
            {canDelete && selectedRecord && (
              <Button variant="outline" size="sm" onClick={() => deleteRecord(selectedRecord.id)} className="gap-1.5 text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );

  function RecordsTable() {
    return (
      <Card className="hairline">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 text-sm pl-7" />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay registros para mostrar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="hairline-b text-left">
                    <th className="py-2 px-2 font-medium whitespace-nowrap">Fecha</th>
                    <th className="py-2 px-2 font-medium">Usuario</th>
                    <th className="py-2 px-2 font-medium">Estado</th>
                    {dataFields.slice(0, 5).map((f) => (
                      <th key={f.id} className="py-2 px-2 font-medium whitespace-nowrap">{f.label}</th>
                    ))}
                    <th className="py-2 px-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="hairline-b hover:bg-secondary/30">
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("es-CO")}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{r.user?.fullName || "Anónimo"}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`hairline text-[10px] ${
                          r.status === "approved" ? "chip-superior" :
                          r.status === "rejected" ? "chip-bajo" :
                          r.status === "reviewed" ? "chip-alto" : ""
                        }`}>{r.status}</Badge>
                      </td>
                      {dataFields.slice(0, 5).map((f) => (
                        <td key={f.id} className="py-2 px-2 max-w-[180px] truncate">
                          <FieldValueDisplay field={f} value={r.data[f.id] ?? r.data[f.name]} />
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedRecord(r)} aria-label="Ver detalle">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
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

  function FormView() {
    return (
      <Card className="hairline">
        <CardHeader>
          <CardTitle className="text-sm">{module!.tabLabels[1] || "Nuevo registro"}</CardTitle>
        </CardHeader>
        <CardContent>
          {module!.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">El formulario no tiene campos configurados.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                {module!.fields.map((f) => (
                  <FieldRenderer
                    key={f.id}
                    field={f}
                    value={formValues[f.id]}
                    onChange={(v) => setFormValues({ ...formValues, [f.id]: v })}
                    error={formErrors[f.id]}
                    academicOptions={academicOptions[f.type]}
                  />
                ))}
              </div>
              <div className="mt-6 pt-4 hairline-t flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setFormValues({})}>Limpiar</Button>
                <Button onClick={submitForm} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Enviando..." : "Enviar registro"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
}
