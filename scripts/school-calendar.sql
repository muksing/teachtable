-- ระบบปฏิทินกลาง — ตารางเหตุการณ์ที่ไม่ได้อยู่ในโมดูลอื่น (ประชุม กิจกรรมพิเศษ วันสำคัญ)
-- เหตุการณ์จากโมดูลอื่น (วันหยุด/วันชดเชย/วันสอบ) อ่านสดจากต้นทางเดิม ไม่ก็อปมาเก็บซ้ำที่นี่
-- รันใน Supabase SQL Editor

create table if not exists public.school_events (
  id                uuid primary key default gen_random_uuid(),
  school_id         text not null,
  title             text not null,
  description       text default '',
  event_date        date not null,
  end_date          date,                    -- null = เหตุการณ์วันเดียว
  event_type        text not null default 'other', -- meeting | activity | important | other
  target_audience   text[] not null default array['all'], -- teacher | student | parent | all
  created_by        text,
  created_by_name   text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_school_events_school_date
  on public.school_events (school_id, event_date);

alter table public.school_events enable row level security;

drop policy if exists "school_events_read" on public.school_events;
create policy "school_events_read" on public.school_events
  for select
  using (
    exists (
      select 1 from users u
      where u.uid = auth.uid()::text
        and u.school_id::text = school_events.school_id
    )
  );

drop policy if exists "school_events_write" on public.school_events;
create policy "school_events_write" on public.school_events
  for all
  using (
    exists (
      select 1 from users u
      where u.uid = auth.uid()::text
        and u.school_id::text = school_events.school_id
        and (
          u.role = any(array['school_admin','superadmin'])
          or 'school_director' = any(u.roles)
          or 'announcer' = any(u.roles)
          or 'calendar_manager' = any(u.roles)
        )
    )
  )
  with check (
    exists (
      select 1 from users u
      where u.uid = auth.uid()::text
        and u.school_id::text = school_events.school_id
        and (
          u.role = any(array['school_admin','superadmin'])
          or 'school_director' = any(u.roles)
          or 'announcer' = any(u.roles)
          or 'calendar_manager' = any(u.roles)
        )
    )
  );

-- RPC สำหรับ นักเรียน/ผู้ปกครอง (anon session) — อ่านอย่างเดียว กรองตาม target_audience
create or replace function get_school_events_public(
  p_school_id text,
  p_target    text,   -- 'student' หรือ 'parent'
  p_from      date default current_date - 7,
  p_to        date default current_date + 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',          e.id,
        'title',       e.title,
        'description', e.description,
        'event_date',  e.event_date,
        'end_date',    e.end_date,
        'event_type',  e.event_type
      ) order by e.event_date
    ), '[]'::jsonb)
    from school_events e
    where e.school_id = p_school_id
      and e.event_date between p_from and p_to
      and (p_target = any(e.target_audience) or 'all' = any(e.target_audience))
  );
end;
$$;

grant execute on function get_school_events_public(text, text, date, date) to anon;
