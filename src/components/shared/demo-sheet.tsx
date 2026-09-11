"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { CheckCircle2, Send } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { toast } from "sonner";

export function DemoSheet() {
  const open = useUIStore((s) => s.demoSheetOpen);
  const setOpen = useUIStore((s) => s.setDemoSheet);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setSubmitted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Solicitud recibida — le contactaremos en menos de 24 horas hábiles.");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 animate-slide-in-right"
      >
        <div className="h-1.5 bg-primary" />
        <div className="p-6 h-full flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-xl">Solicitar demostración</SheetTitle>
            <SheetDescription>
              Configuremos un ambiente para su institución. Sin compromiso.
            </SheetDescription>
          </SheetHeader>

          {submitted ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="h-16 w-16 rounded-full chip-superior grid place-items-center mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-heading text-xl font-semibold mb-2">
                Solicitud recibida
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Nuestro equipo institucional le contactará en menos de 24 horas hábiles
                con un ambiente de prueba configurado para su institución.
              </p>
              <Button
                className="mt-6"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="demo-name">Nombre completo</Label>
                <Input id="demo-name" required placeholder="Rectora / Coordinador" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-inst">Institución educativa</Label>
                <Input id="demo-inst" required placeholder="Institución Educativa..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="demo-email">Correo</Label>
                  <Input id="demo-email" type="email" required placeholder="correo@colegio.edu.co" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-phone">Teléfono</Label>
                  <Input id="demo-phone" required placeholder="+57 ..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-students">Número aproximado de estudiantes</Label>
                <Input id="demo-students" type="number" min={50} placeholder="300" />
              </div>
              <SheetFooter className="mt-6 px-0">
                <Button type="submit" className="w-full gap-2">
                  <Send className="h-4 w-4" />
                  Enviar solicitud
                </Button>
              </SheetFooter>
              <p className="text-xs text-muted-foreground text-center mt-2 leading-relaxed">
                Sus datos se tratarán conforme a la Ley 1581 de 2012 (Colombia) y GDPR.
              </p>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
