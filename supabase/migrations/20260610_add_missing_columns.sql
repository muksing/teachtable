-- Migration: Add missing columns to all main tables

-- ============================================================
-- teachers
-- ============================================================
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS academic_rank TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS position TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS prefix TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_dept_head BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS subject_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'ไทย',
  ADD COLUMN IF NOT EXISTS teacher_type TEXT DEFAULT 'ข้าราชการ',
  ADD COLUMN IF NOT EXISTS salary_grade TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS gov_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS education_level TEXT DEFAULT '';

-- ============================================================
-- students
-- ============================================================
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact JSONB,
  ADD COLUMN IF NOT EXISTS guardian_primary JSONB,
  ADD COLUMN IF NOT EXISTS guardian_secondary JSONB,
  ADD COLUMN IF NOT EXISTS student_status TEXT DEFAULT 'เรียนอยู่',
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS gov_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'ไทย',
  ADD COLUMN IF NOT EXISTS religion TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS blood_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS disability TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS disadvantaged TEXT DEFAULT '';

-- ============================================================
-- classes
-- ============================================================
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS room INTEGER,
  ADD COLUMN IF NOT EXISTS room_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS homeroom_teacher_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS homeroom_teacher_names_snapshot TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '';

-- ============================================================
-- subjects
-- ============================================================
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS consecutive_periods INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dept TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS levels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS credits NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periods_per_week INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '';

-- ============================================================
-- rooms
-- ============================================================
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS building TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS floor INTEGER,
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';

-- ============================================================
-- schools
-- ============================================================
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS current_term TEXT DEFAULT '2568_1',
  ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2568;

-- ============================================================
-- school_requests (create if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS school_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  admin_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  province TEXT DEFAULT '',
  school_size TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- package_catalog (create if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS package_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT DEFAULT '',
  description TEXT DEFAULT '',
  price NUMERIC DEFAULT 0,
  price_yearly NUMERIC DEFAULT 0,
  max_teachers INTEGER DEFAULT 50,
  max_students INTEGER DEFAULT 500,
  max_classes INTEGER DEFAULT 20,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
