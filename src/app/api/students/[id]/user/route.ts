import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

// [F3] Usuario vinculado al estudiante — estado del tab "Usuario" de la ficha.
// La autorización fina es client-side (patrón de la app: NAV rector/administrador);
// aquí se validan las reglas duras de negocio (documento, unicidad, existencia).

function serializeUser(u: {
  id: string; username: string; role: string; active: boolean;
  lastLoginAt: Date | null; mustChangePassword: boolean;
}) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    active: u.active,
    lastLoginAt: u.lastLoginAt,
    mustChangePassword: u.mustChangePassword,
  };
}

// GET /api/students/[id]/user — estado del usuario asociado (o null)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const student = await db.student.findUnique({
      where: { id },
      select: {
        documentNumber: true,
        user: {
          select: {
            id: true, username: true, role: true, active: true,
            lastLoginAt: true, mustChangePassword: true,
          },
        },
      },
    });
    if (!student) {
      return NextResponse.json({ ok: false, error: "Estudiante no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      documentNumber: student.documentNumber,
      user: student.user ? serializeUser(student.user) : null,
    });
  } catch (e) {
    console.error("GET /api/students/[id]/user", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST /api/students/[id]/user — crear usuario (usuario=contraseña=documento)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const student = await db.student.findUnique({
      where: { id },
      select: { id: true, code: true, institutionId: true, firstName: true, lastName: true, firstName2: true, lastName2: true, documentNumber: true, userId: true },
    });
    if (!student) {
      return NextResponse.json({ ok: false, error: "Estudiante no encontrado" }, { status: 404 });
    }
    if (student.userId) {
      return NextResponse.json({ ok: false, error: "El estudiante ya tiene usuario" }, { status: 409 });
    }
    const documento = (student.documentNumber ?? "").trim();
    if (!documento) {
      return NextResponse.json({ ok: false, error: "El estudiante no tiene documento. Complételo primero." }, { status: 400 });
    }
    const taken = await db.user.findUnique({ where: { username: documento } });
    if (taken) {
      return NextResponse.json({ ok: false, error: "El documento ya existe como usuario de otra persona" }, { status: 409 });
    }

    const nombre = [student.firstName, student.firstName2, student.lastName, student.lastName2]
      .filter(Boolean).join(" ").trim();
    const role = await db.role.findFirst({
      where: { institutionId: student.institutionId, code: "estudiante" },
    });

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          institutionId: student.institutionId,
          username: documento,
          passwordHash: hashPassword(documento),
          fullName: nombre || student.code,
          role: "estudiante",
          mustChangePassword: true,
        },
      });
      if (role) {
        await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
      }
      await tx.student.update({ where: { id: student.id }, data: { userId: created.id } });
      await tx.auditLog.create({
        data: {
          institutionId: student.institutionId,
          action: "create_student_user",
          module: "usuarios",
          entityType: "User",
          entityId: created.id,
          details: JSON.stringify({ studentId: student.id, code: student.code }),
        },
      });
      return created;
    });

    return NextResponse.json({ ok: true, user: serializeUser(user) });
  } catch (e) {
    console.error("POST /api/students/[id]/user", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/students/[id]/user — acciones: reset-password | toggle-active
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { action } = await req.json();
    const student = await db.student.findUnique({
      where: { id },
      select: { documentNumber: true, user: { select: { id: true, active: true, username: true } } },
    });
    if (!student || !student.user) {
      return NextResponse.json({ ok: false, error: "El estudiante no tiene usuario" }, { status: 404 });
    }
    const documento = (student.documentNumber ?? "").trim();

    if (action === "reset-password") {
      if (!documento) {
        return NextResponse.json({ ok: false, error: "El estudiante no tiene documento" }, { status: 400 });
      }
      // [F3] El reset normaliza el acceso completo al documento: username y
      // contraseña pasan a ser el documento (p. ej. estudiantes cuyo documento
      // se completó después del sync inicial, con username=código).
      let username = student.user.username;
      if (username !== documento) {
        const taken = await db.user.findUnique({ where: { username: documento } });
        if (taken && taken.id !== student.user.id) {
          return NextResponse.json({ ok: false, error: "El documento ya existe como usuario de otra persona" }, { status: 409 });
        }
        username = documento;
      }
      await db.user.update({
        where: { id: student.user.id },
        data: { username, passwordHash: hashPassword(documento), mustChangePassword: true },
      });
      return NextResponse.json({ ok: true, username });
    }

    if (action === "toggle-active") {
      const updated = await db.user.update({
        where: { id: student.user.id },
        data: { active: !student.user.active },
        select: { active: true },
      });
      return NextResponse.json({ ok: true, active: updated.active });
    }

    return NextResponse.json({ ok: false, error: "Acción no soportada" }, { status: 400 });
  } catch (e) {
    console.error("PATCH /api/students/[id]/user", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
