const ROLE_ALIASES = {
  superadmin: 'superadmin',
  admin: 'school_admin',
  school_admin: 'school_admin',
  scheduler: 'school_scheduler',
  school_scheduler: 'school_scheduler',
  teacher: 'school_teacher',
  school_teacher: 'school_teacher',
  student: 'school_student',
  school_student: 'school_student',
}

const BASE_ROLE_PRIORITY = [
  'superadmin',
  'school_admin',
  'school_scheduler',
  'school_teacher',
  'school_student',
]

const BASE_ROLE_SET = new Set(BASE_ROLE_PRIORITY)

export function normalizeRoleToken(role) {
  if (typeof role !== 'string') return null
  const normalized = role.trim().toLowerCase()
  if (!normalized) return null
  return ROLE_ALIASES[normalized] || normalized
}

export function toLegacySchoolRole(role) {
  return {
    school_admin: 'admin',
    school_scheduler: 'scheduler',
    school_teacher: 'teacher',
    school_student: 'student',
  }[normalizeRoleToken(role)] || ''
}

export function toDisplayRole(role) {
  return {
    superadmin: 'superadmin',
    school_admin: 'admin',
    school_scheduler: 'scheduler',
    school_teacher: 'teacher',
    school_student: 'student',
  }[normalizeRoleToken(role)] || normalizeRoleToken(role) || ''
}

export function extractRolesFromUser(data) {
  if (!data) return []

  return [
    ...(Array.isArray(data.roles) ? data.roles : []),
    data.role,
    data.schoolRole,
    data.school_role,
    data.globalRole,
    data.global_role,
  ]
    .map(normalizeRoleToken)
    .filter(Boolean)
}

export function canonicalizeRoles(inputRoles = []) {
  const normalized = [...new Set(inputRoles.map(normalizeRoleToken).filter(Boolean))]
  const primaryBaseRole = BASE_ROLE_PRIORITY.find(role => normalized.includes(role)) || null
  const extraRoles = normalized.filter(role => !BASE_ROLE_SET.has(role))
  return primaryBaseRole ? [primaryBaseRole, ...extraRoles] : extraRoles
}

export function getPrimaryRole(dataOrRoles) {
  const roles = Array.isArray(dataOrRoles)
    ? canonicalizeRoles(dataOrRoles)
    : canonicalizeRoles(extractRolesFromUser(dataOrRoles))
  return roles[0] || null
}

export function normalizeUserAccessRecord(data = {}) {
  if (!data) data = {}  // default {} ไม่ครอบ null — ต้องจัดการแยก
  const roles = canonicalizeRoles(extractRolesFromUser(data))
  const primaryRole = roles[0] || null
  const schoolRole = toLegacySchoolRole(primaryRole)
  const normalizedSchoolId = data.schoolId || data.school_id || ''
  const normalizedTeacherId = data.teacher_id || data.teacherId || ''
  const isActive =
    typeof data.is_active === 'boolean'
      ? data.is_active
      : typeof data.isActive === 'boolean'
        ? data.isActive
        : true

  return {
    ...data,
    uid: data.uid || data.id || '',
    schoolId: normalizedSchoolId,
    school_id: normalizedSchoolId,
    teacher_id: normalizedTeacherId,
    teacherId: normalizedTeacherId,
    role: primaryRole,
    roles,
    schoolRole: schoolRole || data.schoolRole || data.school_role || '',
    school_role: schoolRole || data.school_role || data.schoolRole || '',
    globalRole: primaryRole === 'superadmin' ? 'superadmin' : (data.globalRole || data.global_role || ''),
    global_role: primaryRole === 'superadmin' ? 'superadmin' : (data.global_role || data.globalRole || ''),
    is_active: isActive,
    isActive: isActive,
    displayRole: toDisplayRole(primaryRole),
  }
}

export function buildRolePayload(inputRoles) {
  const roles = canonicalizeRoles(Array.isArray(inputRoles) ? inputRoles : [inputRoles])
  const primaryRole = roles[0] || null
  const schoolRole = toLegacySchoolRole(primaryRole)

  return {
    role: primaryRole,
    roles,
    schoolRole,
    school_role: schoolRole,
    globalRole: primaryRole === 'superadmin' ? 'superadmin' : null,
    global_role: primaryRole === 'superadmin' ? 'superadmin' : null,
  }
}
