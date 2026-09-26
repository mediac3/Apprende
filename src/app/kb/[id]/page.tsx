import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "./print-button";

// === Link público de documentos generados por la Base de conocimientos ===
// /kb/[id] — accesible sin inicio de sesión (link compartible). Solo expone
// documentos generados con IA (generatedContent); los ítems de URL embebida
// redirigen a su URL original.

export const dynamic = "force-dynamic";

export default async function KbPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.knowledgeItem.findUnique({
    where: { id },
    include: {
      gradeLevel: { select: { name: true } },
      institution: { select: { name: true } },
    },
  });
  if (!item) notFound();

  if (!item.generatedContent) {
    // Ítem embebido por URL: redirige al recurso original
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{item.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este ítem es un recurso embebido por URL.
        </p>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Abrir recurso original
        </a>
      </main>
    );
  }

  const categoriaLabel =
    item.category === "materiales"
      ? "Materiales"
      : item.category === "dba"
        ? "Derechos Básicos de Aprendizaje"
        : item.category === "ebc"
          ? "Estándares Básicos de Competencias"
          : item.category === "evaluacion"
            ? "Evaluación"
            : "Mallas de aprendizaje";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 print:py-0">
      <header className="mb-6 border-b pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {item.institution.name} · Base de conocimientos
        </p>
        <h1 className="mt-1 text-2xl font-heading font-semibold">{item.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {categoriaLabel}
          {item.gradeLevel ? ` · ${item.gradeLevel.name}` : ""} ·{" "}
          {new Date(item.createdAt).toLocaleDateString("es-CO")}
        </p>
        <div className="mt-3 flex gap-2 print:hidden">
          <PrintButton />
          <Link
            href="/"
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Ir a Apprende
          </Link>
        </div>
      </header>

      {/* Contenido generado por IA (HTML confiable producido por el propio
          proveedor configurado por la institución) */}
      <article
        className="kb-document space-y-3 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:border-b-2 [&_h2]:border-primary/60 [&_h2]:pb-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_ol>li]:list-decimal [&_p]:text-justify [&_strong]:text-foreground [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_tr:nth-child(even)]:bg-muted/40 print:text-[11px]"
        dangerouslySetInnerHTML={{ __html: item.generatedContent }}
      />

      <footer className="mt-8 border-t pt-3 text-center text-[11px] text-muted-foreground">
        Generado con Apprende · {new Date().toLocaleString("es-CO")}
      </footer>
    </main>
  );
}
