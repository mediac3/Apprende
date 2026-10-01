-- [F1] Tabla RolePermission: matriz Rol × Módulo (Ver/Crear/Editar/Eliminar).
-- Formato estándar Prisma/SQLite equivalente al modelo del schema.
-- Migración quirúrgica: la BD tiene drift pre-existente y `migrate dev` exigiría reset.

-- UP
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_moduleKey_key" ON "RolePermission"("roleId", "moduleKey");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- DOWN (reverso; ver down.sql en esta misma carpeta)
-- DROP TABLE "RolePermission";
