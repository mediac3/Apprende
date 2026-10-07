import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Cambiar el estado de los roles de un usuario (modal del módulo Usuarios)
// PATCH /api/users/roles { id, institutionId, userId (actor), roleIds[] }
// Reemplaza el conjunto de roles asignados (N:M) y sincroniza el rol principal.

async function syncPrimaryRole(userId: string) {
  const urs = await db.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  urs.sort((a, b) => a.role.sortOrder - b.role.sortOrder);
  const primary = urs[0]?.role.code ?? "";
  await db.user.update({ where: { id: userId }, data: { role: primary } });
  return { primary, roles: urs.map((ur) => ({ id: ur.role.id, code: ur.role.code, name: ur.role.name })) };
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId: actorId, roleIds } = body;

    if (!id || !institutionId || !Array.isArray(roleIds)) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: id, institutionId, roleIds" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({ where: { id, institutionId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // No cambiar los roles del propio usuario (evita auto-bloqueo)
    if (id === actorId) {
      return NextResponse.json(
        { ok: false, error: "No puede cambiar los roles de su propio usuario" },
        { status: 400 }
      );
    }

    // Validar roles de la institución
    const roles = await db.role.findMany({
      where: { institutionId, id: { in: roleIds } },
    });
    const validIds = new Set(roles.map((r) => r.id));

    // Conjunto actual → calcular altas y bajas
    const current = await db.userRole.findMany({ where: { userId: id } });
    const currentIds = new Set(current.map((ur) => ur.roleId));

    let added = 0;
    let removed = 0;
    for (const ur of current) {
      if (!validIds.has(ur.roleId)) {
        await db.userRole.delete({ where: { id: ur.id } });
        removed++;
      }
    }
    for (const r of roles) {
      if (!currentIds.has(r.id)) {
        await db.userRole.create({ data: { userId: id, roleId: r.id } });
        added++;
      }
    }

    const { primary, roles: finalRoles } = await syncPrimaryRole(id);

    await db.auditLog.create({
      data: {
        institutionId,
        userId: actorId || null,
        action: "update",
        module: "usuarios",
        entityType: "UserRole",
        entityId: id,
        details: JSON.stringify({
          user: user.username,
          roles: finalRoles.map((r) => r.code),
          primary,
          added,
          removed,
        }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, primary, roles: finalRoles });
  } catch (e) {
    console.error("[users.roles]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Asignación MASIVA de roles (módulo Usuarios: selección múltiple en el listado)
// POST /api/users/roles { institutionId, userId (actor), userIds[], roleIds[], replace? }
// replace=false (por defecto): AÑADE los roles marcados conservando los actuales.
// replace=true: REEMPLAZA el conjunto completo de cada usuario por roleIds.
// El propio actor se omite (evita auto-bloqueo) y se reporta en skippedSelf.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, userId: actorId, userIds, roleIds, replace } = body;

    if (!institutionId || !Array.isArray(userIds) || !Array.isArray(roleIds) || userIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, userIds, roleIds" },
        { status: 400 }
      );
    }
    if (replace && roleIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Para reemplazar roles debe seleccionar al menos uno" },
        { status: 400 }
      );
    }

    // Validar roles de la institución
    const roles = await db.role.findMany({
      where: { institutionId, id: { in: roleIds } },
    });
    const validIds = new Set(roles.map((r) => r.id));

    // Usuarios de la institución; el actor no se toca
    const targets = await db.user.findMany({
      where: { institutionId, id: { in: userIds } },
      select: { id: true, username: true },
    });
    const editable = targets.filter((u) => u.id !== actorId);
    const skippedSelf = targets.length - editable.length;

    let updated = 0;
    let added = 0;
    let removed = 0;
    for (const u of editable) {
      const current = await db.userRole.findMany({ where: { userId: u.id } });
      const currentIds = new Set(current.map((ur) => ur.roleId));

      if (replace) {
        for (const ur of current) {
          if (!validIds.has(ur.roleId)) {
            await db.userRole.delete({ where: { id: ur.id } });
            removed++;
          }
        }
      }
      for (const rid of validIds) {
        if (!currentIds.has(rid)) {
          await db.userRole.create({ data: { userId: u.id, roleId: rid } });
          added++;
        }
      }
      await syncPrimaryRole(u.id);
      updated++;
    }

    if (updated > 0) {
      await db.auditLog.create({
        data: {
          institutionId,
          userId: actorId || null,
          action: "update",
          module: "usuarios",
          entityType: "UserRole",
          entityId: null,
          details: JSON.stringify({
            bulk: true,
            users: editable.map((u) => u.username),
            roles: roles.map((r) => r.code),
            replace: !!replace,
            added,
            removed,
          }),
          hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
        },
      });
    }

    return NextResponse.json({ ok: true, updated, added, removed, skippedSelf });
  } catch (e) {
    console.error("[users.roles.bulk]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
