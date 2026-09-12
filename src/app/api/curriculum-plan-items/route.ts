import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Items del plan de estudios: asignatura × grado con intensidad horaria

// GET: items de un plan (?planId=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const planId = searchParams.get("planId");

  if (!institutionId || !planId) {
    return NextResponse.json(
      { ok: false, error: "institutionId y planId requeridos" },
      { status: 400 }
    );
  }

  try {
    const plan = await db.curriculumPlan.findFirst({
      where: { id: planId, institutionId },
    });
    if (!plan) {
      return NextResponse.json(
        { ok: false, error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    const items = await db.curriculumPlanItem.findMany({
      where: { planId },
      include: {
        subject: { include: { area: true } },
        gradeLevel: true,
      },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[curriculum-plan-items.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: agregar item al plan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId,
      planId,
      subjectId,
      gradeLevelId,
      weeklyHours,
      sortOrder,
      userId,
    } = body;

    if (!institutionId || !planId || !subjectId || !gradeLevelId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan datos: institutionId, planId, subjectId, gradeLevelId",
        },
        { status: 400 }
      );
    }

    // Validar pertenencia a la institución (normalización: sin IDs cruzados)
    const plan = await db.curriculumPlan.findFirst({
      where: { id: planId, institutionId },
    });
    if (!plan) {
      return NextResponse.json(
        { ok: false, error: "Plan no encontrado" },
        { status: 404 }
      );
    }
    const subject = await db.subject.findFirst({
      where: { id: subjectId, institutionId },
    });
    if (!subject) {
      return NextResponse.json(
        { ok: false, error: "Asignatura no encontrada" },
        { status: 404 }
      );
    }
    const level = await db.gradeLevel.findFirst({
      where: { id: gradeLevelId, institutionId },
    });
    if (!level) {
      return NextResponse.json(
        { ok: false, error: "Grado no encontrado" },
        { status: 404 }
      );
    }

    const dup = await db.curriculumPlanItem.findFirst({
      where: { planId, subjectId, gradeLevelId },
    });
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          error: `"${subject.name}" ya está en el plan para ${level.name}`,
        },
        { status: 400 }
      );
    }

    const last = await db.curriculumPlanItem.findFirst({
      where: { planId, gradeLevelId },
      orderBy: { sortOrder: "desc" },
    });

    const item = await db.curriculumPlanItem.create({
      data: {
        planId,
        subjectId,
        gradeLevelId,
        weeklyHours: weeklyHours !== undefined ? Number(weeklyHours) : 1,
        sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1,
      },
      include: {
        subject: { include: { area: true } },
        gradeLevel: true,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "curriculum_plan_items",
        entityType: "CurriculumPlanItem",
        entityId: item.id,
        details: JSON.stringify({
          plan: plan.name,
          subject: subject.name,
          grade: level.name,
          weeklyHours: item.weeklyHours,
        }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("[curriculum-plan-items.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar item (intensidad horaria, orden)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, weeklyHours, sortOrder, userId } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.curriculumPlanItem.findFirst({
      where: { id, plan: { institutionId } },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Item no encontrado" },
        { status: 404 }
      );
    }

    const update: any = {};
    if (weeklyHours !== undefined) update.weeklyHours = Number(weeklyHours);
    if (sortOrder !== undefined) update.sortOrder = Number(sortOrder);

    const updated = await db.curriculumPlanItem.update({
      where: { id },
      data: update,
      include: {
        subject: { include: { area: true } },
        gradeLevel: true,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "curriculum_plan_items",
        entityType: "CurriculumPlanItem",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    console.error("[curriculum-plan-items.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar item del plan
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const institutionId = searchParams.get("institutionId");
    const userId = searchParams.get("userId");

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.curriculumPlanItem.findFirst({
      where: { id, plan: { institutionId } },
      include: { subject: true, gradeLevel: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Item no encontrado" },
        { status: 404 }
      );
    }

    await db.curriculumPlanItem.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "curriculum_plan_items",
        entityType: "CurriculumPlanItem",
        entityId: id,
        details: JSON.stringify({
          subject: existing.subject.name,
          grade: existing.gradeLevel.name,
        }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[curriculum-plan-items.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
