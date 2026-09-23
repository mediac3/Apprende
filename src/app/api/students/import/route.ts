// Importación masiva de estudiantes [F3] — Paso 5 del wizard.
// POST /api/students/import
// Recibe filas ya mapeadas/normalizadas por el wizard (claves de simat-import.ts),
// RE-valida todo en servidor (regla dura: nada se importa con duplicados de
// documento) y crea Student + StudentEnrollment en UNA transacción atómica
// (todo o nada). Procesa en lotes de 100 cuando hay más de 500 filas.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

type ImportRow = Record<string, any>;

function normHeaderIn(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, userId, academicYearId, rows, institutionFields } = body as {
      institutionId: string;
      userId?: string;
      academicYearId?: string;
      rows: ImportRow[];
      institutionFields?: Record<string, string>;
    };

    if (!institutionId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "institutionId y rows son requeridos" }, { status: 400 });
    }
    if (rows.length > 5000) {
      return NextResponse.json({ ok: false, error: "Máximo 5000 filas por importación" }, { status: 400 });
    }

    // --- Validación 1: campos obligatorios por fila ---
    const rowErrors: { row: number; message: string }[] = [];
    rows.forEach((r, i) => {
      if (!String(r.documentNumber ?? "").trim()) rowErrors.push({ row: i + 1, message: "Documento vacío" });
      if (!String(r.documentType ?? "").trim()) rowErrors.push({ row: i + 1, message: "Tipo documento vacío" });
      if (!String(r.lastName1 ?? "").trim()) rowErrors.push({ row: i + 1, message: "Apellido1 vacío" });
      if (!String(r.firstName1 ?? "").trim()) rowErrors.push({ row: i + 1, message: "Nombre1 vacío" });
      if (!r.groupId) rowErrors.push({ row: i + 1, message: "Grupo sin resolver" });
    });
    if (rowErrors.length) {
      return NextResponse.json({ ok: false, error: "Filas inválidas", rowErrors }, { status: 400 });
    }

    // --- Regla dura: duplicados dentro del archivo ---
    const seen = new Map<string, number>();
    const dupInFile: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const doc = String(rows[i].documentNumber).trim();
      if (seen.has(doc)) dupInFile.push(`Documento ${doc} duplicado en filas ${seen.get(doc)! + 1} y ${i + 1}`);
      else seen.set(doc, i);
    }
    if (dupInFile.length) {
      return NextResponse.json({ ok: false, error: "Documentos duplicados dentro del archivo", dupInFile }, { status: 409 });
    }

    // --- Regla dura: duplicados contra BD (query in) ---
    const docs = [...seen.keys()];
    const existing = await db.student.findMany({
      where: { institutionId, documentNumber: { in: docs } },
      select: { documentNumber: true },
    });
    if (existing.length) {
      return NextResponse.json({
        ok: false,
        error: "Documentos ya existentes en la base de datos",
        dupInDb: existing.map((e) => e.documentNumber),
      }, { status: 409 });
    }

    // --- Grupos válidos de la institución ---
    const groupIds = [...new Set(rows.map((r) => String(r.groupId)))];
    const validGroups = await db.group.findMany({
      where: { id: { in: groupIds }, institutionId },
      select: { id: true },
    });
    const validGroupSet = new Set(validGroups.map((g) => g.id));
    const badGroups = rows
      .map((r, i) => (!validGroupSet.has(String(r.groupId)) ? { row: i + 1, message: `Grupo inexistente` } : null))
      .filter(Boolean) as { row: number; message: string }[];
    if (badGroups.length) {
      return NextResponse.json({ ok: false, error: "Grupos inexistentes", rowErrors: badGroups }, { status: 400 });
    }

    // --- Transacción atómica: lotes de 100 ---
    const now = new Date();
    const yearStr = String(now.getFullYear());
    let imported = 0;

    await db.$transaction(async (tx) => {
      // Si el Excel trae clasificación SIMAT de la institución [F1], se aplica (primer valor no vacío)
      if (institutionFields && typeof institutionFields === "object") {
        const allowedInst = ["etc", "calendario", "sector", "zonaSede", "jornada"] as const;
        const instData: Record<string, string> = {};
        for (const k of allowedInst) {
          const v = institutionFields[k];
          if (typeof v === "string" && v.trim()) instData[k] = v.trim();
        }
        if (Object.keys(instData).length) {
          await tx.institution.update({ where: { id: institutionId }, data: instData });
        }
      }
      const CHUNK = 100;
      for (let start = 0; start < rows.length; start += CHUNK) {
        const chunk = rows.slice(start, start + CHUNK);
        for (const r of chunk) {
          const enrolledAt = r.fechaIni ? new Date(r.fechaIni) : now;
          const student = await tx.student.create({
            data: {
              institutionId,
              groupId: String(r.groupId),
              code: r.code || `SIMAT-${String(r.documentNumber).trim()}`,
              firstName: String(r.firstName1).trim(),
              lastName: String(r.lastName1).trim(),
              firstName2: r.firstName2 || null,
              lastName2: r.lastName2 || null,
              documentType: String(r.documentType).trim(),
              documentNumber: String(r.documentNumber).trim(),
              birthDate: r.fechaNacimiento ? new Date(r.fechaNacimiento) : null,
              gender: r.genero || null,
              birthPlace: r.birthPlace || null,
              barrio: r.barrio || null,
              email: r.correo || null,
              simatEstrato: r.estrato || null,
              simatEps: r.eps || null,
              simatSisben: r.sisben || null,
              simatNui: r.nui || null,
              simatRui: r.rui || null,
              bloodType: r.bloodType || null,
              matriculaContratada: typeof r.matriculaContratada === "boolean" ? r.matriculaContratada : null,
              fuenteRecursos: r.fuenteRecursos || null,
              internado: typeof r.internado === "boolean" ? r.internado : null,
              apoyoAcademico: typeof r.apoyoAcademico === "boolean" ? r.apoyoAcademico : null,
              discapacidad: r.discapacidad || null,
              paisOrigen: r.paisOrigen || null,
              motivo: r.motivo || null,
              status: "activo",
              enrollmentDate: enrolledAt,
            },
          });
          await tx.studentEnrollment.create({
            data: {
              institutionId,
              studentId: student.id,
              academicYearId: academicYearId || null,
              groupId: String(r.groupId),
              status: "matriculado",
              enrolledAt,
            },
          });
          imported++;
        }
        console.log(`[students.import] lote ${start + 1}-${start + chunk.length} de ${rows.length} procesado`);
      }

      await tx.auditLog.create({
        data: {
          institutionId,
          userId: userId || null,
          action: "create",
          module: "students",
          entityType: "Student",
          entityId: "import-masiva",
          details: JSON.stringify({ importacion: "SIMAT", total: imported, year: yearStr }),
          hash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
        },
      });
    });

    return NextResponse.json({ ok: true, imported });
  } catch (e) {
    console.error("[students.import]", e);
    return NextResponse.json({ ok: false, error: "Error interno durante la importación; rollback aplicado" }, { status: 500 });
  }
}
