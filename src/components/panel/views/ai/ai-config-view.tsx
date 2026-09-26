"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Sparkles, KeyRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// === Parámetros → Inteligencia artificial ===
// Clave del proveedor de IA (Google Gemini, nivel gratuito) usada por el
// asistente contextual del panel. La clave se guarda en la BD de la
// institución (tabla AiConfig) y nunca se expone al cliente (solo enmascarada).

const PROVEEDORES = [
  { id: "gemini", nombre: "Google Gemini (gratuito)", claveUrl: "https://aistudio.google.com/apikey" },
];

export default function AiConfigView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;

  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-flash-latest");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/ai/config?institutionId=${institutionId}`);
        const j = await res.json();
        if (alive && j.ok) {
          setProvider(j.config.provider ?? "gemini");
          setModel(j.config.model ?? "gemini-flash-latest");
          setApiKeyMasked(j.config.apiKeyMasked ?? "");
          setConfigured(!!j.config.configured);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [institutionId]);

  async function handleSave() {
    if (!apiKey.trim()) {
      toast.error("Ingresa la clave del proveedor de IA.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, provider, apiKey: apiKey.trim(), model: model.trim() }),
      });
      const j = await res.json();
      if (j.ok) {
        setApiKeyMasked(j.config.apiKeyMasked);
        setConfigured(!!j.config.configured);
        setApiKey("");
        toast.success("Configuración de IA guardada.");
      } else {
        toast.error(j.error ?? "No se pudo guardar la configuración.");
      }
    } catch {
      toast.error("Error de red al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          messages: [{ role: "user", content: "Responde únicamente: IA configurada correctamente." }],
          context: null,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        toast.success("Conexión con la IA verificada.");
      } else {
        toast.error(j.error ?? "No se pudo conectar con la IA.");
      }
    } catch {
      toast.error("Error de red al probar la conexión.");
    } finally {
      setTesting(false);
    }
  }

  const proveedor = PROVEEDORES.find((p) => p.id === provider) ?? PROVEEDORES[0];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Inteligencia artificial</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Configura la clave del asistente de IA contextual del panel. El asistente analiza los
          datos del módulo activo (consolidados, riesgo de deserción, análisis por grupo,
          asignatura y sede) y responde consultas en lenguaje natural.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Estado:{" "}
              {loading ? (
                "cargando…"
              ) : configured ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Configurada ({apiKeyMasked})</Badge>
              ) : (
                <Badge variant="secondary">Sin configurar</Badge>
              )}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                {PROVEEDORES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-flash-latest" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Clave de API {configured && <span className="text-muted-foreground">(déjala vacío para conservar la actual)</span>}
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={configured ? apiKeyMasked : "AIza…"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Obtén tu clave gratuita en{" "}
              <a href={proveedor.claveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary underline">
                {proveedor.claveUrl.replace("https://", "")}
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              (sin tarjeta de crédito). La clave se guarda solo en la base de datos de tu institución.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving || loading}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || loading || (!configured && !apiKey.trim())}>
              {testing ? "Probando…" : "Probar conexión"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
