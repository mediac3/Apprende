-- [F1] Actualiza referencias al rol renombrado dentro de arrays JSON almacenados
-- en CustomModule (defaults de visibilidad/permisos por rol). Valores literales fijos,
-- sin input externo; Prisma/SQLite no requiere binding para este script.

-- UP (idempotente: solo filas que aún contienen "administrativo")
UPDATE "CustomModule" SET "visibleRolesJson"   = REPLACE("visibleRolesJson",   '"administrativo"', '"administrador"') WHERE "visibleRolesJson"   LIKE '%"administrativo"%';
UPDATE "CustomModule" SET "canCreateRolesJson" = REPLACE("canCreateRolesJson", '"administrativo"', '"administrador"') WHERE "canCreateRolesJson" LIKE '%"administrativo"%';
UPDATE "CustomModule" SET "canEditRolesJson"   = REPLACE("canEditRolesJson",   '"administrativo"', '"administrador"') WHERE "canEditRolesJson"   LIKE '%"administrativo"%';
UPDATE "CustomModule" SET "canDeleteRolesJson" = REPLACE("canDeleteRolesJson", '"administrativo"', '"administrador"') WHERE "canDeleteRolesJson" LIKE '%"administrativo"%';

-- DOWN (reverso; ver down.sql en esta misma carpeta)
-- UPDATE "CustomModule" SET "visibleRolesJson"   = REPLACE("visibleRolesJson",   '"administrador"', '"administrativo"') WHERE "visibleRolesJson"   LIKE '%"administrador"%';
-- UPDATE "CustomModule" SET "canCreateRolesJson" = REPLACE("canCreateRolesJson", '"administrador"', '"administrativo"') WHERE "canCreateRolesJson" LIKE '%"administrador"%';
-- UPDATE "CustomModule" SET "canEditRolesJson"   = REPLACE("canEditRolesJson",   '"administrador"', '"administrativo"') WHERE "canEditRolesJson"   LIKE '%"administrador"%';
-- UPDATE "CustomModule" SET "canDeleteRolesJson" = REPLACE("canDeleteRolesJson", '"administrador"', '"administrativo"') WHERE "canDeleteRolesJson" LIKE '%"administrador"%';
