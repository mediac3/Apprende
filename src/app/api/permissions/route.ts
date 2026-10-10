// [F1] API de la matriz de permisos Rol × Módulo.
//
// GET  ?institutionId&userId&mode=self    → mapa efectivo del usuario (cualquier rol)
// GET  ?institutionId&userId              → matriz completa (solo administrador)
// PUT  { institutionId, userId, entries } → guarda filas explícitas (solo administrador)
//
// Reglas duras:
// - Solo el rol `administrador` ve/edita la matriz (verificado en BD).
// - Las filas del rol administrador se guardan siempre todo-true (no editables).
// - Prisma parametriza todas las consultas (sin SQL por concatenación).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserRoleCodes } from "@/lib/teaching-rules";
import { ADMIN_ROLE } from "@/lib/permissions/modules";
import { getEffectivePermMap, getUserRolesInfo, listAllModules } from "@/lib/permissions/server";
import { isSelf } from "@/lib/api-guard";

type Entry = {
  roleId: string;
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

async function resolveAdmin(institutionId: string, userId: string | null) {
  if (!institutionId || !userId) return null;
  const roleCodes = await getUserRoleCodes(userId);
  if (!roleCodes.includes(ADMIN_ROLE)) return null;
  return { roleCodes };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const institutionId = sp.get("institutionId");
  const userId = sp.get("userId");
  const mode = sp.get("mode") ?? "matrix";
  if (!institutionId || !userId) {
    return NextResponse.json({ ok: false, error: "institutionId y userId requeridos" }, { status: 400 });
  }

  try {
    if (mode === "self") {
      // [Seguridad] param-trust: los permisos propios exigen identidad de sesión
      if (!(await isSelf(req, userId))) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
      const [perms, { isAdmin }] = await Promise.all([
        getEffectivePermMap(userId, institutionId),
        getUserRolesInfo(userId),
      ]);
      return NextResponse.json({ ok: true, perms, isAdmin });
    }

    // mode=matrix (default): solo administrador
    const admin = await resolveAdmin(institutionId, userId);
    if (!admin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN", message: "Solo el administrador puede ver la matriz de permisos" }, { status: 403 });
    }

    const [roles, modules, rows] = await Promise.all([
      db.role.findMany({
        where: { institutionId, active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, code: true, name: true, sortOrder: true },
      }),
      listAllModules(institutionId),
      db.rolePermission.findMany({
        where: { role: { institutionId } },
      }),
    ]);

    const cells = [];
    for (const role of roles) {
      const isAdminRole = role.code === ADMIN_ROLE;
      for (const m of modules) {
        if (isAdminRole) {
          cells.push({ roleId: role.id, moduleKey: m.key, canView: true, canCreate: true, canEdit: true, canDelete: true });
          continue;
        }
        const explicit = rows.find((r) => r.roleId === role.id && r.moduleKey === m.key);
        if (explicit) {
          cells.push({
            roleId: role.id,
            moduleKey: m.key,
            canView: explicit.canView,
            canCreate: explicit.canCreate,
            canEdit: explicit.canEdit,
            canDelete: explicit.canDelete,
          });
        } else {
          // Default histórico: vista (y crud) según acceso NAV/JSON del módulo
          const def = m.defaultRoles.length === 0 || m.defaultRoles.some((r) => r === role.code);
          cells.push({ roleId: role.id, moduleKey: m.key, canView: def, canCreate: def, canEdit: def, canDelete: def });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      roles,
      modules: modules.map((m) => ({ key: m.key, label: m.label, group: m.group })),
      cells,
      adminRoleCode: ADMIN_ROLE,
    });
  } catch (e) {
    console.error("[permissions.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId: string | undefined = body?.institutionId;
    const userId: string | undefined = body?.userId;
    const entries: Entry[] | undefined = Array.isArray(body?.entries) ? body.entries : undefined;
    if (!institutionId || !userId || !entries) {
      return NextResponse.json({ ok: false, error: "institutionId, userId y entries son requeridos" }, { status: 400 });
    }

    const admin = await resolveAdmin(institutionId, userId);
    if (!admin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN", message: "Solo el administrador puede editar los permisos" }, { status: 403 });
    }

    // Validación de claves: roles y módulos deben existir en la institución
    const [roles, modules] = await Promise.all([
      db.role.findMany({ where: { institutionId }, select: { id: true, code: true } }),
      listAllModules(institutionId),
    ]);
    const roleById = new Map(roles.map((r) => [r.id, r]));
    const knownKeys = new Set(modules.map((m) => m.key));

    const valid = entries.filter((e) => roleById.has(e.roleId) && knownKeys.has(e.moduleKey));

    await db.$transaction(
      valid.map((e) => {
        // Regla dura: filas del rol administrador siempre todo-true
        const forced = roleById.get(e.roleId)!.code === ADMIN_ROLE;
        const data = {
          canView: forced || Boolean(e.canView),
          canCreate: forced || Boolean(e.canCreate),
          canEdit: forced || Boolean(e.canEdit),
          canDelete: forced || Boolean(e.canDelete),
          updatedBy: userId,
        };
        return db.rolePermission.upsert({
          where: { roleId_moduleKey: { roleId: e.roleId, moduleKey: e.moduleKey } },
          update: data,
          create: { roleId: e.roleId, moduleKey: e.moduleKey, ...data },
        });
      })
    );

    return NextResponse.json({ ok: true, saved: valid.length, rejected: entries.length - valid.length });
  } catch (e) {
    console.error("[permissions.put]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
