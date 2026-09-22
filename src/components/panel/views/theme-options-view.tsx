"use client";

// [theme-options] Vista del módulo "Opciones de Tema".
// Estructura inspirada en el panel de referencia (BuddyBoss) adaptada a Next.js:
// sidebar de secciones + top bar de acciones + panel de contenido.
// Las secciones se implementan iterativamente; esta vista centraliza carga,
// guardado, estado "dirty" y restablecimiento.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HexColorPicker } from "react-colorful";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// ── Campos compartidos ──────────────────────────────────────────────────────

type SectionUpdater = <K extends Exclude<SectionKey, "importExport">>(
  key: K,
  patch: Partial<ThemeData[K]>
) => void;

const HEX_RE = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})?)?$/;

/** Campo de color: hex input + picker visual (react-colorful) + limpiar. "" = sin override. */
function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Picker ${label}`}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="h-8 w-10 shrink-0 rounded-md border border-input shadow-sm"
          style={{ background: value || "repeating-linear-gradient(45deg,#eee,#eee 4px,#fafafa 4px,#fafafa 8px)" }}
        />
        <Input
          value={value}
          disabled={disabled}
          placeholder="#RRGGBB"
          className="h-8 w-32 font-mono text-xs"
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || HEX_RE.test(v)) onChange(v);
          }}
        />
        {value !== "" && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={() => onChange("")}>
            Limpiar
          </Button>
        )}
      </div>
      {open && !disabled && (
        <div className="space-y-1 rounded-md border bg-popover p-2 shadow-md w-fit">
          <HexColorPicker color={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2F4A6D"} onChange={(c) => onChange(c)} />
          <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {suffix && <span className="text-muted-foreground">({suffix})</span>}
      </Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-8 w-24 text-xs"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

// ── Sección: Logotipo ───────────────────────────────────────────────────────

const LOGO_MAX_BYTES = 400 * 1024;

function LogoSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const logo = theme.logo;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setError("Formato no permitido. Usa PNG, JPG, WEBP o SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError("La imagen supera 400KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (!dataUrl.startsWith("data:image/")) {
        setError("No se pudo leer la imagen.");
        return;
      }
      updateSection("logo", { dataUrl, enabled: true });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Logo de escritorio</p>
          <p className="text-xs text-muted-foreground">Sube tu logotipo personalizado para el diseño de escritorio (280×80 px recomendado).</p>
        </div>
        <Switch checked={logo.enabled} disabled={!canEdit} onCheckedChange={(v) => updateSection("logo", { enabled: v })} />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-24 w-56 items-center justify-center rounded-md border bg-muted/40 p-2">
          {logo.dataUrl ? (
            <img src={logo.dataUrl} alt="Logo" style={{ maxHeight: 80, maxWidth: 200 }} />
          ) : (
            <span className="text-xs text-muted-foreground">Sin logo</span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEdit || !logo.dataUrl}
              onClick={() => updateSection("logo", { dataUrl: "", enabled: false })}
            >
              Remove
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <NumberField label="Ancho" suffix="px" value={logo.width} min={20} max={600} disabled={!canEdit} onChange={(v) => updateSection("logo", { width: v })} />
        <NumberField label="Alto" suffix="px" value={logo.height} min={20} max={200} disabled={!canEdit} onChange={(v) => updateSection("logo", { height: v })} />
        <NumberField label="Margen" suffix="px" value={logo.margin} min={0} max={48} disabled={!canEdit} onChange={(v) => updateSection("logo", { margin: v })} />
      </div>
    </div>
  );
}

// ── Sección: Colores ────────────────────────────────────────────────────────

type BtnPair = ThemeData["colors"]["btnPrimary"];

/** Tarjeta de par Regular/Hover (fondo, borde, texto) reutilizada por Colores y Acceso. */
function BtnPairCard({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: BtnPair;
  disabled: boolean;
  onChange: (next: BtnPair) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      {(["regular", "hover"] as const).map((state) => (
        <div key={state} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground capitalize">{state}</p>
          <div className="flex flex-wrap gap-4">
            <ColorField label="Fondo" value={value[state].bg} disabled={disabled} onChange={(v) => onChange({ ...value, [state]: { ...value[state], bg: v } })} />
            <ColorField label="Borde" value={value[state].border} disabled={disabled} onChange={(v) => onChange({ ...value, [state]: { ...value[state], border: v } })} />
            <ColorField label="Texto" value={value[state].text} disabled={disabled} onChange={(v) => onChange({ ...value, [state]: { ...value[state], text: v } })} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorsSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const c = theme.colors;
  const set = (patch: Partial<ThemeData["colors"]>) => updateSection("colors", patch);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Paleta general</p>
        <div className="flex flex-wrap gap-4">
          <ColorField label="Color primario" value={c.primary} disabled={!canEdit} onChange={(v) => set({ primary: v })} />
          <ColorField label="Color de fondo" value={c.bg} disabled={!canEdit} onChange={(v) => set({ bg: v })} />
          <ColorField label="Contenido de fondo" value={c.contentBg} disabled={!canEdit} onChange={(v) => set({ contentBg: v })} />
          <ColorField label="Contenido alternativo de fondo" value={c.altBg} disabled={!canEdit} onChange={(v) => set({ altBg: v })} />
          <ColorField label="Color de borde" value={c.border} disabled={!canEdit} onChange={(v) => set({ border: v })} />
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Enlaces y texto</p>
        <div className="flex flex-wrap gap-4">
          <ColorField label="Enlace" value={c.link} disabled={!canEdit} onChange={(v) => set({ link: v })} />
          <ColorField label="Enlace hover" value={c.linkHover} disabled={!canEdit} onChange={(v) => set({ linkHover: v })} />
          <ColorField label="Texto de cuerpo" value={c.bodyText} disabled={!canEdit} onChange={(v) => set({ bodyText: v })} />
          <ColorField label="Texto alternativo" value={c.altText} disabled={!canEdit} onChange={(v) => set({ altText: v })} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BtnPairCard title="Botón primario" value={c.btnPrimary} disabled={!canEdit} onChange={(patch) => set({ btnPrimary: patch })} />
        <BtnPairCard title="Botón secundario" value={c.btnSecondary} disabled={!canEdit} onChange={(patch) => set({ btnSecondary: patch })} />
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Encabezado</p>
        <div className="flex flex-wrap gap-4">
          <ColorField label="Fondo" value={c.header.bg} disabled={!canEdit} onChange={(v) => set({ header: { ...c.header, bg: v } })} />
          <ColorField label="Fondo alternativo" value={c.header.altBg} disabled={!canEdit} onChange={(v) => set({ header: { ...c.header, altBg: v } })} />
          <ColorField label="Texto" value={c.header.text} disabled={!canEdit} onChange={(v) => set({ header: { ...c.header, text: v } })} />
          <ColorField label="Enlace" value={c.header.link} disabled={!canEdit} onChange={(v) => set({ header: { ...c.header, link: v } })} />
          <ColorField label="Enlace hover" value={c.header.linkHover} disabled={!canEdit} onChange={(v) => set({ header: { ...c.header, linkHover: v } })} />
        </div>
      </div>
    </div>
  );
}

// ── Sección: Tipografía ─────────────────────────────────────────────────────

const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800] as const;

function FontSpecFields({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: ThemeData["typography"]["h1"];
  disabled: boolean;
  onChange: (patch: Partial<ThemeData["typography"]["h1"]>) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Familia</Label>
          <Input
            value={value.family}
            disabled={disabled}
            placeholder="Ej. 'Segoe UI', sans-serif"
            className="h-8 w-56 font-mono text-xs"
            onChange={(e) => onChange({ family: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Peso y estilo</Label>
          <Select value={String(value.weight)} disabled={disabled} onValueChange={(v) => onChange({ weight: Number(v) })}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NumberField label="Tamaño" suffix="px" value={value.size} min={8} max={120} disabled={disabled} onChange={(v) => onChange({ size: v })} />
      </div>
    </div>
  );
}

function TypographySection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const t = theme.typography;
  const set = (patch: Partial<ThemeData["typography"]>) => updateSection("typography", patch);
  const specs: { key: keyof ThemeData["typography"]; title: string }[] = [
    { key: "siteTitle", title: "Título del sitio" },
    { key: "body", title: "Fuente de cuerpo" },
    { key: "h1", title: "H1" },
    { key: "h2", title: "H2" },
    { key: "h3", title: "H3" },
    { key: "h4", title: "H4" },
    { key: "h5", title: "H5" },
    { key: "h6", title: "H6" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Personalización de tipografía</p>
          <p className="text-xs text-muted-foreground">Habilita valores personalizados por nivel. Vacío = tema activo.</p>
        </div>
        <Switch checked={t.enabled} disabled={!canEdit} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      {specs.map(({ key, title }) => (
        <FontSpecFields
          key={key}
          title={title}
          value={t[key] as ThemeData["typography"]["h1"]}
          disabled={!canEdit}
          onChange={(patch) => set({ [key]: { ...(t[key] as object), ...patch } } as Partial<ThemeData["typography"]>)}
        />
      ))}
    </div>
  );
}

// ── Sección: Encabezado ─────────────────────────────────────────────────────

const HEADER_COMPONENTS: { key: keyof ThemeData["header"]["components"]; label: string }[] = [
  { key: "search", label: "Búsqueda" },
  { key: "messages", label: "Mensajes" },
  { key: "notifications", label: "Notificaciones" },
  { key: "cart", label: "Carrito de compras" },
];

function HeaderSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const h = theme.header;
  const set = (patch: Partial<ThemeData["header"]>) => updateSection("header", patch);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-md border p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Estilo del menú</Label>
          <Select value={h.style} disabled={!canEdit} onValueChange={(v) => set({ style: v as ThemeData["header"]["style"] })}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expanded">Expandido</SelectItem>
              <SelectItem value="menuBar">Ficha de la barra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Perfil desplegable</Label>
          <Select value={h.profileStyle} disabled={!canEdit} onValueChange={(v) => set({ profileStyle: v as ThemeData["header"]["profileStyle"] })}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nameAvatar">Nombre y avatar</SelectItem>
              <SelectItem value="avatarOnly">Avatar solo</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Componentes (escritorio)</p>
        <div className="flex flex-wrap gap-4">
          {HEADER_COMPONENTS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Switch checked={h.components[key]} disabled={!canEdit} onCheckedChange={(v) => set({ components: { ...h.components, [key]: v } })} />
              <Label className="text-xs">{label}</Label>
            </div>
          ))}
        </div>
        <p className="text-sm font-medium">Componentes (móvil)</p>
        <div className="flex flex-wrap gap-4">
          {HEADER_COMPONENTS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Switch checked={h.mobileComponents[key]} disabled={!canEdit} onCheckedChange={(v) => set({ mobileComponents: { ...h.mobileComponents, [key]: v } })} />
              <Label className="text-xs">{label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Switch checked={h.sticky} disabled={!canEdit} onCheckedChange={(v) => set({ sticky: v })} />
          <Label className="text-xs">Sticky header</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={h.shadow} disabled={!canEdit} onCheckedChange={(v) => set({ shadow: v })} />
          <Label className="text-xs">Sombra del encabezado</Label>
        </div>
        <div className="min-w-52 flex-1 space-y-1.5">
          <Label className="text-xs">
            Altura del encabezado <span className="text-muted-foreground">({h.height}px, entre 60 y 200)</span>
          </Label>
          <Slider
            value={[h.height]}
            min={60}
            max={200}
            step={1}
            disabled={!canEdit}
            onValueChange={([v]) => set({ height: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sección: Pie de página ──────────────────────────────────────────────────

const SOCIAL_KEYS: { key: keyof ThemeData["footer"]["social"]; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "Twitter / X" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "github", label: "Github" },
];

function FooterSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const f = theme.footer;
  const set = (patch: Partial<ThemeData["footer"]>) => updateSection("footer", patch);
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-xs">Aviso de derechos de autor</Label>
        <Input
          value={f.copyright}
          disabled={!canEdit}
          placeholder="© {year} · Nombre de la institución"
          onChange={(e) => set({ copyright: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Vista previa: <span className="font-medium text-foreground">{f.copyright.replaceAll("{year}", String(new Date().getFullYear()))}</span>
        </p>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Vínculos sociales</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_KEYS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input
                value={f.social[key]}
                disabled={!canEdit}
                placeholder="https://…"
                className="h-8 text-xs"
                onChange={(e) => set({ social: { ...f.social, [key]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Widgets</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={f.widgets.columns} disabled={!canEdit} onCheckedChange={(v) => set({ widgets: { ...f.widgets, columns: v } })} />
            <Label className="text-xs">Columnas de widgets</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={f.widgets.infoSection} disabled={!canEdit} onCheckedChange={(v) => set({ widgets: { ...f.widgets, infoSection: v } })} />
            <Label className="text-xs">Sección info</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estilo</Label>
            <Select value={f.widgets.style} disabled={!canEdit} onValueChange={(v) => set({ widgets: { ...f.widgets, style: v as ThemeData["footer"]["widgets"]["style"] } })}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Predeterminado</SelectItem>
                <SelectItem value="centered">Centrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sección: Inicio de Sesión / Registro ────────────────────────────────────

function AuthSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const a = theme.auth;
  const set = (patch: Partial<ThemeData["auth"]>) => updateSection("auth", patch);
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Paleta de la pantalla de acceso</p>
        <div className="flex flex-wrap gap-4">
          <ColorField label="Fondo" value={a.bg} disabled={!canEdit} onChange={(v) => set({ bg: v })} />
          <ColorField label="Texto" value={a.text} disabled={!canEdit} onChange={(v) => set({ text: v })} />
          <ColorField label="Enlace" value={a.link} disabled={!canEdit} onChange={(v) => set({ link: v })} />
          <ColorField label="Enlace hover" value={a.linkHover} disabled={!canEdit} onChange={(v) => set({ linkHover: v })} />
          <ColorField label="Borde" value={a.border} disabled={!canEdit} onChange={(v) => set({ border: v })} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BtnPairCard
          title="Botón primario"
          value={a.btnPrimary}
          disabled={!canEdit}
          onChange={(patch) => set({ btnPrimary: patch })}
        />
        <BtnPairCard
          title="Botón secundario"
          value={a.btnSecondary}
          disabled={!canEdit}
          onChange={(patch) => set({ btnSecondary: patch })}
        />
      </div>
    </div>
  );
}

// ── Sección: Modo de Mantenimiento ──────────────────────────────────────────

function MaintenanceSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const m = theme.maintenance;
  const set = (patch: Partial<ThemeData["maintenance"]>) => updateSection("maintenance", patch);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setError("Formato no permitido. Usa PNG, JPG, WEBP o SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError("La imagen supera 400KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (!dataUrl.startsWith("data:image/")) {
        setError("No se pudo leer la imagen.");
        return;
      }
      set({ imageDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Activar modo de mantenimiento</p>
          <p className="text-xs text-muted-foreground">Muestra una página de mantenimiento a usuarios no administradores.</p>
        </div>
        <Switch checked={m.enabled} disabled={!canEdit} onCheckedChange={(v) => set({ enabled: v })} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Título</Label>
          <Input value={m.title} disabled={!canEdit} className="h-8 text-xs" onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Texto de abajo</Label>
          <Input value={m.bottomText} disabled={!canEdit} className="h-8 text-xs" onChange={(e) => set({ bottomText: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descripción</Label>
        <Textarea value={m.description} disabled={!canEdit} rows={3} className="text-xs" onChange={(e) => set({ description: e.target.value })} />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Imagen destacada</p>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-20 w-40 items-center justify-center rounded-md border bg-muted/40 p-2">
            {m.imageDataUrl ? (
              <img src={m.imageDataUrl} alt="Mantenimiento" style={{ maxHeight: 64, maxWidth: 140 }} />
            ) : (
              <span className="text-xs text-muted-foreground">Sin imagen</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => fileRef.current?.click()}>
                Upload
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!canEdit || !m.imageDataUrl} onClick={() => set({ imageDataUrl: "" })}>
                Remove
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Switch checked={m.countdownEnabled} disabled={!canEdit} onCheckedChange={(v) => set({ countdownEnabled: v })} />
          <Label className="text-xs">Countdown</Label>
        </div>
        {m.countdownEnabled && (
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha objetivo</Label>
            <Input
              type="datetime-local"
              value={m.countdownTarget}
              disabled={!canEdit}
              className="h-8 text-xs"
              onChange={(e) => set({ countdownTarget: e.target.value })}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={m.showSocial} disabled={!canEdit} onCheckedChange={(v) => set({ showSocial: v })} />
          <Label className="text-xs">Mostrar redes sociales</Label>
        </div>
      </div>
    </div>
  );
}

// ── Sección: Códigos Personalizados ─────────────────────────────────────────

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md border bg-muted" />,
});

function CustomCodeSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const cc = theme.customCode;
  const set = (patch: Partial<ThemeData["customCode"]>) => updateSection("customCode", patch);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Activar códigos personalizados</p>
          <p className="text-xs text-muted-foreground">
            El CSS/JS se inyecta en el sitio público. Solo debe editarlo personal administrativo.
          </p>
        </div>
        <Switch checked={cc.enabled} disabled={!canEdit} onCheckedChange={(v) => set({ enabled: v })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">CSS personalizado</Label>
        <CodeMirror
          value={cc.css}
          height="200px"
          theme="light"
          editable={canEdit}
          onChange={(v: string) => set({ css: v.slice(0, 100_000) })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">JavaScript personalizado</Label>
        <CodeMirror
          value={cc.js}
          height="200px"
          theme="light"
          editable={canEdit}
          onChange={(v: string) => set({ js: v.slice(0, 100_000) })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Código de seguimiento (head)</Label>
        <CodeMirror
          value={cc.headCode}
          height="140px"
          theme="light"
          editable={canEdit}
          onChange={(v: string) => set({ headCode: v.slice(0, 50_000) })}
        />
      </div>
    </div>
  );
}

// ── Sección: Tabla "Notas parciales" ────────────────────────────────────────

const GRADE_CONCEPTS: { key: keyof ThemeData["gradesTable"]["concepts"]; label: string }[] = [
  { key: "ser", label: "Ser" },
  { key: "saber", label: "Saber" },
  { key: "hacer", label: "Hacer" },
  { key: "autoevaluacion", label: "Autoevaluación" },
];

const ROW_DENSITY_HEIGHT: Record<ThemeData["gradesTable"]["rowDensity"], number> = {
  compact: 32,
  normal: 40,
  comfortable: 52,
};

function GradesTableSection({
  theme,
  canEdit,
  updateSection,
}: {
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  const g = theme.gradesTable;
  const set = (patch: Partial<ThemeData["gradesTable"]>) => updateSection("gradesTable", patch);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Colores de header por concepto</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GRADE_CONCEPTS.map(({ key, label }) => (
            <div key={key} className="space-y-2 rounded-md border p-2" style={{ background: g.concepts[key].bg || undefined }}>
              <p className="text-sm font-semibold" style={{ color: g.concepts[key].text || undefined }}>
                {label}
              </p>
              <ColorField label="Fondo" value={g.concepts[key].bg} disabled={!canEdit} onChange={(v) => set({ concepts: { ...g.concepts, [key]: { ...g.concepts[key], bg: v } } })} />
              <ColorField label="Texto" value={g.concepts[key].text} disabled={!canEdit} onChange={(v) => set({ concepts: { ...g.concepts, [key]: { ...g.concepts[key], text: v } } })} />
            </div>
          ))}
        </div>
        <ColorField label="Color de texto general del header" value={g.headerTextColor} disabled={!canEdit} onChange={(v) => set({ headerTextColor: v })} />
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Tamaños y densidad</p>
        <div className="flex flex-wrap gap-4">
          <NumberField label="Fuente del header" suffix="px" value={g.headerFontSize} min={9} max={24} disabled={!canEdit} onChange={(v) => set({ headerFontSize: v })} />
          <NumberField label="Fuente de celda" suffix="px" value={g.cellFontSize} min={9} max={24} disabled={!canEdit} onChange={(v) => set({ cellFontSize: v })} />
          <NumberField label="Fuente columna estudiante" suffix="px" value={g.studentColFontSize} min={9} max={24} disabled={!canEdit} onChange={(v) => set({ studentColFontSize: v })} />
          <NumberField label="Alto del header" suffix="px" value={g.headerHeight} min={28} max={80} disabled={!canEdit} onChange={(v) => set({ headerHeight: v })} />
          <NumberField label="Ancho mínimo por columna de concepto" suffix="px" value={g.minColumnWidth} min={60} max={400} disabled={!canEdit} onChange={(v) => set({ minColumnWidth: v })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Densidad de fila <span className="text-muted-foreground">(alto ≈ {ROW_DENSITY_HEIGHT[g.rowDensity]}px)</span>
          </Label>
          <Select value={g.rowDensity} disabled={!canEdit} onValueChange={(v) => set({ rowDensity: v as ThemeData["gradesTable"]["rowDensity"] })}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compacta</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="comfortable">Cómoda</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Fondos de columnas PROM y DEF</p>
        <div className="flex flex-wrap gap-4">
          <ColorField label="Fondo PROM" value={g.promBg} disabled={!canEdit} onChange={(v) => set({ promBg: v })} />
          <ColorField label="Fondo DEF" value={g.defBg} disabled={!canEdit} onChange={(v) => set({ defBg: v })} />
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Switch checked={g.conditionalNotes} disabled={!canEdit} onCheckedChange={(v) => set({ conditionalNotes: v })} />
          <p className="text-sm font-medium">Colores condicionales de nota</p>
        </div>
        {g.conditionalNotes && (
          <div className="flex flex-wrap gap-4">
            <NumberField label="Umbral bajo" value={g.lowThreshold} min={0} max={10} step={0.1} disabled={!canEdit} onChange={(v) => set({ lowThreshold: v })} />
            <ColorField label="Bajo umbral" value={g.lowColor} disabled={!canEdit} onChange={(v) => set({ lowColor: v })} />
            <ColorField label="Sobre umbral" value={g.highColor} disabled={!canEdit} onChange={(v) => set({ highColor: v })} />
            <p className="self-end text-xs text-muted-foreground">
              Notas &lt; {g.lowThreshold} en rojo; ≥ {g.lowThreshold} en verde.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Despachador de secciones ────────────────────────────────────────────────

function SectionFields({
  section,
  theme,
  canEdit,
  updateSection,
}: {
  section: SectionKey;
  theme: ThemeData;
  canEdit: boolean;
  updateSection: SectionUpdater;
}) {
  switch (section) {
    case "logo":
      return <LogoSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "colors":
      return <ColorsSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "typography":
      return <TypographySection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "header":
      return <HeaderSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "footer":
      return <FooterSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "auth":
      return <AuthSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "maintenance":
      return <MaintenanceSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "customCode":
      return <CustomCodeSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    case "gradesTable":
      return <GradesTableSection theme={theme} canEdit={canEdit} updateSection={updateSection} />;
    default:
      return (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Sección <span className="font-medium text-foreground">{section}</span> en construcción.
        </div>
      );
  }
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
