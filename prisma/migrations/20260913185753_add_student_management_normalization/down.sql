-- Reversión de add_student_management_normalization
-- (la migración es 100% aditiva: DROP de tablas nuevas y columnas nuevas)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TABLE IF EXISTS "EnrollmentEvent";
DROP TABLE IF EXISTS "StudentEnrollment";
DROP TABLE IF EXISTS "StudentContact";
DROP TABLE IF EXISTS "StudentRequirement";
DROP TABLE IF EXISTS "ExternalCertificate";
-- SQLite >= 3.35 soporta DROP COLUMN; se conservan los datos previos a la migración
ALTER TABLE "Observation" DROP COLUMN "title";
ALTER TABLE "Student" DROP COLUMN "baptized";
ALTER TABLE "Student" DROP COLUMN "birthPlace";
ALTER TABLE "Student" DROP COLUMN "documentNumber";
ALTER TABLE "Student" DROP COLUMN "documentType";
ALTER TABLE "Student" DROP COLUMN "identityDocUrl";
ALTER TABLE "Student" DROP COLUMN "overage";
ALTER TABLE "Student" DROP COLUMN "photoUrl";
ALTER TABLE "Student" DROP COLUMN "simatEps";
ALTER TABLE "Student" DROP COLUMN "simatEstrato";
ALTER TABLE "Student" DROP COLUMN "simatMunicipioExp";
PRAGMA foreign_keys=ON;
