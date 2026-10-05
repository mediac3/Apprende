"use client";

// [Dashboard Docente] Bloque D — 🤖 Alertas IA priorizadas, cada una con acción.
// El signo + despliega los estudiantes afectados; cada fila ofrece notificar al
// acudiente (módulo de notificaciones pendiente → aviso informativo).
// "Intervenir" abre acciones que usan módulos existentes. Engranaje: umbrales.
import { useState } from "react";
import {
  Bot,
  Settings2,
  ArrowRight,
  MessageSquare,
  ListChecks,
  NotebookPen,
  CheckCircle2,
  Plus,
  Minus,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { TeacherAlert, TeacherDashboardConfigDTO } from "@/lib/queries/teacher-dashboard";

type Navigate = (m: "observador" | "mensajeria" | "gestion-actividades") => void;

function AlertCard({ alert, onIntervene }: { alert: TeacherAlert; onIntervene: (a: TeacherAlert) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200/60 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Ocultar estudiantes" : "Ver estudiantes"}
          title={open ? "Ocultar estudiantes" : "Ver estudiantes"}
          className="mt-0.5 h-6 w-6 shrink-0 rounded-md border bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            <span className="mr-1" aria-hidden>
              {alert.emoji}
            </span>
            {alert.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-[11px]">
              {alert.count} estudiante{alert.count > 1 ? "s" : ""}
            </Badge>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onIntervene(alert)}>
              Intervenir <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-2 ml-9 space-y-1.5">
          {alert.students.map((s) => (
            <div
              key={s.studentId}
              className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-1.5"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block">{s.name}</span>
                <span className="text-[11px] text-muted-foreground">{s.detail}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] gap-1 shrink-0 text-muted-foreground"
                onClick={() =>
                  toast.info("Módulo de notificaciones en preparación", {
                    description: `Pronto podrás notificar al acudiente de ${s.name.split(" ")[0]} desde aquí.`,
                  })
                }
              >
                <Bell className="h-3 w-3" />
                Notificar acudiente
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiAlerts({
  alerts,
  config,
  onSaveConfig,
  onNavigate,
}: {
  alerts: TeacherAlert[];
  config: TeacherDashboardConfigDTO;
  onSaveConfig: (c: TeacherDashboardConfigDTO) => Promise<boolean>;
  onNavigate: Navigate;
}) {
  const [interveneAlert, setInterveneAlert] = useState<TeacherAlert | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [cfg, setCfg] = useState<TeacherDashboardConfigDTO>(config);
  const [saving, setSaving] = useState(false);

  const openConfig = () => {
    setCfg(config);
    setConfigOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSaveConfig(cfg);
    setSaving(false);
    if (ok) {
      toast.success("Umbrales actualizados");
      setConfigOpen(false);
    } else {
      toast.error("No se pudieron guardar los umbrales");
    }
  };

  const interveneActions: { icon: typeof MessageSquare; label: string; module: Parameters<Navigate>[0] }[] = [
    { icon: NotebookPen, label: "Crear observación de seguimiento", module: "observador" },
    { icon: MessageSquare, label: "Enviar mensaje (mensajería)", module: "mensajeria" },
    { icon: ListChecks, label: "Crear actividad de refuerzo", module: "gestion-actividades" },
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-600" aria-hidden />
          La IA detectó
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 ml-auto text-muted-foreground"
            onClick={openConfig}
            title="Configurar umbrales"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Todo en orden ✅
          </p>
        ) : (
          alerts.map((a, i) => <AlertCard key={`${a.type}-${i}`} alert={a} onIntervene={setInterveneAlert} />)
        )}
      </CardContent>

      {/* Modal: intervenir */}
      <Dialog open={!!interveneAlert} onOpenChange={(o) => !o && setInterveneAlert(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Intervenir</DialogTitle>
            <DialogDescription>{interveneAlert?.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {interveneActions.map((a) => (
              <Button
                key={a.module}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setInterveneAlert(null);
                  onNavigate(a.module);
                }}
              >
                <a.icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: configurar umbrales */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Umbrales de alertas</DialogTitle>
            <DialogDescription>Personaliza cuándo la IA te avisa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-decline" className="text-sm">
                Disminución de rendimiento (puntos)
              </Label>
              <Input
                id="cfg-decline"
                type="number"
                step="0.1"
                min="0.1"
                max="2"
                value={cfg.declineThreshold}
                onChange={(e) => setCfg({ ...cfg, declineThreshold: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-inactive" className="text-sm">
                Días sin registros para alertar inactividad
              </Label>
              <Input
                id="cfg-inactive"
                type="number"
                min="1"
                max="30"
                value={cfg.inactivityDays}
                onChange={(e) => setCfg({ ...cfg, inactivityDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-risk" className="text-sm">
                Promedio de riesgo (debajo de)
              </Label>
              <Input
                id="cfg-risk"
                type="number"
                step="0.1"
                min="0.5"
                max="5"
                value={cfg.riskThreshold}
                onChange={(e) => setCfg({ ...cfg, riskThreshold: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
