-- Down de remove_group_period_fields: restaura estructura (no datos) de las 3 columnas eliminadas.
ALTER TABLE "Group" ADD COLUMN "periodsCount" INTEGER;
ALTER TABLE "Group" ADD COLUMN "semesterized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "semester" INTEGER;
-- Nota: la normalización de sedes huérfanas no se revierte (los branchId NULL originales se pierden por diseño).
