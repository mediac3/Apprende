-- AlterTable
ALTER TABLE "Observation" ADD COLUMN "title" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "baptized" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "birthPlace" TEXT;
ALTER TABLE "Student" ADD COLUMN "documentNumber" TEXT;
ALTER TABLE "Student" ADD COLUMN "documentType" TEXT;
ALTER TABLE "Student" ADD COLUMN "identityDocUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN "overage" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN "simatEps" TEXT;
ALTER TABLE "Student" ADD COLUMN "simatEstrato" TEXT;
ALTER TABLE "Student" ADD COLUMN "simatMunicipioExp" TEXT;

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "groupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'matriculado',
    "libro" INTEGER,
    "folio" INTEGER,
    "code" TEXT,
    "enrolledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentEnrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnrollmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentContact_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentContact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentRequirement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentRequirement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "gradeLevel" TEXT,
    "institutionName" TEXT NOT NULL,
    "city" TEXT,
    "observation" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalCertificate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalCertificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentEnrollment_institutionId_academicYearId_idx" ON "StudentEnrollment"("institutionId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "EnrollmentEvent_enrollmentId_idx" ON "EnrollmentEvent"("enrollmentId");

-- CreateIndex
CREATE INDEX "StudentContact_studentId_idx" ON "StudentContact"("studentId");

-- CreateIndex
CREATE INDEX "StudentRequirement_studentId_idx" ON "StudentRequirement"("studentId");

-- CreateIndex
CREATE INDEX "ExternalCertificate_studentId_idx" ON "ExternalCertificate"("studentId");
