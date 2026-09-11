"use client";

import { ModuleField } from "./field-catalog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useRef, useEffect, useState } from "react";
import { Star, PenTool, X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldRendererProps {
  field: ModuleField;
  value: any;
  onChange: (val: any) => void;
  error?: string;
  // Para campos académicos: opciones precargadas
  academicOptions?: { id: string; label: string }[];
}

export function FieldRenderer({ field, value, onChange, error, academicOptions }: FieldRendererProps) {
  const fieldId = `field-${field.id}`;
  const colSpan = field.width === "half" ? "sm:col-span-1" : field.width === "third" ? "sm:col-span-1 lg:col-span-1" : "sm:col-span-2";

  if (field.type === "section") {
    return (
      <div className="sm:col-span-2 mt-4 first:mt-0">
        <div className="hairline-t pt-3">
          <h4 className="font-heading font-semibold text-sm">{field.label}</h4>
          {field.helpText && <p className="text-xs text-muted-foreground mt-0.5">{field.helpText}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", colSpan)}>
      <Label htmlFor={fieldId} className="text-sm font-medium flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>

      <FieldInput field={field} value={value} onChange={onChange} fieldId={fieldId} academicOptions={academicOptions} />

      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function FieldInput({ field, value, onChange, fieldId, academicOptions }: Omit<FieldRendererProps, "error"> & { fieldId: string }) {
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "zip":
    case "mask":
    case "currency":
      return (
        <Input
          id={fieldId}
          type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      );

    case "number":
      return (
        <Input
          id={fieldId}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          required={field.required}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={fieldId}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows || 4}
          required={field.required}
        />
      );

    case "date":
      return (
        <Input
          id={fieldId}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger id={fieldId}>
            <SelectValue placeholder={field.placeholder || "Seleccionar..."} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "radio":
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange} className="flex flex-wrap gap-3 pt-1">
          {(field.options || []).map((opt) => (
            <div key={opt.value} className="flex items-center gap-1.5">
              <RadioGroupItem id={`${fieldId}-${opt.value}`} value={opt.value} />
              <Label htmlFor={`${fieldId}-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "checkbox":
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {(field.options || []).map((opt) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt.value);
            return (
              <div key={opt.value} className="flex items-center gap-1.5">
                <Checkbox
                  id={`${fieldId}-${opt.value}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onChange([...arr, opt.value]);
                    else onChange(arr.filter((v: string) => v !== opt.value));
                  }}
                />
                <Label htmlFor={`${fieldId}-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
              </div>
            );
          })}
        </div>
      );

    case "file":
      return (
        <Input
          id={fieldId}
          type="file"
          accept={field.accept}
          multiple={field.multiple}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            onChange(files.map((f) => f.name).join("; "));
          }}
        />
      );

    case "rating":
      return (
        <div className="flex gap-1 pt-1">
          {Array.from({ length: field.max || 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i + 1)}
              className="p-0.5"
              aria-label={`${i + 1} estrellas`}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  i < (value || 0) ? "fill-warning text-warning" : "text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
      );

    case "slider":
      return (
        <div className="pt-2">
          <Slider
            value={[value ?? field.min ?? 0]}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onValueChange={([v]) => onChange(v)}
          />
          <div className="text-xs text-muted-foreground mt-1 text-right tabular-nums">{value ?? field.min ?? 0}</div>
        </div>
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value ?? "#2F4A6D"}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 rounded-md border border-border cursor-pointer"
          />
          <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="#2F4A6D" />
        </div>
      );

    case "toggle":
      return (
        <Switch
          checked={!!value}
          onCheckedChange={onChange}
        />
      );

    case "student":
    case "group":
    case "subject":
    case "teacher":
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger id={fieldId}>
            <SelectValue placeholder={field.placeholder || "Seleccionar..."} />
          </SelectTrigger>
          <SelectContent>
            {(academicOptions || []).map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "signature":
      return <SignatureField value={value} onChange={onChange} fieldId={fieldId} />;

    case "captcha":
      return <CaptchaField value={value} onChange={onChange} fieldId={fieldId} type={field.captchaType || "math"} />;

    case "formula":
      // Solo lectura: el valor se calcula en base a otros campos
      return (
        <Input
          id={fieldId}
          value={value ?? ""}
          readOnly
          placeholder="Calculado automáticamente"
          className="bg-secondary/40"
        />
      );

    case "map":
      return (
        <Input
          id={fieldId}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Lat, Lng — ej: 4.7110, -74.0721"
        />
      );

    case "repeatable":
      return <RepeatableField field={field} value={value} onChange={onChange} fieldId={fieldId} />;

    default:
      return <Input id={fieldId} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function SignatureField({ value, onChange, fieldId }: { value: any; onChange: (v: any) => void; fieldId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "var(--app-fg)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    setDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    setDrawing(false);
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="hairline rounded-md overflow-hidden bg-[var(--app-card)]">
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <PenTool className="h-3 w-3" /> Dibuje su firma arriba
        </span>
        <Button type="button" variant="outline" size="sm" onClick={clear} className="gap-1.5">
          <Trash2 className="h-3 w-3" /> Limpiar
        </Button>
      </div>
    </div>
  );
}

function CaptchaField({ value, onChange, fieldId, type }: { value: any; onChange: (v: any) => void; fieldId: string; type: "math" | "text" }) {
  const [a] = useState(() => Math.floor(Math.random() * 9) + 1);
  const [b] = useState(() => Math.floor(Math.random() * 9) + 1);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (type === "math") {
      // La "respuesta correcta" se guarda en value para validar en servidor
      onChange({ question: `${a} + ${b}`, expected: a + b, userAnswer: answer });
    }
  }, [answer]);

  return (
    <div className="flex items-center gap-2">
      <div className="hairline rounded-md px-3 py-1.5 bg-secondary/40 font-mono text-sm">
        {type === "math" ? `${a} + ${b} = ?` : "Verificación humana"}
      </div>
      <Input
        id={fieldId}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Respuesta"
        className="w-32"
        required
      />
    </div>
  );
}

function RepeatableField({ field, value, onChange, fieldId }: { field: ModuleField; value: any; onChange: (v: any) => void; fieldId: string }) {
  const rows: any[] = Array.isArray(value) ? value : [];

  function addRow() {
    onChange([...rows, {}]);
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, data: any) {
    const next = [...rows];
    next[idx] = { ...next[idx], ...data };
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <Input
            placeholder={`Fila ${idx + 1}`}
            value={Object.values(row).join(", ")}
            onChange={(e) => updateRow(idx, { value: e.target.value })}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => removeRow(idx)} aria-label="Eliminar fila">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Agregar fila
      </Button>
    </div>
  );
}

// ============================================================
// Renderiza un valor para mostrarlo en la tabla (read-only)
// ============================================================

export function FieldValueDisplay({ field, value }: { field: ModuleField; value: any }) {
  if (value === undefined || value === null || value === "") return <span className="text-muted-foreground">—</span>;

  switch (field.type) {
    case "checkbox":
      return <span>{Array.isArray(value) ? value.join(", ") : String(value)}</span>;
    case "rating":
      return (
        <span className="flex items-center gap-0.5">
          {Array.from({ length: field.max || 5 }).map((_, i) => (
            <Star key={i} className={cn("h-3 w-3", i < value ? "fill-warning text-warning" : "text-muted-foreground/40")} />
          ))}
        </span>
      );
    case "toggle":
      return <span className={value ? "chip-superior px-2 py-0.5 rounded text-xs" : "chip-bajo px-2 py-0.5 rounded text-xs"}>{value ? "Sí" : "No"}</span>;
    case "color":
      return (
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full hairline" style={{ background: value }} />
          <span className="font-mono text-xs">{value}</span>
        </span>
      );
    case "select":
    case "radio": {
      const opt = field.options?.find((o) => o.value === value);
      return <span>{opt?.label || value}</span>;
    }
    case "student":
    case "group":
    case "subject":
    case "teacher":
      return <span className="font-mono text-xs">{value}</span>;
    case "signature":
      return value ? <span className="text-xs italic text-muted-foreground">[Firmado]</span> : <span className="text-muted-foreground">—</span>;
    case "captcha":
      return <span className="text-xs">Verificado</span>;
    case "date":
      return <span className="text-xs">{new Date(value).toLocaleDateString("es-CO")}</span>;
    case "file":
      return <span className="text-xs truncate max-w-[180px] inline-block align-bottom">{String(value)}</span>;
    case "currency":
      return <span className="tabular-nums">${Number(value).toLocaleString("es-CO")}</span>;
    default:
      return <span>{String(value).length > 80 ? String(value).slice(0, 80) + "…" : String(value)}</span>;
  }
}
