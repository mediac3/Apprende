-- [Dashboard directivo] Alcance del coordinador + umbrales de alertas configurables
-- Aplicada vía `prisma db push` (aditiva, sin pérdida de datos) y registrada con `migrate resolve`.
-- Reversión (down):
--   DROP TABLE "DashboardSetting";
--   ALTER TABLE "User" DROP COLUMN "scopeBranchIds";
--   ALTER TABLE "User" DROP COLUMN "scopeGradeLevelIds";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "scopeBranchIds" TEXT;
ALTER TABLE "User" ADD COLUMN "scopeGradeLevelIds" TEXT;

-- CreateTable
CREATE TABLE "DashboardSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "riskThreshold" REAL NOT NULL DEFAULT 3.0,
    "attendanceThreshold" REAL NOT NULL DEFAULT 90,
    "pendingTasksLimit" INTEGER NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DashboardSetting_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardSetting_institutionId_key" ON "DashboardSetting"("institutionId");
