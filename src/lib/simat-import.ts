// Librería de importación SIMAT [F3] — compartida entre el wizard (cliente)
// y el API /api/students/import (servidor).
// Incluye: diccionario de sinónimos columna→campo, normalización de encabezados
// (minúsculas, sin tildes, sin _/espacios) y normalizadores de valor del SIMAT real.

export type SimatField =
  | "documentType" | "documentNumber" | "lastName1" | "lastName2"
  | "firstName1" | "firstName2" | "genero" | "fechaNacimiento"
  | "nui" | "estrato" | "sisben" | "barrio" | "eps" | "bloodType"
  | "matriculaContratada" | "fuenteRecursos" | "internado"
  | "apoyoAcademico" | "discapacidad" | "paisOrigen" | "correo"
  | "motivo" | "grado" | "grupo" | "jornada" | "zonaSede" | "sector"
  | "calendario" | "etc" | "fechaIni";

export type FieldKind = "texto" | "select" | "fecha" | "numero";

// Campos del mapeo: clave interna, etiqueta visible (inicial mayúscula),
// si es requerido para importar y clase de control en la UI.
export const SIMAT_FIELDS: { key: SimatField; label: string; required: boolean; kind: FieldKind }[] = [
  { key: "documentType", label: "Tipo documento", required: true, kind: "select" },
  { key: "documentNumber", label: "Documento", required: true, kind: "texto" },
  { key: "lastName1", label: "Apellido1", required: true, kind: "texto" },
  { key: "firstName1", label: "Nombre1", required: true, kind: "texto" },
  { key: "lastName2", label: "Apellido2", required: false, kind: "texto" },
  { key: "firstName2", label: "Nombre2", required: false, kind: "texto" },
  { key: "genero", label: "Genero", required: false, kind: "select" },
  { key: "fechaNacimiento", label: "Fecha nacimiento", required: false, kind: "fecha" },
  { key: "nui", label: "Nui", required: false, kind: "texto" },
  { key: "estrato", label: "Estrato", required: false, kind: "select" },
  { key: "sisben", label: "Sisben", required: false, kind: "texto" },
  { key: "barrio", label: "Barrio", required: false, kind: "texto" },
  { key: "eps", label: "Eps", required: false, kind: "texto" },
  { key: "bloodType", label: "Tipo de sangre", required: false, kind: "select" },
  { key: "matriculaContratada", label: "Matrícula contratada", required: false, kind: "select" },
  { key: "fuenteRecursos", label: "Fuente recursos", required: false, kind: "select" },
  { key: "internado", label: "Internado", required: false, kind: "select" },
  { key: "apoyoAcademico", label: "Apoyo académico especial", required: false, kind: "select" },
  { key: "discapacidad", label: "Discapacidad", required: false, kind: "select" },
  { key: "paisOrigen", label: "Pais origen", required: false, kind: "texto" },
  { key: "correo", label: "Correo", required: false, kind: "texto" },
  { key: "motivo", label: "Motivo", required: false, kind: "texto" },
  { key: "grado", label: "Grado", required: true, kind: "texto" },
  { key: "grupo", label: "Grupo", required: true, kind: "texto" },
  { key: "jornada", label: "Jornada", required: false, kind: "texto" },
  { key: "zonaSede", label: "Zona sede", required: false, kind: "texto" },
  { key: "sector", label: "Sector", required: false, kind: "texto" },
  { key: "calendario", label: "Calendario", required: false, kind: "texto" },
  { key: "etc", label: "Etc", required: false, kind: "texto" },
  { key: "fechaIni", label: "Fecha inicio matrícula", required: false, kind: "fecha" },
];

// Normalización de encabezados: minúsculas, sin tildes, sin _/espacios/puntos.
export function normHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Encabezados que nunca se mapean (metadatos del export SIMAT u otra entidad).
// Evita que el fuzzy matching los capture (ej. "SEDE" no es "ZONA_SEDE",
// "PER_ID" no es el documento del estudiante).
const STOP_HEADERS = new Set([
  "ano", "anio", "estado", "jerarquia", "institucion", "dane", "codigodanesede",
  "consecutivo", "sede", "modelo", "fechafin", "numcontrato", "srpa", "perid", "per_id",
]);

