// src/composables/useMasterAuth.js
import { ref, computed } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { USER_ROLES } from '@/supabase/schema'
import { buildRolePayload, normalizeUserAccessRecord } from '@/utils/userRoles'

let _authReadyResolve = null
let _schoolChannel = null

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
        // ใช้ schools.current_term เท่านั้น — ห้าม fallback เป็นรหัสเทอมที่เขียนตายตัว (hardcoded)
        // เพราะถ้าค่านี้ยังไม่ถูกตั้ง ระบบควรแสดงว่า "ยังไม่มีเทอม" ให้แอดมินไปตั้งค่าจริง
        // ไม่ใช่แอบอ้างเทอมใดเทอมหนึ่งที่อาจไม่มีข้อมูลอยู่เลย (สาเหตุของเหตุการณ์เทอมสลับที่เคยเกิดขึ้น)
        schoolStore.setCurrentTerm(data.current_term || null)
        subscribeSchoolSettings(schoolId)
      }
    } catch {
      // Superadmin may not have a school.
    }
  }

  function subscribeSchoolSettings(schoolId) {
    if (!schoolId) return
    if (_schoolChannel) supabase.removeChannel(_schoolChannel)
    _schoolChannel = supabase
      .channel(`school_settings_${schoolId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'schools',
        filter: `id=eq.${schoolId}`,
      }, (payload) => {
        if (payload.new) {
          schoolStore.setSchool(payload.new)
          schoolStore.setCurrentTerm(payload.new.current_term || null)
        }
      })
      .subscribe()
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

  function friendlyAuthError(msg = '') {
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    if (msg.includes('Email not confirmed')) return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
    if (msg.includes('Too many requests') || msg.includes('over_email_send_rate_limit')) return 'ลองเข้าสู่ระบบมากเกินไป กรุณารอสักครู่'
    if (msg.includes('User not found') || msg.includes('user_not_found')) return 'ไม่พบบัญชีผู้ใช้นี้ในระบบ'
    if (msg.includes('Network') || msg.includes('fetch')) return 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ต'
    return msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
  }

  async function login(email, password) {
    loading.value = true
    error.value = null

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      const uid = authData.user.id
      const normalizedUser = await fetchNormalizedUser(uid)
      const userSchoolId = normalizedUser.schoolId || normalizedUser.school_id
      const isSuperAdmin = normalizedUser.roles.includes(USER_ROLES.SUPERADMIN)

      if (!isSuperAdmin) {
        if (!userSchoolId) throw new Error('ไม่พบโรงเรียนที่สังกัด กรุณาติดต่อผู้ดูแลระบบ')
        const { data: schoolDoc } = await supabase.from('schools').select('*').eq('id', userSchoolId).single()
        if (!schoolDoc || schoolDoc.is_active === false) {
          throw new Error('โรงเรียนนี้ยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
        }
      }

      authStore.setProfile(normalizedUser)
      authStore.setLoggedIn(true)

      if (!isSuperAdmin) {
        await loadSchoolInfo(userSchoolId)
      }

      return { success: true }
    } catch (err) {
      const msg = friendlyAuthError(err.message)
      error.value = msg
      supabase.auth.signOut().catch(() => {})
      return { success: false, error: msg }
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

  // ── Google OAuth ──────────────────────────────────────────────────────
  const googleLoading = ref(false)
  const googleError   = ref(null)

  async function loginWithGoogle() {
    googleLoading.value = true
    googleError.value   = null
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (oauthError) throw oauthError
      // browser จะ redirect ไป Google — ไม่มีค่า return
    } catch (err) {
      googleError.value = err.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
      googleLoading.value = false
    }
  }

  // helper: โหลด profile หลัง session พร้อม (ใช้ร่วมกันระหว่าง INITIAL_SESSION และ SIGNED_IN)
  async function handleSessionReady(user, router) {
    try {
      const normalizedUser = await fetchNormalizedUser(user.id)
      const userSchoolId   = normalizedUser.schoolId || normalizedUser.school_id
      const isSuperAdmin   = normalizedUser.roles.includes(USER_ROLES.SUPERADMIN)

      if (!isSuperAdmin && !userSchoolId) {
        throw new Error('ไม่พบโรงเรียนที่สังกัด กรุณาติดต่อผู้ดูแลระบบ')
      }

      authStore.setProfile(normalizedUser)
      authStore.setLoggedIn(true)

      if (!schoolStore.schoolInfo && !isSuperAdmin) {
        await loadSchoolInfo(userSchoolId)
      }
    } catch (err) {
      // Google OAuth แต่ email ไม่มีใน users table → sign out + แสดง error
      await supabase.auth.signOut()
      authStore.clear()
      schoolStore.clear()
      error.value = err.message.includes('User not found')
        ? 'ไม่พบบัญชีนี้ในระบบ — Gmail ต้องตรงกับอีเมลที่ admin ตั้งค่าไว้'
        : (err.message || 'เกิดข้อผิดพลาด')
      if (router) router.push('/login')
    }
  }

  function initAuthListener(router) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user

      if (user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        if (!authStore.isLoggedIn) {
          await handleSessionReady(user, router)
        } else if (event === 'INITIAL_SESSION') {
          // Profile restored from localStorage — reload school info
          try {
            const profile = authStore.profile
            if (!schoolStore.schoolInfo && profile && !profile.roles?.includes(USER_ROLES.SUPERADMIN)) {
              const schoolId = profile.schoolId || profile.school_id
              if (schoolId) await loadSchoolInfo(schoolId)
            }
          } catch {}
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
    googleLoading,
    googleError,
    login,
    loginWithGoogle,
    superAdminLogin,
    schoolAdminLogin,
    logout,
    initAuthListener,
    initializeSuperAdmin,
  }
}
