import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Catálogo de roles por institución (normaliza el rol de los usuarios)
// Permisos del menú: los códigos canónicos (rector, coordinador, docente...)
// gobiernan la visibilidad de módulos; los adicionales son informativos.

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
    const roles = await db.role.findMany({
      where: { institutionId },
      include: { _count: { select: { users: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    console.error("[roles.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
