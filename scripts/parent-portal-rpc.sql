-- ============================================================
--  Parent Portal RPCs — รันใน Supabase SQL Editor
--  school_id columns are UUID; p_school_id params are TEXT
--  → ใช้ school_id::text = p_school_id ทุกที่
-- ============================================================

-- 1. authenticate_parent
-- ============================================================
CREATE OR REPLACE FUNCTION authenticate_parent(
  p_phone             TEXT,
  p_national_id_last6 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone         TEXT := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_school_id     UUID;
  v_school_name   TEXT;
  v_school_logo   TEXT;
  v_current_term  TEXT;
  v_term_year     TEXT;
  v_term_semester TEXT;
  v_result        JSONB;
BEGIN
  -- หา school จาก student ตัวแรกที่ตรง (ไม่ใช้ MAX(uuid))
  SELECT s.school_id,
         COALESCE(sc.name, ''),
         COALESCE(sc.settings->>'logo_url', ''),
         COALESCE(sc.current_term, sc.settings->>'currentTerm', ''),
         COALESCE(sc.settings->'school_info'->>'year', ''),
         COALESCE(sc.settings->'school_info'->>'semester', '')
  INTO v_school_id, v_school_name, v_school_logo, v_current_term, v_term_year, v_term_semester
  FROM students s
  LEFT JOIN schools sc ON sc.id = s.school_id
  WHERE s.is_active = true
    AND (
      ( regexp_replace(s.guardian_primary->>'phone','[^0-9]','','g')  = v_phone
        AND RIGHT(COALESCE(s.guardian_primary->>'national_id',''),6)   = p_national_id_last6 )
      OR
      ( regexp_replace(s.guardian_secondary->>'phone','[^0-9]','','g') = v_phone
        AND RIGHT(COALESCE(s.guardian_secondary->>'national_id',''),6)  = p_national_id_last6 )
    )
  LIMIT 1;

  IF v_school_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'school_id',     v_school_id,
    'school_name',   v_school_name,
    'school_logo',   v_school_logo,
    'current_term',  v_current_term,
    'term_year',     v_term_year,
    'term_semester', v_term_semester,
    'guardian_name', MAX(CASE
      WHEN regexp_replace(s.guardian_primary->>'phone','[^0-9]','','g') = v_phone
           AND RIGHT(COALESCE(s.guardian_primary->>'national_id',''),6) = p_national_id_last6
      THEN s.guardian_primary->>'name'
      ELSE s.guardian_secondary->>'name'
    END),
    'children', jsonb_agg(
      jsonb_build_object(
        'student_code',   s.student_code,
        'prefix',         COALESCE(s.prefix,''),
        'name',           s.first_name,
        'surname',        s.last_name,
        'class_id',       s.class_id,
        'seat_number',    COALESCE(s.seat_number, 0),
        'photo_url',      COALESCE(s.photo_url,''),
        'behavior_score', COALESCE(s.total_behavior_score, 100)
      ) ORDER BY s.class_id, s.seat_number
    )
  )
  INTO v_result
  FROM students s
  WHERE s.is_active  = true
    AND s.school_id  = v_school_id
    AND (
      ( regexp_replace(s.guardian_primary->>'phone','[^0-9]','','g')  = v_phone
        AND RIGHT(COALESCE(s.guardian_primary->>'national_id',''),6)   = p_national_id_last6 )
      OR
      ( regexp_replace(s.guardian_secondary->>'phone','[^0-9]','','g') = v_phone
        AND RIGHT(COALESCE(s.guardian_secondary->>'national_id',''),6)  = p_national_id_last6 )
    );

  IF v_result->>'children' IS NULL THEN RETURN NULL; END IF;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION authenticate_parent(TEXT, TEXT) TO anon;


