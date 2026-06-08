import { initializeApp } from 'firebase/app'
import { getFirestore, doc, collection } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import { unref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export const firebaseConfig = {
  apiKey: "AIzaSyBgQjPIx0FpoJnVdjhSHs2WitU_lvSdpsE",
  authDomain: "master-teachtable.firebaseapp.com",
  projectId: "master-teachtable",
  databaseURL: "https://master-teachtable-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "master-teachtable.firebasestorage.app",
  messagingSenderId: "580221127553",
  appId: "1:580221127553:web:1c67bf982af7bd03daf680"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'asia-southeast1')
export const storage = getStorage(app)

// --- ส่วนที่แก้ปัญหา Error ให้ท่าน ---

function resolveSchoolId(candidate) {
  const value = unref(candidate)
  if (typeof value === 'string') return value.trim() || ''
  if (value && typeof value === 'object') {
    const nested = unref(value.schoolId) ?? unref(value.school_id)
    if (typeof nested === 'string') return nested.trim() || ''
  }
  return ''
}

export function getSchoolDb(customId = null) {
  const authStore = useAuthStore()
  const schoolId = resolveSchoolId(customId) || resolveSchoolId(authStore?.schoolId)
  // ถ้ายังไม่มี ID ให้ชี้ไปที่ Path หลอกๆ เพื่อไม่ให้ collection() พัง
  if (!schoolId) return doc(db, 'temp', 'loading')
  return doc(db, 'schools', schoolId)
}

// สร้าง Alias ให้ชื่อตรงกับที่ไฟล์เก่าๆ ในโปรเจกต์ท่านเรียกหา
export const masterDb = db
export const masterAuth = auth