import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// [Seguridad] Guard de autorización para route handlers (node runtime):
// identidad desde la cookie de sesión + roles FRESCOS desde la BD.
// Devuelve el usuario autorizado o null (responder 403 con forbidden()).
export async function requireRoles(req: NextRequest, roles: string[]) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      active: true,
      institutionId: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!user?.active) return null;
  const codes = [user.role, ...user.userRoles.map((ur) => ur.role.code)];
  return roles.some((r) => codes.includes(r)) ? user : null;
}

export function forbidden() {
  return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
}

// [Seguridad] Param-trust: para APIs "self" (dashboards, permisos propios,
// mensajería…) el ?userId= del query debe coincidir con la identidad de la
// cookie — si no, es lectura cruzada de otro usuario. Verifica además que la
// cuenta siga ACTIVA en BD: desactivar un usuario revoca sus rutas self al momento.
export async function isSelf(req: NextRequest, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.uid !== userId) return false;
  const user = await db.user.findUnique({ where: { id: session.uid }, select: { active: true } });
  return !!user?.active;
}

export function selfForbidden() {
  return Response.json({ ok: false, reason: "forbidden_user" }, { status: 403 });
}

// Mapa módulo→roles (espejo del NAV de institutional-panel). Centralizado para
// que añadir cobertura a nuevas rutas sea una línea.
export const MODULE_ROLES: Record<string, string[]> = {
  usuarios: ["rector", "administrador"],
  auditoria: ["rector", "administrador"],
  "gestion-estudiantes": ["rector", "administrador"],
  "gestion-grupos": ["rector", "administrador"],
  asignacion: ["rector", "coordinador", "administrador"],
  "conceptos-evaluativos": ["rector", "administrador"],
  "modelos-educativos": ["rector", "coordinador", "administrador"],
  promocion: ["rector", "administrador"],
  "opciones-tema": ["rector", "administrador"],
  configuracion: ["rector", "coordinador", "administrador"],
  notas: ["docente", "director_grupo", "coordinador", "rector", "administrador"],
  asistencia: ["docente", "director_grupo", "coordinador", "rector", "administrador"],
  "gestion-actividades": ["docente", "director_grupo", "coordinador", "rector", "administrador"],
  actas: ["rector", "coordinador", "administrador"],
  matricula: ["rector", "administrador", "coordinador"],
  "dashboard-directivo": ["rector", "coordinador", "administrador"],
  talleres: ["docente", "coordinador", "rector", "administrador"],
  "constructor-modulos": ["administrador"],
};

export function requireModule(req: NextRequest, moduleKey: string) {
  return requireRoles(req, MODULE_ROLES[moduleKey] ?? ["rector", "administrador"]);
}
