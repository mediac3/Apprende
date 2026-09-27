"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

// === [F2] Generador de "Planeación de clases" (formato PDF institucional) ===
// Pestaña del módulo Planeador de clases. Un bloque (page-break) por cada
// (grupo, asignatura) que el docente tiene asignada en el año seleccionado.

interface YearOption { id: string; year: number; active: boolean }
interface PeriodOption { id: string; name: string; startDate: string; endDate: string }
interface UserOption { id: string; fullName: string; userRoles?: Array<{ role: { name: string } }> }

interface PlannerReport {
  year: number;
  institution: { name: string; logoUrl: string | null; resolution: string | null; city: string | null };
  teacher: { fullName: string };
  period: { id: string; name: string; startDate: string; endDate: string };
  weeks: number;
  blocks: Array<{
    groupId: string; groupName: string; subjectId: string; subjectName: string;
    weeklyHours: number; groupWeeklyHours: number; plannedHours: number;
  }>;
  resumen: { secciones: number; horasPlaneadas: number; horasTotales: number };
}

function fmtDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
}

export function ReportGenerator() {
  const user = useAuthStore((s) => s.user);
  const institutionId = user?.institution?.id;

  const [years, setYears] = useState<YearOption[]>([]);
  const [year, setYear] = useState<string>("");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [teachers, setTeachers] = useState<UserOption[]>([]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [report, setReport] = useState<PlannerReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Carga inicial: años, periodos y docentes
  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      fetch(`/api/academic-years?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/periods?institutionId=${institutionId}`).then((r) => r.json()),
      fetch(`/api/users?institutionId=${institutionId}`).then((r) => r.json()),
    ]).then(([y, p, u]) => {
      const yearList: YearOption[] = y.ok ? y.years : [];
      setYears(yearList);
      const active = yearList.find((yy) => yy.active) ?? yearList[0];
      if (active) setYear(String(active.year));

      const periodList: PeriodOption[] = p.ok ? p.periods : [];
      setPeriods(periodList);
      // Default: periodo actual según fecha del cliente; si no, el más reciente pasado
      const now = Date.now();
      const sorted = [...periodList].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
      const current = sorted.find((pp) => now >= +new Date(pp.startDate) && now <= +new Date(pp.endDate));
      setPeriodId(current?.id ?? "");

      const userList: UserOption[] = u.ok ? u.users : [];
      const docentes = userList.filter((uu) => uu.userRoles?.some((ur) => ur.role?.name === "docente"));
      setTeachers(docentes);
    });
  }, [institutionId]);

  const periodOrder = useMemo(() => {
    const sorted = [...periods].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
    const map = new Map(sorted.map((pp, i) => [pp.id, i + 1]));
    return (id: string) => map.get(id) ?? 0;
  }, [periods]);

  async function generate() {
    if (!institutionId || !teacherId || !periodId || !year) {
      toast.error("Seleccione año, periodo y docente");
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch(
        `/api/planner/report?institutionId=${institutionId}&teacherId=${teacherId}&periodId=${periodId}&year=${year}`
      );
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Error al generar");
      if (d.report.blocks.length === 0) {
        toast.warning("Sin asignaciones para este periodo");
      }
      setReport(d.report);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el informe");
    } finally {
      setLoading(false);
    }
  }

  function printReport() {
    window.print();
  }

  async function exportPdf() {
    if (!report) return;
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const W = doc.internal.pageSize.getWidth();

      report.blocks.forEach((b, idx) => {
        if (idx > 0) doc.addPage();
        // Encabezado institucional
        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        doc.text(report.institution.name, W / 2, 16, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        if (report.institution.resolution) doc.text(`Resolución: ${report.institution.resolution}`, W / 2, 22, { align: "center" });
        if (report.institution.city) doc.text(report.institution.city, W / 2, 27, { align: "center" });
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("PLANEACIÓN DE CLASES", W / 2, 36, { align: "center" });
        doc.setLineWidth(0.4); doc.line(15, 39, W - 15, 39);

        autoTable(doc, {
          startY: 44,
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 1.5 },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
          body: [
            ["DOCENTE", report.teacher.fullName],
            ["PERIODO", `${report.year}-${periodOrder(report.period.id)} (${report.period.name})`],
            ["ASIGNATURA", b.subjectName],
            ["GRUPO", b.groupName],
          ],
        });

        type Doc = typeof doc & { lastAutoTable?: { finalY: number } };
        const y1 = (doc as Doc).lastAutoTable?.finalY ?? 70;
        autoTable(doc, {
          startY: y1 + 4,
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 1.5 },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
          body: [
            ["FECHA INICIO", fmtDate(report.period.startDate)],
            ["FECHA FIN", fmtDate(report.period.endDate)],
            ["HORAS/SEM", `${b.weeklyHours} · Semanas: ${report.weeks} · Horas planeadas: ${b.plannedHours}`],
            ["TEMAS", "—"],
          ],
        });

        const y2 = (doc as Doc).lastAutoTable?.finalY ?? 100;
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text("DESEMPEÑOS", 15, y2 + 8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.text("Sin desempeños registrados para este periodo.", 15, y2 + 14);
      });

      // Resumen global al pie
      doc.addPage();
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("RESUMEN", 15, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`# SECCIONES PLANEADAS: ${report.resumen.secciones}`, 15, 28);
      doc.text(`# HORAS PLANEADAS: ${report.resumen.horasPlaneadas} de ${report.resumen.horasTotales}`, 15, 34);

      doc.save(`planeacion-${report.teacher.fullName.replace(/\s+/g, "-").toLowerCase()}-${report.year}.pdf`);
      toast.success("PDF generado");
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #planner-report, #planner-report * { visibility: visible; }
          #planner-report { position: absolute; inset: 0; padding: 0; }
          .planner-block { break-after: page; page-break-after: always; }
        }
      `}</style>

      <Card className="hairline rounded-xl print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Planeaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Año</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={String(y.year)}>{y.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Periodo *</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Docente *</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder="Seleccione el docente" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={loading} className="gap-2">
              <FileText className="h-4 w-4" /> {loading ? "Generando…" : "Generar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && report.blocks.length > 0 && (
        <>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" className="gap-2" onClick={printReport}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportPdf}>
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>

          <div id="planner-report" className="space-y-8">
            {report.blocks.map((b) => (
              <div key={`${b.groupId}-${b.subjectId}`} className="planner-block rounded-xl border bg-white p-8 text-black">
                <div className="text-center">
                  {report.institution.logoUrl && (
                    <img src={report.institution.logoUrl} alt="" className="mx-auto mb-2 h-14 object-contain" />
                  )}
                  <p className="text-base font-bold uppercase">{report.institution.name}</p>
                  {report.institution.resolution && (
                    <p className="text-xs">Resolución: {report.institution.resolution}</p>
                  )}
                  {report.institution.city && <p className="text-xs">{report.institution.city}</p>}
                  <p className="mt-4 text-sm font-bold tracking-wide underline">PLANEACIÓN DE CLASES</p>
                </div>

                <table className="mt-4 w-full border-collapse border border-gray-400 text-xs">
                  <tbody>
                    <tr><td className="w-36 border border-gray-400 px-2 py-1 font-bold">DOCENTE</td><td className="border border-gray-400 px-2 py-1">{report.teacher.fullName}</td></tr>
                    <tr><td className="border border-gray-400 px-2 py-1 font-bold">PERIODO</td><td className="border border-gray-400 px-2 py-1">{report.year}-{periodOrder(report.period.id)} ({report.period.name})</td></tr>
                    <tr><td className="border border-gray-400 px-2 py-1 font-bold">ASIGNATURA</td><td className="border border-gray-400 px-2 py-1">{b.subjectName}</td></tr>
                    <tr><td className="border border-gray-400 px-2 py-1 font-bold">GRUPO</td><td className="border border-gray-400 px-2 py-1">{b.groupName}</td></tr>
                  </tbody>
                </table>

                <p className="mt-4 text-xs font-bold">INFORMACIÓN DEL PERIODO</p>
                <table className="mt-1 w-full border-collapse border border-gray-400 text-xs">
                  <tbody>
                    <tr><td className="w-36 border border-gray-400 px-2 py-1 font-bold">Fecha inicio</td><td className="border border-gray-400 px-2 py-1">{fmtDate(report.period.startDate)}</td></tr>
                    <tr><td className="border border-gray-400 px-2 py-1 font-bold">Fecha fin</td><td className="border border-gray-400 px-2 py-1">{fmtDate(report.period.endDate)}</td></tr>
                    <tr><td className="border border-gray-400 px-2 py-1 font-bold">Horas/semana</td><td className="border border-gray-400 px-2 py-1">{b.weeklyHours} · Semanas: {report.weeks} · Horas planeadas: {b.plannedHours}</td></tr>
                    <tr><td className="border border-gray-400 px-2 py-1 font-bold">Temas</td><td className="border border-gray-400 px-2 py-1 text-gray-400">—</td></tr>
                  </tbody>
                </table>

                <p className="mt-4 text-xs font-bold">DESEMPEÑOS</p>
                <p className="mt-1 text-xs italic text-gray-500">Sin desempeños registrados para este periodo.</p>
              </div>
            ))}

            <div className="planner-block rounded-xl border bg-white p-8 text-black text-sm">
              <p className="font-bold"># SECCIONES PLANEADAS: {report.resumen.secciones}</p>
              <p className="font-bold"># HORAS PLANEADAS: {report.resumen.horasPlaneadas} de {report.resumen.horasTotales}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
