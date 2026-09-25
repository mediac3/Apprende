-- [F3] Parámetros de promoción escolar: tabla PromotionConfig (1 fila por institución).
-- Migración aditiva (no destruye datos). Defaults: umbral inasistencia 25%,
-- máx. áreas nivelación 2, preescolar "PJ,J,T"; umbral de áreas null = derivar de escalas.
-- CreateTable
CREATE TABLE "PromotionConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "umbralArea" REAL,
    "umbralInasistencia" INTEGER NOT NULL DEFAULT 25,
    "maxAreasNivelacion" INTEGER NOT NULL DEFAULT 2,
    "preescolarCodes" TEXT NOT NULL DEFAULT 'PJ,J,T',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromotionConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionConfig_institutionId_key" ON "PromotionConfig"("institutionId");
