// src/composables/useAuth.js
// ===== Single Project Setup — ไม่ต้องใช้ Custom Token =====
import { ref } from 'vue'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, getDocs, setDoc, collection, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/firebase/db'
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
  _schoolInfoUnsub = onSnapshot(doc(db, 'schools', schoolId, 'school_info', 'main'), (snap) => {
    if (snap.exists() && schoolStore.schoolInfo) {
      // อัปเดตเฉพาะ field ที่เปลี่ยน ไม่เขียนทับทั้งหมด
      schoolStore.setSchool({ ...schoolStore.schoolInfo, ...snap.data() })
    }
  })
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
      // 1. Login Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const uid  = cred.user.uid

      // 2. ดึง profile จาก Firestore users/{uid} ก่อน
      const userSnap = await getDoc(doc(db, 'users', uid))

      if (!userSnap.exists()) {
        throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลโรงเรียน')
      }

      const userData = userSnap.data()
      const userProfile = { uid, email: cred.user.email, ...userData }
      
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
        const schoolSnap = await getDoc(doc(db, 'schools', schoolId, 'school_info', 'main'))
        if (schoolSnap.exists()) {
          const schoolData = schoolSnap.data()
          schoolStore.setSchool(schoolData)
          currentTerm = schoolData.current_term || currentTerm
          schoolStore.setCurrentTerm(currentTerm)
        }
      }

      // 4. อัพเดต last_login
      await setDoc(doc(db, 'users', uid), {
        last_login: serverTimestamp()
      }, { merge: true })

      authStore.setLoggedIn(true)
      startSchoolInfoListener(schoolStore, schoolId)   // ← real-time sync school_info
      return { success: true }
    } catch (err) {
      const msg = getFriendlyError(err.code || err.message)
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
      await signOut(auth)
      authStore.clear()
      schoolStore.clear()
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // ===== Auto-restore session =====
  function initAuthListener(router) {
    return onAuthStateChanged(auth, async (user) => {
      if (user && !authStore.isLoggedIn) {
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid))
          
          if (!userSnap.exists()) {
            throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลโรงเรียน')
          }
          
          const userData = userSnap.data()
          const p = { uid: user.uid, email: user.email, ...userData }
          if (!Array.isArray(p.roles)) p.roles = p.role ? [p.role] : ['teacher']
          authStore.setProfile(p)

          const schoolId = p.schoolId || p.school_id
          let currentTerm = '2568_1'
          
          if (schoolId) {
            const schoolSnap = await getDoc(doc(db, 'schools', schoolId, 'school_info', 'main'))
            if (schoolSnap.exists()) {
              const schoolData = schoolSnap.data()
              schoolStore.setSchool(schoolData)
              currentTerm = schoolData.current_term || currentTerm
              schoolStore.setCurrentTerm(currentTerm)
            }
          }

          authStore.setLoggedIn(true)
          startSchoolInfoListener(schoolStore, schoolId)   // ← real-time sync หลัง restore
        } catch (e) { console.error('Auth restore error:', e) }
      } else if (!user) {
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