// Diccionario de sinónimos: clave normalizada → campo. Calibrado con el
// Excel SIMAT real (RELACION DEL SIMAT 2025) y variantes habituales.
const SYNONYMS: Record<string, SimatField> = {
  // documento
  tipodoc: "documentType", tipodocumento: "documentType", tipode_documento: "documentType", tipoidentificacion: "documentType",
  doc: "documentNumber", documento: "documentNumber", numdocumento: "documentNumber", numerodocumento: "documentNumber", nrodocumento: "documentNumber", numdoc: "documentNumber",
  // nombres
  apellido1: "lastName1", primerapellido: "lastName1",
  apellido2: "lastName2", segundoapellido: "lastName2",
  nombre1: "firstName1", primernombre: "firstName1",
  nombre2: "firstName2", segundonombre: "firstName2",
  nombres: "firstName1",
  // personales
  genero: "genero", sexo: "genero", gener: "genero",
  fechanacimiento: "fechaNacimiento", fechanac: "fechaNacimiento", nacimiento: "fechaNacimiento", fechanacim: "fechaNacimiento",
  barrio: "barrio",
  correo: "correo", email: "correo", correoelectronico: "correo",
  // simat
  nui: "nui",
  rui: "nui", // el Excel trae el NUI en la columna NUI; RUI comparte sinónimo si aparece
  estrato: "estrato",
  sisben: "sisben", sisbeniv: "sisben",
  eps: "eps",
  tipodesangre: "bloodType", tiposangre: "bloodType", sangre: "bloodType", rh: "bloodType",
  matriculacontratada: "matriculaContratada",
  fuenterecursos: "fuenteRecursos", fuentederecursos: "fuenteRecursos",
  internado: "internado",
  apoyoacademicoespecial: "apoyoAcademico", apoyoacademico: "apoyoAcademico",
  discapacidad: "discapacidad",
  paisorigen: "paisOrigen", pais: "paisOrigen", paisdenacimiento: "paisOrigen",
  motivo: "motivo",
  // matrícula
  grado: "grado", gradocod: "grado", codigogrado: "grado",
  grupo: "grupo",
  fechaini: "fechaIni", fechainicio: "fechaIni", fechamatricula: "fechaIni",
  // institución (contexto)
  jornada: "jornada",
  zonasede: "zonaSede", zona: "zonaSede",
  sector: "sector",
  calendario: "calendario",
  etc: "etc",
};

// Fuzzy fallback: campo cuyo nombre normalizado contenga el header (o viceversa).
export function suggestField(header: string): SimatField | null {
  const h = normHeader(header);
  if (!h || STOP_HEADERS.has(h)) return null;
  if (SYNONYMS[h]) return SYNONYMS[h];
  for (const [k, v] of Object.entries(SYNONYMS)) {
    if (h.length >= 4 && k.length >= 6 && (k.includes(h) || h.includes(k))) return v;
  }
  return null;
}

// Catálogos de valores válidos (normalizados) por campo select.
const CATALOGS: Partial<Record<SimatField, string[]>> = {
  documentType: ["TI", "CC", "RC", "PPT", "PAS", "PASAPORTE", "PE", "CE", "OTRO"],
  genero: ["MASCULINO", "FEMENINO", "OTRO"],
  estrato: ["0", "1", "2", "3", "4", "5", "6"],
  bloodType: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
  matriculaContratada: ["Sí", "No"],
  internado: ["Sí", "No"],
  apoyoAcademico: ["Sí", "No"],
  discapacidad: ["Ninguna", "Visual", "Auditiva", "Intelectual", "Psicosocial", "Múltiple", "Otra"],
  fuenteRecursos: ["SGP", "RECURSOS PROPIOS", "MIXTO", "OTRO"],
};

