-- ═══════════════════════════════════════════════════════════════
-- Storage Policy: Allow student check-in selfie uploads (anon key)
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- นักเรียนใช้ anon key ต้องให้ anon INSERT/SELECT ใน bucket student-photos
-- เฉพาะ path checkin-selfies/ เท่านั้น

-- 1. ให้ anon อัปโหลดได้ใน checkin-selfies/
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'allow_anon_checkin_selfie_upload',
  id,
  'INSERT',
  '(bucket_id = ''student-photos'' AND (storage.foldername(name))[1] = ''checkin-selfies'')'
FROM storage.buckets WHERE id = 'student-photos'
ON CONFLICT DO NOTHING;

-- 2. ให้ anon อ่าน URL ได้ (public read)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'allow_anon_checkin_selfie_read',
  id,
  'SELECT',
  '(bucket_id = ''student-photos'' AND (storage.foldername(name))[1] = ''checkin-selfies'')'
FROM storage.buckets WHERE id = 'student-photos'
ON CONFLICT DO NOTHING;

-- ─── หรือถ้า insert ข้างบนไม่ work ให้ใช้ CREATE POLICY แทน ────────────

-- DROP POLICY IF EXISTS "allow_anon_checkin_selfie_upload" ON storage.objects;
-- CREATE POLICY "allow_anon_checkin_selfie_upload"
--   ON storage.objects FOR INSERT TO anon
--   WITH CHECK (
--     bucket_id = 'student-photos'
--     AND (storage.foldername(name))[1] = 'checkin-selfies'
--   );

-- DROP POLICY IF EXISTS "allow_anon_checkin_selfie_read"  ON storage.objects;
-- CREATE POLICY "allow_anon_checkin_selfie_read"
--   ON storage.objects FOR SELECT TO anon
--   USING (
--     bucket_id = 'student-photos'
--     AND (storage.foldername(name))[1] = 'checkin-selfies'
--   );
