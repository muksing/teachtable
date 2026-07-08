-- =====================================================================
-- Announcements v2: เพิ่ม title, targets, image_urls, target_user_ids
-- และ RPC สำหรับ anon (นักเรียน/ผู้ปกครอง)
-- รัน script นี้ใน Supabase SQL Editor
-- =====================================================================

-- 1. เพิ่ม column ใหม่ใน school_announcements
ALTER TABLE school_announcements
  ADD COLUMN IF NOT EXISTS title           TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS targets         TEXT[]  DEFAULT ARRAY['teacher'],
  ADD COLUMN IF NOT EXISTS image_urls      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user_ids TEXT[]  DEFAULT NULL;

-- 2. อัปเดต INSERT policy ให้รวม announcer role
DROP POLICY IF EXISTS "announcements_insert" ON school_announcements;
CREATE POLICY "announcements_insert" ON school_announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.uid = auth.uid()::text
        AND u.school_id::text = school_announcements.school_id
        AND (
          u.role = ANY(ARRAY['school_admin','superadmin'])
          OR 'school_director' = ANY(u.roles)
          OR 'announcer'       = ANY(u.roles)
        )
    )
  );

-- 3. อัปเดต DELETE policy ให้รวม announcer role
DROP POLICY IF EXISTS "announcements_delete" ON school_announcements;
CREATE POLICY "announcements_delete" ON school_announcements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.uid = auth.uid()::text
        AND u.school_id::text = school_announcements.school_id
        AND (
          u.role = ANY(ARRAY['school_admin','superadmin'])
          OR 'school_director' = ANY(u.roles)
          OR 'announcer'       = ANY(u.roles)
          OR u.uid = school_announcements.author_id
        )
    )
  );

-- 4. UPDATE policy ใหม่
DROP POLICY IF EXISTS "announcements_update" ON school_announcements;
CREATE POLICY "announcements_update" ON school_announcements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.uid = auth.uid()::text
        AND u.school_id::text = school_announcements.school_id
        AND (
          u.role = ANY(ARRAY['school_admin','superadmin'])
          OR 'school_director' = ANY(u.roles)
          OR 'announcer'       = ANY(u.roles)
          OR u.uid = school_announcements.author_id
        )
    )
  );

-- 5. RPC สำหรับ anon (นักเรียน/ผู้ปกครอง ใช้ anon key)
--    กรอง: targets มี p_target + target_user_ids เป็น null/ว่าง (ไม่ส่งเฉพาะบุคคล)
CREATE OR REPLACE FUNCTION get_school_announcements_public(
  p_school_id TEXT,
  p_target    TEXT  -- 'student' หรือ 'parent'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          a.id,
        'title',       COALESCE(a.title, ''),
        'content',     a.content,
        'type',        COALESCE(a.type, 'info'),
        'author_name', a.author_name,
        'created_at',  a.created_at,
        'image_urls',  COALESCE(a.image_urls, '{}')
      ) ORDER BY a.created_at DESC
    ), '[]'::jsonb)
    FROM school_announcements a
    WHERE a.school_id = p_school_id
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
      -- กรองตาม target group
      AND p_target = ANY(COALESCE(a.targets, ARRAY['teacher']))
      -- เฉพาะประกาศทั่วไป (ไม่ระบุเฉพาะบุคคล) เท่านั้นที่นักเรียน/ผู้ปกครองเห็น
      AND (
        a.target_user_ids IS NULL
        OR array_length(a.target_user_ids, 1) IS NULL
        OR array_length(a.target_user_ids, 1) = 0
      )
    LIMIT 50
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_school_announcements_public(TEXT, TEXT) TO anon;

-- 6. Supabase Storage bucket สำหรับรูปภาพประกาศ
--    (รัน section นี้แยกถ้า bucket ยังไม่มี)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcements', 'announcements', true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policies
DROP POLICY IF EXISTS "ann_img_read"   ON storage.objects;
DROP POLICY IF EXISTS "ann_img_insert" ON storage.objects;
DROP POLICY IF EXISTS "ann_img_delete" ON storage.objects;

CREATE POLICY "ann_img_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'announcements');

CREATE POLICY "ann_img_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcements');

CREATE POLICY "ann_img_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'announcements');
