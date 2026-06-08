/**
 * functions/index.js
 *
 * โปรเจกต์นี้ใช้ Firebase Spark plan เท่านั้น
 * จึงไม่ deploy Cloud Functions
 *
 * Flow ที่ใช้งานจริง:
 * - สมัครโรงเรียน: Vue เขียน school_requests ลง Firestore
 * - แจ้ง SuperAdmin: GAS notifyNewSchoolRequests อ่าน Firestore แล้วเขียน email_queue
 * - อนุมัติ/ปฏิเสธ: SuperAdmin ทำผ่านหน้าเว็บ หรือผ่านลิงก์อีเมลที่เปิดกลับเข้าหน้าเว็บ
 * - ส่งอีเมล: GAS runEmailQueue ส่งจาก email_queue
 */
