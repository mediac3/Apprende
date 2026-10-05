-- CreateTable
CREATE TABLE "TeacherDashboardConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "declineThreshold" REAL NOT NULL DEFAULT 0.5,
    "inactivityDays" INTEGER NOT NULL DEFAULT 4,
    "riskThreshold" REAL NOT NULL DEFAULT 3.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherDashboardConfig_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDashboardConfig_teacherId_key" ON "TeacherDashboardConfig"("teacherId");

