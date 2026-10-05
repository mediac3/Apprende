-- AlterTable
-- [Seguridad] Política de cambio de contraseña en primer inicio (configurable por institución)
ALTER TABLE "Institution" ADD COLUMN "forcePasswordChange" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "Institution" ADD COLUMN "passwordChangeRoles" TEXT NOT NULL DEFAULT '[]';
