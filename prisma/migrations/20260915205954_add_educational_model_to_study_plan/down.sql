-- Reversión de add_educational_model_to_study_plan
-- Elimina la columna educationalModelId (FK) de CurriculumPlan conservando los datos.
-- Nota: aplicar con mejor-sqlite3/node sobre db/custom.db (verificado sobre copia de la BD).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "old_CurriculumPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "old_CurriculumPlan" ("active", "createdAt", "description", "id", "institutionId", "name", "updatedAt") SELECT "active", "createdAt", "description", "id", "institutionId", "name", "updatedAt" FROM "CurriculumPlan";
DROP TABLE "CurriculumPlan";
ALTER TABLE "old_CurriculumPlan" RENAME TO "CurriculumPlan";
CREATE UNIQUE INDEX "CurriculumPlan_institutionId_name_key" ON "CurriculumPlan"("institutionId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
