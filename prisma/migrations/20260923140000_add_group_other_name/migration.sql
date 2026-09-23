-- Migración: "Otro nombre" de Grupo [F2/F3] — código SIMAT del grupo.
-- up: columna otherName + backfill de grupos existentes con la lógica
-- "6°A" -> "601", "8°B" -> "802", "10°A" -> "1001" (grado + letra->consecutivo).
-- Idempotente: solo toca filas con otherName NULL.
ALTER TABLE "Group" ADD COLUMN "otherName" TEXT;

UPDATE "Group" SET "otherName" = (
  CASE
    -- "6°A" / "10°B": grado antes del signo ° + letra final -> consecutivo 01, 02...
    WHEN name GLOB '[0-9]*°[A-Z]' THEN
      substr(name, 1, instr(name, '°') - 1) || printf('%02d', unicode(substr(name, -1)) - 64)
    -- "6A" sin signo °
    WHEN name GLOB '[0-9]*[A-Z]' THEN
      substr(name, 1, length(name) - 1) || printf('%02d', unicode(substr(name, -1)) - 64)
    ELSE NULL
  END
)
WHERE "otherName" IS NULL;

-- down (rollback manual, reversible):
-- ALTER TABLE "Group" DROP COLUMN "otherName";
