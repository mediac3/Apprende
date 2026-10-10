import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { verifyPassword, hashPassword } from "@/lib/password";

// [F2] Cambio de contraseña (autenticado con la contraseña actual; sin token global).
// Obligatorio cuando User.mustChangePassword=true (contraseña inicial = documento).
export async function POST(req: NextRequest) {
  try {
    const { username, currentPassword, newPassword } = await req.json();

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { ok: false, error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }
    if (String(newPassword) === String(currentPassword)) {
      return NextResponse.json(
        { ok: false, error: "La nueva contraseña debe ser diferente a la actual" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: { username: String(username).trim(), active: true },
    });

    if (!user || !verifyPassword(String(currentPassword), user.passwordHash)) {
      return NextResponse.json(
        { ok: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(String(newPassword)), mustChangePassword: false },
      }),
      db.auditLog.create({
        data: {
          institutionId: user.institutionId,
          userId: user.id,
          action: "change_password",
          module: "auth",
          entityType: "User",
          entityId: user.id,
          hash: crypto.randomBytes(16).toString("hex"),
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth.changePassword]", e);
    return NextResponse.json(
      { ok: false, error: "Error de servidor" },
      { status: 500 }
    );
  }
}
