-- DOWN de 20260930213500_update_administrador_role_json_refs
UPDATE "CustomModule" SET "visibleRolesJson"   = REPLACE("visibleRolesJson",   '"administrador"', '"administrativo"') WHERE "visibleRolesJson"   LIKE '%"administrador"%';
UPDATE "CustomModule" SET "canCreateRolesJson" = REPLACE("canCreateRolesJson", '"administrador"', '"administrativo"') WHERE "canCreateRolesJson" LIKE '%"administrador"%';
UPDATE "CustomModule" SET "canEditRolesJson"   = REPLACE("canEditRolesJson",   '"administrador"', '"administrativo"') WHERE "canEditRolesJson"   LIKE '%"administrador"%';
UPDATE "CustomModule" SET "canDeleteRolesJson" = REPLACE("canDeleteRolesJson", '"administrador"', '"administrativo"') WHERE "canDeleteRolesJson" LIKE '%"administrador"%';
