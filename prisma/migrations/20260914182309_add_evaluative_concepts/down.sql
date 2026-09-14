-- Reversión de add_evaluative_concepts
-- (la migración es 100% aditiva: DROP de tablas nuevas)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TABLE IF EXISTS "EvaluativeConcept";
DROP TABLE IF EXISTS "EducationalModel";
PRAGMA foreign_keys=ON;
-- Nota: aplicar con sqlite3 db/custom.db < down.sql (verificado sobre copia de la BD)
