import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, SESSION_TTL_S } from "@/lib/session";

// [F4.3] Impersonación "Ver como" — SOLO Administrador, nunca sobre otro
// Administrador, nunca sobre sí mismo. Registra inicio/fin en ImpersonationLog
// (expiración de salvaguarda: 30 min). La escritura está permitida (decisión
// de negocio 2026-10-04); la autorización fina de la app es client-side.
const EXPIRES_MIN = 30;

// POST /api/impersonation { adminId, targetId } — iniciar
export async function POST(req: NextRequest) {
  try {
    const { adminId, targetId } = await req.json();
    if (!adminId || !targetId || adminId === targetId) {
      return NextResponse.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
    }

    const admin = await db.user.findUnique({
      where: { id: adminId },
      select: {
        id: true, role: true, active: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    const isAdmin = admin?.active && (
      admin.role === "administrador" ||
      admin.userRoles.some((ur) => ur.role.code === "administrador")
    );
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Solo un Administrador puede usar «Ver como»" }, { status: 403 });
    }

    const target = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true, username: true, fullName: true, role: true, active: true,
        email: true, phone: true, jobTitle: true, avatarUrl: true,
        institutionId: true,
        institution: { select: { id: true, name: true, shortName: true, logoUrl: true, academicYear: true } },
        userRoles: {
          select: { role: { select: { code: true, sortOrder: true } } },
          orderBy: { roleId: "asc" },
        },
      },
    });
    if (!target) {
      return NextResponse.json({ ok: false, error: "Usuario objetivo no encontrado" }, { status: 404 });
    }
    const targetRoles = target.userRoles.map((ur) => ur.role.code);
    if (target.role === "administrador" || targetRoles.includes("administrador")) {
      return NextResponse.json({ ok: false, error: "No se permite «Ver como» otro Administrador" }, { status: 403 });
    }
    if (!target.active) {
      return NextResponse.json({ ok: false, error: "El usuario está inactivo" }, { status: 409 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRES_MIN * 60 * 1000);
    const log = await db.impersonationLog.create({
      data: { institutionId: target.institutionId, adminId, targetId, startedAt: now, expiresAt },
    });

    const roles = target.userRoles
      .slice()
      .sort((a, b) => a.role.sortOrder - b.role.sortOrder)
      .map((ur) => ur.role.code);

    // [Seguridad] La cookie de sesión pasa a identificar al usuario objetivo,
    // con TTL alineado a la salvaguarda de 30 min; al finalizar (PATCH) vuelve
    // a identificarse la cookie con el administrador original.
    const res = NextResponse.json({
      ok: true,
      logId: log.id,
      startedAt: log.startedAt,
      expiresAt: log.expiresAt,
      user: {
        id: target.id,
        username: target.username,
        fullName: target.fullName,
        role: target.role,
        roles: roles.length > 0 ? roles : [target.role],
        email: target.email,
        phone: target.phone,
        jobTitle: target.jobTitle,
        avatarUrl: target.avatarUrl,
        institution: target.institution,
        mustChangePassword: false,
      },
    });
    res.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(target.id, {
        imp: true,
        ttlSeconds: EXPIRES_MIN * 60,
        roles: roles.length > 0 ? roles : [target.role],
      }),
      sessionCookieOptions(EXPIRES_MIN * 60)
    );
    return res;
  } catch (e) {
    console.error("POST /api/impersonation", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/impersonation { logId } — finalizar
export async function PATCH(req: NextRequest) {
  try {
    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ ok: false, error: "logId requerido" }, { status: 400 });
    }
    const log = await db.impersonationLog.findUnique({ where: { id: logId } });
    if (!log) {
      return NextResponse.json({ ok: false, error: "Registro no encontrado" }, { status: 404 });
    }
    if (!log.endedAt) {
      await db.impersonationLog.update({ where: { id: logId }, data: { endedAt: new Date() } });
    }
    // [Seguridad] restaura la identidad del administrador (con sus roles) en la cookie
    const admin = await db.user.findUnique({
      where: { id: log.adminId },
      select: { role: true, userRoles: { select: { role: { select: { code: true, sortOrder: true } } } } },
    });
    const adminRoles = admin
      ? admin.userRoles.map((ur) => ur.role.code).sort((a, b) => {
          // orden irrelevante para el set; dedup abajo
          return a.localeCompare(b);
        }).filter((c, i, arr) => arr.indexOf(c) === i)
      : [];
    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(log.adminId, { roles: adminRoles.length > 0 ? adminRoles : [admin?.role ?? ""] }),
      sessionCookieOptions(SESSION_TTL_S)
    );
    return res;
  } catch (e) {
    console.error("PATCH /api/impersonation", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
