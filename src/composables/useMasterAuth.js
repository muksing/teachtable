// src/composables/useMasterAuth.js
import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { USER_ROLES } from '@/supabase/schema'
import { buildRolePayload, normalizeUserAccessRecord } from '@/utils/userRoles'

let _authReadyResolve = null
export const authReady = new Promise(resolve => {
  _authReadyResolve = resolve
  // Fallback: ถ้า Supabase ไม่ตอบภายใน 8 วินาที ให้ถือว่า auth พร้อมแล้ว (ไม่ login)
  setTimeout(() => {
    if (_authReadyResolve) {
      _authReadyResolve()
      _authReadyResolve = null
    }
  }, 8000)
})

export function useMasterAuth() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const loading = ref(false)
  const error = ref(null)

  async function loadSchoolInfo(schoolId) {
    if (!schoolId) return
    try {
      const { data } = await supabase.from('schools').select('*').eq('id', schoolId).single()
      if (data) {
        schoolStore.setSchool(data)
        schoolStore.setCurrentTerm(
          data.current_term ||
          data.currentTerm ||
          data.settings?.current_term ||
          data.settings?.currentTerm ||
          '2568_1'
        )
      }
    } catch {
      // Superadmin may not have a school.
    }
  }

  async function repairUserRoleShape(userData) {
    if (!userData?.id) return

    const normalized = normalizeUserAccessRecord(userData)
    const rolePayload = buildRolePayload(normalized.roles)
    const updates = {}

    if (userData.role !== normalized.role) updates.role = normalized.role
    if (JSON.stringify(userData.roles || []) !== JSON.stringify(normalized.roles)) updates.roles = normalized.roles
    if ((userData.schoolRole || '') !== (rolePayload.schoolRole || '')) updates.schoolRole = rolePayload.schoolRole || ''
    if ((userData.school_role || '') !== (rolePayload.school_role || '')) updates.school_role = rolePayload.school_role || ''
    if ((userData.schoolId || '') !== normalized.schoolId) updates.schoolId = normalized.schoolId
    if ((userData.school_id || '') !== normalized.school_id) updates.school_id = normalized.school_id
    if ((userData.teacher_id || '') !== normalized.teacher_id) updates.teacher_id = normalized.teacher_id
    if ((userData.teacherId || '') !== normalized.teacherId) updates.teacherId = normalized.teacherId
    if ((userData.is_active ?? true) !== normalized.is_active) updates.is_active = normalized.is_active
    if ((userData.isActive ?? true) !== normalized.isActive) updates.isActive = normalized.isActive

    if (!Object.keys(updates).length) return
    await supabase.from('users').update(updates).eq('id', userData.id)
  }

  async function fetchNormalizedUser(uid) {
    const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', uid).single()
    if (userError || !userData) throw new Error('User not found')
    await repairUserRoleShape({ ...userData, id: uid })
    return normalizeUserAccessRecord({ ...userData, id: uid, uid })
  }

  async function login(email, password) {
    loading.value = true
    error.value = null

    try {
      const authResult = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('การเชื่อมต่อหมดเวลา กรุณาตรวจสอบการตั้งค่า Supabase')), 15000)
        ),
      ])
      const { data: authData, error: authError } = authResult
      if (authError) throw authError

      const uid = authData.user.id
      const normalizedUser = await fetchNormalizedUser(uid)
      const userSchoolId = normalizedUser.schoolId || normalizedUser.school_id
      const isSuperAdmin = normalizedUser.roles.includes(USER_ROLES.SUPERADMIN)

      if (!isSuperAdmin) {
        if (!userSchoolId) throw new Error('Not a school user')
        const { data: schoolDoc } = await supabase.from('schools').select('*').eq('id', userSchoolId).single()
        if (!schoolDoc || schoolDoc.is_active === false) {
          throw new Error('School is not active')
        }
      }

      authStore.setProfile(normalizedUser)
      authStore.setLoggedIn(true)

      if (!isSuperAdmin) {
        await loadSchoolInfo(userSchoolId)
      }

      return { success: true }
    } catch (err) {
      error.value = err.message
      await supabase.auth.signOut()
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function superAdminLogin(email, password) {
    const result = await login(email, password)
    if (!result.success) return result
    if (!authStore.isSuperAdmin) {
      await supabase.auth.signOut()
      authStore.clear()
      schoolStore.clear()
      const msg = 'Access denied: Not a SuperAdmin'
      error.value = msg
      return { success: false, error: msg }
    }
    return result
  }

  async function schoolAdminLogin(email, password) {
    const result = await login(email, password)
    if (!result.success) return result
    if (authStore.isSuperAdmin || !authStore.schoolId) {
      await supabase.auth.signOut()
      authStore.clear()
      schoolStore.clear()
      const msg = 'Not a school user'
      error.value = msg
      return { success: false, error: msg }
    }
    return result
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
      authStore.clear()
      schoolStore.clear()
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  function initAuthListener(router) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user

      if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        try {
          const normalizedUser = await fetchNormalizedUser(user.id)
          authStore.setProfile(normalizedUser)
          authStore.setLoggedIn(true)

          if (!schoolStore.schoolInfo && !normalizedUser.roles.includes(USER_ROLES.SUPERADMIN)) {
            await loadSchoolInfo(normalizedUser.schoolId || normalizedUser.school_id)
          }
        } catch (err) {
          console.error('Error loading user profile:', err)
          authStore.clear()
          schoolStore.clear()
        }
      } else if (event === 'SIGNED_OUT') {
        authStore.clear()
        schoolStore.clear()
      }

      if (_authReadyResolve) {
        _authReadyResolve()
        _authReadyResolve = null
      }

      if (!user && router.currentRoute.value.meta.requireAuth) {
        router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      } else if (user && ['/login', '/'].includes(router.currentRoute.value.path)) {
        const redirectTarget = router.currentRoute.value.query.redirect
        if (redirectTarget && typeof redirectTarget === 'string') {
          router.push(redirectTarget)
        } else if (authStore.isSuperAdmin) {
          router.push('/superadmin/dashboard')
        } else {
          router.push('/dashboard')
        }
      }
    })
  }

  async function initializeSuperAdmin() {
    try {
      const adminEmail = 'Muksingapp@gmail.com'
      const defaultPassword = 'SuperAdminPassword123!'

      const { data: existingAdmin } = await supabase
        .from('users')
        .select('*')
        .eq('globalRole', USER_ROLES.SUPERADMIN)
        .maybeSingle()

      if (!existingAdmin) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: adminEmail,
          password: defaultPassword,
        })

        if (authError && !authError.message.includes('already registered')) {
          throw authError
        }

        const uid = authData?.user?.id
        if (uid) {
          const { error: insertError } = await supabase.from('users').insert([{
            id: uid,
            email: adminEmail,
            displayName: 'Super Admin',
            firstName: 'Super',
            lastName: 'Admin',
            globalRole: USER_ROLES.SUPERADMIN,
            global_role: USER_ROLES.SUPERADMIN,
            role: USER_ROLES.SUPERADMIN,
            roles: [USER_ROLES.SUPERADMIN],
            isActive: true,
            is_active: true,
            permissions: ['all'],
          }])

          if (insertError) throw insertError
          return { success: true, message: 'SuperAdmin created successfully' }
        }
      }

      return { success: true, message: 'SuperAdmin already exists' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  return {
    loading,
    error,
    login,
    superAdminLogin,
    schoolAdminLogin,
    logout,
    initAuthListener,
    initializeSuperAdmin,
  }
}
