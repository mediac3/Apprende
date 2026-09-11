// Catálogo de tipos de campo para el constructor de módulos (estilo FluentForms)

export interface FieldOption {
  label: string;
  value: string;
}

export interface ModuleField {
  id: string;
  name: string;       // nombre interno (clave en dataJson)
  label: string;      // etiqueta visible
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  defaultValue?: any;
  options?: FieldOption[];   // para select, radio, checkbox
  min?: number;
  max?: number;
  step?: number;
  rows?: number;       // textarea
  accept?: string;     // file
  multiple?: boolean;  // file
  // Compuestos
  children?: ModuleField[];   // seccion/columna
  conditionalField?: string;  // campo condicional: visible si X = Y
  conditionalValue?: any;
  // Especiales
  formula?: string;    // expresión para campo calculado
  captchaType?: "math" | "text";
  // Académicos
  academicEntity?: "student" | "group" | "subject" | "teacher";
  width?: "full" | "half" | "third";   // ancho en el formulario
}

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "tel"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "rating"
  | "slider"
  | "color"
  | "toggle"
  | "zip"
  | "currency"
  | "mask"
  | "section"
  | "column"
  | "repeatable"
  | "conditional"
  | "student"
  | "group"
  | "subject"
  | "teacher"
  | "signature"
  | "captcha"
  | "formula"
  | "map";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;       // lucide icon name
  category: "Básicos" | "Avanzados" | "Académicos" | "Compuestos" | "Especiales";
  description: string;
  hasOptions?: boolean;
  defaultValue?: any;
}

export const FIELD_CATALOG: FieldTypeMeta[] = [
  // Básicos
  { type: "text", label: "Texto corto", icon: "Type", category: "Básicos", description: "Campo de texto de una línea." },
  { type: "textarea", label: "Texto largo", icon: "AlignLeft", category: "Básicos", description: "Párrafo multilinea." },
  { type: "number", label: "Número", icon: "Hash", category: "Básicos", description: "Campo numérico con min/max." },
  { type: "email", label: "Correo", icon: "Mail", category: "Básicos", description: "Email con validación." },
  { type: "tel", label: "Teléfono", icon: "Phone", category: "Básicos", description: "Número telefónico." },
  { type: "date", label: "Fecha", icon: "Calendar", category: "Básicos", description: "Selector de fecha." },
  { type: "select", label: "Lista desplegable", icon: "ChevronDown", category: "Básicos", description: "Selector con opciones.", hasOptions: true },
  { type: "radio", label: "Opción única", icon: "CircleDot", category: "Básicos", description: "Radio buttons.", hasOptions: true },
  { type: "checkbox", label: "Opción múltiple", icon: "CheckSquare", category: "Básicos", description: "Checkbox múltiple.", hasOptions: true },
  { type: "file", label: "Archivo", icon: "Upload", category: "Básicos", description: "Carga de archivo." },

  // Avanzados
  { type: "rating", label: "Calificación", icon: "Star", category: "Avanzados", description: "Estrellas del 1 al 5." },
  { type: "slider", label: "Deslizador", icon: "Sliders", category: "Avanzados", description: "Slider numérico." },
  { type: "color", label: "Color", icon: "Palette", category: "Avanzados", description: "Selector de color." },
  { type: "toggle", label: "Interruptor", icon: "ToggleLeft", category: "Avanzados", description: "Switch on/off." },
  { type: "zip", label: "Código postal", icon: "MapPin", category: "Avanzados", description: "Código postal validado." },
  { type: "currency", label: "Moneda", icon: "DollarSign", category: "Avanzados", description: "Valor monetario." },
  { type: "mask", label: "Máscara", icon: "Asterisk", category: "Avanzados", description: "Texto con patrón." },

  // Académicos
  { type: "student", label: "Estudiante", icon: "GraduationCap", category: "Académicos", description: "Autocompleta desde DB." },
  { type: "group", label: "Grupo", icon: "Users", category: "Académicos", description: "Selector de grupo." },
  { type: "subject", label: "Asignatura", icon: "BookOpen", category: "Académicos", description: "Selector de asignatura." },
  { type: "teacher", label: "Docente", icon: "User", category: "Académicos", description: "Selector de docente." },

  // Compuestos
  { type: "section", label: "Sección", icon: "SquareStack", category: "Compuestos", description: "Agrupa campos con título." },
  { type: "column", label: "Columna", icon: "Columns2", category: "Compuestos", description: "Layout en columnas." },
  { type: "repeatable", label: "Tabla repetible", icon: "Table", category: "Compuestos", description: "Filas dinámicas." },
  { type: "conditional", label: "Campo condicional", icon: "GitBranch", category: "Compuestos", description: "Visible si X = Y." },

  // Especiales
  { type: "signature", label: "Firma", icon: "PenTool", category: "Especiales", description: "Firma en canvas." },
  { type: "captcha", label: "Captcha", icon: "ShieldCheck", category: "Especiales", description: "Verificación humana." },
  { type: "formula", label: "Campo calculado", icon: "Calculator", category: "Especiales", description: "Resultado de fórmula." },
  { type: "map", label: "Ubicación", icon: "Map", category: "Especiales", description: "Selector de ubicación." },
];

export function createField(type: FieldType, index: number): ModuleField {
  const meta = FIELD_CATALOG.find((f) => f.type === type)!;
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const base: ModuleField = {
    id,
    name: `${type}_${index}`,
    label: meta.label,
    type,
    required: false,
    width: "full",
  };
  if (meta.hasOptions) {
    base.options = [
      { label: "Opción 1", value: "opcion_1" },
      { label: "Opción 2", value: "opcion_2" },
    ];
  }
  if (type === "rating") base.max = 5;
  if (type === "slider") { base.min = 0; base.max = 100; base.step = 1; }
  if (type === "textarea") base.rows = 4;
  if (type === "captcha") base.captchaType = "math";
  if (type === "section" || type === "column") base.children = [];
  if (type === "conditional") { base.conditionalField = ""; base.conditionalValue = ""; }
  if (type === "formula") base.formula = "";
  return base;
}

export const FIELD_CATEGORIES = ["Básicos", "Avanzados", "Académicos", "Compuestos", "Especiales"] as const;
