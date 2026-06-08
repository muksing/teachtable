// src/firebase/masterSchema.js
// ===== Master-teachtable Firestore Schema =====

/**
 * COLLECTIONS OVERVIEW:
 *
 * /schools/{schoolId} - ข้อมูลโรงเรียนที่อนุมัติแล้ว
 * /school_requests/{requestId} - คำขอสมัครของโรงเรียน (รอการอนุมัติ)
 * /users/{uid} - ผู้ใช้ทั้งหมด (SuperAdmin + School Admins)
 * /school_{schoolId}_teachers/{teacherId} - ครูของแต่ละโรงเรียน
 * /school_{schoolId}_classes/{classId} - ชั้นเรียน
 * /school_{schoolId}_subjects/{subjectId} - วิชา
 * /school_{schoolId}_timetable/{entryId} - ตารางสอน
 * ... (collections อื่นๆ แยกด้วย school_{schoolId}_)
 */

// ===== SCHOOL MANAGEMENT =====

export const SCHOOL_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

export const SCHOOL_REQUEST_SCHEMA = {
  // ข้อมูลโรงเรียน
  schoolName: '', // ชื่อโรงเรียน
  schoolAddress: '', // ที่อยู่
  schoolPhone: '', // เบอร์โทร
  schoolEmail: '', // อีเมล์โรงเรียน

  // ข้อมูลผู้ติดต่อ/ตัวแทน
  contactName: '', // ชื่อผู้ติดต่อ
  contactPhone: '', // เบอร์ผู้ติดต่อ
  contactEmail: '', // อีเมล์ผู้ติดต่อ

  // ข้อมูล admin account
  adminEmail: '', // อีเมล์สำหรับ login
  adminPassword: '', // รหัสผ่านชั่วคราว (จะเปลี่ยนหลังอนุมัติ)

  // สถานะ
  status: SCHOOL_REQUEST_STATUS.PENDING, // pending | approved | rejected
  submittedAt: null, // Timestamp
  reviewedAt: null, // Timestamp
  reviewedBy: null, // UID ของ SuperAdmin ที่อนุมัติ
  rejectionReason: '', // เหตุผลการปฏิเสธ (ถ้ามี)

  // หลังอนุมัติ
  schoolId: null, // รหัสโรงเรียนที่สร้าง (หลังอนุมัติ)
  approvedAt: null, // Timestamp

  // token สำหรับอนุมัติ/ปฏิเสธผ่านลิงก์อีเมล (ถูกลบหลังใช้งาน)
  approvalToken: null, // UUID สร้างตอน submit คำขอ
  tokenCreatedAt: null, // Timestamp
  superAdminNotifiedAt: null // Timestamp
}

export const SCHOOL_SCHEMA = {
  schoolId: '', // รหัสโรงเรียน (unique)
  schoolName: '',
  schoolAddress: '',
  schoolPhone: '',
  schoolEmail: '',

  // ข้อมูล admin
  adminUid: '', // UID ของ school admin
  adminEmail: '',

  // ตั้งค่าเริ่มต้น
  currentTerm: '2568_1',
  createdAt: null,
  updatedAt: null,

  // สถานะ
  isActive: true,
  subscriptionStatus: 'active' // active | suspended | cancelled
}

// ===== USER MANAGEMENT =====

export const USER_ROLES = {
  SUPERADMIN: 'superadmin',
  SCHOOL_ADMIN: 'school_admin',
  SCHOOL_SCHEDULER: 'school_scheduler',
  SCHOOL_TEACHER: 'school_teacher',
  SCHOOL_STUDENT: 'school_student'
}

export const USER_SCHEMA = {
  uid: '', // Firebase Auth UID
  email: '',
  displayName: '',

  // บทบาท
  role: USER_ROLES.SCHOOL_ADMIN, // สำหรับ school users
  globalRole: USER_ROLES.SUPERADMIN, // สำหรับ SuperAdmin

  // สำหรับ school users
  schoolId: '', // รหัสโรงเรียนที่สังกัด
  schoolRole: '', // role ภายในโรงเรียน (admin, scheduler, teacher, student)

  // ข้อมูลส่วนตัว
  firstName: '',
  lastName: '',
  phone: '',

  // สถานะ
  isActive: true,
  createdAt: null,
  lastLoginAt: null,

  // สำหรับ SuperAdmin
  permissions: [] // array ของ permissions เพิ่มเติม
}

// ===== UTILITY FUNCTIONS =====

/**
 * สร้าง collection name สำหรับแต่ละโรงเรียน
 * @param {string} schoolId - รหัสโรงเรียน
 * @param {string} collection - ชื่อ collection พื้นฐาน
 * @returns {string} collection name ที่มี prefix
 */
export function getSchoolCollection(schoolId, collection) {
  return `school_${schoolId}_${collection}`
}

/**
 * สร้าง school ID ที่ unique
 * @param {string} schoolName - ชื่อโรงเรียน
 * @returns {string} school ID
 */
export function generateSchoolId(schoolName) {
  // สร้างจากชื่อโรงเรียน + timestamp
  const cleanName = schoolName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const timestamp = Date.now().toString(36)
  return `${cleanName}_${timestamp}`
}