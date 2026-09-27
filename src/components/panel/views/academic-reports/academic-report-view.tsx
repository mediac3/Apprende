"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// === [F3] Informes académicos — Informe valorativo periódico ===
// Filtros: Año / Periodo / Grupo / Estudiante / Asignatura. La tabla reutiliza
// el motor del consolidado (API /api/academic-reports/valorativo) y añade
// escala cualitativa, puesto por asignatura, inasistencias por periodo,
// ficha del observador y firma del director de grupo.

interface YearOption { id: string; year: number; active: boolean }
interface PeriodOption { id: string; name: string; startDate: string; endDate: string }
interface GroupOption { id: string; name: string }
interface StudentOption { id: string; firstName: string; lastName: string }

interface InformeStudent {
  id: string; fullName: string; document: string | null;
  def: Record<string, Record<string, number | null>>;
  defFinal: Record<string, number | null>;
  promFinal: number | null;
  pt: number | null;
  inas: Record<string, { x: number; e: number; t: number }>;
}

interface Informe {
  institution: { name: string; logoUrl: string | null; nit: string | null; dane: string | null; city: string | null } | null;
  group: { id: string; name: string; sede: string | null; director: string | null };
  period: { id: string; name: string; order: number };
  periods: Array<{ id: string; name: string; order: number; weight: number }>;
  scales: Array<{ name: string; minValue: number; maxValue: number; color: string | null }>;
  umbral: number;
  subjects: Array<{ id: string; name: string; percentage: number; areaName: string | null; averages: boolean }>;
  areas: Array<{ name: string; subjectIds: string[] }>;
  resumen: Record<string, { prom: number | null; nm: number | null }>;
  indicators: Record<string, { description: string; bajo: string | null; basico: string | null; alto: string | null; superior: string | null }>;
  students: InformeStudent[];
}

const FALLBACK_COLOR = (v: number) =>
  v < 3 ? "text-red-600" : v < 4 ? "text-amber-600" : v <= 4.5 ? "text-green-600" : "text-green-800";

function fmtDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
}

