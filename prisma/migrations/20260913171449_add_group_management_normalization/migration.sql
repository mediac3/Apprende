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
    "periodsCount" INTEGER,
    "semesterized" BOOLEAN NOT NULL DEFAULT false,
    "semester" INTEGER,
    CONSTRAINT "Group_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Group_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_headTeacherId_fkey" FOREIGN KEY ("headTeacherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("createdAt", "gradeLevelId", "headTeacherId", "id", "institutionId", "name", "section") SELECT "createdAt", "gradeLevelId", "headTeacherId", "id", "institutionId", "name", "section" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: enlazar grupos existentes al año académico activo (o más reciente) de su institución
UPDATE "Group" SET "academicYearId" = (
  SELECT ay."id" FROM "AcademicYear" ay
  WHERE ay."institutionId" = "Group"."institutionId"
  ORDER BY ay."active" DESC, ay."year" DESC
  LIMIT 1
)
WHERE "academicYearId" IS NULL;
