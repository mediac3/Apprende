import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// GET: lista de módulos personalizados
// ?institutionId=...&status=published&area=Convivencia
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const status = searchParams.get("status");
  const area = searchParams.get("area");

  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }

  try {
    const where: any = { institutionId };
    if (status) where.status = status;
    if (area) where.area = area;

    const modules = await db.customModule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { records: true } },
      },
    });

    const safe = modules.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      description: m.description,
      icon: m.icon,
      area: m.area,
      menuLabel: m.menuLabel,
      tabOrientation: m.tabOrientation,
      tabLabels: JSON.parse(m.tabLabelsJson),
      fields: JSON.parse(m.fieldsJson),
      settings: m.settingsJson ? JSON.parse(m.settingsJson) : null,
      successMessage: m.successMessage,
      errorMessage: m.errorMessage,
      published: m.published,
      status: m.status,
      rejectionReason: m.rejectionReason,
      visibleRoles: JSON.parse(m.visibleRolesJson),
      canCreateRoles: JSON.parse(m.canCreateRolesJson),
      canEditRoles: JSON.parse(m.canEditRolesJson),
      canDeleteRoles: JSON.parse(m.canDeleteRolesJson),
      recordsCount: m._count.records,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      publishedAt: m.publishedAt,
    }));

    return NextResponse.json({ ok: true, modules: safe });
  } catch (e) {
    console.error("[custom-modules.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: crear nuevo módulo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      createdById,
      name,
      slug,
      description,
      icon,
      area,
      menuLabel,
      tabOrientation,
      tabLabels,
      fields,
      settings,
      successMessage,
      errorMessage,
      visibleRoles,
      canCreateRoles,
      canEditRoles,
      canDeleteRoles,
    } = body;

    if (!institutionId || !name || !slug || !fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, name, slug, fields" },
        { status: 400 }
      );
    }

    const exists = await db.customModule.findFirst({
      where: { institutionId, slug },
    });
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un módulo con ese slug" },
        { status: 400 }
      );
    }

    const mod = await db.customModule.create({
      data: {
        institutionId,
        createdById: createdById || null,
        name,
        slug,
        description: description || null,
        icon: icon || "FileText",
        area: area || "Personalizado",
        menuLabel: menuLabel || name,
        tabOrientation: tabOrientation || "horizontal",
        tabLabelsJson: JSON.stringify(tabLabels || ["Registros", "Nuevo"]),
        fieldsJson: JSON.stringify(fields),
        settingsJson: settings ? JSON.stringify(settings) : null,
        successMessage: successMessage || "Registro enviado correctamente.",
        errorMessage: errorMessage || "Ocurrió un error. Verifique los datos.",
        visibleRolesJson: JSON.stringify(visibleRoles || ["docente", "director_grupo", "coordinador", "rector", "orientador", "acudiente", "estudiante", "administrativo"]),
        canCreateRolesJson: JSON.stringify(canCreateRoles || ["docente", "director_grupo", "coordinador", "rector", "orientador", "acudiente", "estudiante", "administrativo"]),
        canEditRolesJson: JSON.stringify(canEditRoles || ["rector", "administrativo"]),
        canDeleteRolesJson: JSON.stringify(canDeleteRoles || ["rector", "administrativo"]),
        status: "draft",
        published: false,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: createdById || null,
        action: "create",
        module: "custom_modules",
        entityType: "CustomModule",
        entityId: mod.id,
        details: JSON.stringify({ name, slug, area }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, moduleId: mod.id });
  } catch (e) {
    console.error("[custom-modules.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar módulo existente
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      institutionId,
      updatedById,
      name,
      description,
      icon,
      area,
      menuLabel,
      tabOrientation,
      tabLabels,
      fields,
      settings,
      successMessage,
      errorMessage,
      visibleRoles,
      canCreateRoles,
      canEditRoles,
      canDeleteRoles,
    } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const existing = await db.customModule.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 });
    }

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (icon !== undefined) update.icon = icon;
    if (area !== undefined) update.area = area;
    if (menuLabel !== undefined) update.menuLabel = menuLabel;
    if (tabOrientation !== undefined) update.tabOrientation = tabOrientation;
    if (tabLabels !== undefined) update.tabLabelsJson = JSON.stringify(tabLabels);
    if (fields !== undefined) update.fieldsJson = JSON.stringify(fields);
    if (settings !== undefined) update.settingsJson = settings ? JSON.stringify(settings) : null;
    if (successMessage !== undefined) update.successMessage = successMessage;
    if (errorMessage !== undefined) update.errorMessage = errorMessage;
    if (visibleRoles !== undefined) update.visibleRolesJson = JSON.stringify(visibleRoles);
    if (canCreateRoles !== undefined) update.canCreateRolesJson = JSON.stringify(canCreateRoles);
    if (canEditRoles !== undefined) update.canEditRolesJson = JSON.stringify(canEditRoles);
    if (canDeleteRoles !== undefined) update.canDeleteRolesJson = JSON.stringify(canDeleteRoles);

    await db.customModule.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: updatedById || null,
        action: "update",
        module: "custom_modules",
        entityType: "CustomModule",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[custom-modules.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar módulo
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const institutionId = searchParams.get("institutionId");
    const deletedById = searchParams.get("deletedById");

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const existing = await db.customModule.findFirst({ where: { id, institutionId } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Módulo no encontrado" }, { status: 404 });
    }

    await db.customModule.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: deletedById || null,
        action: "delete",
        module: "custom_modules",
        entityType: "CustomModule",
        entityId: id,
        details: JSON.stringify({ name: existing.name, slug: existing.slug }),
        ip: req.headers.get("x-forwarded-for") || "unknown",
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[custom-modules.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
