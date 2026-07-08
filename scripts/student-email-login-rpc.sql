-- ============================================================
--  Student email-based login RPC
--  รันใน Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION authenticate_student_by_email(
  p_email      TEXT,
  p_credential TEXT   -- gov_id (เลขบัตร) หรือ student_pin
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'school_id',            s.school_id,
      'student_code',         s.student_code,
      'prefix',               COALESCE(s.prefix, ''),
      'name',                 s.first_name,
      'surname',              s.last_name,
      'class_id',             s.class_id,
      'seat_number',          COALESCE(s.seat_number, 0),
      'photo_url',            COALESCE(s.photo_url, ''),
      'total_behavior_score', COALESCE(s.total_behavior_score, 100),
      'general_behavior_score',    COALESCE(s.general_behavior_score, 0),
      'attendance_behavior_score', COALESCE(s.attendance_behavior_score, 0),
      'learning_behavior_score',   COALESCE(s.learning_behavior_score, 0),
      'has_set_pin',          (s.student_pin IS NOT NULL)
    )
    FROM students s
    WHERE (
        lower(trim(s.contact->>'email')) = v_email
        OR lower(trim(s.email)) = v_email
      )
      AND (s.gov_id = p_credential OR s.student_pin = p_credential)
      AND s.is_active = true
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION authenticate_student_by_email(TEXT, TEXT) TO anon;
