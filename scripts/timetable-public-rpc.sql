-- ============================================================
--  Timetable RPCs for student & parent portals (anon access)
--  Run in Supabase SQL Editor
-- ============================================================

-- 1. get_class_timetable — ดูตารางสอนของห้องเรียน
--    ใช้ทั้ง student portal และ parent portal
-- ============================================================
CREATE OR REPLACE FUNCTION get_class_timetable(
  p_school_id TEXT,
  p_class_id  TEXT,
  p_term_id   TEXT
)
RETURNS TABLE (
  day_of_week    INT,
  period_number  INT,
  slot_type      TEXT,
  subject_name   TEXT,
  subject_code   TEXT,
  teacher_name   TEXT,
  teacher_code   TEXT,
  room_id        TEXT,
  act_name       TEXT,
  lock_label     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ts.day_of_week,
    ts.period_number,
    ts.slot_type,
    ts.subject_name,
    ts.subject_code,
    CONCAT(COALESCE(t.prefix,''), COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,'')) AS teacher_name,
    ts.teacher_id AS teacher_code,
    ts.room_id,
    ts.act_name,
    ts.lock_label
  FROM timetable_slots ts
  LEFT JOIN teachers t
    ON t.school_id::text = p_school_id
   AND t.teacher_code = ts.teacher_id
  WHERE ts.school_id::text = p_school_id
    AND ts.class_id        = p_class_id
    AND ts.term_id         = p_term_id
  ORDER BY ts.day_of_week, ts.period_number;
END;
$$;

GRANT EXECUTE ON FUNCTION get_class_timetable(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_class_timetable(TEXT, TEXT, TEXT) TO authenticated;
