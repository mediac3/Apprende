-- Migración [F2]: campos SIMAT del estudiante (aditiva, reversible).
-- up: 15 columnas nullable + índice único de documentNumber (BD sin duplicados, verificado).
ALTER TABLE "Student" ADD COLUMN "lastName2" TEXT;
ALTER TABLE "Student" ADD COLUMN "firstName2" TEXT;
ALTER TABLE "Student" ADD COLUMN "simatNui" TEXT;
ALTER TABLE "Student" ADD COLUMN "simatRui" TEXT;
ALTER TABLE "Student" ADD COLUMN "simatSisben" TEXT;
ALTER TABLE "Student" ADD COLUMN "barrio" TEXT;
ALTER TABLE "Student" ADD COLUMN "email" TEXT;
ALTER TABLE "Student" ADD COLUMN "bloodType" TEXT;
ALTER TABLE "Student" ADD COLUMN "matriculaContratada" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "fuenteRecursos" TEXT;
ALTER TABLE "Student" ADD COLUMN "internado" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "apoyoAcademico" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "discapacidad" TEXT;
ALTER TABLE "Student" ADD COLUMN "paisOrigen" TEXT;
ALTER TABLE "Student" ADD COLUMN "motivo" TEXT;
CREATE UNIQUE INDEX "Student_documentNumber_key" ON "Student"("documentNumber");

-- down (rollback manual, reversible):
-- DROP INDEX IF EXISTS "Student_documentNumber_key";
-- ALTER TABLE "Student" DROP COLUMN "motivo";
-- ALTER TABLE "Student" DROP COLUMN "paisOrigen";
-- ALTER TABLE "Student" DROP COLUMN "discapacidad";
-- ALTER TABLE "Student" DROP COLUMN "apoyoAcademico";
-- ALTER TABLE "Student" DROP COLUMN "internado";
-- ALTER TABLE "Student" DROP COLUMN "fuenteRecursos";
-- ALTER TABLE "Student" DROP COLUMN "matriculaContratada";
-- ALTER TABLE "Student" DROP COLUMN "bloodType";
-- ALTER TABLE "Student" DROP COLUMN "email";
-- ALTER TABLE "Student" DROP COLUMN "barrio";
-- ALTER TABLE "Student" DROP COLUMN "simatSisben";
-- ALTER TABLE "Student" DROP COLUMN "simatRui";
-- ALTER TABLE "Student" DROP COLUMN "simatNui";
-- ALTER TABLE "Student" DROP COLUMN "firstName2";
-- ALTER TABLE "Student" DROP COLUMN "lastName2";
