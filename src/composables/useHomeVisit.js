import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function useHomeVisit() {
  const authStore = useAuthStore()
  const schoolId  = () => authStore.schoolId

  // ── Home info ─────────────────────────────────────────
  async function getHomeInfo(studentCode) {
    const { data } = await supabase
      .from('student_home_info').select('*')
      .eq('school_id', schoolId()).eq('student_code', studentCode).maybeSingle()
    return data || null
  }

  async function saveHomeInfo(studentCode, patch) {
    const { error } = await supabase.from('student_home_info')
      .upsert([{ school_id: schoolId(), student_code: studentCode, ...patch,
        updated_at: new Date().toISOString(), updated_by: 'teacher' }],
        { onConflict: 'school_id,student_code' })
    if (error) throw error
  }

  // ── Visits ────────────────────────────────────────────
  async function getVisits(studentCode) {
    const { data } = await supabase.from('home_visits').select('*')
      .eq('school_id', schoolId()).eq('student_code', studentCode)
      .order('visit_date', { ascending: false })
    return data || []
  }

  async function saveVisit({ studentCode, classId, visitDate, visitLat, visitLng,
      homeInfo, familyPresent, notes, photoUrls, roundId }) {
    const distFromHome = (homeInfo?.home_lat && visitLat)
      ? haversineMetres(visitLat, visitLng, homeInfo.home_lat, homeInfo.home_lng) : null
    const profile = authStore.profile || {}
    const teacherName = profile.display_name || profile.name || profile.email || 'ครู'
    const { data, error } = await supabase.from('home_visits')
      .insert([{
        school_id: schoolId(), student_code: studentCode, class_id: classId,
        teacher_id:   profile.teacher_id || profile.uid || null,
        teacher_name: teacherName,
        visit_date:   visitDate, visit_lat: visitLat, visit_lng: visitLng,
        distance_from_home: distFromHome,
        family_present: familyPresent || [], notes: notes || '',
        visit_photo_urls: photoUrls || [],
        round_id:    roundId || null,
        updated_at:  new Date().toISOString(),
      }]).select().single()
    if (error) throw error
    return data
  }

  async function uploadVisitPhoto(file, studentCode) {
    const path = `visit-photos/${schoolId()}/${studentCode}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('student-photos').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('student-photos').getPublicUrl(path)
    return data.publicUrl
  }

  // ── Students with home info summary ──────────────────
  async function getStudentsWithHomeInfo(classId = null) {
    let q = supabase.from('students')
      .select('student_code, prefix, first_name, last_name, class_id')
      .eq('school_id', schoolId())
      .or('student_status.eq.เรียนอยู่,student_status.is.null')
      .order('class_id').order('seat_number')
    if (classId) q = q.eq('class_id', classId)
    const { data: students } = await q

    const [homeRes, visitRes] = await Promise.all([
      supabase.from('student_home_info')
        .select('student_code, home_lat, home_lng, home_address, updated_at')
        .eq('school_id', schoolId()),
      supabase.from('home_visits')
        .select('student_code, visit_date, teacher_name')
        .eq('school_id', schoolId())
        .order('visit_date', { ascending: false }),
    ])
    const homeMap = {}, visitMap = {}
    ;(homeRes.data || []).forEach(h => { homeMap[h.student_code] = h })
    ;(visitRes.data || []).forEach(v => { if (!visitMap[v.student_code]) visitMap[v.student_code] = v })

    return (students || []).map(s => ({
      ...s, homeInfo: homeMap[s.student_code] || null, lastVisit: visitMap[s.student_code] || null,
    }))
  }

  // ── Dashboard stats per class ─────────────────────────
  async function getDashboardStats() {
    const [studentsRes, homeRes, visitRes] = await Promise.all([
      supabase.from('students')
        .select('student_code, class_id')
        .eq('school_id', schoolId())
        .or('student_status.eq.เรียนอยู่,student_status.is.null'),
      supabase.from('student_home_info')
        .select('student_code')
        .eq('school_id', schoolId()),
      supabase.from('home_visits')
        .select('student_code')
        .eq('school_id', schoolId()),
    ])
    const homeSet  = new Set((homeRes.data  || []).map(h => h.student_code))
    const visitSet = new Set((visitRes.data || []).map(v => v.student_code))

    const classMap = {}
    for (const s of (studentsRes.data || [])) {
      if (!classMap[s.class_id]) classMap[s.class_id] = { classId: s.class_id, total: 0, hasHome: 0, visited: 0 }
      classMap[s.class_id].total++
      if (homeSet.has(s.student_code))  classMap[s.class_id].hasHome++
      if (visitSet.has(s.student_code)) classMap[s.class_id].visited++
    }
    return Object.values(classMap).sort((a, b) => a.classId.localeCompare(b.classId, 'th'))
  }

  // ── Rounds ────────────────────────────────────────────
  async function getRounds(classId = null) {
    let q = supabase.from('home_visit_rounds').select('*')
      .eq('school_id', schoolId()).order('created_at', { ascending: false })
    if (classId) q = q.eq('class_id', classId)
    const { data } = await q
    return data || []
  }

  async function createRound({ classId, roundName, dateStart, dateEnd, notes }) {
    const profile = authStore.profile || {}
    const { data, error } = await supabase.from('home_visit_rounds')
      .insert([{
        school_id:    schoolId(), class_id: classId || null,
        teacher_id:   profile.teacher_id || profile.uid || null,
        teacher_name: profile.display_name || profile.name || profile.email || 'ครู',
        round_name:   roundName,
        date_start:   dateStart || null, date_end: dateEnd || null,
        notes:        notes || '',
      }]).select().single()
    if (error) throw error
    return data
  }

  async function deleteRound(id) {
    const { error } = await supabase.from('home_visit_rounds')
      .delete().eq('id', id).eq('school_id', schoolId())
    if (error) throw error
  }

  async function getVisitsByRound(roundId) {
    const { data } = await supabase.from('home_visits').select('*')
      .eq('school_id', schoolId()).eq('round_id', roundId)
      .order('visit_date', { ascending: false })
    return data || []
  }

  async function getActiveRoundsForStudent(classId) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    const { data } = await supabase.from('home_visit_rounds')
      .select('id, round_name, class_id, date_start, date_end, teacher_name, notes')
      .eq('school_id', schoolId())
      .eq('class_id', classId)
      .or(`date_end.is.null,date_end.gte.${today}`)
      .order('created_at', { ascending: false })
    return data || []
  }

  async function getRoundVisitCounts() {
    const { data } = await supabase.from('home_visits')
      .select('round_id, student_code')
      .eq('school_id', schoolId()).not('round_id', 'is', null)
    const counts = {}
    for (const v of (data || [])) {
      if (!counts[v.round_id]) counts[v.round_id] = new Set()
      counts[v.round_id].add(v.student_code)
    }
    return Object.fromEntries(Object.entries(counts).map(([k, s]) => [k, s.size]))
  }

  return {
    getHomeInfo, saveHomeInfo,
    getVisits, saveVisit, uploadVisitPhoto,
    getStudentsWithHomeInfo, getDashboardStats,
    getRounds, createRound, deleteRound,
    getVisitsByRound, getRoundVisitCounts, getActiveRoundsForStudent,
  }
}
