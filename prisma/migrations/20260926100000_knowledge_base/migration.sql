-- Base de conocimientos: materiales/documentos embebidos por URL agrupados
-- por categoría curricular (materiales | dba | ebc | evaluacion | mallas).
-- Evaluación y Materiales requieren gradeLevelId (validado en la API).
-- generatedContent: documento redactado por IA → servido públicamente en /kb/[id].
-- Migración aditiva (no destruye datos).
-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'documento',
    "category" TEXT NOT NULL,
    "gradeLevelId" TEXT,
    "description" TEXT,
    "generatedContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeItem_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeItem_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KnowledgeItem_institutionId_category_idx" ON "KnowledgeItem"("institutionId", "category");

-- CreateIndex
CREATE INDEX "KnowledgeItem_gradeLevelId_idx" ON "KnowledgeItem"("gradeLevelId");
