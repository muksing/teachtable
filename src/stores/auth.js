import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPrimaryRole, normalizeRoleToken, normalizeUserAccessRecord } from '@/utils/userRoles'

const STORAGE_KEY = 'auth_profile'

function loadFromStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

export const useAuthStore = defineStore('auth', () => {
  const profile = ref(loadFromStorage())
  const isLoggedIn = computed(() => !!profile.value?.uid || !!profile.value?.id)

  const roles = computed(() => normalizeUserAccessRecord(profile.value).roles)
  const role = computed(() => getPrimaryRole(profile.value))

  const schoolId = computed(() => profile.value?.schoolId || profile.value?.school_id || null)
  const isAdmin = computed(() => roles.value.some(item => ['school_admin', 'superadmin'].includes(item)))
  const isSuperAdmin = computed(() => roles.value.includes('superadmin'))
  const isScheduler = computed(() => roles.value.some(item => ['school_scheduler', 'superadmin'].includes(item)))
  const isTeacher = computed(() => roles.value.some(item => ['school_teacher', 'superadmin'].includes(item)))
  const isStudent = computed(() => roles.value.includes('school_student'))
  const isSubCoordinator = computed(() => roles.value.includes('sub_coordinator'))
  const isSubjectHead = computed(() => roles.value.includes('subject_head'))
  const isSchoolDirector = computed(() => roles.value.includes('school_director'))
  const canManageSubstitute = computed(() =>
    roles.value.some(r => ['school_admin', 'superadmin', 'sub_coordinator', 'subject_head'].includes(r))
  )

  function hasAnyRole(roleList) {
    return roleList.some(item => {
      const normalizedRole = normalizeRoleToken(item)
      return normalizedRole ? roles.value.includes(normalizedRole) : false
    })
  }

  function setProfile(data) {
    if (!data) {
      profile.value = null
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    profile.value = normalizeUserAccessRecord(data)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.value)) } catch {}
  }

  function setLoggedIn() {
    // isLoggedIn is now computed from profile — kept for backward-compat call signatures
  }

  function clear() {
    profile.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    profile,
    isLoggedIn,
    roles,
    role,
    schoolId,
    isAdmin,
    isSuperAdmin,
    isScheduler,
    isTeacher,
    isStudent,
    isSubCoordinator,
    isSubjectHead,
    isSchoolDirector,
    canManageSubstitute,
    hasAnyRole,
    setProfile,
    setLoggedIn,
    clear,
  }
})
