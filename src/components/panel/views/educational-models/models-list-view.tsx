"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GraduationCap, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModelFormView, type EducationalModelFull } from "./model-form-view";

type Mode = "lista" | "nuevo" | "editar";

// Mismo mapeo de labels que el formulario (2 semestres, 3 cuatrimestres, 4 trimestres, 6 bimestres)
function periodsLabelFor(count: number): string {
  if (count === 2) return "Semestres";
  if (count === 3) return "Cuatrimestres";
  if (count === 4) return "Trimestres";
  if (count === 6) return "Bimestres";
  return "Periodos";
}

function htmlToText(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function ModelsListView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution.id;
  const userId = user?.id;

  const [models, setModels] = useState<EducationalModelFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("lista");
  const [editing, setEditing] = useState<EducationalModelFull | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EducationalModelFull | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/educational-models?institutionId=${institutionId}`);
      const data = await res.json();
      if (data.ok) setModels(data.models ?? []);
    } catch {
      toast.error("No se pudieron cargar los modelos educativos");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setMode("nuevo");
  }

  function openEdit(m: EducationalModelFull) {
    setEditing(m);
    setMode("editar");
  }

  async function handleDelete() {
    if (!deleteTarget || !institutionId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/educational-models?id=${deleteTarget.id}&institutionId=${institutionId}&userId=${userId ?? ""}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "No se pudo eliminar");
        return;
      }
      toast.success("Modelo educativo eliminado");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Error de red al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Modelos educativos</h1>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="nuevo">Nuevo</TabsTrigger>
          <TabsTrigger value="editar" disabled={!editing}>
            Editar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? "Cargando..." : `${models.length} modelo(s) educativo(s)`}
            </p>
            <Button size="sm" onClick={openNew}>
              <FilePlus2 className="h-4 w-4 mr-1" /> Nuevo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Cargando modelos educativos...</div>
              ) : models.length === 0 ? (
                <div className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-8 w-8 opacity-40" />
                  <p className="text-sm">No hay modelos educativos creados</p>
                  <Button size="sm" variant="outline" onClick={openNew}>
                    <FilePlus2 className="h-4 w-4 mr-1" /> Crear el primero
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[25%]">Nombre</TableHead>
                      <TableHead>Periodos</TableHead>
                      <TableHead className="w-28">Conceptos</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead className="w-24 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map((m) => {
                      const detailsText = htmlToText(m.details);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{periodsLabelFor(m.periodCount)}</span>
                              <Badge variant="secondary">{m.periodCount}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{m.concepts?.length ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <span className="text-sm text-muted-foreground truncate block" title={detailsText}>
                              {detailsText ? (detailsText.length > 80 ? `${detailsText.slice(0, 80)}…` : detailsText) : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(m)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(m)}
                                title="Eliminar"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nuevo" className="mt-4">
          {institutionId && (
            <ModelFormView
              key="new"
              mode="new"
              institutionId={institutionId}
              userId={userId ?? ""}
              onBack={() => setMode("lista")}
              onSaved={() => {
                setMode("lista");
                load();
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="editar" className="mt-4">
          {institutionId && editing && (
            <ModelFormView
              key={editing.id}
              mode="edit"
              model={editing}
              institutionId={institutionId}
              userId={userId ?? ""}
              onBack={() => setMode("lista")}
              onSaved={() => {
                setEditing(null);
                setMode("lista");
                load();
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar modelo educativo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleteTarget?.name}" con sus {deleteTarget?.concepts?.length ?? 0} concepto(s) evaluativo(s).
              Los periodos con calificaciones asociadas se conservan desvinculados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
