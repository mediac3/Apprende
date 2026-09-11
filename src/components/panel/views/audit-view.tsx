"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import {
  ScrollText,
  Search,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Audit {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  hash: string;
  user?: { id: string; fullName: string; username: string; role: string } | null;
}

const MODULE_OPTIONS = [
  "grades",
  "attendance",
  "observations",
  "students",
  "enrollments",
  "meetings",
  "feed",
  "messages",
  "workshops",
  "orientations",
  "members",
];

export function AuditView() {
  const user = useAuthStore((s) => s.user);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<string>("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({
      institutionId: user.institution.id,
      limit: String(limit),
    });
    if (module) params.set("module", module);
    fetch(`/api/audits?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAudits(d.audits);
      })
      .finally(() => setLoading(false));
  }, [user, module, limit]);

  function reload() {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({
      institutionId: user.institution.id,
      limit: String(limit),
    });
    if (module) params.set("module", module);
    fetch(`/api/audits?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAudits(d.audits);
      })
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    if (!search) return audits;
    const q = search.toLowerCase();
    return audits.filter(
      (a) =>
        a.user?.fullName?.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.entityType.toLowerCase().includes(q) ||
        a.hash.toLowerCase().includes(q)
    );
  }, [audits, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">
          Auditoría institucional
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Trazabilidad inmutable de todas las acciones realizadas en la plataforma. Cada movimiento
          incluye usuario, módulo, entidad afectada y un hash criptográfico que garantiza la
          integridad del registro. Use los filtros para localizar eventos específicos.
        </p>
      </header>

      <Card className="hairline rounded-xl">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Usuario, acción, entidad o hash…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Módulo</Label>
            <Select value={module} onValueChange={(v) => setModule(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MODULE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary" className="ml-auto">{filtered.length} registros</Badge>
        </CardContent>
      </Card>

      <Card className="hairline rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4 text-primary" /> Registro de eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-md skeleton-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <ScrollText className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Sin registros de auditoría</div>
              <p className="text-xs text-muted-foreground max-w-xs">
                No se encontraron eventos con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Fecha y hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-28">Acción</TableHead>
                    <TableHead className="w-36">Módulo</TableHead>
                    <TableHead className="w-32">Entidad</TableHead>
                    <TableHead className="w-40">Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{a.user?.fullName ?? "Sistema"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {a.user?.role ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{a.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-primary">{a.module}</TableCell>
                      <TableCell className="text-xs">{a.entityType}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground">
                        {a.hash?.slice(0, 12)}…
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setLimit((l) => l + 50)}
                >
                  <ChevronDown className="h-3.5 w-3.5" /> Cargar más (siguientes 50)
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
