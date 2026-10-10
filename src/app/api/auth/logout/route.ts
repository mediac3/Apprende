import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// [Seguridad] Cierra la sesión de API: elimina la cookie httpOnly firmada.
// Allowlist en middleware (no exige sesión: si la cookie ya expiró, igual se limpia).
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
