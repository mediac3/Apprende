import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ESTADOS_PROMOVIBLES,
  estadoPromocionDe,
  getConsolidadoAnual,
  type EstadoPromocion,
} from "@/lib/queries/consolidado";
import {
  ACTIVE_ENROLLMENT_STATUSES,
} from "@/lib/teaching-rules";

// === [F3] Wizard "Promoción de grado" — criterios oficiales de la comisión ===
// POST /api/promocion
//   { action: "preview", fromGroupId, toGroupId, umbralInasistencia? }
//   { action: "execute", fromGroupId, toGroupId, studentIds, umbralInasistencia?,
//     decisions?: [{ id, decision, justificacion }] }
//
// Regla oficial (comisión de promoción):
// - Inasistencia injustificada ≥ umbral (default 25%) → NO promovido.
// - ≥3 áreas en bajo → NO promovido. 1–2 áreas → SUJETO A NIVELACIÓN
//   (promovido condicionado). Asignatura en bajo dentro de área aprobada →
//   PROMOVIDO CON NIVELACIÓN (Parágrafo 3).
// - Preescolar (PJ/J/T): promoción automática (Parágrafo 1, Decreto 1411).
// - La comisión puede desviar el cálculo SOLO con decisión + justificación
//   (PIAR, trayectoria ≥80%, repetición solicitada Pár. 2, asistente).
// Reglas duras: transacción atómica con rollback completo; guard
// anti-duplicado de matrícula en el año destino; re-validación server-side.

interface DecisionIn {
  id: string;
  decision: string;
  justificacion: string;
}

interface Rechazado {
  id: string;
  fullName: string;
  reason: string;
}

