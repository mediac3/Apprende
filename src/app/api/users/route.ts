import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Gestión de usuarios (módulo Administración)
// GET    /api/users?institutionId=        → listado con roles
// POST   /api/users                       → crear usuario (con roles)
// PATCH  /api/users                       → actualizar datos / estado / contraseña
// DELETE /api/users?id=&institutionId=    → eliminar usuario

// Hash simple y determinista (mismo criterio que /api/auth/login)
function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
}

// Sincroniza User.role con el rol principal (menor sortOrder en UserRole)
async function syncPrimaryRole(userId: string) {
  const urs = await db.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  urs.sort((a, b) => a.role.sortOrder - b.role.sortOrder);
  const primary = urs[0]?.role.code ?? "";
  await db.user.update({ where: { id: userId }, data: { role: primary } });
  return primary;
}

function sanitize(u: any) {
  const { passwordHash, ...safe } = u;
  return safe;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const users = await db.user.findMany({
      where: { institutionId },
      include: {
        userRoles: { include: { role: true } },
      },
      orderBy: { fullName: "asc" },
    });

    // Ordenar roles por sortOrder y omitir el hash de contraseña
    const data = users.map((u) => ({
      ...sanitize(u),
      userRoles: u.userRoles.sort((a, b) => a.role.sortOrder - b.role.sortOrder),
    }));

    return NextResponse.json({ ok: true, users: data });
  } catch (e) {
    console.error("[users.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId, userId: actorId, username, fullName,
      phone, email, jobTitle, password, roleIds,
    } = body;

    if (!institutionId || !username || !fullName || !password) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, username, fullName, password" },
        { status: 400 }
      );
    }

    const dup = await db.user.findFirst({
      where: { username: String(username).trim() },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un usuario con ese nombre de usuario" },
        { status: 400 }
      );
    }

    // Validar que los roles pertenezcan a la institución
    let roles: { id: string; code: string }[] = [];
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      roles = await db.role.findMany({
        where: { institutionId, id: { in: roleIds } },
      });
    }

    const user = await db.user.create({
      data: {
        institutionId,
        username: String(username).trim(),
        fullName: String(fullName).trim(),
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        jobTitle: jobTitle ? String(jobTitle).trim() : null,
        passwordHash: hashPassword(String(password)),
        role: "docente", // provisional: syncPrimaryRole lo ajusta
      },
    });

    for (const r of roles) {
      await db.userRole.create({ data: { userId: user.id, roleId: r.id } });
    }
    const primary = await syncPrimaryRole(user.id);

    await db.auditLog.create({
      data: {
        institutionId,
        userId: actorId || null,
        action: "create",
        module: "usuarios",
        entityType: "User",
        entityId: user.id,
        details: JSON.stringify({ username: user.username, fullName: user.fullName, roles: roles.map((r) => r.code), primary }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, user: { ...sanitize(user), role: primary } });
  } catch (e) {
    console.error("[users.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, institutionId, userId: actorId,
      username, fullName, phone, email, jobTitle, active, password,
    } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.user.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (username && String(username).trim() !== existing.username) {
      const dup = await db.user.findFirst({
        where: { username: String(username).trim(), id: { not: id } },
      });
      if (dup) {
        return NextResponse.json(
          { ok: false, error: "Ya existe un usuario con ese nombre de usuario" },
          { status: 400 }
        );
      }
    }

    // No desactivarse a sí mismo (evita bloqueo de acceso)
    if (active === false && actorId === id) {
      return NextResponse.json(
        { ok: false, error: "No puede desactivar su propio usuario" },
        { status: 400 }
      );
    }

    const update: any = {};
    if (username !== undefined) update.username = String(username).trim();
    if (fullName !== undefined) update.fullName = String(fullName).trim();
    if (phone !== undefined) update.phone = phone ? String(phone).trim() : null;
    if (email !== undefined) update.email = email ? String(email).trim().toLowerCase() : null;
    if (jobTitle !== undefined) update.jobTitle = jobTitle ? String(jobTitle).trim() : null;
    if (active !== undefined) update.active = Boolean(active);
    if (password) update.passwordHash = hashPassword(String(password));

    const updated = await db.user.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: actorId || null,
        action: "update",
        module: "usuarios",
        entityType: "User",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, user: sanitize(updated) });
  } catch (e) {
    console.error("[users.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const institutionId = searchParams.get("institutionId");
    const userId = searchParams.get("userId");

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    if (id === userId) {
      return NextResponse.json(
        { ok: false, error: "No puede eliminar su propio usuario" },
        { status: 400 }
      );
    }

    const existing = await db.user.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    await db.user.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "usuarios",
        entityType: "User",
        entityId: id,
        details: JSON.stringify({ username: existing.username, fullName: existing.fullName }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[users.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
