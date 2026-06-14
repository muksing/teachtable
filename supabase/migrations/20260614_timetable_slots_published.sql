-- Create timetable_slots_published: snapshot ที่ Admin Publish แล้ว
-- downstream (PrintTimetable, TeachingLog, MaeSo, ฯลฯ) อ่านจากตารางนี้
-- TimetableView (scheduler) ยังคงแก้ไข timetable_slots (draft) เหมือนเดิม

create table if not exists public.timetable_slots_published (
  id                uuid primary key default gen_random_uuid(),
  school_id         text not null,
  term_id           text not null,
  class_id          text,
  day_of_week       integer,
  period_number     integer,
  subject_id        text,
  subject_name      text,
  teacher_id        text,
  teacher_name      text,
  room_id           text,
  slot_type         text default 'normal',
  co_teachers       jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  -- publish metadata
  published_at      timestamptz not null default now(),
  published_by      text
);

create index if not exists tsp_school_term_idx
  on public.timetable_slots_published (school_id, term_id);

create index if not exists tsp_class_day_period_idx
  on public.timetable_slots_published (school_id, term_id, class_id, day_of_week, period_number);

create index if not exists tsp_teacher_day_idx
  on public.timetable_slots_published (school_id, term_id, teacher_id, day_of_week);

alter table public.timetable_slots_published enable row level security;

drop policy if exists "read timetable_slots_published" on public.timetable_slots_published;
create policy "read timetable_slots_published"
  on public.timetable_slots_published for select
  to authenticated using (true);

drop policy if exists "write timetable_slots_published" on public.timetable_slots_published;
create policy "write timetable_slots_published"
  on public.timetable_slots_published for all
  to authenticated using (true) with check (true);
