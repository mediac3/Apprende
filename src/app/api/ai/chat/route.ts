import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// === Agente de IA — chat contextual del módulo activo ===
// POST { institutionId, messages: [{role:"user"|"assistant", content}], context }
// Usa la clave configurada por la institución (Parámetros → Inteligencia
// artificial). Proveedor: Google Gemini (nivel gratuito). Sin dependencias
// nuevas: llamada REST directa.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const DESCRIPCION_PLATAFORMA = `Apprende es una plataforma educativa modular para instituciones escolares colombianas.
Módulos principales: Consolidado anual (notas por periodo, DEF, promedio y estado de promoción por estudiante), Notas parciales, Planeador de clases, Indicadores de desempeño, Pre-Informe (detección temprana de riesgo), Supervisión académica, Control de asistencia, Dirección de grupo, Ficha del observador, Convivencia escolar, Orientación, Comunicación SMS, Gobierno escolar, Inscripción en línea, Pre-Matrícula, Matrícula, Asignación académica, Promoción de grado, Libros reglamentarios, Actas, Talento Humano y Auditoría.
Reglas oficiales del consolidado: DEF por asignatura y periodo; valoración de área = Σ(DEF asignatura × % asignatura); umbral de aprobación configurable (PromotionConfig, por defecto 3.0); 1-2 áreas en bajo → SUJETO A NIVELACIÓN; 3+ → NO PROMOVIDO; inasistencia injustificada ≥ umbral (25% por defecto) → NO PROMOVIDO; asignatura en bajo dentro de área aprobada → promovido con nivelación (Parágrafo 3).`;

function construirSystemPrompt(context: Record<string, unknown> | null | undefined): string {
  // El widget envía el contexto aplanado ({moduleTitle, ...datos}); también se
  // acepta la forma anidada ({moduleTitle, data}).
  let payload: Record<string, unknown> | null = null;
  if (context && typeof context === "object") {
    payload =
      context.data !== undefined
        ? (context.data as Record<string, unknown>)
        : Object.fromEntries(Object.entries(context).filter(([k]) => k !== "moduleTitle"));
  }
  const datos = payload && Object.keys(payload).length > 0
    ? `DATOS ACTUALES DEL MÓDULO "${String(context?.moduleTitle ?? "")}" (JSON confiable, úsalos como única fuente de verdad):\n${JSON.stringify(payload)}`
    : "El usuario aún no tiene datos de un módulo cargado.";
  return `Eres el asistente de IA de Apprende, plataforma educativa colombiana. Respondes en español, de forma concisa (máximo ~200 palabras), práctica y orientada a decisiones.

${DESCRIPCION_PLATAFORMA}

${datos}

Instrucciones:
- Basa SIEMPRE tus respuestas en los datos del módulo proporcionados; no inventes cifras. Si un dato no está en el contexto, dilo y sugiere dónde encontrarlo.
- Para riesgos de deserción: combina promedio bajo, áreas en bajo y % de inasistencia injustificada; señala a los estudiantes concretos si aparecen en los datos y recomienda acciones (nivelación, plan de apoyo, citación a acudiente, seguimiento de orientación).
- Para análisis académico: compara grupos, asignaturas y sedes cuando los datos lo permitan; identifica asignaturas con mayor cantidad de estudiantes en bajo.
- Si preguntan por otro módulo de la plataforma, explica brevemente qué hace y cómo ayudarían sus datos al análisis académico o de convivencia.
- Usa viñetas cortas cuando listes estudiantes o recomendaciones.`;
}

/** Normaliza mensajes a roles alternados user/model exigidos por Gemini */
function aContentsGemini(messages: ChatMessage[]) {
  const limpios = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ text: String(m.content ?? "").trim() }))
    .filter((m) => m.text.length > 0)
    .map((m, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      parts: [{ text: m.text }],
    }));
  // El primer contenido debe ser del usuario
  while (limpios.length > 0 && limpios[0].role !== "user") limpios.shift();
  // Re-alternar por si hubo duplicados
  const alternados: typeof limpios = [];
  for (const c of limpios) {
    const prev = alternados[alternados.length - 1];
    if (prev && prev.role === c.role) {
      prev.parts[0].text += "\n\n" + c.parts[0].text;
    } else {
      alternados.push(c);
    }
  }
  return alternados;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institutionId, messages, context } = body as {
      institutionId?: string;
      messages?: ChatMessage[];
      context?: Record<string, unknown>;
    };
    if (!institutionId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: "institutionId y messages son requeridos" }, { status: 400 });
    }

    const cfg = await db.aiConfig.findUnique({ where: { institutionId } });
    const model = cfg?.model?.trim() || "gemini-flash-latest";
    if (!cfg?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "La IA no está configurada. Ve a Parámetros → Inteligencia artificial y registra tu clave de Google AI Studio.", needsConfig: true },
        { status: 400 }
      );
    }

    const contents = aContentsGemini(messages);
    if (contents.length === 0) {
      return NextResponse.json({ ok: false, error: "Mensaje vacío" }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: construirSystemPrompt(context) }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("[ai.chat.gemini]", resp.status, detail.slice(0, 300));
      const msg =
        resp.status === 400 || resp.status === 403
          ? "La clave de IA no es válida o el modelo no está disponible. Revisa la configuración en Parámetros → Inteligencia artificial."
          : resp.status === 404
            ? "El modelo configurado no existe en el proveedor. Corrige el nombre del modelo en Parámetros → Inteligencia artificial."
            : resp.status === 429
              ? "Se alcanzó el límite gratuito del proveedor de IA. Intenta de nuevo en un minuto."
              : "Error del proveedor de IA. Intenta de nuevo.";
      return NextResponse.json({ ok: false, error: msg, needsConfig: resp.status === 400 || resp.status === 403 }, { status: 502 });
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const reply = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? "").join("") : "";
    if (!reply.trim()) {
      return NextResponse.json({ ok: false, error: "La IA no devolvió respuesta. Intenta reformular la pregunta." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, reply: reply.trim() });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return NextResponse.json({ ok: false, error: "La IA tardó demasiado en responder. Intenta de nuevo." }, { status: 504 });
    }
    console.error("[ai.chat]", e);
    return NextResponse.json({ ok: false, error: "Error interno del asistente" }, { status: 500 });
  }
}
