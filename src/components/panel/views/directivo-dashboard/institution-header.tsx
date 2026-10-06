"use client";

import { Building2, ChevronRight, GraduationCap, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DirectivoData, DirectivoDrill } from "./use-directivo-dashboard";

// ============================================================
// [Dashboard directivo — Bloque A] Header institucional con
// breadcrumb PERSISTENTE (Institución > Sede > Grado > Grupo).
// Regla dura: el breadcrumb nunca desaparece; cada nivel es
// clickeable para subir sin perder los filtros superiores.
// ============================================================

type Props = {
  data: DirectivoData;
  drill: DirectivoDrill;
  onDrill: (patch: Partial<DirectivoDrill>) => void;
};

export function InstitutionHeader({ data, drill, onDrill }: Props) {
  const { header } = data;
  // Nombres visibles de los niveles actuales del drill-down
  const sedeLabel =
    drill.sede != null
      ? (header.scope.allowedSedes ?? header.branches).find((s) => s.id === drill.sede)?.name ?? "Sede"
      : null;
  const gradoLabel =
    drill.grado != null
      ? (header.scope.allowedGrados ?? []).find((g) => g.id === drill.grado)?.name ??
        data.drill.groups.find((g) => g.id === drill.grupo)?.grado ??
        "Grado"
      : null;
  const grupoLabel = drill.grupo != null ? (data.drill.groups.find((g) => g.id === drill.grupo)?.name ?? "Grupo") : null;

  return (
    <div className="border-b bg-card/60 px-4 py-3 md:px-6" data-testid="directivo-header">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {header.logoUrl ? (
            <img src={header.logoUrl} alt={header.institutionName} className="h-9 w-9 rounded-md object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight md:text-xl">{header.institutionName}</h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              {header.period ? `${header.period.name} · ` : ""}
              {header.year}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!header.scope.allInstitution && (
            <Badge variant="outline" className="text-[11px]">
              Alcance asignado
            </Badge>
          )}
          {/* Selector de sede — solo quien alcanza varias sedes (rector) o tiene sedes asignadas */}
          {(header.scope.allInstitution || (header.scope.allowedSedes?.length ?? 0) > 0) && (
            <Select
              value={drill.sede ?? "all"}
              onValueChange={(v) => onDrill({ sede: v === "all" ? null : v, grado: null, grupo: null })}
            >
              <SelectTrigger size="sm" className="w-[11rem]" aria-label="Sede">
                <SelectValue placeholder="Todas las sedes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {(header.scope.allowedSedes ?? header.branches).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Selector de periodo — activo por defecto */}
          <Select
            value={drill.periodId ?? header.period?.id ?? "none"}
            onValueChange={(v) => onDrill({ periodId: v === "none" ? null : v })}
          >
            <SelectTrigger size="sm" className="w-[11rem]" aria-label="Periodo">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              {header.periods.length === 0 && <SelectItem value="none">Sin periodos</SelectItem>}
              {header.periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? " · activo" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Breadcrumb persistente — Invariante: presente en todos los niveles del drill-down */}
      <nav aria-label="Contexto de navegación" className="mt-2 flex flex-wrap items-center gap-1 text-sm">
        <BreadcrumbItem
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Institución"
          active={!drill.sede && !drill.grado && !drill.grupo}
          onClick={() => onDrill({ sede: null, grado: null, grupo: null })}
        />
        {sedeLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <BreadcrumbItem
              icon={<MapPin className="h-3.5 w-3.5" />}
              label={sedeLabel}
              active={!drill.grado && !drill.grupo}
              onClick={() => onDrill({ grado: null, grupo: null })}
            />
          </>
        )}
        {gradoLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <BreadcrumbItem
              icon={<GraduationCap className="h-3.5 w-3.5" />}
              label={gradoLabel}
              active={!drill.grupo}
              onClick={() => onDrill({ grupo: null })}
            />
          </>
        )}
        {grupoLabel && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <BreadcrumbItem
              icon={<Users className="h-3.5 w-3.5" />}
              label={grupoLabel}
              active
              onClick={undefined}
            />
          </>
        )}
      </nav>
    </div>
  );
}

function BreadcrumbItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={cn(
        "flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="max-w-[10rem] truncate">{label}</span>
    </button>
  );
}
