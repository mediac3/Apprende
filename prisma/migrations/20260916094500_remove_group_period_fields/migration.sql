-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT,
    "headTeacherId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradeLevelId" TEXT,
    "academicYearId" TEXT,
    "branchId" TEXT,
    "journeyId" TEXT,
    CONSTRAINT "Group_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Group_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_headTeacherId_fkey" FOREIGN KEY ("headTeacherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("academicYearId", "branchId", "createdAt", "gradeLevelId", "headTeacherId", "id", "institutionId", "journeyId", "name", "section") SELECT "academicYearId", "branchId", "createdAt", "gradeLevelId", "headTeacherId", "id", "institutionId", "journeyId", "name", "section" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- [C1] Normalización de sedes huérfanas → "Principal" (Branch)
-- Grupos con branchId NULL o inexistente quedan asignados a la sede Principal.
UPDATE "Group" SET "branchId" = (SELECT "id" FROM "Branch" WHERE "name" = 'Principal' LIMIT 1)
WHERE "branchId" IS NULL OR "branchId" NOT IN (SELECT "id" FROM "Branch");
