"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { useAddonsStore } from "@/store/addons-store";
import { ADDON_FEATURES, type AddonState, type AddonTargets } from "@/lib/addons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// [F1] Gestor de complementos (solo administrador): activar/desactivar
// características y elegir en qué versión se ven (móvil, PC o ambos).

const TARGET_LABEL: Record<AddonTargets, string> = {
  both: "Ambos",
  mobile: "Móvil",
  pc: "PC",
};

export function AddonsView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id ?? null;
  const { map, loaded, load, invalidate } = useAddonsStore();

  const [rows, setRows] = useState<Record<string, AddonState>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    void load(institutionId);
  }, [institutionId, loaded, load]);

  useEffect(() => {
    if (!loaded) return;
    setRows(
      Object.fromEntries(
        ADDON_FEATURES.map((f) => [
          f.key,
          { enabled: map[f.key]?.enabled ?? true, targets: map[f.key]?.targets ?? "both" },
        ])
      ) as Record<string, AddonState>
    );
    setDirty(false);
  }, [loaded, map]);

  function update(key: string, patch: Partial<AddonState>) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
  }

  async function save() {
    if (!institutionId || !user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          userId: user.id,
          addons: ADDON_FEATURES.map((f) => ({
            featureKey: f.key,
            enabled: rows[f.key]?.enabled ?? true,
            targets: rows[f.key]?.targets ?? "both",
          })),
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "Error al guardar");
      invalidate();
      await load(institutionId);
      toast.success("Complementos actualizados");
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <h1 className="text-lg font-bold">Gestor de complementos</h1>
        <p className="text-xs text-muted-foreground">
          Activa o desactiva características y elige en qué versión se ven: móvil, PC o ambos.
          Sin configuración, todo está activo para ambos.
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border bg-card p-3">
        {ADDON_FEATURES.map((f) => {
          const row = rows[f.key] ?? { enabled: true, targets: "both" as AddonTargets };
          return (
            <div
              key={f.key}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2",
                !row.enabled && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(v) => update(f.key, { enabled: v === true })}
                  aria-label={`Activar ${f.label}`}
                />
                <Label className="text-sm font-medium">{f.label}</Label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Ver en:</span>
                <Select
                  value={row.targets}
                  onValueChange={(v) => update(f.key, { targets: v as AddonTargets })}
                  disabled={!row.enabled}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Ambos</SelectItem>
                    <SelectItem value="mobile">Móvil</SelectItem>
                    <SelectItem value="pc">PC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving || !dirty || !institutionId}>
          {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
        </Button>
      </div>
    </div>
  );
}
