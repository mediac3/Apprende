import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// [Seguridad] Default-deny para la API: toda /api/* exige cookie de sesión firmada,
// salvo la allowlist pública. La autorización fina por rol vive en cada route
// handler (p. ej. requireRoles en el módulo Usuarios) y la matriz de permisos
// sigue gobernando el menú del cliente.
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/change-password", // se autoprotege (exige contraseña actual)
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/") || PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
