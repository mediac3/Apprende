-- Reversión de add_group_management_normalization
-- (elimina columnas/FKs nuevas de Group y restaura la forma anterior)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "old_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT,
    "headTeacherId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradeLevelId" TEXT,
    CONSTRAINT "Group_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Group_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_headTeacherId_fkey" FOREIGN KEY ("headTeacherId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "old_Group" ("createdAt", "gradeLevelId", "headTeacherId", "id", "institutionId", "name", "section") SELECT "createdAt", "gradeLevelId", "headTeacherId", "id", "institutionId", "name", "section" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "old_Group" RENAME TO "Group";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
