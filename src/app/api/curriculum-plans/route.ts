import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Plan de estudios

// GET: lista de planes (o plan individual con items si viene ?id=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const id = searchParams.get("id");

  if (!institutionId) {
    return NextResponse.json(
      { ok: false, error: "institutionId requerido" },
      { status: 400 }
    );
  }

  try {
    if (id) {
      const plan = await db.curriculumPlan.findFirst({
        where: { id, institutionId },
        include: {
          items: {
            include: {
              subject: { include: { area: true } },
              gradeLevel: true,
            },
            orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { sortOrder: "asc" }],
          },
        },
      });
      if (!plan) {
        return NextResponse.json(
          { ok: false, error: "Plan no encontrado" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, plan });
    }

    const plans = await db.curriculumPlan.findMany({
      where: { institutionId },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Resumen por plan: grados distintos, asignaturas distintas, horas totales
    const items = await db.curriculumPlanItem.groupBy({
      by: ["planId", "gradeLevelId", "subjectId"],
      where: { plan: { institutionId } },
      _sum: { weeklyHours: true },
    });
    const subjects = await db.subject.findMany({
      where: { institutionId },
      select: { id: true, name: true, active: true },
    });
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const levels = await db.gradeLevel.findMany({
      where: { institutionId },
      select: { id: true, name: true, sortOrder: true },
    });
    const levelById = new Map(levels.map((l) => [l.id, l]));

    const summary = new Map<
      string,
      { grades: Set<string>; subjects: Set<string>; totalHours: number }
    >();
    for (const it of items) {
      const s =
        summary.get(it.planId) ?? { grades: new Set(), subjects: new Set(), totalHours: 0 };
      if (levelById.has(it.gradeLevelId)) s.grades.add(it.gradeLevelId);
      if (subjectById.has(it.subjectId)) s.subjects.add(it.subjectId);
      s.totalHours += it._sum.weeklyHours ?? 0;
      summary.set(it.planId, s);
    }

    const result = plans.map((p) => {
      const s = summary.get(p.id) ?? { grades: new Set(), subjects: new Set(), totalHours: 0 };
      return {
        ...p,
        gradesCount: s.grades.size,
        subjectsCount: s.subjects.size,
        totalHours: s.totalHours,
      };
    });

    return NextResponse.json({ ok: true, plans: result });
  } catch (e) {
    console.error("[curriculum-plans.list]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// POST: crear plan (o duplicar si viene cloneFromId)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, name, description, active, cloneFromId, userId } = body;

    if (!institutionId || !name) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: institutionId, name" },
        { status: 400 }
      );
    }

    const dup = await db.curriculumPlan.findFirst({
      where: { institutionId, name },
    });
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un plan con ese nombre" },
        { status: 400 }
      );
    }

    // Duplicación de plan existente
    let sourceItems: any[] = [];
    if (cloneFromId) {
      const source = await db.curriculumPlan.findFirst({
        where: { id: cloneFromId, institutionId },
        include: { items: true },
      });
      if (!source) {
        return NextResponse.json(
          { ok: false, error: "Plan origen no encontrado" },
          { status: 404 }
        );
      }
      sourceItems = source.items;
    }

    const plan = await db.curriculumPlan.create({
      data: {
        institutionId,
        name,
        description: description || null,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    if (sourceItems.length > 0) {
      await db.curriculumPlanItem.createMany({
        data: sourceItems.map((i) => ({
          planId: plan.id,
          subjectId: i.subjectId,
          gradeLevelId: i.gradeLevelId,
          weeklyHours: i.weeklyHours,
          sortOrder: i.sortOrder,
        })),
      });
    }

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: cloneFromId ? "duplicate" : "create",
        module: "curriculum_plans",
        entityType: "CurriculumPlan",
        entityId: plan.id,
        details: JSON.stringify({ name, cloneFromId, itemsCopiados: sourceItems.length }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    console.error("[curriculum-plans.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// PATCH: actualizar plan
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, name, description, active, userId } = body;

    if (!id || !institutionId) {
      return NextResponse.json(
        { ok: false, error: "id e institutionId requeridos" },
        { status: 400 }
      );
    }

    const existing = await db.curriculumPlan.findFirst({
      where: { id, institutionId },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const dup = await db.curriculumPlan.findFirst({
        where: { institutionId, name, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json(
          { ok: false, error: "Ya existe un plan con ese nombre" },
          { status: 400 }
        );
      }
    }

    const update: any = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description || null;
    if (active !== undefined) update.active = Boolean(active);

    const updated = await db.curriculumPlan.update({ where: { id }, data: update });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "curriculum_plans",
        entityType: "CurriculumPlan",
        entityId: id,
        details: JSON.stringify({ updatedFields: Object.keys(update) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, plan: updated });
  } catch (e) {
    console.error("[curriculum-plans.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE: eliminar plan (los items se eliminan en cascada)
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

    const existing = await db.curriculumPlan.findFirst({
      where: { id, institutionId },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    await db.curriculumPlan.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "curriculum_plans",
        entityType: "CurriculumPlan",
        entityId: id,
        details: JSON.stringify({ name: existing.name, items: existing._count.items }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[curriculum-plans.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
