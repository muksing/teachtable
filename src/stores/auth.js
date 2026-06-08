import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref(null)
  const isLoggedIn = ref(false)

  // roles — array เสมอ, รองรับ backward compat กับ role (string เดิม)
  const roles = computed(() => {
    const r = profile.value?.roles
    if (Array.isArray(r) && r.length) return r
    const old = profile.value?.role || profile.value?.globalRole || profile.value?.global_role
    return old ? [old] : []
  })

  // role — primary role สำหรับแสดงผล (สิทธิ์สูงสุด)
  const ROLE_PRIORITY = ['superadmin', 'admin', 'scheduler', 'teacher', 'student']
  const role = computed(() => {
    for (const r of ROLE_PRIORITY) {
      if (roles.value.includes(r)) return r
    }
    return roles.value[0] || null
  })

  const schoolId     = computed(() => profile.value?.schoolId || profile.value?.school_id || null)
  const isAdmin      = computed(() => roles.value.some(r => ['school_admin', 'admin', 'superadmin'].includes(r)))
  const isSuperAdmin = computed(() => roles.value.includes('superadmin'))
  const isScheduler  = computed(() => roles.value.some(r => ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'].includes(r)))
  const isTeacher    = computed(() => roles.value.some(r => ['school_teacher', 'teacher', 'school_admin', 'admin', 'superadmin'].includes(r)))
  const isStudent    = computed(() => roles.value.some(r => ['school_student', 'student'].includes(r)))

  // ตรวจว่ามีสิทธิ์อย่างน้อยหนึ่งอย่างจากรายการ
  function hasAnyRole(roleList) {
    return roleList.some(r => roles.value.includes(r))
  }

  function setProfile(data) { profile.value = data }
  function setLoggedIn(val) { isLoggedIn.value = val }
  function clear() { profile.value = null; isLoggedIn.value = false }

  return {
    profile, isLoggedIn,
    roles, role,
    schoolId,
    isAdmin, isSuperAdmin, isScheduler, isTeacher, isStudent,
    hasAnyRole,
    setProfile, setLoggedIn, clear,
  }
})
