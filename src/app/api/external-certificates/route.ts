import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Gestión de Estudiantes (PDF pág 8) — certificados de otras instituciones

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (PDF pág 9)
const ALLOWED_TYPES = ["pdf", "jpg", "jpeg", "png"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");
  const studentId = searchParams.get("studentId");

  if (!institutionId) {
    return NextResponse.json({ ok: false, error: "institutionId requerido" }, { status: 400 });
  }

  try {
    const where: any = { institutionId };
    if (studentId) where.studentId = studentId;

    const certificates = await db.externalCertificate.findMany({
      where,
      orderBy: { year: "desc" },
    });

    return NextResponse.json({ ok: true, certificates });
  } catch (e) {
    console.error("[external-certificates]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      institutionId, studentId, userId,
      year, gradeLevel, institutionName, city, observation, fileName, fileType, fileData,
    } = body;

    if (!institutionId || !studentId || !year || !institutionName) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    if (fileData) {
      const type = (fileType || "").toLowerCase();
      if (!ALLOWED_TYPES.includes(type)) {
        return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido (pdf, jpg, png)" }, { status: 400 });
      }
      if (fileData.length > MAX_FILE_SIZE) {
        return NextResponse.json({ ok: false, error: "El archivo supera el límite de 2MB" }, { status: 400 });
      }
    }

    const certificate = await db.externalCertificate.create({
      data: {
        institutionId,
        studentId,
        year: Number(year),
        gradeLevel: gradeLevel || null,
        institutionName,
        city: city || null,
        observation: observation || null,
        fileName: fileName || null,
        fileType: (fileType || "").toLowerCase() || null,
        fileData: fileData || null,
      },
    });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "create",
        module: "external-certificates",
        entityType: "ExternalCertificate",
        entityId: certificate.id,
        details: JSON.stringify({ studentId, year, institutionName }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, certificate });
  } catch (e) {
    console.error("[external-certificates.create]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, institutionId, userId, year, gradeLevel, institutionName, city, observation, fileName, fileType, fileData } = body;

    if (!id || !institutionId) {
      return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
    }

    const data: any = {};
    if ("year" in body) data.year = Number(year);
    if ("gradeLevel" in body) data.gradeLevel = gradeLevel || null;
    if ("institutionName" in body) data.institutionName = institutionName;
    if ("city" in body) data.city = city || null;
    if ("observation" in body) data.observation = observation || null;
    if ("fileName" in body) data.fileName = fileName || null;
    if ("fileType" in body) data.fileType = (fileType || "").toLowerCase() || null;
    if ("fileData" in body) data.fileData = fileData || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const certificate = await db.externalCertificate.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "update",
        module: "external-certificates",
        entityType: "ExternalCertificate",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(data) }),
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true, certificate });
  } catch (e) {
    console.error("[external-certificates.update]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const institutionId = searchParams.get("institutionId");
  const userId = searchParams.get("userId");

  if (!id || !institutionId) {
    return NextResponse.json({ ok: false, error: "id e institutionId requeridos" }, { status: 400 });
  }

  try {
    await db.externalCertificate.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        institutionId,
        userId: userId || null,
        action: "delete",
        module: "external-certificates",
        entityType: "ExternalCertificate",
        entityId: id,
        details: null,
        hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[external-certificates.delete]", e);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
