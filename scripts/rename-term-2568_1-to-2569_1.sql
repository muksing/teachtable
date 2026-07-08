-- ═══════════════════════════════════════════════════════════════════
-- เปลี่ยนรหัสเทอม "2568_1" เป็น "2569_1" ให้ตรงกับปีการศึกษาจริง
-- ("2568_1" คือเทอมที่ใช้งานอยู่จริงตอนนี้ ไม่ใช่เทอมเก่า — แค่รหัสภายใน
--  เพี้ยนไม่ตรงกับปีที่แสดงผล "ภาคเรียนที่ 1 ปีการศึกษา 2569")
--
-- วิธีรัน: เปิด Supabase Dashboard → SQL Editor → วางทั้งไฟล์นี้ → กด Run
-- ครั้งเดียวจบ ไม่ต้องทำอะไรเพิ่ม (ถ้าพลาดตรงไหน Postgres ยกเลิกทั้งหมด
-- ให้อัตโนมัติ ไม่ทิ้งข้อมูลค้างครึ่ง ๆ กลาง ๆ)
--
-- ควรรันตอนไม่มีคนใช้งานระบบ (เช่นกลางคืน)
-- หลังรันเสร็จ ให้เอาไฟล์ verify-term-rename.sql ไปรันดูผลลัพธ์ต่อ
--
-- สคริปต์นี้แก้เฉพาะโรงเรียน "โรงเรียนเพชรละครวิทยา"
-- (school_id = 11111111-1111-1111-1111-111111111111) เท่านั้น
-- ═══════════════════════════════════════════════════════════════════

begin;

update teachers                  set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update timetable_slots           set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update timetable_slots_published set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update activity_bookings         set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update teach_actuals             set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update behavior_logs             set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update clubs                     set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update club_memberships          set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update score_records             set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update teaching_assignments      set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';
update leave_requests            set term_id = '2569_1' where school_id = '11111111-1111-1111-1111-111111111111' and term_id = '2568_1';

-- ตัวทะเบียนเทอม (คอลัมน์ชื่อไม่เหมือนที่อื่น)
update academic_terms
  set term_name = '2569_1', year = 2569
  where school_id = '11111111-1111-1111-1111-111111111111' and term_name = '2568_1';

-- ตัวชี้เทอมปัจจุบันที่ระบบทั้งหมดอ้างอิงจริง
update schools
  set current_term = '2569_1'
  where id = '11111111-1111-1111-1111-111111111111' and current_term = '2568_1';

commit;
