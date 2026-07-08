-- =====================================================
-- School Announcements — run ใน Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS school_announcements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         TEXT        NOT NULL,
  author_id         TEXT        NOT NULL,
  author_name       TEXT,
  author_role       TEXT        DEFAULT 'admin',
  content           TEXT        NOT NULL,
  type              TEXT        DEFAULT 'info',
  target_teacher_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_school_announcements_school
  ON school_announcements (school_id, created_at DESC);

ALTER TABLE school_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_read"   ON school_announcements;
DROP POLICY IF EXISTS "announcements_insert" ON school_announcements;
DROP POLICY IF EXISTS "announcements_delete" ON school_announcements;

-- uid = text, school_id = uuid, roles = text[]

CREATE POLICY "announcements_read" ON school_announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.uid = auth.uid()::text
        AND u.school_id::text = school_announcements.school_id
    )
  );

CREATE POLICY "announcements_insert" ON school_announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.uid = auth.uid()::text
        AND u.school_id::text = school_announcements.school_id
        AND (
          u.role = ANY(ARRAY['school_admin','superadmin'])
          OR 'school_director' = ANY(u.roles)
        )
    )
  );

CREATE POLICY "announcements_delete" ON school_announcements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.uid = auth.uid()::text
        AND u.school_id::text = school_announcements.school_id
        AND (
          u.role = ANY(ARRAY['school_admin','superadmin'])
          OR 'school_director' = ANY(u.roles)
          OR u.uid = school_announcements.author_id
        )
    )
  );
