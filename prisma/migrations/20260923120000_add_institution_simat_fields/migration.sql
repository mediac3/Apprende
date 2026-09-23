-- Migración [F1]: clasificación SIMAT de la Institución (aditiva, reversible).
-- up: 5 columnas nullable en Institution (etc, calendario, sector, zonaSede, jornada).
ALTER TABLE "Institution" ADD COLUMN "etc" TEXT;
ALTER TABLE "Institution" ADD COLUMN "calendario" TEXT;
ALTER TABLE "Institution" ADD COLUMN "sector" TEXT;
ALTER TABLE "Institution" ADD COLUMN "zonaSede" TEXT;
ALTER TABLE "Institution" ADD COLUMN "jornada" TEXT;

-- down (rollback manual, reversible):
-- ALTER TABLE "Institution" DROP COLUMN "etc";
-- ALTER TABLE "Institution" DROP COLUMN "calendario";
-- ALTER TABLE "Institution" DROP COLUMN "sector";
-- ALTER TABLE "Institution" DROP COLUMN "zonaSede";
-- ALTER TABLE "Institution" DROP COLUMN "jornada";
