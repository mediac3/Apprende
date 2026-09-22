-- CreateTable
CREATE TABLE "GradeCellComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeCellComment_studentId_activityId_key" ON "GradeCellComment"("studentId", "activityId");

-- CreateIndex
CREATE INDEX "GradeCellComment_activityId_idx" ON "GradeCellComment"("activityId");
