"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Send, Eye, FileText, Clock, Check, X } from "lucide-react";

interface PendingModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  area: string;
  icon: string;
  fields: any[];
  status: string;
  rejectionReason: string | null;
  tabOrientation: string;
  visibleRoles: string[];
  canCreateRoles: string[];
  recordsCount: number;
  createdAt: string;
}

export function ModuleApprovalsView() {
  const user = useAuthStore((s) => s.user);
  const [modules, setModules] = useState<PendingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewModule, setPreviewModule] = useState<PendingModule | null>(null);
  const [rejectModule, setRejectModule] = useState<PendingModule | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    fetch(`/api/custom-modules?institutionId=${user.institution.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          // Mostrar pendientes y publicados (para poder despublicar)
          setModules(d.modules.filter((m: any) => m.status === "pending_review" || m.status === "published" || m.status === "rejected"));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  async function approve(id: string) {
    const res = await fetch("/api/custom-modules/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, institutionId: user!.institution.id, action: "approve", userId: user!.id }),
    });
    const d = await res.json();
    if (d.ok) { toast.success("Módulo aprobado y publicado"); load(); }
    else toast.error(d.error || "Error");
  }

  async function unpublish(id: string) {
    if (!confirm("¿Despublicar este módulo? Ya no será visible para los roles asignados.")) return;
    const res = await fetch("/api/custom-modules/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, institutionId: user!.institution.id, action: "unpublish", userId: user!.id }),
    });
    const d = await res.json();
    if (d.ok) { toast.success("Módulo despublicado"); load(); }
    else toast.error(d.error || "Error");
  }

  async function reject() {
    if (!rejectModule || !rejectReason.trim()) {
      toast.error("Especifique la razón del rechazo");
      return;
    }
    const res = await fetch("/api/custom-modules/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rejectModule.id,
        institutionId: user!.institution.id,
        action: "reject",
        userId: user!.id,
        reason: rejectReason,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success("Módulo rechazado");
      setRejectModule(null);
      setRejectReason("");
      load();
    } else toast.error(d.error || "Error");
  }

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 skeleton-pulse rounded" />)}</div>;
  }

  const pending = modules.filter((m) => m.status === "pending_review");
  const published = modules.filter((m) => m.status === "published");
  const rejected = modules.filter((m) => m.status === "rejected");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Aprobación de módulos</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Como rector, usted aprueba la publicación final de los módulos creados por el administrador.
          Una vez aprobados, aparecen en el panel de los roles asignados.
        </p>
      </header>

      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-warning" />
            <h2 className="font-heading font-semibold text-sm">Pendientes de aprobación</h2>
            <Badge variant="secondary">{pending.length}</Badge>
          </div>
          <div className="space-y-2">
            {pending.map((m) => (
              <ModuleApprovalCard key={m.id} module={m} onApprove={() => approve(m.id)} onReject={() => setRejectModule(m)} onPreview={() => setPreviewModule(m)} />
            ))}
          </div>
        </section>
      )}

      {published.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Check className="h-4 w-4 text-success" />
            <h2 className="font-heading font-semibold text-sm">Publicados</h2>
            <Badge variant="secondary">{published.length}</Badge>
          </div>
          <div className="space-y-2">
            {published.map((m) => (
              <Card key={m.id} className="hairline">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{m.name}</span>
                      <Badge className="chip-superior text-[10px]">Publicado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{m.description || "Sin descripción"}</p>
                    <div className="text-xs text-muted-foreground mt-1">{m.fields.length} campos · {m.recordsCount} registros · {m.area}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPreviewModule(m)} className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => unpublish(m.id)} className="gap-1.5">
                      <X className="h-3.5 w-3.5" /> Despublicar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {rejected.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-destructive" />
            <h2 className="font-heading font-semibold text-sm">Rechazados</h2>
            <Badge variant="secondary">{rejected.length}</Badge>
          </div>
          <div className="space-y-2">
            {rejected.map((m) => (
              <Card key={m.id} className="hairline">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{m.name}</span>
                        <Badge className="chip-bajo text-[10px]">Rechazado</Badge>
                      </div>
                      <p className="text-xs text-destructive mt-1">Razón: {m.rejectionReason || "No especificada"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {modules.length === 0 && (
        <Card className="hairline">
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay módulos para aprobar.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de preview */}
      <Dialog open={!!previewModule} onOpenChange={(v) => !v && setPreviewModule(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{previewModule?.name}</DialogTitle>
            <DialogDescription>
              {previewModule?.fields.length} campos · área {previewModule?.area} · {previewModule?.tabOrientation}
            </DialogDescription>
          </DialogHeader>
          {previewModule && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              <div className="text-xs text-muted-foreground mb-2">Campos del formulario:</div>
              {previewModule.fields.map((f: any, i: number) => (
                <div key={f.id || i} className="flex items-center gap-2 text-sm p-2 rounded-md hairline">
                  <Badge variant="outline" className="hairline text-[10px]">{f.type}</Badge>
                  <span className="font-medium">{f.label}</span>
                  {f.required && <span className="text-destructive text-xs">*</span>}
                  <span className="text-xs text-muted-foreground font-mono ml-auto">{f.name}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 hairline-t">
                <div className="text-xs text-muted-foreground mb-1">Roles que podrán verlo:</div>
                <div className="flex flex-wrap gap-1.5">
                  {previewModule.visibleRoles.map((r: string) => (
                    <Badge key={r} variant="outline" className="hairline text-[10px]">{r}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewModule(null)}>Cerrar</Button>
            {previewModule?.status === "pending_review" && (
              <>
                <Button variant="outline" onClick={() => { setRejectModule(previewModule); setPreviewModule(null); }} className="gap-1.5 text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> Rechazar
                </Button>
                <Button onClick={() => { approve(previewModule.id); setPreviewModule(null); }} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar y publicar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <Dialog open={!!rejectModule} onOpenChange={(v) => !v && setRejectModule(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Rechazar módulo</DialogTitle>
            <DialogDescription>
              Especifique la razón del rechazo. El administrador podrá corregir y volver a enviar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Razón del rechazo *</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ej: El campo 'Documento del estudiante' debe ser obligatorio. Falta sección de firma del acudiente."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectModule(null); setRejectReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={reject} className="gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Rechazar módulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function ModuleApprovalCard({ module, onApprove, onReject, onPreview }: {
  module: PendingModule;
  onApprove: () => void;
  onReject: () => void;
  onPreview: () => void;
}) {
  return (
    <Card className="hairline">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{module.name}</span>
            <Badge className="chip-basico text-[10px]">Pendiente</Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{module.description || "Sin descripción"}</p>
          <div className="text-xs text-muted-foreground mt-1">{module.fields.length} campos · {module.area} · {module.tabOrientation}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onPreview} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Revisar
          </Button>
          <Button variant="outline" size="sm" onClick={onReject} className="gap-1.5 text-destructive">
            <XCircle className="h-3.5 w-3.5" /> Rechazar
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
