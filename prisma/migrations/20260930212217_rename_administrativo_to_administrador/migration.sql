-- [F1] Renombrar rol "Administrativo" -> "Administrador" (rol superior a todos).
-- Role.name ya era "Administrador" en datos; el code era 'administrativo'.
-- Parametrización no aplica: valores literales fijos, sin input externo.

-- UP
UPDATE "Role" SET "code" = 'administrador', "name" = 'Administrador' WHERE "code" = 'administrativo';
UPDATE "User" SET "role" = 'administrador' WHERE "role" = 'administrativo';

-- DOWN (reverso; ver down.sql en esta misma carpeta)
-- UPDATE "Role" SET "code" = 'administrativo', "name" = 'Administrativo' WHERE "code" = 'administrador';
-- UPDATE "User" SET "role" = 'administrativo' WHERE "role" = 'administrador';
