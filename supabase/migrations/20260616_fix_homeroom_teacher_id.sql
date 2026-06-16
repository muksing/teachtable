-- Fix homeroom_teacher_id to always equal homeroom_teacher_ids[1] (first element)
-- homeroom_teacher_ids is text[] (PostgreSQL array, 1-indexed)

UPDATE public.classes
SET homeroom_teacher_id = homeroom_teacher_ids[1]
WHERE homeroom_teacher_ids IS NOT NULL
  AND array_length(homeroom_teacher_ids, 1) > 0
  AND (
    homeroom_teacher_id IS NULL
    OR homeroom_teacher_id != homeroom_teacher_ids[1]
  );
