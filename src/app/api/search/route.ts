// [F2] Búsqueda global: estudiantes + publicaciones de espacios.
// GET /api/search?q=&institutionId=&userId=&limit=10
// - LIKE parametrizado vía Prisma `contains` (SQLite: insensible a mayósculas ASCII).
// - Respeta permisos: sin canView en Gestión de Estudiantes no devuelve estudiantes;
//   sin canView en Comunidad no devuelve publicaciones.
// - Solo estudiantes con matrícula activa en el año académico activo.
// - Máx. `limit` resultados por tipo (default 10, tope 25). Scoped a la institución.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectivePermMap } from "@/lib/permissions/server";
import { ACTIVE_ENROLLMENT_STATUSES } from "@/lib/teaching-rules";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const institutionId = sp.get("institutionId");
  const userId = sp.get("userId");
  const q = (sp.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 10) || 10, 1), 25);

  if (!institutionId || !userId) {
    return NextResponse.json({ ok: false, error: "institutionId y userId requeridos" }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ ok: true, students: [], posts: [] });
  }

  try {
    const perms = await getEffectivePermMap(userId, institutionId);

    let students: {
      id: string; code: string; firstName: string; lastName: string;
      status: string; groupName: string | null;
    }[] = [];
    if (perms["gestion-estudiantes"]?.canView) {
      const activeYear = await db.academicYear.findFirst({
        where: { institutionId, active: true },
        select: { id: true },
      });
      students = await db.student.findMany({
        where: {
          institutionId,
          ...(activeYear
            ? {
                enrollments: {
                  some: {
                    academicYearId: activeYear.id,
                    status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
                  },
                },
              }
            : {}),
          OR: [
            { code: { contains: q } },
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { documentNumber: { contains: q } },
          ],
        },
        select: {
          id: true, code: true, firstName: true, lastName: true, status: true,
          group: { select: { name: true } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: limit,
      });
      students = students.map((s) => ({ ...s, groupName: s.group?.name ?? null }));
    }

    let posts: {
      id: string; snippet: string; createdAt: Date;
      spaceId: string | null; spaceName: string | null; authorName: string;
    }[] = [];
    if (perms["comunidad"]?.canView) {
      const rows = await db.post.findMany({
        where: { institutionId, content: { contains: q } },
        select: {
          id: true, content: true, createdAt: true, spaceId: true,
          space: { select: { name: true } },
          author: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      posts = rows.map((p) => ({
        id: p.id,
        snippet: p.content.length > 60 ? `${p.content.slice(0, 60)}…` : p.content,
        createdAt: p.createdAt,
        spaceId: p.spaceId,
        spaceName: p.space?.name ?? null,
        authorName: p.author.fullName,
      }));
    }

    return NextResponse.json({ ok: true, students, posts });
  } catch (e) {
    console.error("[search.get]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