// Normaliza un valor SIMAT al formato del sistema. Devuelve { v } o { error }.
export function normalizeValue(field: SimatField, raw: string): { v?: string | boolean | null; error?: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { v: null };

  switch (field) {
    case "documentType": {
      const n = s.toUpperCase();
      if (n.startsWith("TI:")) return { v: "TI" };
      if (n.startsWith("CC:")) return { v: "CC" };
      if (n.startsWith("RC:")) return { v: "RC" };
      const m = ["TI", "CC", "RC", "PPT", "PASAPORTE", "PE", "CE", "OTRO"].find((t) => n === t || n.startsWith(t));
      if (m === "PASAPORTE") return { v: "Pasaporte" };
      if (!m) return { error: `Tipo documento inválido: "${s}"` };
      return { v: m === "PPT" ? "PPT" : m };
    }
    case "genero": {
      const n = normHeader(s);
      if (n.startsWith("m")) return { v: "Masculino" };
      if (n.startsWith("f")) return { v: "Femenino" };
      return { v: "Otro" };
    }
    case "estrato": {
      const n = normHeader(s);
      if (["noaplica", "ninguno", "na"].includes(n)) return { v: null };
      const m = s.match(/[0-6]/);
      if (!m) return { error: `Estrato inválido: "${s}" (esperado 0-6)` };
      return { v: m[0] };
    }
    case "bloodType": {
      const n = s.toUpperCase().replace(/\s+/g, "");
      const m = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].find((t) => n === t);
      if (!m) return { error: `Tipo de sangre inválido: "${s}"` };
      return { v: m };
    }
    case "matriculaContratada":
    case "internado":
    case "apoyoAcademico": {
      // El Excel SIMAT real usa "NINGUNO"/"NO APLICA" para el caso negativo
      const n = normHeader(s);
      if (["s", "si", "verdadero", "true"].includes(n)) return { v: true };
      if (["n", "no", "ninguno", "noaplica", "na", "falso", "false"].includes(n)) return { v: false };
      return { error: `Valor inválido para Sí/No: "${s}"` };
    }
    case "discapacidad": {
      const n = normHeader(s);
      if (!n || n === "noaplica" || n === "ninguna" || n === "n") return { v: "Ninguna" };
      if (n.includes("visual")) return { v: "Visual" };
      if (n.includes("auditiv")) return { v: "Auditiva" };
      if (n.includes("intelectual") || n.includes("cognitiv")) return { v: "Intelectual" };
      if (n.includes("psicosocial") || n.includes("mental")) return { v: "Psicosocial" };
      if (n.includes("multiple")) return { v: "Múltiple" };
      return { v: "Otra" };
    }
    case "fuenteRecursos": {
      const n = s.toUpperCase();
      if (n.includes("SGP")) return { v: "SGP" };
      if (n.includes("PROPIO")) return { v: "Recursos propios" };
      if (n.includes("MIXT")) return { v: "Mixto" };
      return { v: "Otro" };
    }
    case "fechaNacimiento":
    case "fechaIni": {
      // SIMAT usa M/D/YY; también acepta ISO y DD/MM/YYYY
      let d: Date | null = null;
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const a = parseInt(m[3], 10);
        const year = a < 100 ? (a > 30 ? 1900 + a : 2000 + a) : a;
        d = new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10)); // M/D/Y
      } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        d = new Date(s);
      } else {
        const p = new Date(s);
        d = isNaN(p.getTime()) ? null : p;
      }
      if (!d || isNaN(d.getTime())) return { error: `Fecha no parseable: "${s}"` };
      return { v: d.toISOString() };
    }
    case "correo": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { error: `Correo inválido: "${s}"` };
      return { v: s };
    }
    default:
      return { v: s };
  }
}

// Valida catálogo estricto (para selects con catálogo definido).
export function isInCatalog(field: SimatField, value: string | boolean | null): boolean {
  const cat = CATALOGS[field];
  if (!cat) return true;
  if (typeof value === "boolean") return cat.includes(value ? "Sí" : "No");
  if (value === null) return true;
  return cat.includes(value.toUpperCase());
}

export const REQUIRED_FIELDS: SimatField[] = SIMAT_FIELDS.filter((f) => f.required).map((f) => f.key);
