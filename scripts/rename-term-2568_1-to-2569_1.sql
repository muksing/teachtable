-- ═══════════════════════════════════════════════════════════════════
-- เปลี่ยนรหัสเทอม "2568_1" เป็น "2569_1" ให้ตรงกับปีการศึกษาจริง
-- ("2568_1" คือเทอมที่ใช้งานอยู่จริงตอนนี้ ไม่ใช่เทอมเก่า — แค่รหัสภายใน
--  เพี้ยนไม่ตรงกับปีที่แสดงผล "ภาคเรียนที่ 1 ปีการศึกษา 2569")
--
-- วิธีรัน: เปิด Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- ควรรันตอนไม่มีคนใช้งานระบบ (เช่นกลางคืน) และสำรอง/export ข้อมูลไว้ก่อน
--
-- สคริปต์นี้แก้เฉพาะโรงเรียน "โรงเรียนเพชรละครวิทยา"
-- (school_id = 11111111-1111-1111-1111-111111111111) เท่านั้น
-- ถ้ามีโรงเรียนอื่นที่ใช้ term_id "2568_1" ด้วย ต้องรันแยกหรือปรับ WHERE
-- ═══════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v_school_id text := '11111111-1111-1111-1111-111111111111';
  v_old_term  text := '2568_1';
  v_new_term  text := '2569_1';
begin

  update teachers                set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update timetable_slots         set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update timetable_slots_published set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update activity_bookings       set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update teach_actuals           set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update behavior_logs           set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update clubs                   set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update club_memberships        set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update score_records           set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update teaching_assignments    set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;
  update leave_requests          set term_id = v_new_term where school_id = v_school_id and term_id = v_old_term;

  -- ตัวทะเบียนเทอม (คอลัมน์ชื่อไม่เหมือนที่อื่น)
  update academic_terms
    set term_name = v_new_term, year = 2569
    where school_id = v_school_id and term_name = v_old_term;

  -- ตัวชี้เทอมปัจจุบันที่ระบบทั้งหมดอ้างอิงจริง
  update schools
    set current_term = v_new_term
    where id = v_school_id and current_term = v_old_term;

end $$;

-- ── ตรวจสอบผลลัพธ์ก่อน commit ──────────────────────────────────────
-- รันส่วนนี้ดูก่อน ถ้าตัวเลขสมเหตุสมผล (ไม่มีอะไรเป็น 0 ที่ไม่ควรเป็น 0)
-- ค่อย 'commit;' ท้ายไฟล์ ถ้าเห็นอะไรผิดปกติให้ 'rollback;' แทน

select 'teachers' t, count(*) rows_now_2569_1 from teachers where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'timetable_slots', count(*) from timetable_slots where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'timetable_slots_published', count(*) from timetable_slots_published where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'activity_bookings', count(*) from activity_bookings where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'teach_actuals', count(*) from teach_actuals where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'behavior_logs', count(*) from behavior_logs where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'clubs', count(*) from clubs where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'club_memberships', count(*) from club_memberships where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'score_records', count(*) from score_records where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'teaching_assignments', count(*) from teaching_assignments where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'leave_requests', count(*) from leave_requests where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
union all select 'academic_terms', count(*) from academic_terms where school_id = '11111111-1111-1111-1111-111111111111' and term_name = '2569_1'
union all select 'schools.current_term', count(*) from schools where id = '11111111-1111-1111-1111-111111111111' and current_term = '2569_1';

-- ตรวจว่าไม่มีอะไรตกค้างเป็น "2568_1" (ควรได้ 0 ทุกแถว ยกเว้นตารางที่ไม่มีข้อมูลอยู่แล้วตั้งแต่ต้น)
select 'LEFTOVER teachers' t, count(*) rows_still_2568_1 from teachers where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER timetable_slots', count(*) from timetable_slots where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER timetable_slots_published', count(*) from timetable_slots_published where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER activity_bookings', count(*) from activity_bookings where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER teach_actuals', count(*) from teach_actuals where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER behavior_logs', count(*) from behavior_logs where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER clubs', count(*) from clubs where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER club_memberships', count(*) from club_memberships where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER score_records', count(*) from score_records where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER teaching_assignments', count(*) from teaching_assignments where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER leave_requests', count(*) from leave_requests where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1'
union all select 'LEFTOVER academic_terms', count(*) from academic_terms where school_id = '11111111-1111-1111-1111-111111111111' and term_name = '2568_1'
union all select 'LEFTOVER schools.current_term', count(*) from schools where id = '11111111-1111-1111-1111-111111111111' and current_term = '2568_1';

-- ═══════════════════════════════════════════════════════════════════
-- ดูผลลัพธ์ 2 ตารางข้างบนแล้วเท่านั้น — ถ้าโอเค ให้รันบรรทัดนี้แยกต่างหาก:
--   commit;
-- ถ้ามีอะไรดูแปลก ๆ ให้รันแยกต่างหาก:
--   rollback;
-- (ห้ามรันสองบรรทัดนี้พร้อมกัน / ห้ามลืมรันอันใดอันหนึ่ง — ถ้าไม่รัน
--  ธุรกรรมจะยังค้างล็อกตารางอยู่)
-- ═══════════════════════════════════════════════════════════════════
