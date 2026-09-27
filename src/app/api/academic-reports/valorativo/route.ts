import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getConsolidadoAnual } from "@/lib/queries/consolidado";

// GET /api/academic-reports/valorativo?groupId=&periodId= — [F3]
// Informe valorativo periódico por estudiante. Reutiliza el motor del
// consolidado (getConsolidadoAnual, vista acumulada hasta el periodo dado)
// y añade: escalas valorativas, NIT/DANE, director de grupo e inasistencias
// por periodo (X = ausente, E = excusa, T = total).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const periodId = searchParams.get("periodId");

  if (!groupId || !periodId) {
    return NextResponse.json({ ok: false, error: "groupId y periodId son requeridos" }, { status: 400 });
  }

  try {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        academicYearId: true,
        branch: { select: { name: true } },
        institutionId: true,
        headTeacher: { select: { fullName: true } },
      },
    });
    if (!group) {
      return NextResponse.json({ ok: false, error: "Grupo no encontrado" }, { status: 404 });
    }

    // Periodo seleccionado y periodos del año académico (orden boletín)
    const period = await db.period.findUnique({ where: { id: periodId } });
    if (!period) {
      return NextResponse.json({ ok: false, error: "Periodo no encontrado" }, { status: 404 });
    }
    const periodosAno = await db.period.findMany({
      where: { institutionId: group.institutionId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true, weight: true },
    });
    const hastaOrder = Math.max(1, periodosAno.findIndex((p) => p.id === periodId) + 1);
    const periodsHasta = periodosAno.slice(0, hastaOrder).map((p, i) => ({
      id: p.id,
      name: p.name,
      order: i + 1,
      startDate: p.startDate,
      endDate: p.endDate,
      weight: p.weight,
    }));

    // Motor del consolidado (vista acumulada hasta el periodo)
    const consolidado = await getConsolidadoAnual({ groupId, hastaOrder });
    if (!consolidado) {
      return NextResponse.json({ ok: false, error: "Sin datos del grupo" }, { status: 404 });
    }

    // Escalas valorativas activas (Bajo/Básico/Alto/Superior con rangos)
    const scales = await db.evaluationScale.findMany({
      where: { institutionId: group.institutionId, active: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true, minValue: true, maxValue: true, color: true },
    });

    // Institución: NIT/DANE para el encabezado
    const institution = await db.institution.findUnique({
      where: { id: group.institutionId },
      select: { name: true, logoUrl: true, nit: true, dane: true, city: true },
    });

    // Desempeños/logros del periodo por asignatura [F3]
    const subjectIds = consolidado.subjects.map((s) => s.id);
    const indicatorsList = subjectIds.length
      ? await db.performanceIndicator.findMany({
          where: { institutionId: group.institutionId, periodId, subjectId: { in: subjectIds } },
          select: {
            subjectId: true, description: true,
            bajo: true, basico: true, alto: true, superior: true,
          },
        })
      : [];
    const indicators: Record<string, { description: string; bajo: string | null; basico: string | null; alto: string | null; superior: string | null }> = {};
    for (const ind of indicatorsList) indicators[ind.subjectId] = ind;

    // Inasistencias por periodo y estudiante (X ausente / E excusa / T total)
    const students = consolidado.students;
    const inasByStudent: Record<string, Record<string, { x: number; e: number; t: number }>> = {};
    if (students.length > 0 && periodsHasta.length > 0) {
      const atts = await db.attendance.findMany({
        where: { groupId, studentId: { in: students.map((s) => s.id) }, date: { gte: periodsHasta[0].startDate, lte: periodsHasta[periodsHasta.length - 1].endDate } },
        select: { studentId: true, date: true, status: true },
      });
      for (const a of atts) {
        const per = periodsHasta.find(
          (p) => a.date >= p.startDate && a.date <= p.endDate
        );
        if (!per) continue;
        const row = (inasByStudent[a.studentId] ??= {});
        const cell = (row[per.id] ??= { x: 0, e: 0, t: 0 });
        if (a.status === "ausente") cell.x++;
        else if (a.status === "excusa") cell.e++;
        if (a.status === "ausente" || a.status === "excusa") cell.t++;
      }
    }

    return NextResponse.json({
      ok: true,
      informe: {
        institution,
        group: { id: group.id, name: group.name, sede: group.branch?.name ?? null, director: group.headTeacher?.fullName ?? null },
        period: { id: period.id, name: period.name, order: hastaOrder },
        periods: periodsHasta,
        scales,
        umbral: consolidado.umbral,
        subjects: consolidado.subjects,
        areas: consolidado.areas,
        resumen: consolidado.resumen,
        indicators,
        students: students.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          document: s.document,
          def: s.def,
          defFinal: s.defFinal,
          promFinal: s.promFinal,
          pt: s.pt,
          inas: inasByStudent[s.id] ?? {},
        })),
      },
    });
  } catch (e) {
    console.error("GET /api/academic-reports/valorativo", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
