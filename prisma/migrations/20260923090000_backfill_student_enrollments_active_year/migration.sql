-- [R2] Backfill de matrículas: crea StudentEnrollment (status 'matriculado') del año
-- académico ACTIVO para cada estudiante activo con grupo asignado, reflejando en
-- Gestión de Estudiantes la realidad actual (Student.groupId). Sin esto, la fuente
-- única de estudiantes por grupo dejaría las planillas casi vacías.
-- Idempotente: salta estudiantes que ya tienen matrícula del año.
INSERT INTO "StudentEnrollment" ("id", "institutionId", "studentId", "academicYearId", "groupId", "status", "enrolledAt", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(12))),
    s."institutionId",
    s."id",
    ay."id",
    s."groupId",
    'matriculado',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Student" s
JOIN "AcademicYear" ay ON ay."institutionId" = s."institutionId" AND ay."active" = 1
WHERE s."groupId" IS NOT NULL
  AND s."status" = 'activo'
  AND NOT EXISTS (
    SELECT 1 FROM "StudentEnrollment" se
    WHERE se."studentId" = s."id" AND se."academicYearId" = ay."id"
  );
