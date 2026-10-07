-- [Usuarios] Renombrar el rol 'Contacto familiar' a 'Acudiente' (solo el nombre visible; el code 'acudiente' no cambia).
-- DOWN (documentado): UPDATE "Role" SET name = 'Contacto familiar' WHERE code = 'acudiente';
UPDATE "Role" SET name = 'Acudiente' WHERE code = 'acudiente' AND name = 'Contacto familiar';
