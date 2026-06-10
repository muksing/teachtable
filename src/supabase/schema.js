export const USER_ROLES = {
  SUPERADMIN: 'superadmin',
  SCHOOL_ADMIN: 'school_admin',
  SCHOOL_SCHEDULER: 'school_scheduler',
  SCHOOL_TEACHER: 'school_teacher',
  SCHOOL_STUDENT: 'school_student'
}

export const SCHOOL_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

export const SCHOOL_SCHEMA = {
  schoolId: '',
  schoolName: '',
  schoolAddress: '',
  schoolPhone: '',
  schoolEmail: '',
  adminUid: '',
  adminEmail: '',
  currentTerm: '2568_1',
  createdAt: null,
  updatedAt: null,
  isActive: true,
  subscriptionStatus: 'active'
}

export function generateSchoolId(schoolName) {
  const cleanName = schoolName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const timestamp = Date.now().toString(36)
  return `${cleanName}_${timestamp}`
}
