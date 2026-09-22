import { z } from "zod";

// [theme-options] Tipos, defaults y normalización de la configuración del tema.
// Regla dura: TODO campo tiene default → normalizeThemeData() jamás devuelve
// estructuras incompletas, por lo que un tema vacío no puede romper el layout.
// Convención: string vacío "" = "sin override" (se usa el valor del tema activo).

// ── Primitivos ──────────────────────────────────────────────────────────────

/** Color hex válido o "" (sin override). */
const hexColor = z
  .string()
  .max(9)
  .regex(/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|)$/)
  .catch("");

const colorPairSchema = z
  .object({ bg: hexColor, text: hexColor })
  .default({ bg: "", text: "" });

const btnStateSchema = z
  .object({ bg: hexColor, border: hexColor, text: hexColor })
  .default({ bg: "", border: "", text: "" });

const btnPairSchema = z
  .object({ regular: btnStateSchema, hover: btnStateSchema })
  .default({
    regular: { bg: "", border: "", text: "" },
    hover: { bg: "", border: "", text: "" },
  });

/** dataURL de imagen (logo / imagen de mantenimiento) o "". Límite ~400KB binario. */
const imageDataUrl = z
  .string()
  .max(560_000)
  .regex(/^(data:image\/(png|jpe?g|webp|svg\+xml);base64,)?/)
  .catch("");

// ── Secciones ───────────────────────────────────────────────────────────────

const logoSchema = z
  .object({
    enabled: z.boolean().catch(false),
    dataUrl: imageDataUrl,
    width: z.number().int().min(20).max(600).catch(280),
    height: z.number().int().min(20).max(200).catch(80),
    margin: z.number().int().min(0).max(48).catch(0),
  })
  .catch({
    enabled: false,
    dataUrl: "",
    width: 280,
    height: 80,
    margin: 0,
  });

const colorsSchema = z
  .object({
    primary: hexColor,
    bg: hexColor,
    contentBg: hexColor,
    altBg: hexColor,
    border: hexColor,
    link: hexColor,
    linkHover: hexColor,
    bodyText: hexColor,
    altText: hexColor,
    btnPrimary: btnPairSchema,
    btnSecondary: btnPairSchema,
    header: z
      .object({
        bg: hexColor,
        altBg: hexColor,
        text: hexColor,
        link: hexColor,
        linkHover: hexColor,
      })
      .catch({ bg: "", altBg: "", text: "", link: "", linkHover: "" }),
  })
  .catch({
    primary: "",
    bg: "",
    contentBg: "",
    altBg: "",
    border: "",
    link: "",
    linkHover: "",
    bodyText: "",
    altText: "",
    btnPrimary: {
      regular: { bg: "", border: "", text: "" },
      hover: { bg: "", border: "", text: "" },
    },
    btnSecondary: {
      regular: { bg: "", border: "", text: "" },
      hover: { bg: "", border: "", text: "" },
    },
    header: { bg: "", altBg: "", text: "", link: "", linkHover: "" },
  });

const fontSpecSchema = z
  .object({
    family: z.string().max(200).catch(""),
    weight: z.number().int().min(100).max(900).catch(400),
    size: z.number().int().min(8).max(120).catch(16),
  })
  .catch({ family: "", weight: 400, size: 16 });

const typographySchema = z
  .object({
    enabled: z.boolean().catch(false),
    siteTitle: fontSpecSchema,
    body: fontSpecSchema,
    h1: fontSpecSchema,
    h2: fontSpecSchema,
    h3: fontSpecSchema,
    h4: fontSpecSchema,
    h5: fontSpecSchema,
    h6: fontSpecSchema,
  })
  .catch({
    enabled: false,
    siteTitle: { family: "", weight: 500, size: 50 },
    body: { family: "", weight: 400, size: 16 },
    h1: { family: "", weight: 400, size: 44 },
    h2: { family: "", weight: 400, size: 34 },
    h3: { family: "", weight: 400, size: 20 },
    h4: { family: "", weight: 400, size: 18 },
    h5: { family: "", weight: 400, size: 16 },
    h6: { family: "", weight: 500, size: 12 },
  });

const headerComponentsSchema = z
  .object({
    search: z.boolean().catch(true),
    messages: z.boolean().catch(true),
    notifications: z.boolean().catch(true),
    cart: z.boolean().catch(false),
  })
  .catch({ search: true, messages: true, notifications: true, cart: false });

const headerSchema = z
  .object({
    style: z.enum(["expanded", "menuBar"]).catch("expanded"),
    sticky: z.boolean().catch(true),
    height: z.number().int().min(60).max(200).catch(76),
    shadow: z.boolean().catch(true),
    components: headerComponentsSchema,
    mobileComponents: headerComponentsSchema,
    profileStyle: z.enum(["nameAvatar", "avatarOnly", "off"]).catch("nameAvatar"),
  })
  .catch({
    style: "expanded",
    sticky: true,
    height: 76,
    shadow: true,
    components: { search: true, messages: true, notifications: true, cart: false },
    mobileComponents: { search: true, messages: true, notifications: true, cart: false },
    profileStyle: "nameAvatar",
  });

