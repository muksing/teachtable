-- ═══════════════════════════════════════════════════════════════
-- Migration: Student Check-in + Home Visit System
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mkeryhnjiuwcynfzmive/editor
-- ═══════════════════════════════════════════════════════════════

-- 1. student_checkins table
CREATE TABLE IF NOT EXISTS student_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  student_code    TEXT NOT NULL,
  class_id        TEXT,
  date            DATE NOT NULL,
  checkin_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat             FLOAT,
  lng             FLOAT,
  distance_m      FLOAT,
  selfie_url      TEXT,
  device_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, student_code, date)
);

CREATE INDEX IF NOT EXISTS idx_student_checkins_school_date ON student_checkins(school_id, date);
CREATE INDEX IF NOT EXISTS idx_student_checkins_student ON student_checkins(school_id, student_code);

-- 2. student_home_info table (ข้อมูลบ้านนักเรียน)
CREATE TABLE IF NOT EXISTS student_home_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  student_code    TEXT NOT NULL,
  home_lat        FLOAT,
  home_lng        FLOAT,
  home_address    TEXT,
  house_type      TEXT,       -- ปูน/ไม้/เช่า/อื่นๆ
  household_income TEXT,
  photo_urls      JSONB DEFAULT '[]',
  family_members  JSONB DEFAULT '[]',
  student_notes   TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT,       -- 'student' | 'teacher'
  UNIQUE (school_id, student_code)
);

CREATE INDEX IF NOT EXISTS idx_home_info_school ON student_home_info(school_id);

-- 3. home_visits table (บันทึกการเยี่ยมบ้าน)
CREATE TABLE IF NOT EXISTS home_visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       TEXT NOT NULL,
  student_code    TEXT NOT NULL,
  class_id        TEXT,
  teacher_id      TEXT,
  teacher_name    TEXT,
  visit_date      DATE NOT NULL,
  visit_lat       FLOAT,
  visit_lng       FLOAT,
  distance_from_home FLOAT,
  family_present  JSONB DEFAULT '[]',
  notes           TEXT,
  visit_photo_urls JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_visits_school ON home_visits(school_id);
CREATE INDEX IF NOT EXISTS idx_home_visits_student ON home_visits(school_id, student_code);

-- 4. Add columns to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS registered_device_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_telegram_id TEXT;

-- 5. RLS Policies (adjust as needed for your RLS setup)
ALTER TABLE student_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_home_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_visits ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated to insert checkins (student portal uses anon key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_checkins' AND policyname='checkins_school_access') THEN
    CREATE POLICY "checkins_school_access" ON student_checkins FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_home_info' AND policyname='home_info_school_access') THEN
    CREATE POLICY "home_info_school_access" ON student_home_info FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='home_visits' AND policyname='home_visits_school_access') THEN
    CREATE POLICY "home_visits_school_access" ON home_visits FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
