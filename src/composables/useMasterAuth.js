// src/composables/useMasterAuth.js
// ===== Master-teachtable Authentication =====
import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { USER_ROLES } from '@/firebase/masterSchema'

// authReady — Promise ที่ resolve เมื่อ Firebase auth state ตรวจสอบครั้งแรกเสร็จ
let _authReadyResolve = null
export const authReady = new Promise(resolve => { _authReadyResolve = resolve })

export function useMasterAuth() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const loading = ref(false)
  const error = ref(null)

  // โหลดข้อมูลโรงเรียนเข้า schoolStore
  async function loadSchoolInfo(schoolId) {
    if (!schoolId) return
    try {
      const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).single()
      if (data) {
        schoolStore.setSchool(data)
        schoolStore.setCurrentTerm(data.current_term || '2568_1')
      }
    } catch { /* ignore — superadmin might not have schoolId */ }
  }

  // ===== Unified Login =====
  async function login(email, password) {
    loading.value = true
    error.value = null

    try {
      // 1. Login Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      const uid = authData.user.id

      // 2. Load user profile from Supabase
      const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', uid).single()
      if (userError || !userData) {
        throw new Error('User not found')
      }

      const userSchoolId = userData.schoolId || userData.school_id
      const roleList = Array.isArray(userData.roles) ? userData.roles : [userData.role, userData.globalRole].filter(Boolean)
      const isSuperAdmin = roleList.includes(USER_ROLES.SUPERADMIN)

      // 3. Validate school user status when not superadmin
      if (!isSuperAdmin) {
        if (!userSchoolId) throw new Error('Not a school user')
        const { data: schoolDoc } = await supabase.from('schools').select('*').eq('id', userSchoolId).single()
        if (!schoolDoc || schoolDoc.is_active === false) {
          throw new Error('School is not active')
        }
      }

      // 4. Set profile
      authStore.setProfile({
        ...userData,
        uid: uid
      })
      authStore.setLoggedIn(true)

      // 5. Load school info for school users
      if (!isSuperAdmin) {
        await loadSchoolInfo(userSchoolId)
      }

      return { success: true }

    } catch (err) {
      error.value = err.message
      await supabase.auth.signOut() // logout if error
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ===== Compatibility wrappers (keep old API) =====
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

  // ===== Logout =====
  async function logout() {
    try {
      await supabase.auth.signOut()
      authStore.clear()
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  // ===== Auth State Listener =====
  function initAuthListener(router) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user
      if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // User is signed in
        try {
          const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', user.id).single()
          if (userData && !userError) {
            authStore.setProfile({
              ...userData,
              uid: user.uid
            })
            authStore.setLoggedIn(true)
            // โหลด schoolStore ถ้ายังไม่มีข้อมูล
            if (!schoolStore.schoolInfo) {
              const userSchoolId = userData.schoolId || userData.school_id
              await loadSchoolInfo(userSchoolId)
            }
          }
        } catch (err) {
          console.error('Error loading user profile:', err)
          authStore.clear()
        }
      } else if (event === 'SIGNED_OUT') {
        // User is signed out
        authStore.clear()
        schoolStore.clear()
      }

      // Resolve authReady promise
      if (_authReadyResolve) {
        _authReadyResolve()
        _authReadyResolve = null
      }

      // Redirect logic
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

  // ===== Initialize SuperAdmin =====
  async function initializeSuperAdmin() {
    try {
      const adminEmail = 'Muksingapp@gmail.com'
      const defaultPassword = 'SuperAdminPassword123!'
      
      // ตรวจสอบว่ามี SuperAdmin ใน Supabase หรือยัง
      const { data: existingAdmin } = await supabase
        .from('users')
        .select('*')
        .eq('globalRole', USER_ROLES.SUPERADMIN)
        .maybeSingle()

      if (!existingAdmin) {
        // 1. สร้างบัญชีผ่าน Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: adminEmail,
          password: defaultPassword,
        })

        if (authError && !authError.message.includes('already registered')) {
          throw authError
        }

        const uid = authData?.user?.id
        if (uid) {
          // 2. Insert ลงตาราง users
          const { error: insertError } = await supabase.from('users').insert([{
            id: uid,
            email: adminEmail,
            "displayName": 'Super Admin',
            "firstName": 'Super',
            "lastName": 'Admin',
            "globalRole": USER_ROLES.SUPERADMIN,
            role: USER_ROLES.SUPERADMIN,
            roles: [USER_ROLES.SUPERADMIN],
            "isActive": true,
            is_active: true,
            permissions: ['all']
          }])
          
          if (insertError) throw insertError
          
          console.log(`✅ สร้าง SuperAdmin สำเร็จ! Email: ${adminEmail} | Password: ${defaultPassword}`)
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
    initializeSuperAdmin
  }
}