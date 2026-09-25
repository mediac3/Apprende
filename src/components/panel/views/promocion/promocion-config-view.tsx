"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap, Save } from "lucide-react";

// === [F3] Parámetros → Promoción escolar ===
// Configuración institucional de los criterios usados por el wizard de
// promoción y el Consolidado anual. Guarda 1 fila por institución
// (PromotionConfig); sin fila = defaults.

interface PromotionConfigForm {
  umbralArea: number | null;
  umbralInasistencia: number;
  maxAreasNivelacion: number;
  preescolarCodes: string;
}

const DEFAULTS: PromotionConfigForm = {
  umbralArea: null,
  umbralInasistencia: 25,
  maxAreasNivelacion: 2,
  preescolarCodes: "PJ,J,T",
};

export default function PromocionConfigView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;
  const [form, setForm] = useState<PromotionConfigForm>(DEFAULTS);
  const [porDefecto, setPorDefecto] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [umbralAreaAuto, setUmbralAreaAuto] = useState(true);

  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/promocion-config?institutionId=${institutionId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j.ok) return;
        setForm({
          umbralArea: j.config.umbralArea ?? null,
          umbralInasistencia: j.config.umbralInasistencia,
          maxAreasNivelacion: j.config.maxAreasNivelacion,
          preescolarCodes: j.config.preescolarCodes,
        });
        setPorDefecto(!!j.porDefecto);
        setUmbralAreaAuto(j.config.umbralArea === null || j.config.umbralArea === undefined);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [institutionId]);

  async function save() {
    if (!institutionId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/promocion-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          umbralArea: umbralAreaAuto ? null : form.umbralArea,
          umbralInasistencia: form.umbralInasistencia,
          maxAreasNivelacion: form.maxAreasNivelacion,
          preescolarCodes: form.preescolarCodes,
          userId: user?.id,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        toast.success("Parámetros de promoción guardados");
        setPorDefecto(false);
      } else {
        toast.error(j.error ?? "No se pudo guardar");
      }
    } catch {
      toast.error("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <GraduationCap className="h-5 w-5" />
          Promoción escolar
        </h1>
        <p className="text-sm text-muted-foreground">
          Criterios que aplican el wizard de Promoción de grado y el Consolidado anual.
          Usan los valores por defecto hasta que guardes por primera vez.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 py-4">
          {porDefecto && !loading && (
            <Badge variant="outline">Mostrando valores por defecto (sin configuración guardada)</Badge>
          )}

          <div className="space-y-2">
            <Label>Umbral de aprobación de áreas</Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={umbralAreaAuto}
                  onChange={() => setUmbralAreaAuto(true)}
                />
                Auto — derivar de Escalas valorativas (tope de &quot;Bajo&quot;)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={!umbralAreaAuto}
                  onChange={() => setUmbralAreaAuto(false)}
                />
                Fijo:
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                className="w-24"
                value={umbralAreaAuto ? "" : (form.umbralArea ?? "")}
                disabled={umbralAreaAuto}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    umbralArea: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Un área está en bajo cuando su valoración final queda por debajo de este umbral.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Inasistencia injustificada máxima (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="100"
                className="w-24"
                value={form.umbralInasistencia}
                onChange={(e) =>
                  setForm((f) => ({ ...f, umbralInasistencia: Number(e.target.value) || 25 }))
                }
              />
              <span className="text-xs text-muted-foreground">
                Causal de no promoción: ausencias sin excusa ≥ este % del total de registros del año.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Máximo de áreas en bajo para promovido condicionado</Label>
            <div className="flex items-center gap-3">
              <Select
                value={String(form.maxAreasNivelacion)}
                onValueChange={(v) => setForm((f) => ({ ...f, maxAreasNivelacion: Number(v) }))}
              >
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Con 1–N áreas en bajo el estudiante es promovido condicionado a nivelación;
                con más de N, no promovido.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Códigos de preescolar (promoción automática)</Label>
            <div className="flex items-center gap-3">
              <Input
                className="w-48"
                value={form.preescolarCodes}
                onChange={(e) => setForm((f) => ({ ...f, preescolarCodes: e.target.value }))}
              />
              <span className="text-xs text-muted-foreground">
                Separados por coma. En estos grados no se reprueba (Pár. 1, Decreto 1411 de 2022).
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || loading}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar parámetros"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
