-- DOWN de 20260923090000_backfill_student_enrollments_active_year:
-- elimina SOLO las matrículas creadas por el backfill (estudiante activo con grupo
-- que no tenía matrícula previa del año). Las 2 matrículas preexistentes quedan:
--   cmu0lkwz10001ogxw8efyi9mv (student cmtxjrkli003sp45twacokno8, 6°A)
--   cmucv4ovl001gog702o950qx1 (student cmtxjrkklz004qp45tq0dpk30e, 6°B)
DELETE FROM "StudentEnrollment"
WHERE id NOT IN ('cmu0lkwz10001ogxw8efyi9mv', 'cmucv4ovl001gog702o950qx1')
  AND status = 'matriculado'
  AND academicYearId = (SELECT id FROM "AcademicYear" WHERE active = 1 LIMIT 1)
  AND studentId IN (
    SELECT s."id" FROM "Student" s
    JOIN "AcademicYear" ay ON ay."institutionId" = s."institutionId" AND ay."active" = 1
    WHERE s."groupId" IS NOT NULL AND s."status" = 'activo'
  )
  AND NOT EXISTS (
    -- conserva matrículas que existían antes del backfill de ese mismo estudiante/año
    SELECT 1 FROM "StudentEnrollment" pre
    WHERE pre."id" IN ('cmu0lkwz10001ogxw8efyi9mv', 'cmucv4ovl001gog702o950qx1')
      AND pre."studentId" = "StudentEnrollment"."studentId"
      AND pre."academicYearId" = "StudentEnrollment"."academicYearId"
  );
