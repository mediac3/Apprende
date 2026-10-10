import bcrypt from "bcryptjs";
import crypto from "crypto";

// [Seguridad] Contraseñas: bcrypt con salt (cost 10). Las contraseñas históricas
// del demo con SHA-256 sin salt se aceptan en el login y se re-hashan de forma
// transparente (upgrade en el primer acceso exitoso).
const BCRYPT_COST = 10;

export function hashPassword(p: string): string {
  return bcrypt.hashSync(p, BCRYPT_COST);
}

export function isLegacySha256(hash: string): boolean {
  return !hash.startsWith("$2");
}

export function legacySha256(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
}

export function verifyPassword(p: string, hash: string): boolean {
  if (isLegacySha256(hash)) {
    return timingSafeEqual(legacySha256(p), hash);
  }
  return bcrypt.compareSync(p, hash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
