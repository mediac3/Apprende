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
