-- ============================================================
--  Club Module — migrate from schools.settings.clubs JSONB
--  to proper relational tables
--  รันใน Supabase SQL Editor (ทีละ block หรือรันทั้งหมด)
-- ============================================================

-- ── 1. Create tables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id       TEXT        UNIQUE NOT NULL,
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term_id       TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'normal',   -- 'normal' | 'special'
  max_capacity  INT,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  teacher_id    TEXT        NOT NULL,
  teacher_name  TEXT,
  eval_criteria TEXT,
  member_count  INT         NOT NULL DEFAULT 0,
  session_count INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_memberships (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id      TEXT        NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  school_id    UUID        NOT NULL,
  term_id      TEXT        NOT NULL,
  student_id   TEXT        NOT NULL,
  student_name TEXT,
  student_no   TEXT,
  class_id     TEXT,
  class_room   TEXT,
  photo_url    TEXT,
  eval_result  TEXT,
  eval_note    TEXT,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, student_id)
);

CREATE TABLE IF NOT EXISTS club_sessions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id     TEXT        UNIQUE NOT NULL,
  club_id        TEXT        NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
  school_id      UUID        NOT NULL,
  term_id        TEXT        NOT NULL,
  session_number INT         NOT NULL,
  session_date   DATE        NOT NULL,
  topic          TEXT,
  note           TEXT,
  file_urls      JSONB       NOT NULL DEFAULT '[]',
  attendance     JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clubs_school_term    ON clubs(school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_clubs_teacher        ON clubs(teacher_id, school_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club    ON club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_student ON club_memberships(student_id, school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_club_sessions_club   ON club_sessions(club_id);

-- ── 3. RLS ────────────────────────────────────────────────────
ALTER TABLE clubs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_sessions    ENABLE ROW LEVEL SECURITY;

-- authenticated (ครู/admin) read+write ทุก row
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clubs' AND policyname='clubs_authenticated') THEN
    CREATE POLICY clubs_authenticated ON clubs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='club_memberships' AND policyname='club_memberships_authenticated') THEN
    CREATE POLICY club_memberships_authenticated ON club_memberships FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='club_sessions' AND policyname='club_sessions_authenticated') THEN
    CREATE POLICY club_sessions_authenticated ON club_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- anon read (student portal / parent portal)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clubs' AND policyname='clubs_anon_read') THEN
    CREATE POLICY clubs_anon_read ON clubs FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='club_memberships' AND policyname='club_memberships_anon_read') THEN
    CREATE POLICY club_memberships_anon_read ON club_memberships FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='club_sessions' AND policyname='club_sessions_anon_read') THEN
    CREATE POLICY club_sessions_anon_read ON club_sessions FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- ── 4. Migrate existing data from schools.settings.clubs ──────
--  (ข้ามถ้า club_id มีอยู่แล้ว → idempotent)
DO $$
DECLARE
  school_rec   RECORD;
  term_key     TEXT;
  club_arr     JSONB;
  club_item    JSONB;
  cid          TEXT;
  evals        JSONB;
  member_key   TEXT;
  member_val   JSONB;
  session_key  TEXT;
  session_val  JSONB;
  i            INT;
BEGIN
  FOR school_rec IN
    SELECT id, settings FROM schools
    WHERE settings->'clubs' IS NOT NULL
  LOOP
    FOR term_key IN
      SELECT jsonb_object_keys(school_rec.settings->'clubs')
    LOOP
      club_arr := school_rec.settings->'clubs'->term_key;
      IF jsonb_typeof(club_arr) <> 'array' THEN CONTINUE; END IF;

      FOR i IN 0 .. jsonb_array_length(club_arr) - 1 LOOP
        club_item := club_arr->i;
        cid       := club_item->>'club_id';
        IF cid IS NULL THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM clubs WHERE club_id = cid) THEN CONTINUE; END IF;

        evals := COALESCE(club_item->'evaluations', '{}'::jsonb);

        INSERT INTO clubs (
          club_id, school_id, term_id, name, type, max_capacity,
          description, is_active, teacher_id, teacher_name,
          eval_criteria, member_count, session_count, created_at, updated_at
        ) VALUES (
          cid,
          school_rec.id,
          term_key,
          COALESCE(NULLIF(club_item->>'name',''), 'ชุมนุม'),
          COALESCE(NULLIF(club_item->>'type',''), 'normal'),
          NULLIF(club_item->>'max_capacity','')::INT,
          NULLIF(club_item->>'description',''),
          COALESCE((club_item->>'is_active')::BOOLEAN, true),
          COALESCE(NULLIF(club_item->>'teacher_id',''), 'unknown'),
          NULLIF(club_item->>'teacher_name',''),
          NULLIF(evals->>'criteria',''),
          COALESCE((club_item->>'member_count')::INT, 0),
          COALESCE((club_item->>'session_count')::INT, 0),
          COALESCE((club_item->>'created_at')::TIMESTAMPTZ, now()),
          COALESCE((club_item->>'updated_at')::TIMESTAMPTZ, now())
        );

        -- members
        FOR member_key IN
          SELECT jsonb_object_keys(COALESCE(club_item->'members', '{}'))
        LOOP
          member_val := club_item->'members'->member_key;
          INSERT INTO club_memberships (
            club_id, school_id, term_id, student_id,
            student_name, student_no, class_id, class_room, photo_url,
            eval_result, eval_note, enrolled_at
          ) VALUES (
            cid, school_rec.id, term_key, member_key,
            member_val->>'student_name',
            member_val->>'student_no',
            member_val->>'class_id',
            member_val->>'class_room',
            member_val->>'photo_url',
            (evals->member_key)->>'result',
            (evals->member_key)->>'note',
            COALESCE((member_val->>'enrolled_at')::TIMESTAMPTZ, now())
          )
          ON CONFLICT (club_id, student_id) DO NOTHING;
        END LOOP;

        -- sessions
        FOR session_key IN
          SELECT jsonb_object_keys(COALESCE(club_item->'sessions', '{}'))
        LOOP
          session_val := club_item->'sessions'->session_key;
          INSERT INTO club_sessions (
            session_id, club_id, school_id, term_id,
            session_number, session_date, topic, note,
            file_urls, attendance, created_at, updated_at
          ) VALUES (
            session_key, cid, school_rec.id, term_key,
            COALESCE((session_val->>'session_number')::INT, 1),
            COALESCE(
              NULLIF(session_val->>'session_date','')::DATE,
              CURRENT_DATE
            ),
            NULLIF(session_val->>'topic',''),
            NULLIF(session_val->>'note',''),
            COALESCE(session_val->'file_urls', '[]'),
            COALESCE(session_val->'attendance', '{}'),
            COALESCE((session_val->>'created_at')::TIMESTAMPTZ, now()),
            now()
          )
          ON CONFLICT (session_id) DO NOTHING;
        END LOOP;

      END LOOP;
    END LOOP;
  END LOOP;
END $$;
