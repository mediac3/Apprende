-- DOWN de 20260922230000_add_year_to_subject_assignment: restaura la tabla original
-- (sin year, sin updatedAt, sin unique ni índice por teacherId).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "weeklyHours" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SubjectAssignment" ("id", "institutionId", "groupId", "subjectId", "teacherId", "weeklyHours", "createdAt")
SELECT "id", "institutionId", "groupId", "subjectId", "teacherId", "weeklyHours", "createdAt" FROM "SubjectAssignment";
DROP TABLE "SubjectAssignment";
ALTER TABLE "new_SubjectAssignment" RENAME TO "SubjectAssignment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
