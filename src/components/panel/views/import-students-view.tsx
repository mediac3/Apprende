"use client";

// Wizard de importación masiva de estudiantes desde Excel [F3].
// 5 pasos: subir archivo → mapeo automático → validación previa →
// vista previa por grupo → confirmación y resultado.
// Regla dura: no se importa nada con documentos duplicados (archivo o BD).

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  SIMAT_FIELDS,
  REQUIRED_FIELDS,
  suggestField,
  normHeader,
  normalizeValue,
  type SimatField,
} from "@/lib/simat-import";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  Download,
  ArrowLeft,
  ArrowRight,
  Database,
} from "lucide-react";

const XLSX_MIME = ".xlsx,.xls";
type RowErrors = { row: number; message: string }[];

function toCsv(headers: string[], rows: (string | number | boolean | null)[][]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
}

function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImportStudentsView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution.id ?? "";
  const [step, setStep] = useState(0);

  // Paso 1: archivo
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");

  // Paso 2: mapeo
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowsRaw, setRowsRaw] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, SimatField | "">>({});

  // Catálogos
  const [grades, setGrades] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; gradeLevelId?: string | null }[]>([]);
  const [yearId, setYearId] = useState("");
  const [yearName, setYearName] = useState("");

  // Paso 3/4/5
  const [errors, setErrors] = useState<RowErrors>([]);
  const [resolved, setResolved] = useState<Record<string, any>[]>([]);
  const [result, setResult] = useState<{ imported?: number; error?: string; detail?: any } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      fetch(`/api/grade-levels?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/groups?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/academic-years?institutionId=${institutionId}`).then((r) => r.json()),
    ])
      .then(([dl, dg, dy]) => {
        if (dl.ok) setGrades(dl.gradeLevels);
        if (dg.ok) setGroups(dg.groups);
        if (dy.ok) {
          const active = dy.years.find((y: any) => y.active) ?? dy.years[0];
          if (active) { setYearId(active.id); setYearName(active.name ?? String(active.year ?? "")); }
        }
      })
      .catch(() => toast.error("No se pudieron cargar catálogos (grados, grupos, año)"));
  }, [institutionId]);

  // --- Paso 1: parseo del Excel en el navegador ---
  const [lastWb, setLastWb] = useState<any>(null);

  async function onFile(f: File) {
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { sheetStubs: true });
      setLastWb(wb);
      setSheets(wb.SheetNames);
      setFileName(f.name);
      if (wb.SheetNames.length) pickSheet(wb, wb.SheetNames[0], XLSX);
      toast.success(`Archivo "${f.name}" cargado`);
    } catch {
      toast.error("No se pudo leer el archivo Excel");
    }
  }

  async function reSuggestSheet(name: string) {
    const XLSX = await import("xlsx");
    if (lastWb) pickSheet(lastWb, name, XLSX);
  }

  function pickSheet(wb: any, name: string, XLSX: any) {
    setSheet(name);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" }) as string[][];
    const hIdx = rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 5);
    const h = (hIdx >= 0 ? rows[hIdx] : rows[0] ?? []).map((c) => String(c).trim());
    const data = rows.slice((hIdx >= 0 ? hIdx : 0) + 1).filter((r) => r.some((c) => String(c).trim()));
    setHeaders(h);
    setRowsRaw(data);
    // Mapeo automático inicial, sin colisiones
    const used = new Set<SimatField>();
    const m: Record<number, SimatField | ""> = {};
    h.forEach((col, i) => {
      const sug = suggestField(col);
      m[i] = sug && !used.has(sug) ? sug : "";
      if (m[i]) used.add(m[i] as SimatField);
    });
    setMapping(m);
    setResult(null);
    setErrors([]);
  }

  const mappedFields = Object.values(mapping).filter(Boolean) as SimatField[];
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mappedFields.includes(f));

  // --- Paso 3: validación previa ---
  const validate = useCallback((): { ok: boolean; errors: RowErrors; rows: Record<string, any>[] } => {
    const errs: RowErrors = [];
    const out: Record<string, any>[] = [];
    const seenDoc = new Map<string, number>();
    const gradeByName = new Map(grades.map((g) => [normHeader(g.name), g.id]));

    rowsRaw.forEach((raw, idx) => {
      const n = idx + 1;
      const row: Record<string, any> = {};
      for (const [colStr, field] of Object.entries(mapping)) {
        const col = Number(colStr);
        if (!field) continue;
        const value = String(raw[col] ?? "").trim();
        if (!value) { row[field] = null; continue; }
        const { v, error } = normalizeValue(field, value);
        if (error) { errs.push({ row: n, message: error }); row[field] = null; continue; }
        row[field] = v;
      }
      // Requeridos
      for (const req of ["documentNumber", "documentType", "lastName1", "firstName1", "grupo"]) {
        if (!String(row[req] ?? "").trim()) {
          const label = SIMAT_FIELDS.find((f) => f.key === req)?.label ?? req;
          errs.push({ row: n, message: `${label} vacío` });
        }
      }
      // Duplicado dentro del archivo
      const doc = String(row.documentNumber ?? "").trim();
      if (doc) {
        if (seenDoc.has(doc)) errs.push({ row: n, message: `Documento ${doc} duplicado (también en fila ${seenDoc.get(doc)})` });
        else seenDoc.set(doc, n);
      }
      // Resolver grupo por nombre exacto (trim)
      const groupName = String(row.grupo ?? "").trim();
      if (groupName) {
        const g = groups.find((gg) => gg.name.trim() === groupName);
        if (!g) {
          errs.push({ row: n, message: `Grupo "${groupName}" no existe en el sistema` });
        } else {
          row.groupId = g.id;
          // Coherencia Grado ↔ Grupo
          const gradeVal = String(row.grado ?? "").trim();
          if (gradeVal && g.gradeLevelId) {
            const expected = grades.find((x) => x.id === g.gradeLevelId);
            if (expected && normHeader(expected.name) !== normHeader(gradeVal) && !gradeByName.has(normHeader(gradeVal))) {
              errs.push({ row: n, message: `Grupo "${groupName}" no pertenece al grado "${gradeVal}"` });
            } else if (expected && normHeader(expected.name) !== normHeader(gradeVal)) {
              const byId = gradeByName.get(normHeader(gradeVal));
              if (byId && byId !== g.gradeLevelId) {
                errs.push({ row: n, message: `Grupo "${groupName}" no pertenece al grado "${gradeVal}"` });
              }
            }
          }
        }
      }
      out.push(row);
    });
    return { ok: errs.length === 0, errors: errs, rows: out };
  }, [rowsRaw, mapping, groups, grades]);

  function runValidate() {
    const { ok, errors: errs, rows } = validate();
    setErrors(errs);
    setResolved(rows);
    if (ok) {
      toast.success(`${rows.length} filas validadas sin errores`);
      setStep(3);
    } else {
      toast.error(`${errs.length} errores de validación`);
    }
  }

  // --- Paso 4: desglose por Grado → Grupo ---
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of resolved) {
      const g = groups.find((x) => x.id === r.groupId);
      const gradeName = grades.find((x) => x.id === g?.gradeLevelId)?.name ?? "Sin grado";
      const key = `${gradeName} → ${g?.name ?? "?"}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([k, n]) => ({ k, n }));
  }, [resolved, groups, grades]);

  // --- Paso 5: importar ---
  async function doImport() {
    if (!institutionId) return;
    setBusy(true);
    // Campos institucionales (F1): si el Excel los trae, se actualizan aparte
    const inst: Record<string, string> = {};
    for (const k of ["etc", "calendario", "sector", "zonaSede", "jornada"]) {
      const v = resolved.find((r) => r[k])?.[k];
      if (typeof v === "string" && v.trim()) inst[k] = v.trim();
    }
    const payloadRows = resolved.map((r) => {
      const { etc: _e, calendario: _c, sector: _s, zonaSede: _z, jornada: _j, ...rest } = r;
      return rest;
    });
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, userId: user?.id, academicYearId: yearId || undefined, rows: payloadRows, institutionFields: inst }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setResult({ imported: d.imported });
        setStep(4);
        toast.success(`${d.imported} estudiantes importados`);
      } else {
        setResult({ error: d.error || "Error de importación", detail: d });
        setStep(4);
      }
    } catch {
      setResult({ error: "Error de red durante la importación" });
      setStep(4);
    } finally {
      setBusy(false);
    }
  }

  const STEPS = ["Archivo", "Mapeo", "Validación", "Vista previa", "Resultado"];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Importar estudiantes</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Asistente de importación masiva desde Excel SIMAT. Regla dura: no se importa nada con documentos duplicados.
          {yearName ? <> Año de matrícula: <strong>{yearName}</strong>.</> : null}
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
              {i + 1}. {s}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
          </div>
        ))}
      </div>

      {/* Paso 1 — Archivo */}
      {step === 0 && (
        <Card className="hairline">
          <CardHeader><CardTitle className="text-sm">Paso 1 · Subir archivo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Label className="text-xs text-muted-foreground">Archivo Excel (.xlsx o .xls) con encabezados en la primera fila</Label>
            <Input type="file" accept={XLSX_MIME} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} className="max-w-md" />
            {sheets.length > 0 && (
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-xs text-muted-foreground">Hoja</Label>
                <Select value={sheet} onValueChange={(v) => reSuggestSheet(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {headers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <strong>{fileName}</strong> · hoja “{sheet}” · {headers.length} columnas · {rowsRaw.length} filas de datos
              </p>
            )}
            <div className="flex justify-end">
              <Button disabled={headers.length === 0} onClick={() => setStep(1)} className="gap-1.5">
                Continuar al mapeo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {headers.length > 0 && missingRequired.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Faltan columnas requeridas sin sugerir: revisa el mapeo. (Faltan: {missingRequired.map((f) => SIMAT_FIELDS.find((x) => x.key === f)?.label).join(", ")})
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Paso 2 — Mapeo */}
      {step === 1 && (
        <Card className="hairline">
          <CardHeader><CardTitle className="text-sm">Paso 2 · Mapeo de columnas → campos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Columna Excel</th>
                    <th className="py-2 pr-3">Campo</th>
                    <th className="py-2 pr-3">Ejemplo</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, i) => {
                    const field = mapping[i] ?? "";
                    const example = rowsRaw[0]?.[i] ?? "";
                    const isReq = field ? (SIMAT_FIELDS.find((f) => f.key === field)?.required ?? false) : false;
                    const dupCount = mappedFields.filter((f) => field && f === field).length;
                    const conflicted = field && dupCount > 1;
                    return (
                      <tr key={i} className="border-t">
                        <td className="py-1.5 pr-3 font-medium">{h}</td>
                        <td className="py-1.5 pr-3 w-64">
                          <Select
                            value={field}
                            onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v === "none" ? "" : (v as SimatField) }))}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="— Ignorar —" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Ignorar —</SelectItem>
                              {SIMAT_FIELDS.map((f) => (
                                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1.5 pr-3 max-w-40 truncate text-muted-foreground" title={String(example)}>{String(example)}</td>
                        <td className="py-1.5">
                          {conflicted ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">campo duplicado</span>
                          ) : field ? (
                            <span className={`text-xs ${isReq ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                              {isReq ? "✓ requerido mapeado" : "opcional"}
                            </span>
                          ) : (
                            <span className="text-xs text-red-600 dark:text-red-400">sin mapear</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {missingRequired.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Campos requeridos sin mapear: {missingRequired.map((f) => SIMAT_FIELDS.find((x) => x.key === f)?.label).join(", ")}
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Atrás</Button>
              <Button disabled={missingRequired.length > 0 || rowsRaw.length === 0} onClick={() => { setStep(2); }} className="gap-1.5">
                Validar filas <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3 — Validación */}
      {step === 2 && (
        <Card className="hairline">
          <CardHeader><CardTitle className="text-sm">Paso 3 · Validación previa ({rowsRaw.length} filas)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {errors.length === 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Todas las filas son válidas. Puedes continuar.
              </p>
            ) : (
              <>
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> {errors.length} errores en {new Set(errors.map((e) => e.row)).size} filas. Corrige el archivo y vuelve a subirlo.
                </p>
                <div className="max-h-64 overflow-y-auto rounded border p-2 space-y-1">
                  {errors.slice(0, 300).map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">Fila {e.row}: {e.message}</p>
                  ))}
                  {errors.length > 300 && <p className="text-xs">…y {errors.length - 300} errores más (descarga el CSV)</p>}
                </div>
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Atrás</Button>
              <div className="flex gap-2">
                {errors.length > 0 && (
                  <Button variant="outline" className="gap-1.5" onClick={() => downloadCsv("errores-importacion.csv", toCsv(["Fila", "Error"], errors.map((e) => [e.row, e.message])))}>
                    <Download className="h-4 w-4" /> Descargar errores CSV
                  </Button>
                )}
                <Button disabled={errors.length > 0 || resolved.length === 0} onClick={() => setStep(3)} className="gap-1.5">
                  Siguiente <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 4 — Vista previa */}
      {step === 3 && (
        <Card className="hairline">
          <CardHeader><CardTitle className="text-sm">Paso 4 · Vista previa por grupo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">Total de estudiantes a matricular: <strong>{resolved.length}</strong></p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Grado</th>
                    <th className="py-2 pr-3">Grupo</th>
                    <th className="py-2">Estudiantes nuevos</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => {
                    const [grado, grupo] = b.k.split(" → ");
                    return (
                      <tr key={b.k} className="border-t">
                        <td className="py-1.5 pr-3">{grado}</td>
                        <td className="py-1.5 pr-3 font-medium">{grupo}</td>
                        <td className="py-1.5">{b.n}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="max-h-52 overflow-y-auto rounded border p-2">
              {resolved.slice(0, 200).map((r, i) => (
                <p key={i} className="text-xs">
                  {String(r.documentNumber)} · {[r.lastName1, r.lastName2, r.firstName1, r.firstName2].filter(Boolean).join(" ")} · {groups.find((g) => g.id === r.groupId)?.name}
                </p>
              ))}
              {resolved.length > 200 && <p className="text-xs text-muted-foreground">…y {resolved.length - 200} más</p>}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Atrás</Button>
              <Button disabled={busy} onClick={doImport} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Database className="h-4 w-4" /> {busy ? `Importando ${resolved.length} filas…` : `Importar ${resolved.length} estudiantes`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 5 — Resultado */}
      {step === 4 && (
        <Card className="hairline">
          <CardHeader><CardTitle className="text-sm">Paso 5 · Resultado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result?.imported != null ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> {result.imported} estudiantes importados correctamente (matrícula {yearName || "año activo"}).
              </p>
            ) : (
              <>
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> No se importó ningún estudiante. {result?.error ?? ""}
                </p>
                {result?.detail?.dupInFile && (
                  <div className="max-h-40 overflow-y-auto rounded border p-2">
                    {result.detail.dupInFile.map((s: string, i: number) => <p key={i} className="text-xs">{s}</p>)}
                  </div>
                )}
                {result?.detail?.dupInDb && (
                  <p className="text-xs text-muted-foreground">Documentos ya existentes en BD: {result.detail.dupInDb.join(", ")}</p>
                )}
                {result?.detail?.rowErrors && (
                  <div className="max-h-40 overflow-y-auto rounded border p-2">
                    {result.detail.rowErrors.map((e: any, i: number) => <p key={i} className="text-xs">Fila {e.row}: {e.message}</p>)}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" className="gap-1.5" onClick={() => { setStep(0); setResult(null); }}>
                <Upload className="h-4 w-4" /> Importar otro archivo
              </Button>
              {result?.imported != null && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => downloadCsv(
                    "reporte-importacion.csv",
                    toCsv(["Documento", "Nombre completo", "Grupo"], resolved.map((r) => [r.documentNumber, [r.lastName1, r.lastName2, r.firstName1, r.firstName2].filter(Boolean).join(" "), groups.find((g) => g.id === r.groupId)?.name ?? ""]))
                  )}
                >
                  <Download className="h-4 w-4" /> Descargar reporte CSV
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
