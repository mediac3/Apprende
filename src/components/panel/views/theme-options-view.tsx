"use client";

// [theme-options] Vista del módulo "Opciones de Tema".
// Estructura inspirada en el panel de referencia (BuddyBoss) adaptada a Next.js:
// sidebar de secciones + top bar de acciones + panel de contenido.
// Las secciones se implementan iterativamente; esta vista centraliza carga,
// guardado, estado "dirty" y restablecimiento.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Image as ImageIcon,
  Droplet,
  Type,
  PanelTop,
  PanelsTopLeft,
  Lock,
  Construction,
  Code,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  THEME_DATA_DEFAULTS,
  normalizeThemeData,
  type ThemeData,
} from "@/lib/theme-options";

type SectionKey =
  | "logo"
  | "colors"
  | "typography"
  | "header"
  | "footer"
  | "auth"
  | "maintenance"
  | "customCode"
  | "gradesTable"
  | "importExport";

const SECTIONS: { key: SectionKey; label: string; icon: typeof ImageIcon }[] = [
  { key: "logo", label: "Logotipo", icon: ImageIcon },
  { key: "colors", label: "Colores", icon: Droplet },
  { key: "typography", label: "Tipografía", icon: Type },
  { key: "header", label: "Encabezado", icon: PanelTop },
  { key: "footer", label: "Pie de página", icon: PanelsTopLeft },
  { key: "auth", label: "Inicio de Sesión / Registro", icon: Lock },
  { key: "maintenance", label: "Modo de Mantenimiento", icon: Construction },
  { key: "customCode", label: "Códigos Personalizados", icon: Code },
  { key: "gradesTable", label: "Tabla Notas parciales", icon: FileSpreadsheet },
  { key: "importExport", label: "Importación / Exportación", icon: FileDown },
];

const EDITOR_ROLES = ["rector", "administrativo"];

export function ThemeOptionsView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id ?? "";
  const canEdit = useMemo(() => {
    const roles = user?.roles?.length ? user.roles : user?.role ? [user.role] : [];
    return roles.some((r) => EDITOR_ROLES.includes(r));
  }, [user]);

  const [theme, setTheme] = useState<ThemeData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState<SectionKey>("logo");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    fetch(`/api/theme-options?institutionId=${encodeURIComponent(institutionId)}`)
      .then((r) => r.json())
      .then((res) => {
        if (alive && res?.ok) setTheme(res.data as ThemeData);
      })
      .catch(() => {
        if (alive) setTheme(THEME_DATA_DEFAULTS);
      });
    return () => {
      alive = false;
    };
  }, [institutionId]);

  const updateSection = useCallback(
    <K extends Exclude<SectionKey, "importExport">>(key: K, patch: Partial<ThemeData[K]>) => {
      setTheme((prev) => (prev ? ({ ...prev, [key]: { ...prev[key], ...patch } } as ThemeData) : prev));
      setDirty(true);
    },
    []
  );

  async function handleSave() {
    if (!theme || !canEdit || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/theme-options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, userId: user?.id, data: theme }),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setTheme(json.data as ThemeData);
        setDirty(false);
        setFeedback({ ok: true, msg: "Cambios guardados correctamente." });
      } else {
        setFeedback({ ok: false, msg: json?.error ?? "No se pudo guardar." });
      }
    } catch {
      setFeedback({ ok: false, msg: "Error de red al guardar." });
    } finally {
      setSaving(false);
    }
  }

  function handleResetSection() {
    if (section === "importExport" || !theme) return;
    setTheme({ ...theme, [section]: THEME_DATA_DEFAULTS[section] } as ThemeData);
    setDirty(true);
  }

  function handleResetAll() {
    if (!window.confirm("¿Restablecer TODAS las opciones de tema a sus valores por defecto?")) return;
    setTheme(THEME_DATA_DEFAULTS);
    setDirty(true);
  }

  if (!theme) {
    return (
      <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
        Cargando opciones de tema…
      </div>
    );
  }

  const activeSection = SECTIONS.find((s) => s.key === section);

  return (
    <div className="space-y-4">
      {/* Top bar de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Opciones de Tema</h1>
          <p className="text-xs text-muted-foreground">
            Configuración global del sitio. Los valores vacíos usan el tema activo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={!dirty || saving || !canEdit}>
            <Save className="mr-2 h-4 w-4" /> Guardar Los Cambios
          </Button>
          <Button variant="outline" onClick={handleResetSection} disabled={section === "importExport" || !canEdit}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restablecer Sección
          </Button>
          <Button variant="outline" onClick={handleResetAll} disabled={!canEdit}>
            Restablecer Todos Los
          </Button>
        </div>
      </div>

      {/* Banner de cambios sin guardar */}
      {dirty && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          Settings have changed, you should save them!
        </div>
      )}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            feedback.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {feedback.msg}
        </div>
      )}
      {!canEdit && (
        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Solo rector o administrativo pueden modificar el tema.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        {/* Sidebar de secciones */}
        <Card className="h-fit">
          <CardContent className="p-1">
            <nav className="space-y-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = s.key === section;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Panel de contenido de la sección */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="text-base font-semibold">{activeSection?.label}</h2>
            {section !== "importExport" ? (
              <SectionFields section={section} theme={theme} canEdit={canEdit} updateSection={updateSection} />
            ) : (
              <ImportExportPanel theme={theme} setTheme={setTheme} setDirty={() => setDirty(true)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Placeholder tipado de secciones (se implementa por iteraciones) ─────────

type SectionUpdater = <K extends Exclude<SectionKey, "importExport">>(
  key: K,
  patch: Partial<ThemeData[K]>
) => void;

function SectionFields({
  section,
}: {
  section: SectionKey;
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      Sección <span className="font-medium text-foreground">{section}</span> en construcción.
    </div>
  );
}

// ── Importación / Exportación (UI propia, no se persiste en el tema) ────────

function ImportExportPanel({
  theme,
  setTheme,
  setDirty,
}: {
  theme: ThemeData;
  setTheme: (t: ThemeData) => void;
  setDirty: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apprende-tema-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = normalizeThemeData(String(reader.result));
        setPreview(JSON.stringify(parsed, null, 2));
      } catch {
        setPreview(null);
        window.alert("El archivo no contiene un tema válido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleExport}>
          <FileDown className="mr-2 h-4 w-4" /> Exportar tema (JSON)
        </Button>
        <label>
          <span className="cursor-pointer">
            <Button variant="outline" type="button" asChild>
              <span>Importar JSON</span>
            </Button>
          </span>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {preview && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Revise la vista previa antes de aplicar:
          </p>
          <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-3 text-xs">
            {preview}
          </pre>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setTheme(normalizeThemeData(preview));
                setDirty();
                setPreview(null);
              }}
            >
              Aplicar importación
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setPreview(null)}>Descartar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  );
}
