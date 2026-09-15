// Color determinístico por área del conocimiento.
// Mismo área (id o abreviatura como fallback) => mismo color
// entre renders y sesiones. Paleta accesible de 10 colores.

const PALETTE = [
  "#2563eb", // azul
  "#16a34a", // verde
  "#d97706", // ámbar
  "#dc2626", // rojo
  "#7c3aed", // violeta
  "#0891b2", // cian
  "#db2777", // rosa
  "#65a30d", // lima
  "#ea580c", // naranja
  "#4f46e5", // índigo
];

export function getAreaColor(areaIdOrAbbr: string): string {
  const s = areaIdOrAbbr || "sin-area";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
