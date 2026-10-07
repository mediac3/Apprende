-- [Dashboard Padre] Vínculo acudiente↔estudiante (multi-hijo). Migración ADITIVA.
-- DOWN (documentado, no automático en SQLite):
--   DROP INDEX IF EXISTS "ParentStudent_parentId_studentId_key";
--   DROP INDEX IF EXISTS "ParentStudent_parentId_idx";
--   DROP INDEX IF EXISTS "ParentStudent_studentId_idx";
--   DROP TABLE IF EXISTS "ParentStudent";
--   (y quitar del schema las relaciones User.parentLinks / Student.parentLinks / Institution.parentStudents)
-- CREATE TABLE
CREATE TABLE "ParentStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParentStudent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- INDEXES
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");
CREATE INDEX "ParentStudent_parentId_idx" ON "ParentStudent"("parentId");
CREATE INDEX "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");
