// src/composables/useAuth.js
// ===== Single Project Setup — ไม่ต้องใช้ Custom Token =====
import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

// authReady — Promise ที่ resolve เมื่อ Firebase auth state ตรวจสอบครั้งแรกเสร็จ
let _authReadyResolve = null
export const authReady = new Promise(resolve => { _authReadyResolve = resolve })

// Real-time listener สำหรับ school_info/main (ใช้ร่วมกันทุก instance)
let _schoolInfoUnsub = null

function startSchoolInfoListener(schoolStore, schoolId) {
  if (_schoolInfoUnsub) return  // มี listener แล้ว ไม่ต้องซ้ำ
  if (!schoolId) return // ถ้าไม่มี schoolId ไม่ต้อง listen
  
  const channel = supabase.channel('schema-db-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'schools', filter: `id=eq.${schoolId}` },
      (payload) => {
        if (schoolStore.schoolInfo) {
          schoolStore.setSchool({ ...schoolStore.schoolInfo, ...payload.new })
        }
      }
    )
    .subscribe()
    
  _schoolInfoUnsub = () => {
    supabase.removeChannel(channel)
  }
}

function stopSchoolInfoListener() {
  _schoolInfoUnsub?.()
  _schoolInfoUnsub = null
}

export function useAuth() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const loading = ref(false)
  const error   = ref(null)

  // ===== Login =====
  async function login(email, password) {
    loading.value = true
    error.value   = null
    try {
      // 1. Login Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      const uid = authData.user.id

      // 2. ดึง profile จาก users
      const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', uid).single()
      
      if (userError || !userData) {
        throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลโรงเรียน')
      }

      const userProfile = { uid, email: authData.user.email, ...userData }
      
      if (userProfile.is_active === false) throw new Error('บัญชีถูกระงับการใช้งาน')
      
      // normalize: role (string เดิม) → roles (array)
      if (!Array.isArray(userProfile.roles)) {
        userProfile.roles = userProfile.role ? [userProfile.role] : ['teacher']
      }

      authStore.setProfile(userProfile)

      // 3. ดึง school info โดยใช้ schoolId จาก userProfile
      const schoolId = userProfile.schoolId || userProfile.school_id
      let currentTerm = '2568_1' // default

      if (schoolId) {
        const { data: schoolData, error: schoolError } = await supabase.from('schools').select('*').eq('id', schoolId).single()
        if (schoolData && !schoolError) {
          schoolStore.setSchool(schoolData)
          currentTerm = schoolData.current_term || currentTerm
          schoolStore.setCurrentTerm(currentTerm)
        }
      }

      // 4. อัพเดต last_login
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', uid)

      authStore.setLoggedIn(true)
      startSchoolInfoListener(schoolStore, schoolId)   // ← real-time sync school_info
      return { success: true }
    } catch (err) {
      const msg = getFriendlyError(err.message)
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  // ===== Logout =====
  async function logout() {
    try {
      stopSchoolInfoListener()               // ← หยุด listener ก่อน logout
      await supabase.auth.signOut()
      authStore.clear()
      schoolStore.clear()
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // ===== Auto-restore session =====
  function initAuthListener(router) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user
      if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !authStore.isLoggedIn) {
        try {
          const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', user.id).single()
          if (userError || !userData) {
            throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลโรงเรียน')
          }
          
          const p = { uid: user.id, email: user.email, ...userData }
          if (!Array.isArray(p.roles)) p.roles = p.role ? [p.role] : ['teacher']
          authStore.setProfile(p)

          const schoolId = p.schoolId || p.school_id
          let currentTerm = '2568_1'
          
          if (schoolId) {
            const { data: schoolData } = await supabase.from('schools').select('*').eq('id', schoolId).single()
            if (schoolData) {
              schoolStore.setSchool(schoolData)
              currentTerm = schoolData.current_term || currentTerm
              schoolStore.setCurrentTerm(currentTerm)
            }
          }

          authStore.setLoggedIn(true)
          startSchoolInfoListener(schoolStore, schoolId)   // ← real-time sync หลัง restore
        } catch (e) { console.error('Auth restore error:', e) }
      } else if (event === 'SIGNED_OUT' || !user) {
        stopSchoolInfoListener()                   // ← หยุด listener เมื่อ logout
        authStore.clear()
        schoolStore.clear()
        router?.push('/login')
      }
      // บอกให้ router guard รู้ว่า auth พร้อมแล้ว
      _authReadyResolve?.()
      _authReadyResolve = null
    })
  }

  // ===== Error messages ภาษาไทย =====
  function getFriendlyError(code) {
    const map = {
      'Invalid login credentials':     'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/invalid-credential':       'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'auth/user-not-found':           'ไม่พบบัญชีผู้ใช้นี้',
      'auth/wrong-password':           'รหัสผ่านไม่ถูกต้อง',
      'auth/invalid-email':            'รูปแบบอีเมลไม่ถูกต้อง',
      'auth/too-many-requests':        'ลองใหม่อีกครั้งในภายหลัง (พยายามมากเกินไป)',
      'auth/network-request-failed':   'ไม่สามารถเชื่อมต่อเครือข่ายได้',
      'auth/user-disabled':            'บัญชีถูกปิดการใช้งาน',
    }
    return map[code] || code || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
  }

  return { login, logout, initAuthListener, loading, error }
}
