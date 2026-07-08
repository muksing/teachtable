-- เพิ่มสิทธิ์ role "calendar_manager" ให้แก้ไขปฏิทินได้ (admin มอบสิทธิ์ให้ครูเป็นรายคนได้
-- ผ่านหน้า "จัดการครู" — ติ๊กช่อง "🗓️ ปฏิทินโรงเรียน")
-- รันสคริปต์นี้ถ้าเคยรัน school-calendar.sql ไปแล้วก่อนหน้านี้

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
