import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { verifyPassword, hashPassword, isLegacySha256 } from "@/lib/password";

// [Seguridad] Rate limit de fuerza bruta: máx. 5 intentos fallidos por
// usuario+IP cada 15 minutos (en memoria; válido para despliegue de una sola
// instancia). Solo cuentan los intentos FALLIDOS.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const loginFails = new Map<string, number[]>();

function loginBlocked(key: string): boolean {
  const now = Date.now();
  const recent = (loginFails.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginFails.set(key, recent);
  return recent.length >= LOGIN_MAX_FAILS;
}

function registerLoginFail(key: string) {
  const now = Date.now();
  const recent = (loginFails.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  recent.push(now);
  loginFails.set(key, recent);
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Usuario y contraseña requeridos" },
        { status: 400 }
      );
    }

    const failKey = `${String(username).trim().toLowerCase()}|${req.headers.get("x-forwarded-for") || "local"}`;
    if (loginBlocked(failKey)) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo." },
        { status: 429 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        username: String(username).trim(),
        active: true,
      },
      include: {
        institution: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      registerLoginFail(failKey);
      return NextResponse.json(
        { ok: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // [Seguridad] upgrade transparente: contraseñas históricas SHA-256 (demo) se
    // re-hashan a bcrypt en el primer login exitoso.
    if (isLegacySha256(user.passwordHash)) {
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(String(password)) },
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        institutionId: user.institutionId,
        userId: user.id,
        action: "login",
        module: "auth",
        entityType: "User",
        entityId: user.id,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomBytes(16).toString("hex"),
      },
    });

    // Roles del usuario (N:M normalizado) ordenados por prioridad del catálogo
    const roles = user.userRoles
      ? user.userRoles
          .slice()
          .sort((a: any, b: any) => a.role.sortOrder - b.role.sortOrder)
          .map((ur: any) => ur.role.code)
      : undefined;

    const safe = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      roles: roles && roles.length > 0 ? roles : [user.role],
      email: user.email,
      phone: user.phone,
      jobTitle: user.jobTitle,
      mustChangePassword: user.mustChangePassword, // [F2] forzar cambio en primer login
      avatarUrl: user.avatarUrl,
      institution: {
        id: user.institution.id,
        name: user.institution.name,
        shortName: user.institution.shortName,
        logoUrl: user.institution.logoUrl,
        academicYear: user.institution.academicYear,
        forcePasswordChange: user.institution.forcePasswordChange, // [Seguridad] política de cambio inicial
        passwordChangeRoles: user.institution.passwordChangeRoles,
      },
    };

    // [Seguridad] Sesión httpOnly firmada: a partir de aquí la API exige esta cookie
    // (middleware default-deny). El estado de UI sigue en el store del cliente.
    const res = NextResponse.json({ ok: true, user: safe });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth.login]", e);
    return NextResponse.json(
      { ok: false, error: "Error de servidor" },
      { status: 500 }
    );
  }
}
