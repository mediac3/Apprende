"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Download, Plus, Trash2 } from "lucide-react";
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
import { toast } from "sonner";
import type { StudentRow } from "../student-detail-view";
import { AddCertificateModal } from "../modals/add-certificate-modal";

export interface CertificateRow {
  id: string;
  year: number;
  gradeLevel: string | null;
  institutionName: string;
  city: string | null;
  observation: string | null;
  fileName: string | null;
  fileType: string | null;
  fileData: string | null;
}

export function CertificatesTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch(`/api/external-certificates?institutionId=${user.institution.id}&studentId=${student.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setCertificates(d.certificates);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, student.id, reloadKey]);

  async function remove(c: CertificateRow) {
    if (!user || !confirm(`¿Eliminar el certificado de ${c.year} (${c.institutionName})?`)) return;
    const res = await fetch(
      `/api/external-certificates?id=${c.id}&institutionId=${user.institution.id}&userId=${user.id}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (d.ok) {
      toast.success("Certificado eliminado");
      setReloadKey((k) => k + 1);
    } else toast.error(d.error || "No se pudo eliminar");
  }

  return (
    <Card className="hairline rounded-xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Certificados anteriores</CardTitle>
        <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Agregar certificado
        </Button>
      </CardHeader>
      <CardContent>
        {certificates.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sin certificados de otras instituciones registrados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Año</TableHead>
                <TableHead className="w-20">Grado</TableHead>
                <TableHead>Establecimiento</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Observación</TableHead>
                <TableHead className="w-28">Adjunto</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium tabular-nums">{c.year}</TableCell>
                  <TableCell className="text-xs">{c.gradeLevel ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.institutionName}</TableCell>
                  <TableCell className="text-xs">{c.city ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.observation || "—"}</TableCell>
                  <TableCell>
                    {c.fileData ? (
                      <a
                        href={c.fileData}
                        download={c.fileName || `certificado_${c.year}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {c.fileName ?? "Adjunto"}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      aria-label="Eliminar certificado"
                      onClick={() => remove(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AddCertificateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        studentId={student.id}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </Card>
  );
}
