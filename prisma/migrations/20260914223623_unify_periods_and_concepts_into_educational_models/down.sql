-- DOWN de: unify_periods_and_concepts_into_educational_models
-- Restaura el estado previo de DATOS sin pérdida. Las columnas nuevas son
-- aditivas y nullable/default (periodCount, details, Period.educationalModelId,
-- Period.order, EvaluativeConcept.order): el código anterior nunca las leyó,
-- por lo que con los datos en su valor previo el comportamiento es idéntico.
-- (Revertir estructura en SQLite exigiría recrear tablas; no aporta beneficio
-- funcional y añade riesgo. Backup previo: db/custom.db.bak-pre-modelos-educativos)

-- 1) Descolgar los Period de los modelos educativos
UPDATE "Period" SET "educationalModelId" = NULL, "order" = NULL;

-- 2) Restaurar order por defecto de los conceptos
UPDATE "EvaluativeConcept" SET "order" = 0;

-- 3) Restaurar valores por defecto del modelo
UPDATE "EducationalModel" SET "periodCount" = 4, "details" = NULL;
