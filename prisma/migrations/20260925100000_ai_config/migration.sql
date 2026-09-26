-- Agente de IA contextual: configuración por institución (clave del proveedor,
-- modelo). Migración aditiva (no destruye datos). La clave se guarda por la
-- propia institución desde Parámetros → Inteligencia artificial.
-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_institutionId_key" ON "AiConfig"("institutionId");
