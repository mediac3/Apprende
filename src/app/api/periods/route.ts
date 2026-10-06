import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    const periods = await db.period.findMany({
      where: { institutionId },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ ok: true, periods });
  } catch (e) {
    console.error("[periods]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// [Configuración de periodos] Edición desde Configuración: fechas, cerrado/abierto
// y activo arbitrario. Al activar uno se desactivan los demás de su modelo educativo
// (solo un periodo activo por modelo). Si ninguno queda activo, los módulos resuelven
// por rango de fechas con la fecha del cliente.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, startDate, endDate, closed, active } = body ?? {};
    if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

    const period = await db.period.findUnique({ where: { id } });
    if (!period) return NextResponse.json({ ok: false, error: "Periodo no encontrado" }, { status: 404 });

    const startD = startDate ? new Date(startDate) : null;
    const endD = endDate ? new Date(endDate) : null;
    if (startDate && isNaN(startD!.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de inicio inválida" }, { status: 400 });
    }
    if (endDate && isNaN(endD!.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de fin inválida" }, { status: 400 });
    }
    if (startD && endD && startD > endD) {
      return NextResponse.json({ ok: false, error: "La fecha de inicio debe ser anterior a la de fin" }, { status: 400 });
    }

    if (active === true && period.educationalModelId) {
      await db.period.updateMany({
        where: { educationalModelId: period.educationalModelId, NOT: { id } },
        data: { active: false },
      });
    }

    const updated = await db.period.update({
      where: { id },
      data: {
        ...(startD ? { startDate: startD } : {}),
        ...(endD ? { endDate: endD } : {}),
        ...(closed !== undefined ? { closed: Boolean(closed) } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });
    return NextResponse.json({ ok: true, period: updated });
  } catch (e) {
    console.error("[periods.patch]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
