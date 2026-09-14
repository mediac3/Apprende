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
import { ClipboardList, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ConceptFormView,
  type ConceptRecord,
  type EducationalModelOption,
} from "./concept-form-view";

type Mode = "lista" | "nuevo" | "editar";

export function ConceptsListView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution.id;
  const userId = user?.id;

  const [concepts, setConcepts] = useState<ConceptRecord[]>([]);
  const [models, setModels] = useState<EducationalModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("lista");
  const [editing, setEditing] = useState<ConceptRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConceptRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    try {
      const [conceptsRes, modelsRes] = await Promise.all([
        fetch(`/api/evaluative-concepts?institutionId=${institutionId}`).then((r) => r.json()),
        fetch(`/api/educational-models?institutionId=${institutionId}`).then((r) => r.json()),
      ]);
      if (conceptsRes.ok) setConcepts(conceptsRes.concepts ?? []);
      if (modelsRes.ok) setModels(modelsRes.models ?? []);
    } catch {
      toast.error("No se pudieron cargar los conceptos evaluativos");
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

  function openEdit(c: ConceptRecord) {
    setEditing(c);
    setMode("editar");
  }

  async function handleDelete() {
    if (!deleteTarget || !institutionId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/evaluative-concepts?id=${deleteTarget.id}&institutionId=${institutionId}&userId=${userId ?? ""}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "No se pudo eliminar");
        return;
      }
      toast.success("Concepto eliminado");
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
      <h1 className="text-2xl font-bold tracking-tight">Conceptos evaluativos</h1>

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
              {loading ? "Cargando..." : `${concepts.length} concepto(s) en ${models.length} modelo(s)`}
            </p>
            <Button size="sm" onClick={openNew}>
              <FilePlus2 className="h-4 w-4 mr-1" /> Nuevo registro
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Cargando conceptos...</div>
              ) : concepts.length === 0 ? (
                <div className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 opacity-40" />
                  <p className="text-sm">No hay conceptos evaluativos creados</p>
                  <Button size="sm" variant="outline" onClick={openNew}>
                    <FilePlus2 className="h-4 w-4 mr-1" /> Crear el primero
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">Título</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead className="w-24 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concepts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">
                              Modelo: {c.educationalModel?.name ?? c.educationalModelId}
                            </span>
                            <Badge variant="secondary" className="w-fit">{c.percentage}%</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(c)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(c)}
                              title="Eliminar"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nuevo" className="mt-4">
          {institutionId && (
            <ConceptFormView
              key="new"
              mode="new"
              models={models}
              institutionId={institutionId}
              userId={userId ?? ""}
              onBack={() => setMode("lista")}
              onSaved={() => {
                setMode("lista");
                load();
              }}
              onModelsChanged={load}
            />
          )}
        </TabsContent>

        <TabsContent value="editar" className="mt-4">
          {institutionId && editing && (
            <ConceptFormView
              key={editing.id}
              mode="edit"
              concept={editing}
              models={models}
              institutionId={institutionId}
              userId={userId ?? ""}
              onBack={() => setMode("lista")}
              onSaved={() => {
                setEditing(null);
                setMode("lista");
                load();
              }}
              onModelsChanged={load}
            />
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar concepto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleteTarget?.name}" (
              {deleteTarget?.educationalModel?.name ?? "modelo"} — {deleteTarget?.percentage}%).
              Esta acción no se puede deshacer.
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
