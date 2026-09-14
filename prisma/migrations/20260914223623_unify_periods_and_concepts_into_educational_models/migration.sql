-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EducationalModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "periodCount" INTEGER NOT NULL DEFAULT 4,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EducationalModel_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EducationalModel" ("active", "createdAt", "id", "institutionId", "name", "updatedAt") SELECT "active", "createdAt", "id", "institutionId", "name", "updatedAt" FROM "EducationalModel";
DROP TABLE "EducationalModel";
ALTER TABLE "new_EducationalModel" RENAME TO "EducationalModel";
CREATE UNIQUE INDEX "EducationalModel_institutionId_name_key" ON "EducationalModel"("institutionId", "name");
CREATE TABLE "new_EvaluativeConcept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "educationalModelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvaluativeConcept_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvaluativeConcept_educationalModelId_fkey" FOREIGN KEY ("educationalModelId") REFERENCES "EducationalModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EvaluativeConcept" ("createdAt", "educationalModelId", "id", "institutionId", "name", "open", "percentage", "updatedAt") SELECT "createdAt", "educationalModelId", "id", "institutionId", "name", "open", "percentage", "updatedAt" FROM "EvaluativeConcept";
DROP TABLE "EvaluativeConcept";
ALTER TABLE "new_EvaluativeConcept" RENAME TO "EvaluativeConcept";
CREATE UNIQUE INDEX "EvaluativeConcept_educationalModelId_name_key" ON "EvaluativeConcept"("educationalModelId", "name");
CREATE TABLE "new_Period" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "weight" REAL NOT NULL DEFAULT 25,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "educationalModelId" TEXT,
    "order" INTEGER,
    CONSTRAINT "Period_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Period_educationalModelId_fkey" FOREIGN KEY ("educationalModelId") REFERENCES "EducationalModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Period" ("active", "closed", "createdAt", "endDate", "id", "institutionId", "name", "startDate", "weight") SELECT "active", "closed", "createdAt", "endDate", "id", "institutionId", "name", "startDate", "weight" FROM "Period";
DROP TABLE "Period";
ALTER TABLE "new_Period" RENAME TO "Period";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- =====================================================================
-- Migración de datos: unificar Periodos y Conceptos bajo Modelos educativos
-- (aditiva: no elimina filas ni tablas previas)
-- =====================================================================

-- 1) periodCount del modelo = nº de periodos existentes de su institución
--    (si la institución no tiene periodos, conserva el default 4)
UPDATE "EducationalModel" AS em
SET "periodCount" = CASE
  WHEN (SELECT COUNT(*) FROM "Period" p WHERE p."institutionId" = em."institutionId") > 0
  THEN (SELECT COUNT(*) FROM "Period" p WHERE p."institutionId" = em."institutionId")
  ELSE em."periodCount"
END;

-- 2) Colgar los Period sueltos del modelo más antiguo de su institución,
--    con "order" según orden de inserción original (rowid)
UPDATE "Period" AS per
SET "educationalModelId" = (
  SELECT em."id" FROM "EducationalModel" em
  WHERE em."institutionId" = per."institutionId"
  ORDER BY em."createdAt" ASC
  LIMIT 1
),
"order" = (
  SELECT COUNT(*) + 1 FROM "Period" p2
  WHERE p2."institutionId" = per."institutionId"
    AND p2.rowid < per.rowid
)
WHERE per."educationalModelId" IS NULL;

-- 3) Orden secuencial de conceptos por modelo (según inserción original)
UPDATE "EvaluativeConcept" AS c
SET "order" = (
  SELECT COUNT(*) + 1 FROM "EvaluativeConcept" c2
  WHERE c2."educationalModelId" = c."educationalModelId"
    AND c2.rowid < c.rowid
)
WHERE c."order" = 0;
