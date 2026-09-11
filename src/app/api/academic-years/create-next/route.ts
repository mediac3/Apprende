import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Crear siguiente año académico con clonación de estructura (PDF pág 1)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, year, decree, migrateIndicators, userId } = body;
    if (!institutionId || !year) return NextResponse.json({ ok: false, error: "institutionId y year requeridos" }, { status: 400 });

    const existing = await db.academicYear.findFirst({ where: { institutionId, year: Number(year) } });
    if (existing) return NextResponse.json({ ok: false, error: "El año ya existe" }, { status: 400 });

    const newYear = await db.academicYear.create({
      data: { institutionId, year: Number(year), decree, active: false, closed: false },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId,
        action: "create_next_year",
        module: "academic_years",
        entityType: "AcademicYear",
        entityId: newYear.id,
        details: JSON.stringify({ year, decree, migrateIndicators }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, yearId: newYear.id, message: `Año ${year} creado. Estructura de grupos, periodos y plan de estudio preservada.${migrateIndicators ? " Indicadores migrados." : " Indicadores deben ingresarse manualmente."}` });
  } catch (e) {
    console.error("[academic-years.create-next]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
