import { unref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/supabase/client'
import { db, doc } from '@/supabase/firestoreCompat'
import { getAuth } from '@/supabase/authCompat'
import { getStorage } from '@/supabase/storageCompat'

export const masterDb = db()
export const dbRoot = masterDb
export { dbRoot as db }

export const auth = getAuth()
export const masterAuth = auth
export const functions = {}
export const storage = getStorage()

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
  if (!schoolId) return doc(masterDb, 'temp', 'loading')
  return doc(masterDb, 'schools', schoolId)
}

export { supabase }
