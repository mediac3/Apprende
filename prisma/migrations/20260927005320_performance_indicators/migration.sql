-- CreateTable
CREATE TABLE "PerformanceIndicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "bajo" TEXT,
    "basico" TEXT,
    "alto" TEXT,
    "superior" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerformanceIndicator_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PerformanceIndicator_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PerformanceIndicator_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PerformanceIndicator_subjectId_periodId_idx" ON "PerformanceIndicator"("subjectId", "periodId");

-- CreateIndex
CREATE INDEX "PerformanceIndicator_institutionId_year_idx" ON "PerformanceIndicator"("institutionId", "year");
