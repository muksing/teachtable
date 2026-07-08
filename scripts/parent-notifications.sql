-- ============================================================
--  parent_notifications: ข่าวสารจากครูที่ปรึกษาถึงผู้ปกครองในระบบ
--  รัน Supabase SQL Editor ก่อนใช้ feature นี้
-- ============================================================

CREATE TABLE IF NOT EXISTS parent_notifications (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    UUID        NOT NULL,
  student_code TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  sender_name  TEXT,
  class_id     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ,        -- NULL = ยังไม่อ่าน
  tts_at       TIMESTAMPTZ         -- NULL = ยังไม่ฟัง
);

CREATE INDEX IF NOT EXISTS idx_pn_student_school
  ON parent_notifications(school_id, student_code, created_at DESC);

ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'parent_notifications' AND policyname = 'pn_auth'
  ) THEN
    -- ครู/admin: CRUD ทั้งหมด
    CREATE POLICY pn_auth ON parent_notifications
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'parent_notifications' AND policyname = 'pn_anon_select'
  ) THEN
    -- parent portal (anon): อ่านได้
    CREATE POLICY pn_anon_select ON parent_notifications
      FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'parent_notifications' AND policyname = 'pn_anon_update'
  ) THEN
    -- parent portal (anon): อัปเดต read_at / tts_at ได้ (mark as read)
    CREATE POLICY pn_anon_update ON parent_notifications
      FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
