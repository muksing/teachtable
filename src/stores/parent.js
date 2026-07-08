import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/supabase/client'

const KEY = 'pp_session'

export const useParentStore = defineStore('parent', () => {
  const session = ref(JSON.parse(localStorage.getItem(KEY) || 'null'))

  const isLoggedIn     = computed(() => !!session.value?.children?.length)
  const guardianName   = computed(() => session.value?.guardian_name || '')
  const schoolId       = computed(() => session.value?.school_id || '')
  const schoolName     = computed(() => session.value?.school_name || '')
  const schoolLogo     = computed(() => session.value?.school_logo || '')
  const currentTerm    = computed(() => session.value?.current_term || '')
  const children       = computed(() => session.value?.children || [])

  // ปีการศึกษาจากข้อมูลพื้นฐานโรงเรียน (settings.school_info) ไม่ใช่ term_id
  const termYear       = computed(() => session.value?.term_year     || '')
  const termSemester   = computed(() => session.value?.term_semester  || '')
  const termLabel      = computed(() => {
    const y = termYear.value
    const s = termSemester.value
    if (y && s) return `ภาคเรียนที่ ${s} ปีการศึกษา ${y}`
    return ''
  })

  async function login(phone, nationalIdLast6) {
    const { data, error } = await supabase.rpc('authenticate_parent', {
      p_phone:             phone.replace(/[^0-9]/g, ''),
      p_national_id_last6: nationalIdLast6,
    })
    if (error) throw error
    if (!data) throw new Error('ไม่พบข้อมูล — กรุณาตรวจสอบเบอร์โทรและเลขบัตรประชาชน')
    session.value = data
    localStorage.setItem(KEY, JSON.stringify(data))
    return data
  }

  function logout() {
    session.value = null
    localStorage.removeItem(KEY)
  }

  function getChild(studentCode) {
    return children.value.find(c => c.student_code === studentCode) || null
  }

  return { isLoggedIn, guardianName, schoolId, schoolName, schoolLogo, currentTerm, termYear, termSemester, termLabel, children, login, logout, getChild }
})