-- 2. get_parent_child_attendance
-- ============================================================
CREATE OR REPLACE FUNCTION get_parent_child_attendance(
  p_student_code TEXT,
  p_school_id    TEXT,
  p_date_from    DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_date_to      DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'date',      ta.date,
        'period',    ta.period_number,
        'slot_type', COALESCE(ta.slot_type, 'normal'),
        'subject',   CASE
                       WHEN ta.slot_type = 'homeroom'
                         THEN COALESCE(NULLIF(hp.hp_name, ''),
                                CASE WHEN ta.period_number = 0 THEN 'เข้าแถว' ELSE 'กิจกรรมครูที่ปรึกษา' END)
                       ELSE COALESCE(NULLIF(sub.name, ''), NULLIF(ta.subject_id, ''), '')
                     END,
        'teacher',   COALESCE(NULLIF(ta.record_by_name, ''), ''),
        'is_filled', ta.is_filled,
        'status',    CASE
                       WHEN ta.is_filled = false
                         OR ta.student_records IS NULL
                         OR (ta.student_records -> p_student_code) IS NULL
                         THEN 'ยังไม่บันทึก'
                       ELSE COALESCE(ta.student_records -> p_student_code ->> 'status', 'มาเรียน')
                     END
      )
      ORDER BY ta.date DESC, ta.period_number
    )
    FROM teach_actuals ta
    LEFT JOIN subjects sub
      ON  sub.school_id::text = p_school_id
      AND sub.subject_code    = ta.subject_id
    LEFT JOIN LATERAL (
      SELECT elem->>'name' AS hp_name
      FROM jsonb_array_elements(
        COALESCE(
          (SELECT settings->'teaching_log_settings'->'homeroom_special_periods'
           FROM schools WHERE id::text = p_school_id LIMIT 1),
          '[]'::jsonb
        )
      ) elem
      WHERE (elem->>'period')::int = ta.period_number
      LIMIT 1
    ) hp ON ta.slot_type = 'homeroom'
    WHERE ta.class_id        = (SELECT class_id FROM students WHERE student_code = p_student_code AND school_id::text = p_school_id AND is_active = true LIMIT 1)
      AND ta.school_id::text = p_school_id
      AND ta.date            >= p_date_from
      AND ta.date            <= p_date_to
  ), '[]'::jsonb)
$func$;

GRANT EXECUTE ON FUNCTION get_parent_child_attendance(TEXT, TEXT, DATE, DATE) TO anon;


-- 3. get_parent_child_behavior
-- ============================================================
CREATE OR REPLACE FUNCTION get_parent_child_behavior(
  p_student_code TEXT,
  p_school_id    TEXT,
  p_term_id      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'total_score',      COALESCE(s.total_behavior_score, 100),
      'general_score',    COALESCE(s.general_behavior_score, 0),
      'attendance_score', COALESCE(s.attendance_behavior_score, 0),
      'learning_score',   COALESCE(s.learning_behavior_score, 0),
      'probation_score', (
        SELECT COALESCE(SUM(bl.points_change), 0)
        FROM behavior_logs bl
        WHERE bl.student_id      = p_student_code
          AND bl.school_id::text = p_school_id
          AND bl.term_id         = p_term_id
          AND bl.behavior_type   = 'probation'
      ),
      'recent_logs', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'date',        bl.date,
            'type',        bl.behavior_type,
            'label',       bl.label_snapshot,
            'points',      bl.points_change,
            'note',        bl.note,
            'teacher',     bl.recorded_by_name_snapshot,
            'image_urls',  bl.image_urls
          ) ORDER BY bl.date DESC, bl.created_at DESC
        ), '[]'::jsonb)
        FROM behavior_logs bl
        WHERE bl.student_id         = p_student_code
          AND bl.school_id::text    = p_school_id
          AND bl.term_id            = p_term_id
          AND bl.points_change     <> 0
        LIMIT 200
      )
    )
    FROM students s
    WHERE s.student_code    = p_student_code
      AND s.school_id::text = p_school_id
      AND s.is_active       = true
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_parent_child_behavior(TEXT, TEXT, TEXT) TO anon;


-- 4. get_parent_child_scores
-- ============================================================
CREATE OR REPLACE FUNCTION get_parent_child_scores(
  p_student_code TEXT,
  p_school_id    TEXT,
  p_term_id      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id TEXT;
BEGIN
  SELECT class_id INTO v_class_id
  FROM students
  WHERE student_code    = p_student_code
    AND school_id::text = p_school_id
    AND is_active       = true
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'subject_code', sr.subject_code,
        'subject_name', COALESCE(sub.name, sr.subject_code),
        'scores',       sr.scores
      ) ORDER BY sub.name NULLS LAST
    )
    FROM score_records sr
    LEFT JOIN subjects sub
      ON sub.school_id::text = p_school_id
     AND sub.subject_code    = sr.subject_code
    WHERE sr.student_id         = p_student_code
      AND sr.school_id::text    = p_school_id
      AND sr.class_id           = v_class_id
      AND sr.term_id            = p_term_id
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_parent_child_scores(TEXT, TEXT, TEXT) TO anon;
