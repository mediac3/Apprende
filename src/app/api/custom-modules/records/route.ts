import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { getSessionUser } from "@/lib/api-guard";

// [Seguridad] Records de módulos personalizados: solo se escriben si el rol del
// usuario está entre los roles definidos por el rector al publicar el módulo
// (CustomModule.visibleRolesJson); el administrador siempre puede.
async function actorCanWriteModule(actor: { id: string; role: string } | null, moduleId: string, institutionId: string): Promise<boolean> {
  if (!actor) return false;
  const mod = await db.customModule.findFirst({ where: { id: moduleId, institutionId } });
  if (!mod || !mod.published) return false;
  if (actor.role === "administrador") return true;
  const ur = await db.userRole.findMany({ where: { userId: actor.id }, select: { role: { select: { code: true } } } });
  const codes = [...new Set([actor.role, ...ur.map((x) => x.role.code)])];
  let visible: string[] = [];
  try { visible = JSON.parse(mod.visibleRolesJson || "[]"); } catch { visible = []; }
  return codes.some((c) => visible.includes(c));
}

// GET: listar registros de un módulo
// ?moduleId=...&institutionId=...&userId=...&status=...&search=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "200");

  if (!moduleId || !institutionId) {
    return NextResponse.json({ ok: false, error: "moduleId e institutionId requeridos" }, { status: 400 });
  }

  try {
    const where: any = { moduleId, institutionId };
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const records = await db.customModuleRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Buscar info de usuarios en paralelo
    const userIds = [...new Set(records.map((r) => r.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, role: true, avatarUrl: true },
        })
      : [];
    const userMap: Record<string, any> = {};
    users.forEach((u) => (userMap[u.id] = u));

    const safe = records.map((r) => {
      const data = JSON.parse(r.dataJson);
      // Filtrar por búsqueda si se especifica
      if (search) {
        const haystack = JSON.stringify(data).toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return null;
      }
      return {
        id: r.id,
        moduleId: r.moduleId,
        data,
        status: r.status,
        reviewNotes: r.reviewNotes,
        reviewedAt: r.reviewedAt,
        reviewedById: r.reviewedById,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        user: r.userId ? userMap[r.userId] : null,
      };
    }).filter(Boolean);

    return NextResponse.json({ ok: true, records: safe });
  } catch (e) {
    console.error("[custom-modules.records.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: crear nuevo registro (envío de formulario frontend)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { moduleId, institutionId, userId, data } = body;

    if (!moduleId || !institutionId || !data) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    // [Seguridad] identidad + roles del módulo (visibleRolesJson)
    const actor = await getSessionUser(req);
    if (!(await actorCanWriteModule(actor, moduleId, institutionId))) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const mod = await db.customModule.findFirst({ where: { id: moduleId, institutionId } });
    if (!mod) {
      return NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 });
    }

    if (!mod.published) {
      return NextResponse.json({ ok: false, error: "Módulo no publicado" }, { status: 403 });
    }

    // Validar campos requeridos
    const fields = JSON.parse(mod.fieldsJson) as any[];
    const missing = fields
      .filter((f) => f.required && f.type !== "section" && f.type !== "column")
      .filter((f) => {
        const v = data[f.id] ?? data[f.name];
        return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      })
      .map((f) => f.label || f.name);

    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Campos requeridos faltantes: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const record = await db.customModuleRecord.create({
      data: {
        moduleId,
        institutionId,
        userId: userId || null,
        dataJson: JSON.stringify(data),
        status: "submitted",
      },
    });

    // Auditoría
    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "custom_module_record",
        entityType: "CustomModuleRecord",
        entityId: record.id,
        details: JSON.stringify({ moduleId, moduleName: mod.name }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    // Notificar al admin (creador del módulo) y administradores de la institución
    const admins = await db.user.findMany({
      where: { institutionId, role: "administrador", active: true },
      select: { id: true },
    });
    const notifyTargets = new Set<string>();
    if (mod.createdById) notifyTargets.add(mod.createdById);
    admins.forEach((a) => notifyTargets.add(a.id));

    const notifPromises = Array.from(notifyTargets).map((uid) =>
      db.notification.create({
        data: {
          userId: uid,
          type: "custom_module_submission",
          title: `Nuevo registro en ${mod.name}`,
          body: `Se ha enviado un nuevo registro en el módulo "${mod.name}".`,
          link: `/api/custom-modules/records?moduleId=${moduleId}`,
          channel: "in_app",
        },
      })
    );
    await Promise.all(notifPromises);

    return NextResponse.json({ ok: true, recordId: record.id, successMessage: mod.successMessage });
  } catch (e) {
    console.error("[custom-modules.records.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar estado o datos de un registro
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, updatedById, data, status, reviewNotes } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    // [Seguridad] identidad + roles del módulo del registro (visibleRolesJson)
    const actorPatch = await getSessionUser(req);
    const existingForModule = await db.customModuleRecord.findFirst({ where: { id, institutionId } });
    if (!(await actorCanWriteModule(actorPatch, existingForModule?.moduleId ?? "", institutionId))) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = existingForModule;
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Registro no encontrado" }, { status: 404 });
    }

    const update: any = {};
    if (data !== undefined) update.dataJson = JSON.stringify(data);
    if (status !== undefined) update.status = status;
    if (reviewNotes !== undefined) {
      update.reviewNotes = reviewNotes;
      update.reviewedById = updatedById || null;
      update.reviewedAt = new Date();
    }

    await db.customModuleRecord.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: updatedById || null,
        action: "update",
        module: "custom_module_record",
        entityType: "CustomModuleRecord",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[custom-modules.records.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar un registro
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const institutionId = searchParams.get("institutionId");
    const deletedById = searchParams.get("deletedById");

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    // [Seguridad] identidad + roles del módulo del registro (visibleRolesJson)
    const actorDelete = await getSessionUser(req);
    const existingForModule = await db.customModuleRecord.findFirst({ where: { id, institutionId } });
    if (!(await actorCanWriteModule(actorDelete, existingForModule?.moduleId ?? "", institutionId))) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = existingForModule;
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Registro no encontrado" }, { status: 404 });
    }

    await db.customModuleRecord.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: deletedById || null,
        action: "delete",
        module: "custom_module_record",
        entityType: "CustomModuleRecord",
        entityId: id,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[custom-modules.records.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
