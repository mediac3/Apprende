import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// [Seguridad] Default-deny para la API: toda /api/* exige cookie de sesión firmada,
// salvo la allowlist pública. La autorización fina por rol vive en cada route
// handler (p. ej. requireRoles/requireModule en el módulo Usuarios) y la matriz
// de permisos sigue gobernando el menú del cliente.
// (Next 16: la convención middleware.ts pasó a proxy.ts — mismo comportamiento.)
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/change-password", // se autoprotege (exige contraseña actual)
]);

// [Seguridad Fase 3] Escrituras → roles exigidos (espejo del NAV). Se aplica en el
// proxy con los roles FIRMADOS en el token (vigencia ≤ 7 días; los cambios de rol
// toman efecto al re-login — los handlers críticos además validan roles frescos
// de BD con requireRoles/requireModule: defensa en profundidad).
// Exclusiones deliberadas: /api/custom-modules/records (escrituras de usuarios
// finales de módulos personalizados, p. ej. «Permiso de salida» del acudiente),
// feed, mensajes, e-learning y matrícula/pre-matrícula (flujos multi-rol).
const WRITE_MODULE_ROLES: Array<[RegExp, string[]]> = [
  [/^\/api\/users(\/roles)?$/, ["rector", "administrador"]],
  [/^\/api\/audits$/, ["rector", "administrador"]],
  [/^\/api\/dashboard-settings$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/theme-options$/, ["rector", "administrador"]],
  [/^\/api\/user-scope$/, ["rector", "administrador"]],
  [/^\/api\/students(\/bulk-delete|\/import)?$/, ["rector", "administrador"]],
  [/^\/api\/groups$/, ["rector", "administrador"]],
  [/^\/api\/subjects$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/subject-assignments$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/evaluative-concepts$/, ["rector", "administrador"]],
  [/^\/api\/educational-models$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/evaluation-scales$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/periods$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/academic-years/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/meetings$/, ["rector", "coordinador", "administrador"]],
  [/^\/api\/workshops$/, ["docente", "coordinador", "rector", "administrador"]],
  [/^\/api\/activities$/, ["docente", "director_grupo", "coordinador", "rector", "administrador"]],
  [/^\/api\/grades$/, ["docente", "director_grupo", "coordinador", "rector", "administrador"]],
  [/^\/api\/grade-records$/, ["docente", "director_grupo", "coordinador", "rector", "administrador"]],
  [/^\/api\/grade-comments$/, ["docente", "director_grupo", "coordinador", "rector", "administrador"]],
  [/^\/api\/grade-sheet-archive$/, ["docente", "director_grupo", "coordinador", "rector", "administrador"]],
  [/^\/api\/attendance$/, ["docente", "director_grupo", "coordinador", "rector", "administrador"]],
  [/^\/api\/custom-modules\/(publish|import)$/, ["administrador"]],
  [/^\/api\/custom-modules$/, ["administrador"]],
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/") || PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // [Seguridad Fase 3] gate de escritura por módulo (métodos que mutan)
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const roles = WRITE_MODULE_ROLES.find(([re]) => re.test(pathname));
    if (roles) {
      // Cookies emitidas antes de incluir roles en el token: exigir re-login
      const tokenRoles = session.roles ?? [];
      const allowed = tokenRoles.some((r) => roles[1].includes(r));
      if (!allowed) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
