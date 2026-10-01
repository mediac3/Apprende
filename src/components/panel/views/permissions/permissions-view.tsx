"use client";

// [F1] Vista "Permisos": matriz Rol × Sección × {Ver, Crear, Editar, Eliminar}.
// Diseño según captura de referencia: header con escudo, banner informativo,
// chips de rol por agrupación y celdas con "tira" azul primario (check blanco)
// / círculo gris (sin permiso). Fila del administrador bloqueada (todo-true).

import { Fragment, useMemo } from "react";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions, type CellFlags, type ModuleRow, type RoleRow } from "./use-permissions";

const ACTIONS: { key: keyof CellFlags; label: string }[] = [
  { key: "canView", label: "Ver" },
  { key: "canCreate", label: "Crear" },
  { key: "canEdit", label: "Editar" },
  { key: "canDelete", label: "Eliminar" },
];

const ROLE_CHIP_STYLES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
];

function PermCheckbox({
  checked,
  disabled,
  onClick,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  if (checked) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked="true"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`flex h-9 w-full items-center justify-center ${disabled ? "cursor-not-allowed bg-primary/80" : "bg-primary hover:bg-primary/90"} transition-colors`}
      >
        <Check className="h-4 w-4 text-white" strokeWidth={3} />
      </button>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked="false"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-full items-center justify-center bg-background transition-colors hover:bg-muted/50"
    >
      <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/35" />
    </button>
  );
}

export function PermissionsView() {
  const { loading, error, roles, modules, cells, adminRoleCode, dirty, dirtyCount, setCell, save, saving, reload } =
    usePermissions();

  const grouped = useMemo(() => {
    // Agrupa módulos por grupo (orden del catálogo) para subtítulos dentro de cada rol
    const byGroup = new Map<string, ModuleRow[]>();
    for (const m of modules) {
      const list = byGroup.get(m.group) ?? [];
      list.push(m);
      byGroup.set(m.group, list);
    }
    return Array.from(byGroup.entries());
  }, [modules]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permisos</h1>
          <p className="text-sm text-muted-foreground">Gestiona el acceso de roles a las secciones del sistema</p>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          El rol <span className="font-semibold text-foreground">Administrador</span> siempre tiene acceso completo a
          todas las secciones. Aquí configuras los permisos para el resto de roles (Rector, Docente, Acudiente,
          Estudiante…). Los permisos controlan qué secciones aparecen en el menú lateral y qué acciones pueden realizar.
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {roles.length} roles · {modules.length} secciones
          {dirty && <span className="ml-2 font-medium text-primary">{dirtyCount} cambios sin guardar</span>}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={reload} disabled={saving}>
              Descartar
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="sticky top-0 z-10 bg-muted/95 px-4 py-2.5 text-left font-medium backdrop-blur">Rol / Sección</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="sticky top-0 z-10 bg-muted/95 px-2 py-2.5 text-center font-medium backdrop-blur">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role, roleIdx) => {
                const isAdminRole = role.code === adminRoleCode;
                const chip = ROLE_CHIP_STYLES[roleIdx % ROLE_CHIP_STYLES.length];
                return (
                  <Fragment key={`role-block-${role.id}`}>
                    {/* Chip de rol (agrupación) */}
                    <tr>
                      <td colSpan={5} className="px-4 pt-4 pb-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${chip}`}>
                          {role.name}
                        </span>
                        {isAdminRole && (
                          <span className="ml-2 text-xs text-muted-foreground">Acceso completo (no editable)</span>
                        )}
                      </td>
                    </tr>
                    {grouped.map(([group, mods]) => (
                      <Fragment key={`role-${role.id}-group-${group}`}>
                        {mods.map((m) => {
                          const k = `${role.id}::${m.key}`;
                          const flags = cells[k] ?? { canView: false, canCreate: false, canEdit: false, canDelete: false };
                          return (
                            <tr key={`${role.id}-${m.key}`} className="border-t border-border/60">
                              <td className="px-4 py-0">
                                <div className="py-1.5">
                                  <span>{m.label}</span>
                                  <span className="ml-2 text-xs text-muted-foreground/70">{group}</span>
                                </div>
                              </td>
                              {ACTIONS.map((a) => (
                                <td key={a.key} className="w-[110px] px-2 py-0">
                                  <PermCheckbox
                                    checked={isAdminRole ? true : flags[a.key]}
                                    disabled={isAdminRole}
                                    label={`${a.label} · ${m.label} · ${role.name}`}
                                    onClick={() => setCell(role.id, role.code, m.key, a.key, !flags[a.key])}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
