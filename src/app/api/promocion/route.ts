import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getConsolidadoAnual } from "@/lib/queries/consolidado";
import {
  ACTIVE_ENROLLMENT_STATUSES,
} from "@/lib/teaching-rules";

// === [F3] Wizard "Promoción de grado" ===
// POST /api/promocion
//   { action: "preview", fromGroupId, toGroupId }
//     → vista previa: promedio final, estado y elegibilidad por estudiante.
//   { action: "execute", fromGroupId, toGroupId, studentIds }
//     → ejecución transaccional: cierra la StudentEnrollment del año origen
//       con status "promovido", crea la del año destino con status
//       "matriculado" en el grupo destino y registra EnrollmentEvent.
// Reglas duras: NO se promueve si promedio final < umbral (re-validado en
// servidor); transacción atómica con rollback completo si algo falla;
// guard anti-duplicado de matrícula en el año destino.

interface Rechazado {
  id: string;
  fullName: string;
  reason: string;
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
    if (
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
    const rows = consolidado.students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      promFinal: s.promFinal,
      defCompleta: s.defCompleta,
      promovido: s.promFinal !== null && s.promFinal >= umbral,
    }));
    const meta = {
      umbral,
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
      return NextResponse.json({ ok: true, ...meta, students: rows });
    }

    if (action === "execute") {
      const ids: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
      if (ids.length === 0) {
        return NextResponse.json(
          { ok: false, error: "studentIds requerido" },
          { status: 400 }
        );
      }
      // Re-validación server-side: regla dura — sin umbral no hay promoción
      const byId = new Map(rows.map((r) => [r.id, r]));
      const rechazados: Rechazado[] = [];
      const validIds: string[] = [];
      for (const id of ids) {
        const r = byId.get(id);
        if (!r) {
          rechazados.push({ id, fullName: "(desconocido)", reason: "No pertenece al grupo origen" });
        } else if (r.promFinal === null) {
          rechazados.push({ ...r, reason: "Sin notas registradas" });
        } else if (r.promFinal < umbral) {
          rechazados.push({ ...r, reason: `Promedio ${r.promFinal} < umbral ${umbral}` });
        } else {
          validIds.push(id);
        }
      }

      const fromYearId = fromGroup.academicYearId as string;
      const toYearId = toGroup.academicYearId as string;

      const promovidos = await db.$transaction(
        async (tx) => {
          const done: string[] = [];
          for (const studentId of validIds) {
            const enrollment = await tx.studentEnrollment.findFirst({
              where: {
                studentId,
                groupId: fromGroupId,
                academicYearId: fromYearId,
                status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
              },
            });
            if (!enrollment) {
              throw new Error(`Sin matrícula activa en el grupo origen (student ${studentId})`);
            }
            const existing = await tx.studentEnrollment.findFirst({
              where: { studentId, academicYearId: toYearId },
            });
            if (existing) {
              throw new Error(`El estudiante ${studentId} ya tiene matrícula en el año destino`);
            }
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: { status: "promovido" },
            });
            await tx.studentEnrollment.create({
              data: {
                institutionId: fromGroup.institutionId,
                studentId,
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
                  reason: `Promovido a ${toGroup.name} (${toGroup.academicYear?.year ?? ""})`,
                },
              ],
            });
            done.push(studentId);
          }
          return done;
        },
        { timeout: 20000 }
      );

      return NextResponse.json({ ok: true, ...meta, promovidos, rechazados });
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
