import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// === [F1] Archivo de auditoría de planillas imprimibles (GradeSheetArchive) ===
// El PDF se guarda como BLOB en SQLite (sin filesystem). Consultas Prisma
// parametrizadas; nunca se arma SQL por concatenación.

const MAX_PDF_BYTES = 10_000_000; // 10MB
const PDF_DATAURL_PREFIX = "data:application/pdf;base64,";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const institutionId = typeof body?.institutionId === "string" ? body.institutionId : "";
    const groupId = typeof body?.groupId === "string" ? body.groupId : "";
    const subjectId = typeof body?.subjectId === "string" ? body.subjectId : "";
    const periodId = typeof body?.periodId === "string" ? body.periodId : "";
    const yearLabel = typeof body?.yearLabel === "string" ? body.yearLabel : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";

    if (!userId || !institutionId || !groupId || !subjectId || !periodId || !dataUrl) {
      return NextResponse.json({ ok: false, error: "campos requeridos: userId, institutionId, groupId, subjectId, periodId, dataUrl" }, { status: 400 });
    }
    if (!dataUrl.startsWith(PDF_DATAURL_PREFIX)) {
      return NextResponse.json({ ok: false, error: "dataUrl debe ser un PDF base64" }, { status: 400 });
    }

    // El usuario debe existir y pertenecer a la institución (auditoría confiable).
    const user = await db.user.findFirst({
      where: { id: userId, institutionId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    let pdf: Buffer;
    try {
      pdf = Buffer.from(dataUrl.slice(PDF_DATAURL_PREFIX.length), "base64");
    } catch {
      return NextResponse.json({ ok: false, error: "base64 inválido" }, { status: 400 });
    }
    if (pdf.length === 0 || pdf.length > MAX_PDF_BYTES) {
      return NextResponse.json({ ok: false, error: "Tamaño de PDF fuera de límite" }, { status: 413 });
    }

    // fileName del cliente solo como metadato de visualización (no es ruta de disco).
    const originalName = fileName.replace(/[^a-zA-Z0-9._ -]/g, "-").slice(0, 120) || "planilla";

    const archive = await db.gradeSheetArchive.create({
      data: {
        institutionId,
        groupId,
        subjectId,
        periodId,
        yearLabel,
        fileName: originalName,
        pdfBytes: Uint8Array.from(pdf),
        generatedBy: userId,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: archive.id });
  } catch (e) {
    console.error("[grade-sheet-archive] POST error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "No se pudo archivar la planilla" }, { status: 500 });
  }
}
