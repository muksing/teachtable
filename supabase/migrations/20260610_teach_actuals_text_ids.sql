-- Migration: Change UUID columns in teach_actuals to TEXT
-- teacher_id and subject_id in this system are TEXT codes (e.g. "309", "30901")
-- not UUIDs — drop FK constraints and change types

ALTER TABLE teach_actuals
  DROP CONSTRAINT IF EXISTS teach_actuals_planned_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS teach_actuals_actual_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS teach_actuals_subject_id_fkey,
  DROP CONSTRAINT IF EXISTS teach_actuals_term_id_fkey;

ALTER TABLE teach_actuals
  ALTER COLUMN planned_teacher_id TYPE TEXT USING planned_teacher_id::TEXT,
  ALTER COLUMN actual_teacher_id  TYPE TEXT USING actual_teacher_id::TEXT,
  ALTER COLUMN subject_id         TYPE TEXT USING subject_id::TEXT,
  ALTER COLUMN term_id            TYPE TEXT USING term_id::TEXT;
