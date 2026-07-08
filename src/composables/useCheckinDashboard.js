import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const LATE_HOUR = 8 // 08:xx ถือว่าสาย (เวลาไทย UTC+7)

// เวลาไทย UTC+7 — ป้องกัน timezone bug ก่อน 07:00 น.
function thaiToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}
function thaiHour(ts) {
  return (new Date(ts).getUTCHours() + 7) % 24
}
function toYMD(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export function useCheckinDashboard() {
  const authStore = useAuthStore()
  const schoolId  = () => authStore.schoolId

  // นักเรียนในห้องพร้อมสถานะเช็คอินของวันที่กำหนด
  async function getCheckinStudents(date, classId = null) {
    let studQ = supabase.from('students')
      .select('student_code, prefix, first_name, last_name, class_id, seat_number, photo_url')
      .eq('school_id', schoolId())
      .or('student_status.eq.เรียนอยู่,student_status.is.null')
      .order('class_id').order('seat_number')
    if (classId) studQ = studQ.eq('class_id', classId)

    let ciQ = supabase.from('student_checkins')
      .select('student_code, class_id, checkin_time, lat, lng, distance_m, selfie_url')
      .eq('school_id', schoolId()).eq('date', date)
    if (classId) ciQ = ciQ.eq('class_id', classId)

    const [studRes, ciRes] = await Promise.all([studQ, ciQ])
    const ciMap = {}
    for (const c of (ciRes.data || [])) ciMap[c.student_code] = c

    return (studRes.data || []).map(s => {
      const ci = ciMap[s.student_code] || null
      let status = 'absent'
      if (ci) {
        status = thaiHour(ci.checkin_time) < LATE_HOUR ? 'ontime' : 'late'
      }
      return { ...s, checkin: ci, status }
    })
  }

  // จำนวนเช็คอิน/ไม่เช็คอิน/สาย ต่อวัน ในช่วงวันที่กำหนด
  async function getCheckinByDateRange(startDate, endDate, classId = null) {
    let ciQ = supabase.from('student_checkins')
      .select('student_code, class_id, date, checkin_time')
      .eq('school_id', schoolId())
      .gte('date', startDate).lte('date', endDate)
    if (classId) ciQ = ciQ.eq('class_id', classId)

    let studQ = supabase.from('students')
      .select('student_code, class_id')
      .eq('school_id', schoolId())
      .or('student_status.eq.เรียนอยู่,student_status.is.null')
    if (classId) studQ = studQ.eq('class_id', classId)

    const [ciRes, studRes] = await Promise.all([ciQ, studQ])
    const total = (studRes.data || []).length
    const byDate = {}
    for (const c of (ciRes.data || [])) {
      if (!byDate[c.date]) byDate[c.date] = { checkedIn: 0, late: 0, ontime: 0, total }
      byDate[c.date].checkedIn++
      if (thaiHour(c.checkin_time) < LATE_HOUR) byDate[c.date].ontime++
      else byDate[c.date].late++
    }
    return { byDate, total }
  }

  // สรุปรายสัปดาห์ (จันทร์–ศุกร์) จาก string วันที่
  async function getWeeklyReport(refDate, classId = null) {
    const d   = new Date(refDate + 'T00:00:00+07:00')
    const dow = d.getDay() || 7
    const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
    const startDate = toYMD(mon), endDate = toYMD(fri)
    const { byDate, total } = await getCheckinByDateRange(startDate, endDate, classId)
    const days = []
    for (let i = 0; i < 5; i++) {
      const dd = new Date(mon); dd.setDate(mon.getDate() + i)
      const key = toYMD(dd)
      days.push({ date: key, label: new Date(key + 'T00:00:00+07:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }), ...(byDate[key] || { checkedIn: 0, late: 0, ontime: 0, total }) })
    }
    return { days, startDate, endDate, total }
  }

  // สรุปรายเดือน
  async function getMonthlyReport(year, month, classId = null) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay   = new Date(year, month, 0).getDate()
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    const { byDate, total } = await getCheckinByDateRange(startDate, endDate, classId)
    const days = []
    for (let dd = 1; dd <= lastDay; dd++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
      const dow = new Date(key + 'T00:00:00+07:00').getDay()
      if (dow === 0 || dow === 6) continue
      days.push({ date: key, label: String(dd), ...(byDate[key] || { checkedIn: 0, late: 0, ontime: 0, total }) })
    }
    return { days, startDate, endDate, total }
  }

  // สรุปรายเทอม — จัดกลุ่มเป็นรายสัปดาห์
  async function getTermReport(termStart, termEnd, classId = null) {
    const { byDate, total } = await getCheckinByDateRange(termStart, termEnd, classId)
    const weekMap = {}
    const end = new Date(termEnd + 'T00:00:00+07:00')
    for (let d = new Date(termStart + 'T00:00:00+07:00'); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay()
      if (dow === 0 || dow === 6) continue
      const mon = new Date(d); mon.setDate(d.getDate() - dow + 1)
      const weekKey = toYMD(mon)
      if (!weekMap[weekKey]) weekMap[weekKey] = { weekStart: weekKey, days: 0, checkedIn: 0, late: 0, ontime: 0, total }
      const key = toYMD(d)
      weekMap[weekKey].days++
      if (byDate[key]) {
        weekMap[weekKey].checkedIn += byDate[key].checkedIn
        weekMap[weekKey].late      += byDate[key].late
        weekMap[weekKey].ontime    += byDate[key].ontime
      }
    }
    const weeks = Object.values(weekMap).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    return { weeks, termStart, termEnd, total }
  }

  // สรุปรายห้อง ทั้งโรงเรียน — สำหรับ admin
  async function getCheckinSummaryByClass(date) {
    const [ciRes, studRes] = await Promise.all([
      supabase.from('student_checkins').select('student_code, class_id, checkin_time').eq('school_id', schoolId()).eq('date', date),
      supabase.from('students').select('student_code, class_id').eq('school_id', schoolId()).or('student_status.eq.เรียนอยู่,student_status.is.null'),
    ])
    const classTotal = {}, classChecked = {}, classLate = {}
    for (const s of (studRes.data || [])) classTotal[s.class_id] = (classTotal[s.class_id] || 0) + 1
    for (const c of (ciRes.data || [])) {
      classChecked[c.class_id] = (classChecked[c.class_id] || 0) + 1
      if (thaiHour(c.checkin_time) >= LATE_HOUR) classLate[c.class_id] = (classLate[c.class_id] || 0) + 1
    }
    return Object.keys(classTotal).sort().map(cls => ({
      class_id: cls, total: classTotal[cls] || 0,
      checkedIn: classChecked[cls] || 0, late: classLate[cls] || 0,
      notYet: (classTotal[cls] || 0) - (classChecked[cls] || 0),
      pct: classTotal[cls] ? Math.round((classChecked[cls] || 0) / classTotal[cls] * 100) : 0,
    }))
  }

  return { getCheckinStudents, getCheckinByDateRange, getWeeklyReport, getMonthlyReport, getTermReport, getCheckinSummaryByClass, LATE_HOUR, thaiToday }
}
