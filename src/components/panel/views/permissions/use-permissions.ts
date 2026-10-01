"use client";

// [F1] Hook de carga y guardado de la matriz de permisos (API /api/permissions).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface ModuleRow {
  key: string;
  label: string;
  group: string;
}

export interface CellFlags {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

type CellsMap = Record<string, CellFlags>;

const cellKey = (roleId: string, moduleKey: string) => `${roleId}::${moduleKey}`;

const sameFlags = (a: CellFlags, b: CellFlags) =>
  a.canView === b.canView && a.canCreate === b.canCreate && a.canEdit === b.canEdit && a.canDelete === b.canDelete;

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution.id ?? "";
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [cells, setCells] = useState<CellsMap>({});
  const [adminRoleCode, setAdminRoleCode] = useState<string>("administrador");
  const [saving, setSaving] = useState(false);
  const initialRef = useRef<CellsMap>({});

  const load = useCallback(async () => {
    if (!institutionId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/permissions?institutionId=${encodeURIComponent(institutionId)}&userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.message || json?.error || "No se pudieron cargar los permisos");
        return;
      }
      const next: CellsMap = {};
      for (const c of json.cells as (CellFlags & { roleId: string; moduleKey: string })[]) {
        next[cellKey(c.roleId, c.moduleKey)] = { canView: c.canView, canCreate: c.canCreate, canEdit: c.canEdit, canDelete: c.canDelete };
      }
      setRoles(json.roles as RoleRow[]);
      setModules(json.modules as ModuleRow[]);
      setAdminRoleCode((json.adminRoleCode as string) || "administrador");
      setCells(next);
      initialRef.current = next;
    } catch {
      setError("Error de red al cargar los permisos");
    } finally {
      setLoading(false);
    }
  }, [institutionId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const setCell = useCallback(
    (roleId: string, roleCode: string, moduleKey: string, action: keyof CellFlags, value: boolean) => {
      if (roleCode === adminRoleCode) return; // regla dura: admin no editable
      const k = cellKey(roleId, moduleKey);
      setCells((prev) => {
        const cur = prev[k] ?? { canView: false, canCreate: false, canEdit: false, canDelete: false };
        if (cur[action] === value) return prev;
        // Regla de coherencia visual: para actuar (crear/editar/eliminar) se requiere Ver
        const next = { ...cur, [action]: value };
        if (action !== "canView" && value) next.canView = true;
        if (action === "canView" && !value) {
          next.canCreate = false;
          next.canEdit = false;
          next.canDelete = false;
        }
        return { ...prev, [k]: next };
      });
    },
    [adminRoleCode]
  );

  const dirtyCells = useMemo(() => {
    const changed: { roleId: string; moduleKey: string; flags: CellFlags }[] = [];
    for (const [k, flags] of Object.entries(cells)) {
      const before = initialRef.current[k];
      if (!before || !sameFlags(before, flags)) {
        const [roleId, moduleKey] = k.split("::");
        changed.push({ roleId, moduleKey, flags });
      }
    }
    return changed;
  }, [cells]);

  const dirty = dirtyCells.length > 0;

  const save = useCallback(async (): Promise<boolean> => {
    if (!institutionId || !userId || dirtyCells.length === 0) return false;
    setSaving(true);
    try {
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          userId,
          entries: dirtyCells.map((c) => ({ roleId: c.roleId, moduleKey: c.moduleKey, ...c.flags })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json?.message || "No se pudieron guardar los permisos");
        return false;
      }
      toast.success(`Permisos actualizados (${json.saved} ${json.saved === 1 ? "cambio" : "cambios"})`);
      initialRef.current = cells;
      return true;
    } catch {
      toast.error("Error de red al guardar los permisos");
      return false;
    } finally {
      setSaving(false);
    }
  }, [institutionId, userId, dirtyCells, cells]);

  return { loading, error, roles, modules, cells, adminRoleCode, dirty, dirtyCount: dirtyCells.length, setCell, save, saving, reload: load };
}
