import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// [C1] Eliminación masiva de estudiantes en transacción atómica.
// Regla dura: si ALGÚN estudiante del lote tiene notas registradas (Grade o
// GradeRecord), se aborta TODO el lote y se reporta qué estudiantes lo impiden.
function fullNameOf(s: { lastName: string; lastName2: string | null; firstName: string; firstName2: string | null }): string {
  return [s.lastName, s.lastName2, s.firstName, s.firstName2].filter(Boolean).join(" ") || "Estudiante";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: unknown = body?.ids;
    const institutionId: string | undefined = body?.institutionId;
    const userId: string | undefined = body?.userId;

    if (!Array.isArray(ids) || ids.length === 0 || !institutionId) {
      return NextResponse.json({ ok: false, error: "ids e institutionId requeridos" }, { status: 400 });
    }
    const studentIds = ids.filter((v): v is string => typeof v === "string");

    const students = await db.student.findMany({
      where: { id: { in: studentIds }, institutionId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lastName2: true,
        firstName2: true,
        _count: { select: { grades: true, gradeRecords: true } },
      },
    });

    if (students.length === 0) {
      return NextResponse.json({ ok: false, error: "No se encontraron estudiantes válidos para eliminar" }, { status: 404 });
    }

    // [C1] Regla dura: bloquear TODO el lote si alguno tiene notas.
    const blockers = students.filter((s) => s._count.grades + s._count.gradeRecords > 0);
    if (blockers.length > 0) {
      const names = blockers.slice(0, 5).map((s) => `"${fullNameOf(s)}"`);
      return NextResponse.json(
        {
          ok: false,
          error:
            blockers.length === 1
              ? `No se puede eliminar: ${names[0]} tiene notas registradas. Retire primero sus calificaciones.`
              : `No se puede eliminar: ${blockers.length} estudiantes tienen notas registradas (${names.join(", ")}${blockers.length > 5 ? ", …" : ""}).`,
          blockers: blockers.map((s) => ({ id: s.id, name: fullNameOf(s), notas: s._count.grades + s._count.gradeRecords })),
        },
        { status: 409 }
      );
    }

    // Transacción atómica [C1]: sin datos parciales. El cascade de matrículas,
    // observaciones, asistencias, contactos, etc. lo aplica la BD (FK ON DELETE CASCADE).
    const deleted = await db.$transaction(async (tx) => {
      const res = await tx.student.deleteMany({
        where: { id: { in: students.map((s) => s.id) }, institutionId },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          userId: userId || null,
          action: "delete",
          module: "students",
          entityType: "Student",
          entityId: null,
          details: JSON.stringify({ bulk: true, count: res.count, ids: students.map((s) => s.id) }),
          hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
        },
      });
      return res.count;
    });

    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("[students.bulkDelete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
