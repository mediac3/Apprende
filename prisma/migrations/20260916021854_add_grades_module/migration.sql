-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "evaluativeConceptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isGeneral" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_evaluativeConceptId_fkey" FOREIGN KEY ("evaluativeConceptId") REFERENCES "EvaluativeConcept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Activity_groupId_subjectId_periodId_idx" ON "Activity"("groupId", "subjectId", "periodId");

-- CreateIndex
CREATE INDEX "Activity_subjectId_periodId_evaluativeConceptId_idx" ON "Activity"("subjectId", "periodId", "evaluativeConceptId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_groupId_subjectId_periodId_name_key" ON "Activity"("groupId", "subjectId", "periodId", "name");

-- CreateIndex
CREATE INDEX "GradeRecord_studentId_idx" ON "GradeRecord"("studentId");

-- CreateIndex
CREATE INDEX "GradeRecord_activityId_idx" ON "GradeRecord"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRecord_studentId_activityId_key" ON "GradeRecord"("studentId", "activityId");
