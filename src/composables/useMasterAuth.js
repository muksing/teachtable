// src/composables/useMasterAuth.js
// ===== Master-teachtable Authentication =====
import { ref } from 'vue'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/db'
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
      const snap = await getDoc(doc(db, 'schools', schoolId, 'school_info', 'main'))
      if (snap.exists()) {
        const data = snap.data()
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
      // 1. Login Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid

      // 2. Load user profile
      const userDoc = await getDoc(doc(db, 'users', uid))
      if (!userDoc.exists()) {
        throw new Error('User not found')
      }

      const userData = userDoc.data()
      const userSchoolId = userData.schoolId || userData.school_id
      const roleList = Array.isArray(userData.roles) ? userData.roles : [userData.role, userData.globalRole].filter(Boolean)
      const isSuperAdmin = roleList.includes(USER_ROLES.SUPERADMIN)

      // 3. Validate school user status when not superadmin
      if (!isSuperAdmin) {
        if (!userSchoolId) throw new Error('Not a school user')
        const schoolDoc = await getDoc(doc(db, 'schools', userSchoolId))
        if (!schoolDoc.exists() || !schoolDoc.data().isActive) {
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
      await signOut(auth) // logout if error
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
      await signOut(auth)
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
      await signOut(auth)
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
      await signOut(auth)
      authStore.clear()
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  // ===== Auth State Listener =====
  function initAuthListener(router) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
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
      } else {
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
      // ตรวจสอบว่ามี SuperAdmin แล้วหรือไม่
      const q = query(
        collection(db, 'users'),
        where('globalRole', '==', USER_ROLES.SUPERADMIN)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        // สร้าง SuperAdmin account
        const superAdminData = {
          email: 'muksingapp@gmail.com',
          displayName: 'Super Admin',
          firstName: 'Super',
          lastName: 'Admin',
          globalRole: USER_ROLES.SUPERADMIN,
          isActive: true,
          createdAt: serverTimestamp(),
          permissions: ['all']
        }

        // จะต้องสร้าง Auth account แยกต่างหาก
        console.log('SuperAdmin account needs to be created manually in Firebase Auth')
        console.log('Data:', superAdminData)

        return { success: true, message: 'SuperAdmin data prepared' }
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