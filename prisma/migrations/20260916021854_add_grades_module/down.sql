-- Down: add_grades_module (reversible)
DROP INDEX IF EXISTS "GradeRecord_studentId_activityId_key";
DROP INDEX IF EXISTS "GradeRecord_activityId_idx";
DROP INDEX IF EXISTS "GradeRecord_studentId_idx";
DROP INDEX IF EXISTS "Activity_groupId_subjectId_periodId_name_key";
DROP INDEX IF EXISTS "Activity_subjectId_periodId_evaluativeConceptId_idx";
DROP INDEX IF EXISTS "Activity_groupId_subjectId_periodId_idx";
DROP TABLE IF EXISTS "GradeRecord";
DROP TABLE IF EXISTS "Activity";
