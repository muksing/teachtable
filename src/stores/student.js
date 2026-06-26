import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/supabase/client'

const STORAGE_KEY = 'student_session'

export const useStudentStore = defineStore('student', () => {
  const session = ref(
    (() => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') }
      catch { return null }
    })()
  )

  const isLoggedIn = computed(() => !!session.value?.student_code)

  async function login(schoolId, studentCode, credential) {
    const { data, error } = await supabase.rpc('authenticate_student', {
      p_school_id: schoolId,
      p_student_code: studentCode,
      p_credential: credential,
    })
    if (error) throw error
    if (!data) return false

    // โหลด current_term + clubs จาก schools table
    const { data: schoolData } = await supabase
      .from('schools')
      .select('current_term, settings')
      .eq('id', schoolId)
      .single()

    session.value = {
      ...data,
      school_id: schoolId,
      current_term: schoolData?.current_term || null,
      clubs: schoolData?.settings?.clubs || {},
      has_set_pin: data.has_set_pin,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session.value))
    return true
  }

  function logout() {
    session.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function refreshScores(scores) {
    if (!session.value) return
    session.value = { ...session.value, ...scores }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session.value))
  }

  function updatePhotoUrl(url) {
    if (!session.value || !url) return
    session.value = { ...session.value, photo_url: url }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session.value))
  }

  return { session, isLoggedIn, login, logout, refreshScores, updatePhotoUrl }
})
