"use client";

import { useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { FileUp, Trash2, Upload, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { StudentRow } from "../student-detail-view";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (PDF pág 9)

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("No se pudo leer el archivo"));
    fr.readAsDataURL(file);
  });
}

// Redimensiona una imagen a máx 480px por lado para mantener liviano el data URL
async function resizeImage(file: File, maxSide = 480): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fileExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function FilesTab({ student }: { student: StudentRow }) {
  const user = useAuthStore((s) => s.user);
  const [photo, setPhoto] = useState<string | null>(student.photoUrl ?? null);
  const [doc, setDoc] = useState<string | null>(student.identityDocUrl ?? null);
  const [docName, setDocName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  async function patchStudent(fields: Record<string, string | null>) {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: student.id, institutionId: user.institution.id, userId: user.id, ...fields }),
      });
      const d = await res.json();
      if (!d.ok) toast.error(d.error || "No se pudo guardar");
      return d.ok;
    } finally {
      setSaving(false);
    }
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return;
    if (!["jpg", "jpeg", "png"].includes(fileExt(file.name))) {
      toast.error("La foto debe ser JPG o PNG");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("La imagen supera el límite de 2MB");
      return;
    }
    const resized = await resizeImage(file);
    setPhoto(resized);
    if (await patchStudent({ photoUrl: resized })) toast.success("Foto actualizada");
  }

  async function onDocChange(file: File | undefined) {
    if (!file) return;
    const ext = fileExt(file.name);
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      toast.error("Documento debe ser PDF, JPG o PNG");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("El documento supera el límite de 2MB");
      return;
    }
    const dataUrl = await readAsDataURL(file);
    setDoc(dataUrl);
    setDocName(file.name);
    if (await patchStudent({ identityDocUrl: dataUrl })) toast.success("Documento actualizado");
  }

  async function remove(kind: "photo" | "doc") {
    if (!confirm(kind === "photo" ? "¿Quitar la foto del estudiante?" : "¿Quitar el documento de identidad?")) return;
    if (kind === "photo") {
      if (await patchStudent({ photoUrl: null })) {
        setPhoto(null);
        toast.success("Foto eliminada");
      }
    } else {
      if (await patchStudent({ identityDocUrl: null })) {
        setDoc(null);
        setDocName("");
        toast.success("Documento eliminado");
      }
    }
  }

  return (
    <Card className="hairline rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Archivos del estudiante</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {/* Foto del estudiante */}
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {photo ? (
              <img src={photo} alt="Foto del estudiante" className="h-24 w-24 rounded-full object-cover hairline" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-secondary grid place-items-center text-muted-foreground hairline">
                <User className="h-10 w-10" />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                La foto se usará en el encabezado del estudiante y en reportes.
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" disabled={saving} onClick={() => photoInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Subir foto
                </Button>
                {photo && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" disabled={saving} onClick={() => remove("photo")}>
                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                  </Button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              onPhotoChange(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {/* Documento de identidad */}
        <div className="space-y-3">
          <div className="hairline rounded-xl border-dashed p-4 flex flex-col items-center gap-2 text-center">
            {doc ? (
              doc.startsWith("data:application/pdf") ? (
                <FileUp className="h-8 w-8 text-muted-foreground" />
              ) : (
                <img src={doc} alt="Documento de identidad" className="max-h-24 rounded-md object-contain" />
              )
            ) : (
              <FileUp className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="text-xs text-muted-foreground">
              Documento de identidad en formato PDF, JPG o PNG (máx. 2MB).
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={saving} onClick={() => docInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Subir documento
              </Button>
              {doc && (
                <>
                  <a
                    href={doc}
                    download={docName || "documento_identidad"}
                    className="inline-flex items-center h-8 px-3 text-xs rounded-md border hairline hover:bg-secondary"
                  >
                    Ver / descargar
                  </a>
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" disabled={saving} onClick={() => remove("doc")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <input
            ref={docInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              onDocChange(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
