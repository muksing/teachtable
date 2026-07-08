-- ═══════════════════════════════════════════════════════════════════
-- ตรวจสอบผลลัพธ์หลังรัน rename-term-2568_1-to-2569_1.sql
-- วางทั้งไฟล์ กด Run — ดูผลลัพธ์ตาราง 2 ก้อนด้านล่าง
-- ═══════════════════════════════════════════════════════════════════

-- ก้อนที่ 1: จำนวนแถวที่อยู่ใน "2569_1" แล้ว (ควรเห็นตัวเลข ไม่ใช่ 0 ในตารางที่มีข้อมูลจริง)
select 'teachers' t, count(*) rows_in_2569_1 from teachers where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2569_1'
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

-- ก้อนที่ 2: จำนวนแถวที่ยังตกค้างเป็น "2568_1" — ต้องเป็น 0 ทุกแถว ถ้าไม่ใช่ 0 แปลว่ารีเนมไม่ครบ
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
