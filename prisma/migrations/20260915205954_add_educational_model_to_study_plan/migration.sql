/*
  Warnings:

  - Added the required column `educationalModelId` to the `CurriculumPlan` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CurriculumPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "educationalModelId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumPlan_educationalModelId_fkey" FOREIGN KEY ("educationalModelId") REFERENCES "EducationalModel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Backfill (estrategia A'): el plan existente recibe el id del modelo educativo "Escuela nueva".
-- Si hubiera planes y no existiera el modelo, la subquery devuelve NULL y el NOT NULL aborta la migración (fallo seguro).
INSERT INTO "new_CurriculumPlan" ("active", "createdAt", "description", "educationalModelId", "id", "institutionId", "name", "updatedAt") SELECT "active", "createdAt", "description", (SELECT "id" FROM "EducationalModel" WHERE "name" = 'Escuela nueva' LIMIT 1), "id", "institutionId", "name", "updatedAt" FROM "CurriculumPlan";
DROP TABLE "CurriculumPlan";
ALTER TABLE "new_CurriculumPlan" RENAME TO "CurriculumPlan";
CREATE INDEX "CurriculumPlan_educationalModelId_idx" ON "CurriculumPlan"("educationalModelId");
CREATE UNIQUE INDEX "CurriculumPlan_institutionId_name_key" ON "CurriculumPlan"("institutionId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