const socialLinksSchema = z
  .object({
    facebook: z.string().max(500).catch(""),
    instagram: z.string().max(500).catch(""),
    x: z.string().max(500).catch(""),
    youtube: z.string().max(500).catch(""),
    linkedin: z.string().max(500).catch(""),
    tiktok: z.string().max(500).catch(""),
    whatsapp: z.string().max(500).catch(""),
    github: z.string().max(500).catch(""),
  })
  .catch({
    facebook: "",
    instagram: "",
    x: "",
    youtube: "",
    linkedin: "",
    tiktok: "",
    whatsapp: "",
    github: "",
  });

const footerSchema = z
  .object({
    copyright: z.string().max(500).catch(""),
    social: socialLinksSchema,
    widgets: z
      .object({
        columns: z.boolean().catch(false),
        infoSection: z.boolean().catch(true),
        style: z.enum(["default", "centered"]).catch("default"),
      })
      .catch({ columns: false, infoSection: true, style: "default" }),
  })
  .catch({
    copyright: "© {year} · Todos los derechos reservados",
    social: {
      facebook: "",
      instagram: "",
      x: "",
      youtube: "",
      linkedin: "",
      tiktok: "",
      whatsapp: "",
      github: "",
    },
    widgets: { columns: false, infoSection: true, style: "default" },
  });

const authSchema = z
  .object({
    bg: hexColor,
    text: hexColor,
    link: hexColor,
    linkHover: hexColor,
    border: hexColor,
    btnPrimary: btnPairSchema,
    btnSecondary: btnPairSchema,
  })
  .catch({
    bg: "",
    text: "",
    link: "",
    linkHover: "",
    border: "",
    btnPrimary: {
      regular: { bg: "", border: "", text: "" },
      hover: { bg: "", border: "", text: "" },
    },
    btnSecondary: {
      regular: { bg: "", border: "", text: "" },
      hover: { bg: "", border: "", text: "" },
    },
  });

const maintenanceSchema = z
  .object({
    enabled: z.boolean().catch(false),
    title: z.string().max(300).catch(""),
    description: z.string().max(5000).catch(""),
    imageDataUrl: imageDataUrl,
    bottomText: z.string().max(5000).catch(""),
    countdownEnabled: z.boolean().catch(false),
    countdownTarget: z.string().max(40).catch(""), // ISO date
    showSocial: z.boolean().catch(false),
  })
  .catch({
    enabled: false,
    title: "",
    description: "",
    imageDataUrl: "",
    bottomText: "",
    countdownEnabled: false,
    countdownTarget: "",
    showSocial: false,
  });

const customCodeSchema = z
  .object({
    enabled: z.boolean().catch(false),
    css: z.string().max(100_000).catch(""),
    js: z.string().max(100_000).catch(""),
    headCode: z.string().max(50_000).catch(""),
  })
  .catch({ enabled: false, css: "", js: "", headCode: "" });

// ── Tabla "Notas parciales" ─────────────────────────────────────────────────

export const GRADES_TABLE_DEFAULTS = {
  concepts: {
    ser: { bg: "#EA580C", text: "#FFFFFF" },
    saber: { bg: "#7C3AED", text: "#FFFFFF" },
    hacer: { bg: "#0EA5E9", text: "#FFFFFF" },
    autoevaluacion: { bg: "#16A34A", text: "#FFFFFF" },
  },
  headerFontSize: 13,
  cellFontSize: 13,
  studentColFontSize: 13,
  rowDensity: "normal",
  headerHeight: 40,
  minColumnWidth: 180,
  conditionalNotes: false,
  lowThreshold: 3.0,
  lowColor: "#DC2626",
  highColor: "#16A34A",
  promBg: "#E0F2FE",
  defBg: "#DCFCE7",
  headerTextColor: "#FFFFFF",
} as const;