/** Decisión de comisión válida con justificación suficiente */
function decisionValida(d: DecisionIn | undefined): d is DecisionIn {
  return (
    !!d &&
    typeof d.decision === "string" &&
    d.decision.trim().length > 0 &&
    typeof d.justificacion === "string" &&
    d.justificacion.trim().length >= 10
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;
    const fromGroupId = body?.fromGroupId as string | undefined;
    const toGroupId = body?.toGroupId as string | undefined;
    if (!fromGroupId || !toGroupId) {
      return NextResponse.json(
        { ok: false, error: "fromGroupId y toGroupId requeridos" },
        { status: 400 }
      );
    }
    if (fromGroupId === toGroupId) {
      return NextResponse.json(
        { ok: false, error: "El grupo origen y el destino deben ser distintos" },
        { status: 400 }
      );
    }

    const [fromGroup, toGroup] = await Promise.all([
      db.group.findUnique({
        where: { id: fromGroupId },
        include: {
          gradeLevel: { select: { name: true, code: true, sortOrder: true } },
          academicYear: { select: { year: true } },
        },
      }),
      db.group.findUnique({
        where: { id: toGroupId },
        include: {
          gradeLevel: { select: { name: true, code: true, sortOrder: true } },
          academicYear: { select: { year: true } },
        },
      }),
    ]);
    if (!fromGroup || !toGroup) {
      return NextResponse.json(
        { ok: false, error: "Grupo origen o destino no encontrado" },
        { status: 404 }
      );
    }
    if (!fromGroup.academicYearId || !toGroup.academicYearId) {
      return NextResponse.json(
        { ok: false, error: "Ambos grupos deben tener año académico asignado" },
        { status: 400 }
      );
    }
    // Parámetros institucionales (PromotionConfig; defaults si no hay fila)
    const cfg = await db.promotionConfig.findUnique({
      where: { institutionId: fromGroup.institutionId },
    });
    const umbralInasistencia = cfg?.umbralInasistencia ?? 25;
    const maxAreasNivelacion = cfg?.maxAreasNivelacion ?? 2;
    const codigosPreescolar = (cfg?.preescolarCodes ?? "PJ,J,T")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const esPreescolar = codigosPreescolar.includes(fromGroup.gradeLevel?.code ?? "");
    if (
      !esPreescolar &&
      fromGroup.academicYear?.year != null &&
      toGroup.academicYear?.year != null &&
      toGroup.academicYear.year !== fromGroup.academicYear.year + 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `La promoción es al año siguiente (origen ${fromGroup.academicYear.year}, destino ${toGroup.academicYear.year})`,
        },
        { status: 400 }
      );
    }
    if (
      !esPreescolar &&
      fromGroup.gradeLevel?.sortOrder != null &&
      toGroup.gradeLevel?.sortOrder != null &&
      toGroup.gradeLevel.sortOrder !== fromGroup.gradeLevel.sortOrder + 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `El grupo destino debe ser del grado siguiente (${fromGroup.gradeLevel.name} → ${toGroup.gradeLevel.name})`,
        },
        { status: 400 }
      );
    }

    const consolidado = await getConsolidadoAnual({ groupId: fromGroupId });
    if (!consolidado) {
      return NextResponse.json(
        { ok: false, error: "No se pudo calcular el consolidado del grupo origen" },
        { status: 404 }
      );
    }
    const umbral = consolidado.umbral;
    // Recalcular estado con el umbral de inasistencia de la comisión
    const rowsBase = consolidado.students.map((s) => {
      const estado: EstadoPromocion = esPreescolar
        ? "promovido"
        : estadoPromocionDe(
            {
              sinDatos: s.promFinal === null,
              areasBajoCount: s.areasBajo.length,
              pendientesCount: s.pendientesNivelacion.length,
              pctInasistencia: s.pctInasistencia,
            },
            umbralInasistencia,
            maxAreasNivelacion
          );
      return {
        id: s.id,
        fullName: s.fullName,
        promFinal: s.promFinal,
        defCompleta: s.defCompleta,
        areasBajo: s.areasBajo,
        pendientesNivelacion: s.pendientesNivelacion,
        pctInasistencia: s.pctInasistencia,
        estado,
        promovible: ESTADOS_PROMOVIBLES.includes(estado),
      };
    });
    const meta = {
      umbral,
      umbralInasistencia,
      maxAreasNivelacion,
      preescolar: esPreescolar,
      from: {
        id: fromGroup.id,
        name: fromGroup.name,
        gradeLevelName: fromGroup.gradeLevel?.name ?? null,
        year: fromGroup.academicYear?.year ?? null,
      },
      to: {
        id: toGroup.id,
        name: toGroup.name,
        gradeLevelName: toGroup.gradeLevel?.name ?? null,
        year: toGroup.academicYear?.year ?? null,
      },
    };

    if (action === "preview") {
      return NextResponse.json({ ok: true, ...meta, students: rowsBase });
    }

    if (action === "execute") {
      const ids: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
      const decisionsIn: DecisionIn[] = Array.isArray(body?.decisions)
        ? body.decisions
        : [];
      if (ids.length === 0) {
        return NextResponse.json(
          { ok: false, error: "studentIds requerido" },
          { status: 400 }
        );
      }
      const byId = new Map(rowsBase.map((r) => [r.id, r]));
      const decisionsById = new Map(decisionsIn.map((d) => [d.id, d]));
      const rechazados: Rechazado[] = [];
      const validos: {
        id: string;
        notaComision: string | null;
      }[] = [];
      for (const id of ids) {
        const r = byId.get(id);
        if (!r) {
          rechazados.push({ id, fullName: "(desconocido)", reason: "No pertenece al grupo origen" });
          continue;
        }
        if (r.promovible) {
          const d = decisionsById.get(id);
          validos.push({
            id,
            notaComision:
              d && d.justificacion.trim()
                ? `${d.decision}: ${d.justificacion.trim()}`
                : null,
          });
          continue;
        }
        // Desviación del cálculo: exige decisión de comisión con justificación
        const d = decisionsById.get(id);
        if (!decisionValida(d)) {
          rechazados.push({
            id,
            fullName: r.fullName,
            reason:
              r.estado === "no_promovido_inasistencia"
                ? `Inasistencia ${r.pctInasistencia ?? "—"}% ≥ ${umbralInasistencia}%`
                : r.estado === "no_promovido"
                  ? `${r.areasBajo.length} áreas en bajo`
                  : "Sin notas registradas",
          });
          continue;
        }
        validos.push({
          id,
          notaComision: `Decisión de comisión (${d.decision}): ${d.justificacion.trim()}`,
        });
      }

      const fromYearId = fromGroup.academicYearId as string;
      const toYearId = toGroup.academicYearId as string;

      const promovidos = await db.$transaction(
        async (tx) => {
          const done: string[] = [];
          for (const v of validos) {
            const enrollment = await tx.studentEnrollment.findFirst({
              where: {
                studentId: v.id,
                groupId: fromGroupId,
                academicYearId: fromYearId,
                status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
              },
            });
            if (!enrollment) {
              throw new Error(`Sin matrícula activa en el grupo origen (student ${v.id})`);
            }
            const existing = await tx.studentEnrollment.findFirst({
              where: { studentId: v.id, academicYearId: toYearId },
            });
            if (existing) {
              throw new Error(`El estudiante ${v.id} ya tiene matrícula en el año destino`);
            }
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: { status: "promovido" },
            });
            await tx.studentEnrollment.create({
              data: {
                institutionId: fromGroup.institutionId,
                studentId: v.id,
                academicYearId: toYearId,
                groupId: toGroupId,
                status: "matriculado",
                enrolledAt: new Date(),
              },
            });
            await tx.enrollmentEvent.createMany({
              data: [
                {
                  enrollmentId: enrollment.id,
                  type: "otra",
                  reason:
                    `Promovido a ${toGroup.name} (${toGroup.academicYear?.year ?? ""})` +
                    (v.notaComision ? ` — ${v.notaComision}` : ""),
                },
              ],
            });
            done.push(v.id);
          }
          return done;
        },
        { timeout: 20000 }
      );

      return NextResponse.json({
        ok: true,
        ...meta,
        promovidos,
        decisions: decisionsIn.filter((d) => promovidos.includes(d.id)),
        rechazados,
      });
    }

    return NextResponse.json({ ok: false, error: "action inválido" }, { status: 400 });
  } catch (e) {
    console.error("[promocion]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
