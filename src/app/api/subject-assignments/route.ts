import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveYear, getUserRoleCodes, hasElevatedRole } from "@/lib/teaching-rules";

// === [M1] Asignación académica: docente por (grupo, asignatura, año) ===
// Solo roles elevados (rector/coordinador/administrativo) pueden leer-escribir la matriz.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const institutionId = sp.get("institutionId");
  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }
  const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : await getActiveYear(institutionId);
  const assignments = await db.subjectAssignment.findMany({
    where: { institutionId, year },
    select: { id: true, groupId: true, subjectId: true, teacherId: true, year: true },
  });
  return NextResponse.json({ ok: true, year, assignments });
}

interface AssignmentChange {
  groupId: string;
  subjectId: string;
  teacherId: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const institutionId = String(body.institutionId || "");
    const userId = String(body.userId || "");
    const changes: AssignmentChange[] = Array.isArray(body.changes) ? body.changes : [];
    if (!institutionId || !userId || changes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "institutionId, userId y changes son requeridos" },
        { status: 400 }
      );
    }

    // [R1] Solo roles elevados editan la matriz de asignación.
    const roles = await getUserRoleCodes(userId);
    if (!hasElevatedRole(roles)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Solo rector, coordinador o administrativo pueden editar la asignación académica" },
        { status: 403 }
      );
    }

    const year = body.year ? parseInt(String(body.year), 10) : await getActiveYear(institutionId);

    await db.$transaction(
      changes.map((c) => {
        const groupId = String(c.groupId);
        const subjectId = String(c.subjectId);
        const teacherId = c.teacherId ? String(c.teacherId) : null;
        if (!teacherId) {
          // Celda vaciada ("—"): eliminar la asignación del par.
          return db.subjectAssignment.deleteMany({
            where: { groupId, subjectId, year },
          });
        }
        return db.subjectAssignment.upsert({
          where: { groupId_subjectId_year: { groupId, subjectId, year } },
          create: { institutionId, groupId, subjectId, teacherId, year },
          update: { teacherId },
        });
      })
    );

    return NextResponse.json({ ok: true, saved: changes.length, year });
  } catch (e) {
    console.error("POST /api/subject-assignments", e);
    return NextResponse.json({ ok: false, error: "Error al guardar asignaciones" }, { status: 500 });
  }
}
