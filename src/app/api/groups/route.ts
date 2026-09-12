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
    const groups = await db.group.findMany({
      where: { institutionId },
      include: {
        headTeacher: {
          select: { id: true, fullName: true, avatarUrl: true, username: true, jobTitle: true },
        },
        gradeLevel: true,
        _count: { select: { students: true } },
      },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    });

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      grade: g.gradeLevel?.code ?? null, // compat: código del grado (catálogo GradeLevel)
      gradeLevel: g.gradeLevel,
      section: g.section,
      headTeacherId: g.headTeacherId,
      headTeacher: g.headTeacher,
      studentCount: g._count.students,
      createdAt: g.createdAt,
    }));

    return NextResponse.json({ ok: true, groups: result });
  } catch (e) {
    console.error("[groups]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
