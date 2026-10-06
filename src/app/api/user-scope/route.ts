import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserRoleCodes } from "@/lib/teaching-rules";

// === [Dashboard directivo] Alcance del coordinador (sedes/grados asignados) ===
// GET ?userId → { scopeBranchIds, scopeGradeLevelIds } (arrays JSON o null = sin restricción).
// PATCH: solo rector/administrador (roles frescos de BD); null = toda la institución.

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "userId requerido" }, { status: 400 });
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { scopeBranchIds: true, scopeGradeLevelIds: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    scopeBranchIds: user.scopeBranchIds ? (JSON.parse(user.scopeBranchIds) as string[]) : null,
    scopeGradeLevelIds: user.scopeGradeLevelIds ? (JSON.parse(user.scopeGradeLevelIds) as string[]) : null,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const editorId = String(body.editorId || "");
    const institutionId = String(body.institutionId || "");
    const targetId = String(body.userId || "");
    if (!editorId || !institutionId || !targetId) {
      return NextResponse.json({ ok: false, error: "editorId, institutionId y userId requeridos" }, { status: 400 });
    }
    // [Seguridad] roles frescos de BD: solo rector o administrador asignan alcance
    const roles = await getUserRoleCodes(editorId);
    if (!roles.some((r) => r === "rector" || r === "administrador")) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Solo rector o administrador pueden asignar el alcance" },
        { status: 403 }
      );
    }
    const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, institutionId: true } });
    if (!target || target.institutionId !== institutionId) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado en la institución" }, { status: 404 });
    }
    const norm = (v: unknown): string[] | null => {
      if (v == null) return null; // null = sin restricción
      if (!Array.isArray(v)) return null;
      const arr = v.map(String).filter(Boolean);
      return arr.length ? arr : null; // [] también se trata como sin restricción
    };
    const scopeBranchIds = norm(body.scopeBranchIds);
    const scopeGradeLevelIds = norm(body.scopeGradeLevelIds);
    // Validar pertenencia a la institución (ids de sedes/grados reales)
    if (scopeBranchIds) {
      const count = await db.branch.count({ where: { id: { in: scopeBranchIds }, institutionId } });
      if (count !== scopeBranchIds.length) {
        return NextResponse.json({ ok: false, error: "VALIDATION", message: "Sede fuera de la institución" }, { status: 400 });
      }
    }
    if (scopeGradeLevelIds) {
      const count = await db.gradeLevel.count({ where: { id: { in: scopeGradeLevelIds }, institutionId } });
      if (count !== scopeGradeLevelIds.length) {
        return NextResponse.json({ ok: false, error: "VALIDATION", message: "Grado fuera de la institución" }, { status: 400 });
      }
    }
    await db.user.update({
      where: { id: targetId },
      data: {
        scopeBranchIds: scopeBranchIds ? JSON.stringify(scopeBranchIds) : null,
        scopeGradeLevelIds: scopeGradeLevelIds ? JSON.stringify(scopeGradeLevelIds) : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[user-scope]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
