// [Seguridad] Sesión de API: cookie httpOnly firmada (HMAC-SHA256 con Web Crypto,
// compatible con middleware edge y route handlers node). Sin dependencias nuevas.
// Definir AUTH_SECRET en producción (ver docs/seguridad.md); si falta, se usa un
// fallback de desarrollo para no romper entornos demo.

export const SESSION_COOKIE = "apprende_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 días

export interface SessionPayload {
  uid: string;
  imp?: boolean; // true = cookie emitida como usuario objetivo de «Ver como»
  roles?: string[]; // códigos de rol al emitirse (para gates de módulo en el proxy)
  iat: number;
  exp: number;
}

// Uint8Array sobre ArrayBuffer explícito (Web Crypto exige BufferSource estricto)
function toBytes(s: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(s.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function getSecret(): Uint8Array<ArrayBuffer> {
  const secret = process.env.AUTH_SECRET || "apprende-dev-secret-CAMBIAR-EN-PRODUCCION";
  return toBytes(secret);
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    getSecret(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, toBytes(data));
  return b64urlFromBytes(new Uint8Array(sig));
}

// Comparación en tiempo constante (evita oráculo de timing en la firma)
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  uid: string,
  opts?: { imp?: boolean; ttlSeconds?: number; roles?: string[] }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid,
    imp: opts?.imp || undefined,
    roles: opts?.roles && opts.roles.length > 0 ? opts.roles : undefined,
    iat: now,
    exp: now + (opts?.ttlSeconds ?? SESSION_TTL_S),
  };
  const body = b64urlFromBytes(toBytes(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(body);
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytesFromB64url(body))) as SessionPayload;
    if (!payload?.uid || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_TTL_S) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    // Activar COOKIE_SECURE=true cuando el servidor esté tras HTTPS
    // (en localhost/LAN por http, una cookie secure no se enviaría).
    secure: process.env.COOKIE_SECURE === "true",
  };
}
