import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPrimaryRole, normalizeRoleToken, normalizeUserAccessRecord } from '@/utils/userRoles'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref(null)
  const isLoggedIn = ref(false)

  const roles = computed(() => normalizeUserAccessRecord(profile.value).roles)
  const role = computed(() => getPrimaryRole(profile.value))

  const schoolId = computed(() => profile.value?.schoolId || profile.value?.school_id || null)
  const isAdmin = computed(() => roles.value.some(item => ['school_admin', 'superadmin'].includes(item)))
  const isSuperAdmin = computed(() => roles.value.includes('superadmin'))
  const isScheduler = computed(() => roles.value.some(item => ['school_scheduler', 'superadmin'].includes(item)))
  const isTeacher = computed(() => roles.value.some(item => ['school_teacher', 'superadmin'].includes(item)))
  const isStudent = computed(() => roles.value.includes('school_student'))

  function hasAnyRole(roleList) {
    return roleList.some(item => {
      const normalizedRole = normalizeRoleToken(item)
      return normalizedRole ? roles.value.includes(normalizedRole) : false
    })
  }

  function setProfile(data) {
    if (!data) {
      profile.value = null
      return
    }
    profile.value = normalizeUserAccessRecord(data)
  }

  function setLoggedIn(val) {
    isLoggedIn.value = val
  }

  function clear() {
    profile.value = null
    isLoggedIn.value = false
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
    hasAnyRole,
    setProfile,
    setLoggedIn,
    clear,
  }
})
