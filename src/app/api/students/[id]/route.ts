import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/students/[id] — ficha del estudiante para el lightbox [F1]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const student = await db.student.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ ok: false, error: "Estudiante no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, student });
  } catch (e) {
    console.error("GET /api/students/[id]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
