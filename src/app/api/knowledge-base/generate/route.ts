import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// === Base de conocimientos — generar documento con IA (Gemini) ===
// POST { institutionId, category, gradeLevelId?, topic }
// Genera el contenido del documento según la categoría curricular, lo guarda
// como KnowledgeItem (generadoContent) y devuelve el LINK PÚBLICO /kb/[id].
// Nota: Skywork no expone API pública (decisión de negocio del usuario) →
// la generación usa Gemini, ya integrado vía AiConfig.

const CATEGORIAS: Record<string, { label: string; instruccion: string }> = {
  materiales: {
    label: "Materiales",
    instruccion:
      "Guía de materiales y recursos didácticos: lista de materiales físicos y digitales, uso pedagógico de cada uno y sugerencias de elaboración propia.",
  },
  dba: {
    label: "Derechos Básicos de Aprendizaje",
    instruccion:
      "Documento de Derechos Básicos de Aprendizaje (DBA, Ministerio de Educación Nacional de Colombia): DBA por periodo o área, evidencias de aprendizaje sugeridas y explicación de cada derecho.",
  },
  ebc: {
    label: "Estándares Básicos de Competencias",
    instruccion:
      "Documento de Estándares Básicos de Competencias: estándares por periodo, competencias asociadas y desempeños esperados.",
  },
  evaluacion: {
    label: "Evaluación",
    instruccion:
      "Plan/instrumento de evaluación: criterios de evaluación, tabla de desempeños (superior, alto, básico, bajo), actividades e instrumentos sugeridos y ponderación.",
  },
  mallas: {
    label: "Mallas de aprendizaje",
    instruccion:
      "Malla de aprendizaje: por periodos, con contenidos/temas, DBA asociados, indicadores de desempeño (saber hacer, saber ser, saber conocer) y actividades.",
  },
};

const CAT_CON_GRADO = ["evaluacion", "materiales"];

/** Solo se permite llamar a hosts https públicos conocidos (sin localhost/privados) */
function hostPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, category, gradeLevelId, topic } = body as {
      institutionId?: string;
      category?: string;
      gradeLevelId?: string | null;
      topic?: string;
    };
    if (!institutionId || !category || !CATEGORIAS[category]) {
      return NextResponse.json({ ok: false, error: "institutionId y category válidos son requeridos" }, { status: 400 });
    }

    const cfg = await db.aiConfig.findUnique({ where: { institutionId } });
    if (!cfg?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "La IA no está configurada. Ve a Parámetros → Inteligencia artificial.", needsConfig: true },
        { status: 400 }
      );
    }

    let gradoNombre = "";
    let gradoId: string | null = null;
    if (CAT_CON_GRADO.includes(category)) {
      if (!gradeLevelId) {
        return NextResponse.json({ ok: false, error: "Para Evaluación y Materiales debes seleccionar el Grado" }, { status: 400 });
      }
      const gl = await db.gradeLevel.findFirst({
        where: { id: gradeLevelId, institutionId },
        select: { id: true, name: true },
      });
      if (!gl) return NextResponse.json({ ok: false, error: "Grado no encontrado" }, { status: 400 });
      gradoId = gl.id;
      gradoNombre = gl.name;
    }

    const cat = CATEGORIAS[category];
    const prompt = `Genera un documento educativo colombiano en HTML (solo el fragmento HTML del cuerpo: h2, h3, p, ul, ol, table — sin <html>, <head> ni <body>).
Tipo de documento: ${cat.label}.
${gradoNombre ? `Grado destinado: ${gradoNombre}.` : ""}
${topic ? `Tema o enfoque solicitado por el usuario: ${topic}.` : "Cubre los temas centrales del documento para el área de manera general."}
Contenido requerido: ${cat.instruccion}
Estructura mínima: título (h2), introducción, secciones con h3, listas y al menos una tabla cuando aplique. Español formal, redactado para docentes. Extensión: completo pero sin relleno.`;

    const model = cfg.model?.trim() || "gemini-flash-latest";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    if (!hostPermitido(geminiUrl)) {
      return NextResponse.json({ ok: false, error: "Host de IA no permitido" }, { status: 400 });
    }

    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("[kb.generate.gemini]", resp.status, detail.slice(0, 200));
      const msg =
        resp.status === 400 || resp.status === 403
          ? "La clave de IA no es válida. Revisa Parámetros → Inteligencia artificial."
          : resp.status === 404
            ? "El modelo configurado no existe. Corrige el nombre del modelo en Parámetros → Inteligencia artificial."
            : resp.status === 429
              ? "Límite gratuito alcanzado. Intenta en un minuto."
              : "Error del proveedor de IA.";
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const html = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? "").join("") : "";
    if (!html.trim()) {
      return NextResponse.json({ ok: false, error: "La IA no devolvió contenido. Intenta de nuevo." }, { status: 502 });
    }

    const tituloBase = topic?.trim() || `${cat.label}${gradoNombre ? ` — ${gradoNombre}` : ""}`;
    const created = await db.knowledgeItem.create({
      data: {
        institutionId,
        title: tituloBase,
        url: "generado",
        type: "documento",
        category,
        gradeLevelId: gradoId,
        description: `Documento generado con IA (${new Date().toLocaleDateString("es-CO")}).`,
        generatedContent: html,
      },
    });
    // URL pública del documento servido por la plataforma
    const item = await db.knowledgeItem.update({
      where: { id: created.id },
      data: { url: `/kb/${created.id}` },
      include: { gradeLevel: { select: { id: true, name: true, code: true } } },
    });

    return NextResponse.json({
      ok: true,
      item,
      publicPath: `/kb/${created.id}`,
      publicUrl: `/kb/${created.id}`,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return NextResponse.json({ ok: false, error: "La IA tardó demasiado. Intenta de nuevo." }, { status: 504 });
    }
    console.error("[kb.generate]", e);
    return NextResponse.json({ ok: false, error: "Error interno generando el documento" }, { status: 500 });
  }
}
