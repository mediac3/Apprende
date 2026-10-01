// [F1] Resolución de permisos efectivos en servidor (fuente de verdad: BD).
//
// Estrategia sin regresión: si no existe fila explícita en RolePermission para
// (rol, módulo), se aplica el default histórico (NAV / JSON del módulo custom).
// Las filas explícitas —creadas al guardar la matriz— siempre ganan.
// El rol `administrador` pasa todas las validaciones (regla dura de F1).
//
// Limitación conocida (pre-existente en la app): no hay sesión de servidor;
// `userId` llega del cliente. Aquí el rol SIEMPRE se resuelve contra la BD
// (getUserRoleCodes), nunca se confía en un rol enviado por el cliente.

import { db } from "@/lib/db";
import { getUserRoleCodes } from "@/lib/teaching-rules";
import { ADMIN_ROLE, STATIC_MODULES, CUSTOM_PREFIX, defaultCanView, type ModuleDef, type PermAction } from "./modules";

export type PermFlags = { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
export type EffectivePermMap = Record<string, PermFlags>;

export const ALL_TRUE: PermFlags = { canView: true, canCreate: true, canEdit: true, canDelete: true };
export const ALL_FALSE: PermFlags = { canView: false, canCreate: false, canEdit: false, canDelete: false };

/** Códigos de rol del usuario + ¿es administrador? (resuelto en BD). */
export async function getUserRolesInfo(userId: string): Promise<{ roleCodes: string[]; isAdmin: boolean }> {
  const roleCodes = await getUserRoleCodes(userId);
  return { roleCodes, isAdmin: roleCodes.includes(ADMIN_ROLE) };
}

/** Módulos personalizados publicados de la institución, como ModuleDef. */
export async function listCustomModules(institutionId: string): Promise<ModuleDef[]> {
  const rows = await db.customModule.findMany({
    where: { institutionId, published: true },
    select: { id: true, name: true, menuLabel: true, area: true, visibleRolesJson: true },
  });
  return rows.map((m) => {
    let defaultRoles: string[] = [];
    try {
      const parsed = JSON.parse(m.visibleRolesJson);
      if (Array.isArray(parsed)) defaultRoles = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // JSON inválido: cae a [] = visible para todos (mismo fail-open que el feed histórico)
    }
    return {
      key: `${CUSTOM_PREFIX}${m.id}`,
      label: m.menuLabel || m.name,
      group: m.area || "Personalizados",
      defaultRoles,
    };
  });
}

/** Todos los módulos (estáticos + custom publicados) de la institución. */
export async function listAllModules(institutionId: string): Promise<ModuleDef[]> {
  return [...STATIC_MODULES, ...(await listCustomModules(institutionId))];
}

function flagsFromExplicit(row: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean } | undefined): PermFlags | null {
  return row ? { canView: row.canView, canCreate: row.canCreate, canEdit: row.canEdit, canDelete: row.canDelete } : null;
}

/**
 * Mapa {moduleKey → permisos} efectivo para un usuario.
 * @param roleIdsByCode opcional para reutilizar roles ya consultados (evita N+1 en matriz).
 */
export async function getEffectivePermMap(
  userId: string,
  institutionId: string
): Promise<EffectivePermMap> {
  const { roleCodes, isAdmin } = await getUserRolesInfo(userId);
  const modules = await listAllModules(institutionId);

  const map: EffectivePermMap = {};
  if (isAdmin) {
    for (const m of modules) map[m.key] = { ...ALL_TRUE };
    return map;
  }
  if (roleCodes.length === 0) {
    // Usuario sin rol conocido: nada visible (fail-closed para el panel)
    for (const m of modules) map[m.key] = { ...ALL_FALSE };
    return map;
  }

  const roles = await db.role.findMany({
    where: { institutionId, code: { in: roleCodes } },
    select: { id: true },
  });
  const rows = await db.rolePermission.findMany({
    where: { roleId: { in: roles.map((r) => r.id) } },
  });
  // El permiso más permisivo entre los roles del usuario gana (un usuario puede
  // ejercer varios roles; PDF módulo Usuarios).
  for (const m of modules) {
    map[m.key] = { ...ALL_FALSE };
    const defaultView = defaultCanView(m, roleCodes);
    for (const role of roles) {
      const explicit = flagsFromExplicit(rows.find((r) => r.roleId === role.id && r.moduleKey === m.key));
      const view = explicit ? explicit.canView : defaultView;
      const crud = explicit ? explicit.canCreate || explicit.canEdit || explicit.canDelete : defaultView;
      if (view) map[m.key].canView = true;
      if (crud) {
        // Sin fila explícita, crud hereda el default de vista (comportamiento histórico);
        // con fila explícita, cada bandera es independiente.
        if (explicit) {
          if (explicit.canCreate) map[m.key].canCreate = true;
          if (explicit.canEdit) map[m.key].canEdit = true;
          if (explicit.canDelete) map[m.key].canDelete = true;
        } else {
          map[m.key].canCreate = map[m.key].canCreate || defaultView;
          map[m.key].canEdit = map[m.key].canEdit || defaultView;
          map[m.key].canDelete = map[m.key].canDelete || defaultView;
        }
      }
    }
  }
  return map;
}

/** ¿Puede el usuario ejecutar `action` sobre `moduleKey`? (validación backend). */
export async function checkPermission(
  userId: string,
  institutionId: string,
  moduleKey: string,
  action: PermAction
): Promise<boolean> {
  const map = await getEffectivePermMap(userId, institutionId);
  const flags = map[moduleKey];
  if (!flags) return false;
  return flags[action];
}