const gradesTableSchema = z
  .object({
    concepts: z
      .object({
        ser: colorPairSchema,
        saber: colorPairSchema,
        hacer: colorPairSchema,
        autoevaluacion: colorPairSchema,
      })
      .catch({
        ser: { bg: GRADES_TABLE_DEFAULTS.concepts.ser.bg, text: GRADES_TABLE_DEFAULTS.concepts.ser.text },
        saber: { bg: GRADES_TABLE_DEFAULTS.concepts.saber.bg, text: GRADES_TABLE_DEFAULTS.concepts.saber.text },
        hacer: { bg: GRADES_TABLE_DEFAULTS.concepts.hacer.bg, text: GRADES_TABLE_DEFAULTS.concepts.hacer.text },
        autoevaluacion: {
          bg: GRADES_TABLE_DEFAULTS.concepts.autoevaluacion.bg,
          text: GRADES_TABLE_DEFAULTS.concepts.autoevaluacion.text,
        },
      }),
    headerFontSize: z.number().int().min(9).max(24).catch(GRADES_TABLE_DEFAULTS.headerFontSize),
    cellFontSize: z.number().int().min(9).max(24).catch(GRADES_TABLE_DEFAULTS.cellFontSize),
    studentColFontSize: z.number().int().min(9).max(24).catch(GRADES_TABLE_DEFAULTS.studentColFontSize),
    rowDensity: z.enum(["compact", "normal", "comfortable"]).catch("normal"),
    headerHeight: z.number().int().min(28).max(80).catch(GRADES_TABLE_DEFAULTS.headerHeight),
    minColumnWidth: z.number().int().min(60).max(400).catch(GRADES_TABLE_DEFAULTS.minColumnWidth),
    conditionalNotes: z.boolean().catch(GRADES_TABLE_DEFAULTS.conditionalNotes),
    lowThreshold: z.number().min(0).max(10).catch(GRADES_TABLE_DEFAULTS.lowThreshold),
    lowColor: hexColor,
    highColor: hexColor,
    promBg: hexColor,
    defBg: hexColor,
    headerTextColor: hexColor,
  })
  .catch({
    concepts: {
      ser: { bg: GRADES_TABLE_DEFAULTS.concepts.ser.bg, text: GRADES_TABLE_DEFAULTS.concepts.ser.text },
      saber: { bg: GRADES_TABLE_DEFAULTS.concepts.saber.bg, text: GRADES_TABLE_DEFAULTS.concepts.saber.text },
      hacer: { bg: GRADES_TABLE_DEFAULTS.concepts.hacer.bg, text: GRADES_TABLE_DEFAULTS.concepts.hacer.text },
      autoevaluacion: {
        bg: GRADES_TABLE_DEFAULTS.concepts.autoevaluacion.bg,
        text: GRADES_TABLE_DEFAULTS.concepts.autoevaluacion.text,
      },
    },
    headerFontSize: GRADES_TABLE_DEFAULTS.headerFontSize,
    cellFontSize: GRADES_TABLE_DEFAULTS.cellFontSize,
    studentColFontSize: GRADES_TABLE_DEFAULTS.studentColFontSize,
    rowDensity: "normal" as const,
    headerHeight: GRADES_TABLE_DEFAULTS.headerHeight,
    minColumnWidth: GRADES_TABLE_DEFAULTS.minColumnWidth,
    conditionalNotes: GRADES_TABLE_DEFAULTS.conditionalNotes,
    lowThreshold: GRADES_TABLE_DEFAULTS.lowThreshold,
    lowColor: GRADES_TABLE_DEFAULTS.lowColor,
    highColor: GRADES_TABLE_DEFAULTS.highColor,
    promBg: GRADES_TABLE_DEFAULTS.promBg,
    defBg: GRADES_TABLE_DEFAULTS.defBg,
    headerTextColor: GRADES_TABLE_DEFAULTS.headerTextColor,
  });

// ── Raíz ────────────────────────────────────────────────────────────────────

export const themeDataSchema = z.object({
  v: z.number().int().min(1).catch(1),
  logo: logoSchema,
  colors: colorsSchema,
  typography: typographySchema,
  header: headerSchema,
  footer: footerSchema,
  auth: authSchema,
  maintenance: maintenanceSchema,
  customCode: customCodeSchema,
  gradesTable: gradesTableSchema,
});

export type ThemeData = z.infer<typeof themeDataSchema>;

/** Defaults completos, derivados del propio schema (fuente única de verdad). */
export const THEME_DATA_DEFAULTS: ThemeData = themeDataSchema.parse({});

/**
 * Normaliza cualquier entrada (JSON string, null, basura) a un ThemeData válido.
 * Nunca lanza: los campos invasiles se reemplazan por defaults vía .catch().
 */
export function normalizeThemeData(raw: string | null | undefined): ThemeData {
  if (!raw) return THEME_DATA_DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return themeDataSchema.parse(parsed);
  } catch {
    return THEME_DATA_DEFAULTS;
  }
}

/** Serializa para persistir en ThemeOptions.data. */
export function serializeThemeData(data: ThemeData): string {
  return JSON.stringify(themeDataSchema.parse(data));
}

/** Reemplaza el shortcode {year} por el año actual (usado en copyright del footer). */
export function renderShortcodes(text: string): string {
  return text.replaceAll("{year}", String(new Date().getFullYear()));
}
