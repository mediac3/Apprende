"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StudentRow } from "../student-detail-view";

interface ObservationRow {
  id: string;
  date: string;
  title: string | null;
  category: string;
  type: string | null;
  description: string;
  severity: string | null;
  status: string;
  recordedBy?: { id: string; fullName: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_seguimiento: "En seguimiento",
  cerrada: "Cerrada",
};

const STATUS_CHIP: Record<string, string> = {
  abierta: "chip-bajo",
  en_seguimiento: "chip-basico",
  cerrada: "chip-superior",
};

export function CoexistenceTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch(`/api/observations?institutionId=${user.institution.id}&studentId=${student.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setObservations(d.observations);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, student.id, reloadKey]);

  // Casos de convivencia escolar (categoría convivencia) — PDF pág 1
  const cases = useMemo(
    () =>
      observations
        .filter((o) => o.category === "convivencia")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [observations]
  );

  return (
    <Card className="hairline rounded-xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          Casos de convivencia escolar
          <span className="text-xs font-normal text-muted-foreground">({cases.length})</span>
        </CardTitle>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Recargar casos"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {cases.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sin casos de convivencia registrados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Docente</TableHead>
                <TableHead className="w-28">Tipo situación</TableHead>
                <TableHead className="w-28">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-xs">{new Date(o.date).toLocaleDateString("es-CO")}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{o.title || "Sin título"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{o.description}</div>
                  </TableCell>
                  <TableCell className="text-xs">{o.recordedBy?.fullName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{o.type || "—"}</TableCell>
                  <TableCell>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md uppercase", STATUS_CHIP[o.status] ?? "chip-basico")}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
