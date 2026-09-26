import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// === Base de conocimientos: materiales/documentos embebidos por URL ===
// GET    /api/knowledge-base?institutionId=(&category=)
// POST   { institutionId, title, url, type, category, gradeLevelId?, description? }
// DELETE /api/knowledge-base?id=
// Regla: Evaluación y Materiales requieren gradeLevelId.

const CATEGORIAS = ["materiales", "dba", "ebc", "evaluacion", "mallas"];
const TIPOS = ["documento", "video", "imagen", "enlace"];
const CAT_CON_GRADO = ["evaluacion", "materiales"];

function urlValida(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const category = searchParams.get("category");
  if (!institutionId) return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });

  try {
    const items = await db.knowledgeItem.findMany({
      where: { institutionId, ...(category && CATEGORIAS.includes(category) ? { category } : {}) },
      include: { gradeLevel: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[kb.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, title, url, type, category, gradeLevelId, description } = body;
    if (!institutionId || !title?.trim() || !url?.trim()) {
      return NextResponse.json({ ok: false, error: "institutionId, title y url son requeridos" }, { status: 400 });
    }
    if (!CATEGORIAS.includes(category)) {
      return NextResponse.json({ ok: false, error: "Categoría inválida" }, { status: 400 });
    }
    const tipo = TIPOS.includes(type) ? type : "documento";
    if (!urlValida(url.trim())) {
      return NextResponse.json({ ok: false, error: "La URL debe ser http(s) válida" }, { status: 400 });
    }
    // Regla de negocio: Evaluación y Materiales se registran para un grado
    let gradoId: string | null = typeof gradeLevelId === "string" && gradeLevelId ? gradeLevelId : null;
    if (CAT_CON_GRADO.includes(category)) {
      if (!gradoId) {
        return NextResponse.json({ ok: false, error: "Para Evaluación y Materiales debes seleccionar el Grado" }, { status: 400 });
      }
      const gl = await db.gradeLevel.findFirst({ where: { id: gradoId, institutionId }, select: { id: true } });
      if (!gl) return NextResponse.json({ ok: false, error: "Grado no encontrado" }, { status: 400 });
    } else {
      gradoId = null;
    }

    const item = await db.knowledgeItem.create({
      data: {
        institutionId,
        title: title.trim(),
        url: url.trim(),
        type: tipo,
        category,
        gradeLevelId: gradoId,
        description: typeof description === "string" ? description.trim() : null,
      },
      include: { gradeLevel: { select: { id: true, name: true, code: true } } },
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("[kb.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  try {
    await db.knowledgeItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[kb.delete]", e);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar" }, { status: 500 });
  }
}
