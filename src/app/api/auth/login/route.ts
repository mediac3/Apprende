import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Hash simple y determinista (no para producción, solo demo)
function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
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

    if (!user || user.passwordHash !== hashPassword(String(password))) {
      return NextResponse.json(
        { ok: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
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
      avatarUrl: user.avatarUrl,
      institution: {
        id: user.institution.id,
        name: user.institution.name,
        shortName: user.institution.shortName,
        logoUrl: user.institution.logoUrl,
        academicYear: user.institution.academicYear,
      },
    };

    return NextResponse.json({ ok: true, user: safe });
  } catch (e) {
    console.error("[auth.login]", e);
    return NextResponse.json(
      { ok: false, error: "Error de servidor" },
      { status: 500 }
    );
  }
}
