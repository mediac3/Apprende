-- Reconciliacion de drift: columna ya existente en la BD (aplicada via db push),
-- registrada en el historial de migraciones sin tocar datos.
ALTER TABLE "Activity" ADD COLUMN "label" TEXT;