export function AcademicReportView() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;

  const [years, setYears] = useState<YearOption[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentFilter, setStudentFilter] = useState<string>("todos");
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>("todos");
  const [compacto, setCompacto] = useState(false);
  const [informe, setInforme] = useState<Informe | null>(null);
  const [loading, setLoading] = useState(false);

  // Catálogos: años + periodos (default periodo actual según fecha del cliente)
  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      fetch(`/api/academic-years?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/periods?institutionId=${institutionId}`).then((r) => r.json()),
    ]).then(([y, p]) => {
      const yearList: YearOption[] = y.ok ? y.years : [];
      setYears(yearList);
      const active = yearList.find((yy) => yy.active) ?? yearList[0];
      if (active) setYearId(active.id);

      const periodList: PeriodOption[] = p.ok ? p.periods : [];
      setPeriods(periodList);
      const now = Date.now();
      const current = periodList.find(
        (pp) => now >= +new Date(pp.startDate) && now <= +new Date(pp.endDate)
      );
      if (current) setPeriodId(current.id);
    });
  }, [institutionId]);

  // Grupos dependen del año
  useEffect(() => {
    if (!institutionId || !yearId) return;
    fetch(`/api/groups?institutionId=${institutionId}&yearId=${yearId}`)
      .then((r) => r.json())
      .then((d) => {
        const list: GroupOption[] = d.ok ? d.groups : [];
        setGroups(list);
        if (list[0]) setGroupId(list[0].id);
        else setGroupId("");
      });
  }, [institutionId, yearId]);

  // Estudiantes dependen del grupo (cascada)
  useEffect(() => {
    if (!institutionId || !groupId) {
      setStudents([]);
      return;
    }
    fetch(`/api/students?institutionId=${institutionId}&groupId=${groupId}&status=activo`)
      .then((r) => r.json())
      .then((d) => {
        const list: StudentOption[] = d.ok ? d.students : [];
        setStudents(list);
      });
    setStudentFilter("todos");
  }, [institutionId, groupId]);

  async function generate() {
    if (!groupId || !periodId) {
      toast.error("Seleccione periodo y grupo");
      return;
    }
    setLoading(true);
    setInforme(null);
    try {
      const res = await fetch(`/api/academic-reports/valorativo?groupId=${groupId}&periodId=${periodId}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Error al generar");
      setInforme(d.informe);
      setSubjects(d.informe.subjects.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el informe");
    } finally {
      setLoading(false);
    }
  }

  // Puesto por asignatura (y área) dentro del grupo: 1 = mejor defFinal
  const rankBySubject = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    if (!informe) return map;
    for (const subj of informe.subjects) {
      const sorted = [...informe.students]
        .filter((s) => s.defFinal[subj.id] !== null && s.defFinal[subj.id] !== undefined)
        .sort((a, b) => (b.defFinal[subj.id] ?? 0) - (a.defFinal[subj.id] ?? 0));
      const ranks = new Map<string, number>();
      sorted.forEach((s, i) => ranks.set(s.id, i + 1));
      map.set(subj.id, ranks);
    }
    return map;
  }, [informe]);

  const promGrupo = useMemo(() => {
    if (!informe) return null;
    const vals = informe.students.map((s) => s.promFinal).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [informe]);

  function nivelDe(v: number): { name: string; cls: string } {
    const scale = informe?.scales.find((s) => v >= s.minValue && v <= s.maxValue);
    if (scale) {
      const chip = scale.color?.startsWith("chip-") ? scale.color : undefined;
      return { name: scale.name, cls: chip ?? FALLBACK_COLOR(v) };
    }
    return { name: "", cls: FALLBACK_COLOR(v) };
  }

  // Índice del nivel alcanzado (0=Bajo … 3=Superior) según escala de la BD
  function nivelIndexOf(v: number | null | undefined): number {
    if (v === null || v === undefined) return -1;
    const scales = informe?.scales ?? [];
    const idx = scales.findIndex((s) => v >= s.minValue && v <= s.maxValue);
    return idx >= 0 ? idx : -1;
  }

  // Texto de logros con ✓ (nivel alcanzado) / ✗ (resto) para una asignatura
  function logrosDe(subjectId: string, student: InformeStudent): string[] | null {
    const ind = informe?.indicators?.[subjectId];
    if (!ind) return null;
    const niveles = [ind.bajo, ind.basico, ind.alto, ind.superior];
    const alcanzado = nivelIndexOf(student.defFinal[subjectId]);
    const out: string[] = [];
    niveles.forEach((txt, i) => {
      if (!txt) return;
      out.push(`${i === alcanzado ? "✓" : "✗"} ${txt}`);
    });
    return out.length ? out : null;
  }

  // Valoración de área por periodo = Σ(def asignatura × %) / Σ% (regla oficial)
  function areaDef(subjectIds: string[], periodIdCol: string, student: InformeStudent): number | null {
    let sum = 0, pct = 0;
    for (const sid of subjectIds) {
      const subj = informe?.subjects.find((x) => x.id === sid);
      if (!subj || !subj.averages) continue;
      const v = student.def[sid]?.[periodIdCol];
      if (v === null || v === undefined) continue;
      sum += v * subj.percentage;
      pct += subj.percentage;
    }
    return pct > 0 ? Math.round((sum / pct) * 10) / 10 : null;
  }

  function areaDefFinal(subjectIds: string[], student: InformeStudent): number | null {
    let sum = 0, pct = 0;
    for (const sid of subjectIds) {
      const subj = informe?.subjects.find((x) => x.id === sid);
      if (!subj || !subj.averages) continue;
      const v = student.defFinal[sid];
      if (v === null || v === undefined) continue;
      sum += v * subj.percentage;
      pct += subj.percentage;
    }
    return pct > 0 ? Math.round((sum / pct) * 10) / 10 : null;
  }

  function printReport() { window.print(); }

  async function exportPdf() {
    if (!informe) return;
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      const sel = selectedStudents();

      sel.forEach((st, idx) => {
        if (idx > 0) doc.addPage();
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text(informe.institution?.name ?? "", W / 2, 14, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        const inst2 = [informe.institution?.nit ? `NIT ${informe.institution.nit}` : null, informe.institution?.dane ? `DANE ${informe.institution.dane}` : null, informe.institution?.city].filter(Boolean).join("  ·  ");
        if (inst2) doc.text(inst2, W / 2, 18, { align: "center" });
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text(`INFORME VALORATIVO PERIÓDICO — GRUPO ${informe.group.name}`, W / 2, 25, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(`AÑO: ${new Date().getFullYear()}   PERIODO: ${informe.period.name}   ESTUDIANTE: ${st.fullName}   DOC: ${st.document ?? "—"}`, W / 2, 30, { align: "center" });

        const head = [["ÁREAS / ASIGNATURAS", ...informe.periods.map((p) => `P${p.order}`), "PROM", "PT"]];
        const body: import("jspdf-autotable").RowInput[] = [];
        for (const area of informe.areas) {
          const areaCells = informe.periods.map((p) => {
            const v = areaDef(area.subjectIds, p.id, st);
            return v === null ? "—" : String(v);
          });
          const af = areaDefFinal(area.subjectIds, st);
          body.push([{ content: area.name, colSpan: 1, styles: { fontStyle: "bold" } }, ...areaCells, af === null ? "—" : String(af), ""]);
          if (!compacto) {
            for (const sid of area.subjectIds) {
              const subj = informe.subjects.find((x) => x.id === sid);
              if (!subj) continue;
              if (subjectFilter !== "todos" && sid !== subjectFilter) continue;
              const cells = informe.periods.map((p) => {
                const v = st.def[sid]?.[p.id];
                return v === null || v === undefined ? "—" : String(v);
              });
              const df = st.defFinal[sid];
              const rank = rankBySubject.get(sid)?.get(st.id);
              body.push([`   ${subj.name} (${subj.percentage}%)`, ...cells, df === null || df === undefined ? "—" : String(df), rank ? String(rank) : "—"]);
              const logros = !compacto ? logrosDe(sid, st) : null;
              if (logros) {
                const desc = informe.indicators[sid]?.description ? `${informe.indicators[sid].description}. ` : "";
                const marked = logros.map((l) => (l.startsWith("✓") ? "(+)" : "(-)") + l.slice(1).trim()).join("  ");
                body.push([{ content: `     ${desc}${marked}`, colSpan: head[0].length, styles: { fontSize: 6.5, fontStyle: "italic", halign: "left" } }]);
              }
            }
          }
        }
        autoTable(doc, {
          startY: 35,
          head,
          body,
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.2, halign: "center" },
          columnStyles: { 0: { halign: "left", cellWidth: 70 } },
        });
        type Doc = typeof doc & { lastAutoTable?: { finalY: number } };
        let y = (doc as Doc).lastAutoTable?.finalY ?? 60;

        const inasTxt = informe.periods
          .map((p) => { const c = st.inas[p.id]; return c ? `P${p.order}: ${c.x}/${c.e}/${c.t}` : null; })
          .filter(Boolean).join("    ");
        if (inasTxt) { doc.setFontSize(8); doc.text(`INASISTENCIAS (X/E/T):  ${inasTxt}`, 14, y + 6); y += 10; }

        doc.setFontSize(9);
        doc.text(`Ficha del observador — Mi promedio: ${st.promFinal ?? "—"}   Puesto en el grupo: ${st.pt ?? "—"}   Promedio del grupo: ${promGrupo !== null ? Math.round(promGrupo * 100) / 100 : "—"}`, 14, y + 8);
        doc.setFontSize(9);
        doc.text("________________________________", W - 80, y + 30);
        doc.text(`Director(a) de grupo: ${informe.group.director ?? "—"}`, W - 80, y + 35);
      });

      doc.save(`informe-valorativo-${informe.group.name.replace(/\s+/g, "-")}.pdf`);
      toast.success("PDF generado");
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  }

  function selectedStudents(): InformeStudent[] {
    if (!informe) return [];
    return informe.students.filter((s) => studentFilter === "todos" || s.id === studentFilter);
  }

  const sel = selectedStudents();

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #valorativo-report, #valorativo-report * { visibility: visible; }
          #valorativo-report { position: absolute; inset: 0; padding: 0; }
          .valorativo-block { break-after: page; page-break-after: always; }
        }
      `}</style>

      <Card className="hairline rounded-xl print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Boletines o informes valorativos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Año</Label>
              <Select value={yearId} onValueChange={setYearId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Periodo *</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estudiante</Label>
              <Select value={studentFilter} onValueChange={setStudentFilter}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{[s.lastName, s.firstName].filter(Boolean).join(" ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Asignatura</Label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={compacto} onCheckedChange={setCompacto} id="compacto" />
                <Label htmlFor="compacto" className="text-xs text-muted-foreground">Informe compacto (sin logros)</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={loading} className="gap-2">
              <FileText className="h-4 w-4" /> {loading ? "Generando…" : "Generar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {informe && sel.length > 0 && (
        <>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" className="gap-2" onClick={printReport}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportPdf}>
              <FileDown className="h-4 w-4" /> Generar PDF
            </Button>
          </div>

          <div id="valorativo-report" className="space-y-8">
            {sel.map((st) => (
              <div key={st.id} className="valorativo-block rounded-xl border bg-white p-6 text-black">
                <div className="text-center">
                  {informe.institution?.logoUrl && (
                    <img src={informe.institution.logoUrl} alt="" className="mx-auto mb-1 h-12 object-contain" />
                  )}
                  <p className="text-sm font-bold uppercase">{informe.institution?.name}</p>
                  <p className="text-[11px]">
                    {[informe.institution?.nit ? `NIT ${informe.institution.nit}` : null, informe.institution?.dane ? `DANE ${informe.institution.dane}` : null].filter(Boolean).join("  ·  ")}
                  </p>
                  {informe.group.sede && <p className="text-[11px]">Sede: {informe.group.sede}</p>}
                  <p className="mt-2 text-sm font-bold tracking-wide underline">INFORME VALORATIVO PERIÓDICO</p>
                  <p className="text-xs font-semibold">Grupo {informe.group.name}</p>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1 text-[11px]">
                  <div><span className="font-bold">AÑO:</span> {years.find((y) => y.id === yearId)?.year ?? "—"}</div>
                  <div><span className="font-bold">PERIODO:</span> {informe.period.name}</div>
                  <div className="truncate"><span className="font-bold">ESTUDIANTE:</span> {st.fullName}</div>
                  <div><span className="font-bold">DOC:</span> {st.document ?? "—"}</div>
                </div>

                <table className="mt-3 w-full border-collapse border border-gray-400 text-[11px]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-2 py-1 text-left">ÁREAS / ASIGNATURAS</th>
                      {informe.periods.map((p) => (
                        <th key={p.id} className="border border-gray-400 px-1 py-1">P{p.order}</th>
                      ))}
                      <th className="border border-gray-400 px-1 py-1">PROM</th>
                      <th className="border border-gray-400 px-1 py-1">PT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.areas.map((area) => {
                      const visibleSubjects = area.subjectIds
                        .map((sid) => informe.subjects.find((x) => x.id === sid))
                        .filter((x): x is NonNullable<typeof x> => !!x)
                        .filter((x) => subjectFilter === "todos" || x.id === subjectFilter);
                      if (subjectFilter !== "todos" && visibleSubjects.length === 0) return null;
                      const areaCells = informe.periods.map((p) => {
                        const v = areaDef(area.subjectIds, p.id, st);
                        return <td key={p.id} className={cn("border border-gray-400 px-1 py-1 text-center tabular-nums", v !== null && nivelDe(v).cls)}>{v === null ? "—" : v}</td>;
                      });
                      const af = areaDefFinal(area.subjectIds, st);
                      const afN = af !== null ? nivelDe(af) : null;
                      return (
                        <Fragment key={`${st.id}-${area.name}-frag`}>
                          <tr className="bg-gray-50 font-semibold">
                            <td className="border border-gray-400 px-2 py-1">{area.name}</td>
                            {areaCells}
                            <td className={cn("border border-gray-400 px-1 py-1 text-center tabular-nums", afN?.cls)}>{af === null ? "—" : af}{afN?.name ? " · " + afN.name : ""}</td>
                            <td className="border border-gray-400 px-1 py-1 text-center">—</td>
                          </tr>
                          {visibleSubjects.map((subj) => {
                            const rank = rankBySubject.get(subj.id)?.get(st.id);
                            const df = st.defFinal[subj.id];
                            const dfN = df !== null && df !== undefined ? nivelDe(df) : null;
                            const logros = !compacto ? logrosDe(subj.id, st) : null;
                            return (
                              <Fragment key={`${st.id}-${subj.id}-row`}>
                                <tr>
                                  <td className="border border-gray-400 px-2 py-1 pl-5">{subj.name} <span className="text-gray-500">({subj.percentage}%)</span></td>
                                  {informe.periods.map((p) => {
                                    const v = st.def[subj.id]?.[p.id];
                                    return (
                                      <td key={p.id} className={cn("border border-gray-400 px-1 py-1 text-center tabular-nums", v !== null && v !== undefined && nivelDe(v).cls)}>
                                        {v === null || v === undefined ? "—" : v}
                                      </td>
                                    );
                                  })}
                                  <td className={cn("border border-gray-400 px-1 py-1 text-center font-semibold tabular-nums", dfN?.cls)}>
                                    {df === null || df === undefined ? "—" : df}{dfN?.name ? " · " + dfN.name : ""}
                                  </td>
                                  <td className="border border-gray-400 px-1 py-1 text-center tabular-nums">{rank ?? "—"}</td>
                                </tr>
                                {logros && (
                                  <tr>
                                    <td colSpan={informe.periods.length + 3} className="border border-gray-400 px-6 py-1 text-[10px] italic text-gray-700">
                                      <span className="font-semibold not-italic">{informe.indicators[subj.id]?.description}</span>
                                      {logros.map((l, i) => (
                                        <div key={i} className={l.startsWith("✓") ? "font-semibold text-green-700" : "text-gray-500"}>{l}</div>
                                      ))}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {!compacto && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    Desempeños por nivel: próximos a registrar en el módulo (Bajo · Básico · Alto · Superior).
                  </div>
                )}

                <div className="mt-2 text-[11px]">
                  <span className="font-bold">INASISTENCIAS (X/E/T):</span>{" "}
                  {informe.periods.map((p) => {
                    const c = st.inas[p.id];
                    return <span key={p.id} className="mr-4">P{p.order}: {c ? `${c.x}/${c.e}/${c.t}` : "0/0/0"}</span>;
                  })}
                </div>

                <div className="mt-3 border-t border-gray-300 pt-2 text-[11px]">
                  <span className="font-bold">Ficha del observador:</span>{" "}
                  Mi promedio: <span className="tabular-nums font-semibold">{st.promFinal ?? "—"}</span> · Puesto en el grupo: <span className="tabular-nums font-semibold">{st.pt ?? "—"}</span> · Promedio del grupo: <span className="tabular-nums font-semibold">{promGrupo !== null ? Math.round(promGrupo * 100) / 100 : "—"}</span>
                </div>

                <div className="mt-10 text-right text-[11px]">
                  <div className="ml-auto w-64 text-center">
                    <div className="h-4">{informe.group.director ?? ""}</div>
                    <div className="border-t border-gray-500 pt-1 text-[10px] text-gray-500">
                      Director(a) de grupo{informe.group.director ? "" : " (sin asignar)"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
