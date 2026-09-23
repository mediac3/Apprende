-- Migración: añade year (año académico), updatedAt y unicidad por (grupo, asignatura, año) a SubjectAssignment.
-- Backfill: year = año del AcademicYear del grupo; si el grupo no tiene año, el año actual.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "weeklyHours" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubjectAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SubjectAssignment" ("createdAt", "groupId", "id", "institutionId", "subjectId", "teacherId", "weeklyHours", "year", "updatedAt")
SELECT "createdAt", "groupId", "id", "institutionId", "subjectId", "teacherId", "weeklyHours",
       COALESCE(
         (SELECT ay."year" FROM "Group" g JOIN "AcademicYear" ay ON ay."id" = g."academicYearId" WHERE g."id" = "SubjectAssignment"."groupId"),
         CAST(strftime('%Y', 'now') AS INTEGER)
       ),
       CURRENT_TIMESTAMP
FROM "SubjectAssignment";
DROP TABLE "SubjectAssignment";
ALTER TABLE "new_SubjectAssignment" RENAME TO "SubjectAssignment";
CREATE INDEX "SubjectAssignment_teacherId_year_idx" ON "SubjectAssignment"("teacherId", "year");
CREATE UNIQUE INDEX "SubjectAssignment_groupId_subjectId_year_key" ON "SubjectAssignment"("groupId", "subjectId", "year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
