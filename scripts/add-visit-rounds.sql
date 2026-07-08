-- ═══════════════════════════════════════════════════════
-- Migration: Home Visit Rounds
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Add round_id to home_visits
ALTER TABLE home_visits ADD COLUMN IF NOT EXISTS round_id UUID;

-- 2. home_visit_rounds table
CREATE TABLE IF NOT EXISTS home_visit_rounds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    TEXT NOT NULL,
  class_id     TEXT,
  teacher_id   TEXT,
  teacher_name TEXT,
  round_name   TEXT NOT NULL,
  date_start   DATE,
  date_end     DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_rounds_school ON home_visit_rounds(school_id);
CREATE INDEX IF NOT EXISTS idx_visit_rounds_class  ON home_visit_rounds(school_id, class_id);

ALTER TABLE home_visit_rounds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='home_visit_rounds' AND policyname='visit_rounds_access'
  ) THEN
    CREATE POLICY "visit_rounds_access" ON home_visit_rounds
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
