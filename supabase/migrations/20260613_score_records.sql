-- Migration: create score_records table
-- Created: 2026-06-13

CREATE TABLE IF NOT EXISTS public.score_records (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      TEXT          NOT NULL,
  term_id        TEXT          NOT NULL,
  subject_code   TEXT          NOT NULL,
  class_id       TEXT          NOT NULL,
  student_id     TEXT          NOT NULL,
  scores         JSONB         NOT NULL DEFAULT '{}',
  recorded_by    TEXT,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT score_records_unique
    UNIQUE (school_id, term_id, subject_code, class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_score_records_lookup
  ON public.score_records (school_id, term_id, subject_code, class_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_records_updated_at ON public.score_records;

CREATE TRIGGER trg_score_records_updated_at
  BEFORE UPDATE ON public.score_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security
ALTER TABLE public.score_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "score_records_authenticated_all"
  ON public.score_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
