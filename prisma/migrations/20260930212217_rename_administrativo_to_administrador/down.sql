-- DOWN de 20260930212217_rename_administrativo_to_administrador
-- Restaura el nombre anterior del rol (no destructivo; UserRole es por roleId y no se afecta).
UPDATE "Role" SET "code" = 'administrativo', "name" = 'Administrativo' WHERE "code" = 'administrador';
UPDATE "User" SET "role" = 'administrativo' WHERE "role" = 'administrador';
