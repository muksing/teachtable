// src/composables/useSchoolDb.js
// Fully migrated to native Supabase — no Firestore compat imports
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

// คืนชื่อตารางที่ถูก Publish แล้ว ถ้ายังไม่เคย Publish → fallback timetable_slots
function getSlotTable(schoolStore) {
  return schoolStore.settingsObj?.timetable_published_at
    ? 'timetable_slots_published'
    : 'timetable_slots'
}

// ─── Day mapping ────────────────────────────────────────────────────────────
const THAI_DAY_TO_NUMBER = {
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 7,
}
const THAI_DAYS_ARR = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeDateKey(input) {
  if (typeof input === 'string') return input
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return localDateStr(input)
  }
  if (input && typeof input.format === 'function') {
    return input.format('YYYY-MM-DD')
  }
  return `${input || ''}`
}

function normalizeDayNumber(dayValue) {
  const n = Number(dayValue)
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null
}

function asText(value) {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

function getThaiDayFromDate(dateStr) {
  return THAI_DAYS_ARR[new Date(dateStr + 'T00:00:00').getDay()]
}

// ใช้ local date (ไม่ใช่ UTC) เพื่อป้องกัน off-by-one เมื่อ timezone = UTC+7
function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── teach_actual mapper: DB row → legacy field names used by views ──────────
function mapTeachActual(row) {
  if (!row) return null
  return {
    ...row,
    // legacy aliases expected by views
    teach_actual_id: row.id,
    period: row.period_number ?? row.period,
    teacher_plan_id: row.planned_teacher_id ?? row.teacher_plan_id,
    teacher_plan_name: row.teacher_plan_name ?? '',
    subject_plan_id: row.subject_id ?? row.subject_plan_id,
    subject_actual_teacher_id: row.actual_teacher_id ?? row.subject_actual_teacher_id ?? null,
    is_substitute_mandatory: row.is_substitute_mandatory ?? false,
    is_filled: row.is_filled ?? false,
    activity_type: row.activity_type ?? 'บรรยาย',
    topic: row.topic ?? '',
    timestamp: row.updated_at || null,
  }
}

// ─── timetable_slots mapper: DB row → legacy field names ─────────────────────
function mapTimetableSlot(row) {
  if (!row) return null
  return {
    ...row,
    // legacy aliases
    day: row.day_of_week ?? row.day,
    period: row.period_number ?? row.period,
    teacher_id: row.teacher_id,
    subject_code: row.subject_id ?? row.subject_code,
    class_id: row.class_id,
    room_id: row.room_id,
    type: row.slot_type ?? row.type ?? 'normal',
  }
}

export function useSchoolDb() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()

  const term = () => schoolStore.displayTerm || schoolStore.currentTerm || '2568_1'

  function getAuditFields() {
    return {
      updated_by: authStore.profile?.uid || 'system',
      updated_by_name: authStore.profile?.displayName || 'ระบบ',
      updated_at: new Date().toISOString(),
    }
  }

  // ─── Helper: get term_id (UUID or TEXT) for timetable_slots ───────────────
  // The column is TEXT in our schema so we use the string directly.
  // This helper is kept for safety — if an academic_terms table exists it looks
  // up the UUID, otherwise falls back to the plain string.
  async function getTermId() {
    const t = term()
    const schoolId = authStore.schoolId
    if (!schoolId) return t
    try {
      const { data } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('school_id', schoolId)
        .eq('term_name', t)
        .maybeSingle()
      return data?.id || t
    } catch {
      return t
    }
  }

  // ─── Helper: get/update schools.settings JSONB ───────────────────────────
  async function getSchoolSettings() {
    const schoolId = authStore.schoolId
    if (!schoolId) return {}
    const { data, error } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .maybeSingle()
    if (error) throw error
    return data?.settings || {}
  }

  async function updateSchoolSettings(partialSettings) {
    const schoolId = authStore.schoolId
    if (!schoolId) throw new Error('ไม่พบ schoolId')
    const current = await getSchoolSettings()
    const merged = { ...current, ...partialSettings }
    const { error } = await supabase
      .from('schools')
      .update({ settings: merged })
      .eq('id', schoolId)
    if (error) throw error
    return merged
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEACHERS
  // ═════════════════════════════════════════════════════════════════════════
  async function getTeachers() {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', term())
      .order('first_name', { ascending: true })
    if (error) throw error
    return data.map(d => ({
      ...d,
      teacher_id: d.teacher_code,
      name: d.first_name,
      surname: d.last_name,
      dept: d.department || '',
      academic_rank: d.academic_rank || '',
      position: d.position || '',
      email: d.email || '',
      phone: d.phone || '',
      is_dept_head: d.is_dept_head === true,
      is_active: d.is_active !== false,
    }))
  }

  async function saveTeacher(teacher) {
    const payload = {
      school_id: authStore.schoolId,
      term_id: term(),
      teacher_code: teacher.teacher_id,
      prefix: teacher.prefix,
      first_name: teacher.name,
      last_name: teacher.surname,
      academic_rank: teacher.academic_rank || null,
      department: teacher.dept || teacher.department || null,
      position: teacher.position || null,
      email: teacher.email || null,
      phone: teacher.phone || null,
      is_dept_head: teacher.is_dept_head === true,
      is_active: teacher.is_active !== false,
    }

    let savedId = teacher.id
    if (teacher.id && teacher.id.includes('-')) {
      const { error } = await supabase.from('teachers').update(payload).eq('id', teacher.id)
      if (error) throw error
      savedId = teacher.id
    } else {
      const { data, error } = await supabase
        .from('teachers')
        .upsert([payload], { onConflict: 'school_id,term_id,teacher_code' })
        .select()
        .single()
      if (error) throw error
      savedId = data.id
    }
    return savedId
  }

  async function deleteTeacher(id) {
    if (!id) return
    let targetId = id
    if (!id.includes('-')) {
      // received teacher_code, look up UUID
      const { data } = await supabase
        .from('teachers')
        .select('id')
        .eq('school_id', authStore.schoolId)
        .eq('term_id', term())
        .eq('teacher_code', id)
        .maybeSingle()
      if (!data?.id) return
      targetId = data.id
    }
    const { error } = await supabase.from('teachers').delete().eq('id', targetId)
    if (error) throw error
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SUBJECTS
  // ═════════════════════════════════════════════════════════════════════════
  async function getSubjects() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('subject_code')
    if (error) throw error
    return data.map(d => ({ ...d }))
  }

  async function saveSubject(subject) {
    const payload = {
      school_id: authStore.schoolId,
      subject_code: subject.subject_code,
      name: subject.name || '',
      name_en: subject.name_en || '',
      dept: subject.dept || '',
      levels: Array.isArray(subject.levels) ? subject.levels : [],
      subject_type: subject.subject_type || '',
      credits: subject.credits != null ? Number(subject.credits) : 0,
      periods_per_week: subject.periods_per_week != null ? Number(subject.periods_per_week) : 2,
      consecutive_periods: subject.consecutive_periods != null ? Number(subject.consecutive_periods) : 1,
      note: subject.note || '',
      is_active: subject.is_active !== false,
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject.id || '')
    if (isUuid) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', subject.id)
      if (error) throw error
      return subject.id
    } else {
      const { data: existing } = await supabase.from('subjects').select('id')
        .eq('school_id', authStore.schoolId).eq('subject_code', subject.subject_code).maybeSingle()
      if (existing?.id) {
        const { error } = await supabase.from('subjects').update(payload).eq('id', existing.id)
        if (error) throw error
        return existing.id
      } else {
        const { data, error } = await supabase.from('subjects').insert([payload]).select().single()
        if (error) throw error
        return data.id
      }
    }
  }

  async function deleteSubject(subjectCode) {
    if (!subjectCode) return
    const schoolId = authStore.schoolId

    // ลบ timetable_slots ที่ผูกวิชานี้ (ไม่งั้นครูยังเห็นรายการค้างบันทึก)
    await supabase.from('timetable_slots')
      .delete()
      .eq('school_id', schoolId)
      .eq('subject_id', subjectCode)

    // ลบ teach_actuals ที่ยังไม่ได้บันทึก (is_filled=false) สำหรับวิชานี้
    await supabase.from('teach_actuals')
      .delete()
      .eq('school_id', schoolId)
      .eq('subject_id', subjectCode)
      .eq('is_filled', false)

    const { error } = await supabase.from('subjects')
      .delete()
      .eq('school_id', schoolId)
      .eq('subject_code', subjectCode)
    if (error) throw error
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CLASSES
  // ═════════════════════════════════════════════════════════════════════════
  async function getClasses() {
    if (!authStore.schoolId || authStore.schoolId === 'undefined') return []
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('class_name')
    if (error) throw error
    return data.map(d => {
      // Derive level/room from class_name when DB columns are empty (e.g. "ม.1/2" → level "ม.1", room 2)
      let level = d.level || ''
      let room = d.room || null
      if ((!level || !room) && d.class_name && d.class_name.includes('/')) {
        const parts = d.class_name.split('/')
        if (!level) level = parts[0]
        if (!room) room = parseInt(parts[1]) || null
      }
      return { ...d, class_id: d.class_name, level, room }
    })
  }

  async function saveClass(cls) {
    const className = cls.class_id || cls.class_name
    const payload = {
      school_id: authStore.schoolId,
      class_name: className,
      level: cls.level || null,
      room: cls.room ? Number(cls.room) : null,
      room_number: cls.room_number || null,
      max_students: cls.max_students ? Number(cls.max_students) : 40,
    }
    // Only set homeroom fields when explicitly provided (avoid overwriting with empty on import)
    if (cls.homeroom_teacher_id !== undefined || cls.homeroom_teacher_ids !== undefined) {
      // Normalize array — always derive from whichever source has data
      const ids = Array.isArray(cls.homeroom_teacher_ids) && cls.homeroom_teacher_ids.length
        ? cls.homeroom_teacher_ids
        : (cls.homeroom_teacher_id ? [cls.homeroom_teacher_id] : [])
      payload.homeroom_teacher_ids = ids
      // homeroom_teacher_id คือครูคนแรกเสมอ
      payload.homeroom_teacher_id = ids[0] || null
      payload.homeroom_teacher_names_snapshot = Array.isArray(cls.homeroom_teacher_names_snapshot)
        ? cls.homeroom_teacher_names_snapshot
        : (cls.homeroom_teacher_name_snapshot ? [cls.homeroom_teacher_name_snapshot] : [])
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cls.id || '')
    if (isUuid) {
      const { error } = await supabase.from('classes').update(payload).eq('id', cls.id)
      if (error) throw error
      return cls.id
    } else {
      // Check if already exists to decide insert vs update
      const { data: existing } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', authStore.schoolId)
        .eq('class_name', payload.class_name)
        .maybeSingle()
      if (existing?.id) {
        const { error } = await supabase.from('classes').update(payload).eq('id', existing.id)
        if (error) throw error
        return existing.id
      } else {
        const { data, error } = await supabase.from('classes').insert([payload]).select().single()
        if (error) throw error
        return data.id
      }
    }
  }

  async function deleteClass(classId) {
    const { data } = await supabase
      .from('classes')
      .select('id')
      .eq('school_id', authStore.schoolId)
      .eq('class_name', classId)
      .maybeSingle()
    if (data?.id) {
      await supabase.from('classes').delete().eq('id', data.id)
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STUDENTS
  // ═════════════════════════════════════════════════════════════════════════
  async function getStudents(classId = null, { activeOnly = false } = {}) {
    let q = supabase
      .from('students')
      .select('*')
      .eq('school_id', authStore.schoolId)
    if (classId) {
      q = q.eq('class_id', classId)
    } else {
      q = q.order('class_id')
    }
    if (activeOnly) {
      q = q.or('status.is.null,status.eq.เรียนอยู่')
    }
    const { data, error } = await q
    if (error) throw error
    let results = data.map(d => ({
      ...d,
      student_id: d.student_code,
      name: d.first_name,
      surname: d.last_name,
      student_status: d.status,
    }))
    if (classId) {
      results.sort((a, b) => {
        const numA = parseInt(a.seat_number, 10)
        const numB = parseInt(b.seat_number, 10)
        return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB)
      })
    }
    return results
  }

  async function saveStudent(student) {
    const payload = {
      school_id: authStore.schoolId,
      class_id: student.class_id || null,
      student_code: student.student_id,
      seat_number: student.seat_number,
      prefix: student.prefix,
      first_name: student.name,
      last_name: student.surname,
      gender: student.gender,
      status: student.student_status || 'เรียนอยู่',
      student_status: student.student_status || 'เรียนอยู่',
      is_active: student.is_active !== false,
      behavior_carry_over: student.behavior_carry_over ?? 0,
      total_behavior_score: student.total_behavior_score ?? 0,
      general_behavior_score: student.general_behavior_score ?? 0,
      attendance_behavior_score: student.attendance_behavior_score ?? 0,
      learning_behavior_score: student.learning_behavior_score ?? 0,
      photo_url: student.photo_url || null,
      birth_date: student.birth_date || null,
      gov_id: student.national_id || student.gov_id || null,
      note: student.note || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      contact: student.contact || null,
      guardian_primary: student.guardian_primary || null,
      guardian_secondary: student.guardian_secondary || null,
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student.id || '')
    if (isUuid) {
      // มี id ตรงๆ (จาก import ที่ match แล้ว หรือจาก edit form)
      const { error } = await supabase.from('students').update(payload).eq('id', student.id)
      if (error) throw error
      return student.id
    }
    // ไม่มี id → ค้นหาด้วย student_code ก่อน แล้วค้นด้วย gov_id เป็น fallback
    let existingId = null
    if (student.student_id) {
      const { data } = await supabase.from('students').select('id')
        .eq('school_id', authStore.schoolId).eq('student_code', student.student_id).maybeSingle()
      existingId = data?.id || null
    }
    if (!existingId && payload.gov_id) {
      const { data } = await supabase.from('students').select('id')
        .eq('school_id', authStore.schoolId).eq('gov_id', payload.gov_id).maybeSingle()
      existingId = data?.id || null
    }
    if (existingId) {
      const { error } = await supabase.from('students').update(payload).eq('id', existingId)
      if (error) throw error
      return existingId
    }
    const { data, error } = await supabase.from('students').insert([payload]).select().single()
    if (error) throw error
    return data.id
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ATTENDANCE STATUS SETTINGS (stored in schools.settings.attendance_statuses)
  // ═════════════════════════════════════════════════════════════════════════
  async function getAttendanceStatuses() {
    const settings = await getSchoolSettings()
    const statuses = settings.attendance_statuses || []
    return statuses
      .filter(s => s.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  async function saveAttendanceStatus(status) {
    const settings = await getSchoolSettings()
    const list = Array.isArray(settings.attendance_statuses) ? [...settings.attendance_statuses] : []
    const idx = list.findIndex(s => s.status_code === status.status_code)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...status }
    } else {
      list.push(status)
    }
    await updateSchoolSettings({ attendance_statuses: list })
  }

  // ═════════════════════════════════════════════════════════════════════════
  // BEHAVIOR SETTINGS (stored in schools.settings.behavior_settings)
  // ═════════════════════════════════════════════════════════════════════════
  async function getBehaviorSettings(type = null) {
    const settings = await getSchoolSettings()
    let items = Array.isArray(settings.behavior_settings) ? settings.behavior_settings : []
    if (type) {
      items = items.filter(s => s.behavior_type === type && s.is_active !== false)
    }
    return items.sort((a, b) => (a.behavior_type || '').localeCompare(b.behavior_type || ''))
  }

  async function saveBehaviorSetting(setting) {
    const settings = await getSchoolSettings()
    const list = Array.isArray(settings.behavior_settings) ? [...settings.behavior_settings] : []
    const idx = list.findIndex(s => s.setting_id === setting.setting_id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...setting }
    } else {
      list.push(setting)
    }
    await updateSchoolSettings({ behavior_settings: list })
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEACHING ASSIGNMENTS (timetable_slots acts as the assignments source)
  // Returns flattened rows compatible with what AssignmentsView / AttendanceReportView expect
  // ═════════════════════════════════════════════════════════════════════════
  async function getTeachingAssignments() {
    const termId = term()
    const { data, error } = await supabase
      .from(getSlotTable(schoolStore))
      .select('class_id, subject_id, subject_name, teacher_id, teacher_name')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)
      .not('slot_type', 'in', '("activity","manual_lock")')
    if (error) throw error
    // deduplicate: one row per class+subject+teacher combination
    const seen = new Set()
    const rows = []
    for (const row of (data || [])) {
      const key = `${row.class_id}_${row.subject_id}_${row.teacher_id}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        id: key,
        assign_id: key,
        class_id: row.class_id,
        subject_code: row.subject_id,
        subject_id: row.subject_id,
        subject_name: row.subject_name || row.subject_id || '',
        teacher_id: row.teacher_id,
        teacher_id_snapshot: row.teacher_id,
        teacher_name: row.teacher_name || row.teacher_id || '',
        preferred_room: '',
        periods_per_week: 1,
        consecutive_periods: 1,
        placed: 0,
        remaining: 1,
        done: false,
      })
    }
    return rows
  }

  async function saveTeachingAssignment(assignment) {
    // Use term() directly (not getTermId()) — getTermId() may return a UUID from academic_terms,
    // but teaching_assignments.term_id and reload() both use the plain string e.g. '2568_1'
    const termId = term()
    const payload = {
      school_id: authStore.schoolId,
      term_id: termId,
      class_id: assignment.class_id,
      subject_id: assignment.subject_code || assignment.subject_id || '',
      subject_name: assignment.subject_name || '',
      teacher_id: assignment.teacher_id || '',
      teacher_name: assignment.teacher_name || '',
      preferred_room: assignment.preferred_room || '',
      periods_per_week: Number(assignment.periods_per_week) || 1,
      consecutive_periods: Number(assignment.consecutive_periods) || 1,
      updated_at: new Date().toISOString(),
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignment.id || '')
    if (isUuid) {
      const { error } = await supabase.from('teaching_assignments').update(payload).eq('id', assignment.id)
      if (error) throw error
      return assignment.id
    }
    const { data, error } = await supabase
      .from('teaching_assignments')
      .upsert([{ ...payload, created_at: new Date().toISOString() }], {
        onConflict: 'school_id,term_id,class_id,subject_id,teacher_id',
      })
      .select()
      .single()
    if (error) throw error
    return data.id
  }

  async function deleteTeachingAssignment(id) {
    if (!id) return
    const { error } = await supabase.from('teaching_assignments').delete().eq('id', id)
    if (error) throw error
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TIMETABLE
  // ═════════════════════════════════════════════════════════════════════════
  async function getTimetable() {
    const table = getSlotTable(schoolStore)
    // ใช้ pagination เพราะ Supabase project มี hard cap 1000 rows ต่อ request
    const PAGE = 1000
    let allRows = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('school_id', authStore.schoolId)
        .eq('term_id', term())
        .range(from, from + PAGE - 1)
      if (error) throw error
      allRows.push(...(data || []))
      if ((data || []).length < PAGE) break
    }
    return allRows.map(mapTimetableSlot)
  }

  // Get timetable slots from published snapshot in schools.settings
  async function getPublishedTimetableSlots() {
    try {
      const settings = await getSchoolSettings()
      const publishStatus = settings.published_timetable?.status
      if (publishStatus !== 'published') {
        throw new Error('ตารางสอนยังไม่พร้อมใช้งาน กรุณารอให้ผู้บริหารอนุมัติก่อน')
      }
      const timetable = settings.published_timetable?.timetable
      if (!Array.isArray(timetable)) {
        throw new Error('ไม่พบสแนปชอตตารางสอน')
      }
      return timetable
    } catch (e) {
      throw new Error(`โหลดตารางสอนล้มเหลว: ${e.message}`)
    }
  }

  async function saveTimetableSlot(slot) {
    const payload = {
      school_id: authStore.schoolId,
      term_id: term(),
      class_id: slot.class_id,
      subject_id: slot.subject_code || slot.subject_id || null,
      subject_name: slot.subject_name || null,
      teacher_id: slot.teacher_id || null,
      teacher_name: slot.teacher_name || null,
      room_id: slot.room_id || null,
      day_of_week: slot.day || slot.day_of_week,
      period_number: Number(slot.period || slot.period_number),
      slot_type: slot.type || slot.slot_type || 'normal',
    }
    const { error } = await supabase
      .from('timetable_slots')
      .upsert([payload], { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
    if (error) throw error
  }

  // Save multiple slots at once using upsert
  async function saveTimetableBatch(slots) {
    if (!slots || slots.length === 0) return
    const schoolId = authStore.schoolId
    const timetableTerm = term()
    const rawPayloads = slots.map(slot => ({
      school_id: schoolId,
      term_id: timetableTerm,
      class_id: slot.class_id,
      subject_id: slot.subject_code || slot.subject_id || null,
      subject_name: slot.subject_name || null,
      teacher_id: slot.teacher_id || null,
      teacher_name: slot.teacher_name || null,
      room_id: slot.room_id || null,
      day_of_week: slot.day || slot.day_of_week,
      period_number: Number(slot.period || slot.period_number),
      slot_type: slot.type || slot.slot_type || 'normal',
    }))
    // Deduplicate by conflict key to avoid "affect row a second time" error
    const dedup = new Map()
    for (const p of rawPayloads) {
      dedup.set(`${p.class_id}_${p.day_of_week}_${p.period_number}`, p)
    }
    const payloads = [...dedup.values()]
    const CHUNK = 400
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const { error } = await supabase
        .from('timetable_slots')
        .upsert(payloads.slice(i, i + CHUNK), { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      if (error) throw error
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEACHING LOGS — mapped from teach_actuals for backward compat
  // AttendanceView uses getTeachingLogs(date, classId, teacherId)
  // It reads: log.period, log.subject_code_snapshot, log.class_id, log.log_id|id
  // ═════════════════════════════════════════════════════════════════════════
  async function getTeachingLogs(date, classId = null, teacherId = null) {
    const dateKey = normalizeDateKey(date)
    const termId = term()

    let q = supabase
      .from('teach_actuals')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)
      .eq('date', dateKey)

    if (classId) q = q.eq('class_id', classId)

    const { data, error } = await q
    if (error) throw error

    let rows = (data || []).map(row => ({
      ...mapTeachActual(row),
      log_id: row.id,
      // backward compat fields for AttendanceView
      subject_code_snapshot: row.subject_id ?? row.subject_plan_id ?? '',
      teacher_id_snapshot: row.planned_teacher_id ?? '',
    }))

    if (teacherId) {
      rows = rows.filter(r =>
        r.planned_teacher_id === teacherId ||
        r.actual_teacher_id === teacherId ||
        r.teacher_plan_id === teacherId ||
        r.teacher_id_snapshot === teacherId
      )
    }

    return rows.sort((a, b) => (a.period || 0) - (b.period || 0))
  }

  async function getTeachingLog(logId) {
    const { data, error } = await supabase
      .from('teach_actuals')
      .select('*')
      .eq('id', logId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return { ...mapTeachActual(data), log_id: data.id }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // BEHAVIOR SUMMARY — derived from students table
  // ═════════════════════════════════════════════════════════════════════════
  async function getBehaviorSummary(studentId) {
    // student_id here can be the UUID or student_code; try UUID first
    let row = null
    const selectFields = 'behavior_carry_over, total_behavior_score, general_behavior_score, attendance_behavior_score, learning_behavior_score'
    if (studentId && studentId.includes('-')) {
      const { data } = await supabase
        .from('students')
        .select(selectFields)
        .eq('id', studentId)
        .maybeSingle()
      row = data
    } else {
      const { data } = await supabase
        .from('students')
        .select(selectFields)
        .eq('school_id', authStore.schoolId)
        .eq('student_code', studentId)
        .maybeSingle()
      row = data
    }
    if (!row) {
      return {
        total_score: 0,
        general_score: 0,
        attendance_score: 0,
        learning_score: 0,
        general_score_init: 0,
        attendance_score_init: 0,
        learning_score_init: 0,
      }
    }
    const carryOver  = row.behavior_carry_over       ?? 0
    const general    = row.general_behavior_score    ?? 0
    const attendance = row.attendance_behavior_score ?? 0
    const learning   = row.learning_behavior_score   ?? 0
    const total      = row.total_behavior_score      ?? (carryOver + general + attendance + learning)
    return {
      carry_over_score: carryOver,
      total_score:      total,
      general_score:    general,
      attendance_score: attendance,
      learning_score:   learning,
      inclass_score:    attendance + learning,
      general_score_init: 0,
      attendance_score_init: 0,
      learning_score_init: 0,
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // BEHAVIOR LOGS
  // ═════════════════════════════════════════════════════════════════════════
  async function getBehaviorLogs({ studentId, classId, type, startDate, endDate } = {}) {
    const termId = term()
    let q = supabase
      .from('behavior_logs')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)

    if (studentId) q = q.eq('student_id', studentId)
    if (type === 'inclass') q = q.in('behavior_type', ['attendance', 'learning'])
    else if (type) q = q.eq('behavior_type', type)
    if (startDate) q = q.gte('created_at', startDate)
    if (endDate)   q = q.lte('created_at', endDate + 'T23:59:59')

    q = q.order('created_at', { ascending: false })

    // paginate (Supabase hard cap 1000 rows/request)
    const PAGE_BL = 1000
    let rows = []
    for (let from = 0; ; from += PAGE_BL) {
      const { data, error } = await q.range(from, from + PAGE_BL - 1)
      if (error) throw error
      rows.push(...(data || []))
      if ((data || []).length < PAGE_BL) break
    }
    // filter by class_id in memory (no class_id column in behavior_logs; join via students if needed)
    if (classId) {
      // If classId filtering is needed, get student IDs in that class first
      const { data: students } = await supabase
        .from('students')
        .select('student_code')
        .eq('school_id', authStore.schoolId)
        .eq('class_id', classId)
      const studentIds = new Set((students || []).map(s => s.student_code))
      rows = rows.filter(r => studentIds.has(r.student_id))
    }
    return rows
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ACTIVITY BOOKINGS
  // ═════════════════════════════════════════════════════════════════════════
  async function getActivityBookings() {
    const termId = await getTermId()
    const { data, error } = await supabase
      .from('activity_bookings')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)
      .order('created_at')
    if (error) throw error
    return data || []
  }

  async function saveActivityBooking(booking) {
    const termId = await getTermId()
    const payload = {
      school_id: authStore.schoolId,
      term_id: termId,
      name: booking.name,
      days: booking.days,
      start_period: booking.start_period,
      duration_periods: booking.duration_periods,
      target_classes: booking.target_classes,
      color: booking.color || null,
    }
    if (booking.id && booking.id.includes('-')) {
      const { error } = await supabase
        .from('activity_bookings')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', booking.id)
      if (error) throw error
      return booking.id
    } else {
      const { data, error } = await supabase
        .from('activity_bookings')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      return data.id
    }
  }

  async function deleteActivityBooking(id) {
    if (!id || !id.includes('-')) return
    const { error } = await supabase.from('activity_bookings').delete().eq('id', id)
    if (error) throw error
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ROOMS
  // ═════════════════════════════════════════════════════════════════════════
  async function getRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('room_code')
    if (error) throw error
    return data.map(d => ({
      ...d,
      room_id: d.room_code,
    }))
  }

  function buildRoomCatalog(rooms = []) {
    const activeRooms = rooms
      .filter(r => r && r.room_id && r.is_active !== false)
      .map(r => ({
        room_id: r.room_id,
        room_name: r.room_name || '',
        room_type: r.room_type || 'other',
        building: r.building || '',
        floor: r.floor || '',
        capacity: r.capacity ?? null,
        is_active: true,
      }))
      .sort((a, b) => (a.room_id || '').localeCompare(b.room_id || ''))
    return {
      version: 1,
      active_rooms: activeRooms,
      lab_rooms: activeRooms.filter(r => r.room_type === 'lab'),
      special_rooms: activeRooms.filter(r => r.room_type === 'special'),
      classroom_rooms: activeRooms.filter(r => r.room_type === 'classroom' || r.room_type === 'other'),
    }
  }

  async function rebuildRoomCatalog() {
    const rooms = await getRooms()
    const catalog = buildRoomCatalog(rooms)
    // Store in schools.settings.room_catalog
    await updateSchoolSettings({ room_catalog: catalog })
    return catalog
  }

  async function getRoomCatalog() {
    const settings = await getSchoolSettings()
    if (settings.room_catalog) return settings.room_catalog
    return rebuildRoomCatalog()
  }

  async function saveRoom(room) {
    const payload = {
      school_id: authStore.schoolId,
      room_code: room.room_id,
      room_name: room.room_name,
      room_type: room.room_type || 'other',
      building: room.building || null,
      floor: room.floor || null,
      capacity: room.capacity || null,
      is_active: room.is_active !== false,
      note: room.note || '',
    }
    let savedId = null
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(room.id || '')
    if (isUuid) {
      const { error } = await supabase.from('rooms').update(payload).eq('id', room.id)
      if (error) throw error
      savedId = room.id
    } else {
      const { data: existing } = await supabase.from('rooms').select('id')
        .eq('school_id', authStore.schoolId).eq('room_code', room.room_id).maybeSingle()
      if (existing?.id) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', existing.id)
        if (error) throw error
        savedId = existing.id
      } else {
        const { data, error } = await supabase.from('rooms').insert([payload]).select().single()
        if (error) throw error
        savedId = data.id
      }
    }
    try { await rebuildRoomCatalog() } catch (e) { console.warn('rebuildRoomCatalog failed:', e) }
    return savedId
  }

  async function deleteRoom(roomId) {
    if (!roomId) return
    const { data } = await supabase
      .from('rooms')
      .select('id')
      .eq('school_id', authStore.schoolId)
      .eq('room_code', roomId)
      .maybeSingle()
    if (data?.id) {
      await supabase.from('rooms').delete().eq('id', data.id)
    }
    try { await rebuildRoomCatalog() } catch (e) { console.warn('rebuildRoomCatalog failed:', e) }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEACH ACTUALS
  // ═════════════════════════════════════════════════════════════════════════
  function encodeTeachActualId(date, classId, period) {
    const encodedClass = (classId || '').replace(/\//g, '_')
    return `${date}_${encodedClass}_${period}`
  }

  // ดึง teach_actual รายวัน — ใช้ timetable_slots เป็น source of truth
  // เพื่อหลีกเลี่ยง UUID type mismatch บน planned_teacher_id / actual_teacher_id
  async function getTeachActuals(date, teacherPlanId = null) {
    const dateKey = normalizeDateKey(date)
    // timetable_slots.term_id is TEXT (e.g. '2568_1') — use term() directly like MyTimetableView
    // getTermId() may return a UUID if academic_terms table exists, causing 0 rows from timetable_slots
    const timetableTerm = term()
    const schoolId = authStore.schoolId

    // ไม่ระบุครู → คืน teach_actuals ทั้งหมดของวันนั้น (ใช้โดย admin/report)
    if (!teacherPlanId) {
      const { data, error } = await supabase
        .from('teach_actuals')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term_id', timetableTerm)
        .eq('date', dateKey)
      if (error) throw error
      return (data || []).map(mapTeachActual).sort((a, b) => (a.period || 0) - (b.period || 0))
    }

    // ระบุครู → อ่าน timetable_slots ของครูวันนั้นโดยตรง (teacher_id = TEXT code)
    const dayNum = THAI_DAY_TO_NUMBER[THAI_DAYS_ARR[new Date(dateKey + 'T00:00:00').getDay()]]
    const [slotsRes, actualsRes, teachersRes] = await Promise.all([
      supabase
        .from(getSlotTable(schoolStore))
        .select('class_id, period_number, subject_id, subject_name, teacher_id, teacher_name, room_id, slot_type')
        .eq('school_id', schoolId)
        .eq('term_id', timetableTerm)
        .eq('teacher_id', teacherPlanId)
        .eq('day_of_week', dayNum)
        .not('slot_type', 'in', '("activity","manual_lock")'),
      supabase
        .from('teach_actuals')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term_id', timetableTerm)
        .eq('date', dateKey),
      supabase
        .from('teachers')
        .select('teacher_code, prefix, first_name, last_name')
        .eq('school_id', schoolId),
    ])
    if (slotsRes.error) throw slotsRes.error

    const teacherNameMap = new Map()
    for (const t of (teachersRes.data || [])) {
      teacherNameMap.set(t.teacher_code, `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim())
    }

    const tSlots = slotsRes.data || []
    const actualsMap = new Map()
    for (const row of (actualsRes.data || [])) {
      actualsMap.set(`${row.class_id}_${row.period_number}`, mapTeachActual(row))
    }

    // Merge timetable slots
    const results = tSlots.map(slot => {
      const key = `${slot.class_id}_${slot.period_number}`
      const existing = actualsMap.get(key)
      const info = {
        subject_plan_id: slot.subject_id || '',
        subject_name: slot.subject_name || slot.subject_id || '',
        teacher_plan_id: slot.teacher_id || '',
        teacher_plan_name: teacherNameMap.get(slot.teacher_id) || slot.teacher_name || slot.teacher_id || '',
        preferred_room: slot.room_id || '',
        class_id: slot.class_id,
      }
      if (existing) return { ...existing, ...info }
      return {
        id: null, teach_actual_id: null,
        school_id: schoolId, term_id: timetableTerm,
        class_id: slot.class_id, date: dateKey,
        period: slot.period_number, period_number: slot.period_number,
        slot_type: slot.slot_type || 'normal',
        is_filled: false, is_substitute_mandatory: false,
        topic: '', activity_type: 'บรรยาย', ...info,
      }
    })

    // เพิ่ม homeroom periods ของครูที่ปรึกษา (ไม่อยู่ใน timetable_slots)
    const thaiDay = THAI_DAYS_ARR[new Date(dateKey + 'T00:00:00').getDay()]
    try {
      const [settingsResult, classesRes] = await Promise.all([
        getSchoolSettings(),
        supabase.from('classes')
          .select('class_name, homeroom_teacher_id, homeroom_teacher_ids, homeroom_teacher_names_snapshot')
          .eq('school_id', schoolId),
      ])
      const homeroomPeriods = settingsResult.teaching_log_settings?.homeroom_special_periods || []
      // Homeroom period เป็นของครูคนแรกในรายชื่อที่ปรึกษา
      const homeroomClasses = (classesRes.data || []).filter(c => {
        const ids = Array.isArray(c.homeroom_teacher_ids) && c.homeroom_teacher_ids.length
          ? c.homeroom_teacher_ids
          : (c.homeroom_teacher_id ? [c.homeroom_teacher_id] : [])
        return ids.length > 0 && ids[0] === teacherPlanId
      })
      // ชื่อครู: teacherNameMap → snapshot[0] → teacher code
      const firstSnapName = homeroomClasses.length
        ? (() => {
            const c = homeroomClasses[0]
            const snap = Array.isArray(c.homeroom_teacher_names_snapshot) ? c.homeroom_teacher_names_snapshot
              : (c.homeroom_teacher_name_snapshot ? [c.homeroom_teacher_name_snapshot] : [])
            return snap[0] || ''
          })()
        : ''
      const teacherDisplayName = teacherNameMap.get(teacherPlanId) || firstSnapName || teacherPlanId
      for (const homeroomClass of homeroomClasses) {
        if (!homeroomPeriods.length) break
        const classId = homeroomClass.class_name
        for (const hp of homeroomPeriods) {
          const period = Number(hp.period)
          if (!Number.isFinite(period)) continue
          const days = Array.isArray(hp.days) ? hp.days : []
          if (days.length && !days.includes('all') && !days.includes(thaiDay)) continue
          if (results.some(r => r.class_id === classId && r.period === period)) continue
          const existing = actualsMap.get(`${classId}_${period}`)
          const hmInfo = {
            subject_plan_id: '', subject_name: hp.name || '',
            teacher_plan_id: teacherPlanId,
            teacher_plan_name: teacherDisplayName,
            class_id: classId, class_name: classId, slot_type: 'homeroom',
          }
          if (existing) {
            results.push({ ...existing, ...hmInfo })
          } else {
            results.push({
              id: null, teach_actual_id: null,
              school_id: schoolId, term_id: timetableTerm,
              date: dateKey, day_of_week: thaiDay,
              period, period_number: period,
              is_filled: false, is_substitute_mandatory: false,
              topic: '', activity_type: 'บรรยาย', student_records: {},
              ...hmInfo,
            })
          }
        }
      }
    } catch (_) { /* homeroom ล้มเหลว ไม่กระทบ regular slots */ }

    return results.sort((a, b) => (a.period || 0) - (b.period || 0))
  }

  // ดึงช่วงวันที่ (สำหรับรายงาน) — รวม virtual unfilled จาก timetable_slots ด้วย
  async function getTeachActualsRange(startDate, endDate, teacherId = null) {
    const startKey = normalizeDateKey(startDate)
    const endKey = normalizeDateKey(endDate)
    const termId = term()
    const schoolId = authStore.schoolId

    const slotTable2 = getSlotTable(schoolStore)
    const PAGE2 = 1000
    const fetchSlots2 = async () => {
      const rows = []
      for (let from = 0; ; from += PAGE2) {
        let q = supabase.from(slotTable2)
          .select('class_id, period_number, subject_id, subject_name, teacher_id, teacher_name, day_of_week')
          .eq('school_id', schoolId).eq('term_id', termId)
          .not('slot_type', 'in', '("activity","manual_lock")')
          .range(from, from + PAGE2 - 1)
        if (teacherId) q = q.eq('teacher_id', teacherId)
        const { data, error } = await q
        if (error) throw error
        rows.push(...(data || []))
        if ((data || []).length < PAGE2) break
      }
      return rows
    }

    const [slotsData2, settingsResult, classesRes, teachersRes] = await Promise.all([
      fetchSlots2(),
      getSchoolSettings(),
      supabase.from('classes')
        .select('class_name, homeroom_teacher_id, homeroom_teacher_ids, homeroom_teacher_names_snapshot')
        .eq('school_id', schoolId),
      supabase.from('teachers')
        .select('teacher_code, prefix, first_name, last_name')
        .eq('school_id', schoolId).limit(500),
    ])
    const slotsRes = { data: slotsData2, error: null }

    // paginate teach_actuals to bypass 1000-row default cap
    let actualsRows = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('teach_actuals')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .gte('date', startKey)
        .lte('date', endKey)
        .order('date')
        .range(from, from + PAGE - 1)
      if (error) throw error
      actualsRows.push(...(data || []))
      if ((data || []).length < PAGE) break
    }

    const homeroomPeriods      = settingsResult.teaching_log_settings?.homeroom_special_periods || []
    const classesWithHomeroom  = (classesRes.data || []).filter(c =>
      (Array.isArray(c.homeroom_teacher_ids) ? c.homeroom_teacher_ids : [c.homeroom_teacher_id].filter(Boolean)).length > 0
    )
    const teacherNameMap = new Map()
    for (const t of (teachersRes?.data || [])) {
      teacherNameMap.set(t.teacher_code, `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim())
    }

    const slotsByDay = {}
    for (const slot of (slotsRes.data || [])) {
      const day = slot.day_of_week
      if (!slotsByDay[day]) slotsByDay[day] = []
      slotsByDay[day].push(slot)
    }

    const actualsMap = new Map()
    for (const row of actualsRows) {
      const mapped = mapTeachActual(row)
      // Use stored record_by_name if present; fall back to planned teacher name
      if (!mapped.record_by_name && mapped.is_filled) {
        mapped.record_by_name = teacherNameMap.get(row.planned_teacher_id) || ''
      }
      actualsMap.set(`${row.date}_${row.class_id}_${row.period_number}`, mapped)
    }

    const results = []
    const start = new Date(startKey + 'T00:00:00')
    const end   = new Date(endKey   + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr     = localDateStr(d)
      const thaiDay     = THAI_DAYS_ARR[d.getDay()]
      const dayNum      = THAI_DAY_TO_NUMBER[thaiDay]
      const slotsForDay = slotsByDay[dayNum] || []
      const seenKeys    = new Set()  // กัน duplicate slot ในวันเดียวกัน
      for (const slot of slotsForDay) {
        const key = `${dateStr}_${slot.class_id}_${slot.period_number}`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        const existing = actualsMap.get(key)
        const slotTeacherId = String(slot.teacher_id || '')
        const slotInfo = {
          subject_plan_id:   slot.subject_id   || '',
          subject_name:      slot.subject_name  || slot.subject_id || '',
          teacher_plan_id:   slotTeacherId,
          teacher_plan_name: teacherNameMap.get(slotTeacherId) || slot.teacher_name || slotTeacherId || '',
          class_id:          slot.class_id,
          class_name:        slot.class_id,
        }
        if (existing) results.push({ ...existing, ...slotInfo })
        else results.push({
          id: null, teach_actual_id: null,
          date: dateStr, day_of_week: thaiDay,
          period: slot.period_number, period_number: slot.period_number,
          is_filled: false, is_substitute_mandatory: false,
          topic: '', activity_type: 'บรรยาย', record_by_name: '', timestamp: null,
          ...slotInfo,
        })
      }
      // เพิ่ม homeroom periods ของครูที่ปรึกษาแต่ละห้อง
      for (const cls of classesWithHomeroom) {
        const cId = cls.class_name
        for (const hp of homeroomPeriods) {
          const period = Number(hp.period)
          if (!Number.isFinite(period)) continue
          const days = Array.isArray(hp.days) ? hp.days : []
          if (days.length && !days.includes('all') && !days.includes(thaiDay)) continue
          if (results.some(r => r.date === dateStr && r.class_id === cId && r.period === period)) continue
          const key = `${dateStr}_${cId}_${period}`
          const existing = actualsMap.get(key)
          const hmTeacherId = (Array.isArray(cls.homeroom_teacher_ids) && cls.homeroom_teacher_ids.length
            ? cls.homeroom_teacher_ids[0] : cls.homeroom_teacher_id) || ''
          const hmSnapName = (() => {
            const snap = Array.isArray(cls.homeroom_teacher_names_snapshot) ? cls.homeroom_teacher_names_snapshot
              : (cls.homeroom_teacher_name_snapshot ? [cls.homeroom_teacher_name_snapshot] : [])
            return snap[0] || ''
          })()
          const hmTeacherName = teacherNameMap.get(hmTeacherId) || hmSnapName || hmTeacherId
          const hmInfo = {
            subject_plan_id: '', subject_name: hp.name || hp.subject_name || '',
            teacher_plan_id: hmTeacherId,
            teacher_plan_name: hmTeacherName,
            class_id: cId, class_name: cId, slot_type: 'homeroom',
          }
          if (existing) results.push({ ...existing, ...hmInfo })
          else results.push({
            id: null, teach_actual_id: null,
            date: dateStr, day_of_week: thaiDay,
            period, period_number: period,
            is_filled: false, is_substitute_mandatory: false,
            topic: '', activity_type: 'บรรยาย', record_by_name: '', timestamp: null,
            ...hmInfo,
          })
        }
      }
    }

    return results.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      if ((a.class_id || '') !== (b.class_id || '')) return (a.class_id || '') < (b.class_id || '') ? -1 : 1
      return (a.period || 0) - (b.period || 0)
    })
  }

  // ดึงเฉพาะ teach_actuals ที่ is_filled=false ในเทอมปัจจุบัน (ใช้โดยหน้าลืมบันทึก)
  async function getUnfilledTeachActuals() {
    const schoolId = authStore.schoolId
    const termId   = term()

    // แสดงเฉพาะช่วงที่ยังแก้ได้ (backdating window) และก่อนวันนี้
    const settings     = await getSchoolSettings()
    const maxDays      = settings?.teaching_log_settings?.backdating_days ?? 14
    const today        = new Date()
    const yesterday    = new Date(today); yesterday.setDate(today.getDate() - 1)
    const startDate    = new Date(today); startDate.setDate(today.getDate() - maxDays)
    const startKey     = startDate.toISOString().split('T')[0]
    const endKey       = yesterday.toISOString().split('T')[0]

    const [teachersRes, slotsRes, subjectsRes, classesRes] = await Promise.all([
      supabase.from('teachers')
        .select('teacher_code, prefix, first_name, last_name')
        .eq('school_id', schoolId),
      supabase.from(getSlotTable(schoolStore))
        .select('class_id, period_number, subject_id, subject_name, teacher_id, teacher_name, day_of_week')
        .eq('school_id', schoolId)
        .eq('term_id', termId),
      supabase.from('subjects')
        .select('subject_code, name')
        .eq('school_id', schoolId),
      supabase.from('classes')
        .select('class_name, homeroom_teacher_id, homeroom_teacher_ids, homeroom_teacher_names_snapshot')
        .eq('school_id', schoolId),
    ])

    // paginate is_filled=false ในช่วง backdating
    let rows = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('teach_actuals')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .eq('is_filled', false)
        .not('slot_type', 'in', '("activity","manual_lock")')
        .gte('date', startKey)
        .lte('date', endKey)
        .order('date', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...(data || []))
      if ((data || []).length < PAGE) break
    }

    const teacherNameMap = new Map()
    for (const t of (teachersRes.data || [])) {
      const fullName = `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim()
      teacherNameMap.set(String(t.teacher_code), fullName)
    }

    // subjects map: subject_code → subject_name (Thai name)
    const subjectNameMap = new Map()
    for (const s of (subjectsRes.data || [])) {
      subjectNameMap.set(String(s.subject_code), s.name || '')
    }

    // slot map: ใช้ทั้ง class+period+dow lookup และ teacher_id → teacher_name
    const slotMap = new Map()
    const slotTeacherMap = new Map()
    for (const s of (slotsRes.data || [])) {
      slotMap.set(`${s.class_id}_${s.period_number}_${s.day_of_week}`, s)
      if (s.teacher_id && s.teacher_name && !slotTeacherMap.has(String(s.teacher_id))) {
        slotTeacherMap.set(String(s.teacher_id), s.teacher_name)
      }
    }

    // homeroom: class_name → { teacher_code, snap_name }
    const classHomeroomMap = new Map()
    for (const c of (classesRes.data || [])) {
      const rawTid = Array.isArray(c.homeroom_teacher_ids) && c.homeroom_teacher_ids.length
        ? c.homeroom_teacher_ids[0] : c.homeroom_teacher_id
      // กรณี homeroom_teacher_id เก็บ "307, 703" เป็น string → เอาแค่ตัวแรก
      const tid = rawTid ? String(rawTid).split(',')[0].trim() : null
      const snap = Array.isArray(c.homeroom_teacher_names_snapshot) ? c.homeroom_teacher_names_snapshot
        : (c.homeroom_teacher_name_snapshot ? [c.homeroom_teacher_name_snapshot] : [])
      if (tid) classHomeroomMap.set(c.class_name, { tid, snapName: snap[0] || '' })
    }

    // homeroom period → name from settings
    const homeroomSettings = settings?.teaching_log_settings?.homeroom_special_periods || []
    const homeroomPeriodNameMap = new Map()
    for (const hp of homeroomSettings) {
      if (hp.period) homeroomPeriodNameMap.set(Number(hp.period), hp.name || '')
    }

    return rows.map(row => {
      const mapped = mapTeachActual(row)
      const isHomeroom = row.slot_type === 'homeroom'
        || homeroomPeriodNameMap.has(row.period_number)
      const dayNum = THAI_DAY_TO_NUMBER[THAI_DAYS_ARR[new Date(row.date + 'T00:00:00').getDay()]]
      const slot   = isHomeroom ? null : slotMap.get(`${row.class_id}_${row.period_number}_${dayNum}`)

      let teacherId = String(row.planned_teacher_id || '')
      let teacherName = teacherNameMap.get(teacherId)
        || slotTeacherMap.get(teacherId)
        || slot?.teacher_name
        || ''
      let subjectId = row.subject_id || slot?.subject_id || ''
      let subjectName = slot?.subject_name || subjectNameMap.get(subjectId) || ''

      if (isHomeroom && !teacherName) {
        // fallback จาก classes table
        const hm = classHomeroomMap.get(row.class_id)
        if (hm) {
          teacherId = hm.tid
          teacherName = teacherNameMap.get(hm.tid) || hm.snapName || hm.tid
        }
      }
      if (isHomeroom && !subjectName) {
        subjectName = homeroomPeriodNameMap.get(row.period_number) || ''
      }

      return {
        ...mapped,
        teacher_plan_id:   teacherId,
        teacher_plan_name: teacherName,
        subject_name:      subjectName,
        class_name:        row.class_id,
      }
    })
  }

  async function getTeachActualsRangeByClass(startDate, endDate, classId = null) {
    const startKey = normalizeDateKey(startDate)
    const endKey   = normalizeDateKey(endDate)
    const termId   = term()
    const schoolId = authStore.schoolId

    const slotTable = getSlotTable(schoolStore)
    const PAGE = 1000

    // paginate timetable slots (Supabase hard cap 1000 rows/request)
    const fetchSlots = async () => {
      const rows = []
      for (let from = 0; ; from += PAGE) {
        let q = supabase.from(slotTable)
          .select('class_id, period_number, subject_id, subject_name, teacher_id, teacher_name, day_of_week')
          .eq('school_id', schoolId).eq('term_id', termId)
          .not('slot_type', 'in', '("activity","manual_lock")')
          .range(from, from + PAGE - 1)
        if (classId) q = q.eq('class_id', classId)
        const { data, error } = await q
        if (error) throw error
        rows.push(...(data || []))
        if ((data || []).length < PAGE) break
      }
      return rows
    }

    // paginate teach_actuals (could span many days across a term)
    const fetchActuals = async () => {
      const rows = []
      for (let from = 0; ; from += PAGE) {
        let q = supabase.from('teach_actuals').select('*')
          .eq('school_id', schoolId).eq('term_id', termId)
          .gte('date', startKey).lte('date', endKey).order('date')
          .range(from, from + PAGE - 1)
        if (classId) q = q.eq('class_id', classId)
        const { data, error } = await q
        if (error) throw error
        rows.push(...(data || []))
        if ((data || []).length < PAGE) break
      }
      return rows
    }

    let classesQ = supabase
      .from('classes')
      .select('class_name, homeroom_teacher_id, homeroom_teacher_ids, homeroom_teacher_names_snapshot')
      .eq('school_id', schoolId)
    if (classId) classesQ = classesQ.eq('class_name', classId)

    const [slotsData, actualsRows, settingsResult, classesRes, teachersRes2] = await Promise.all([
      fetchSlots(), fetchActuals(), getSchoolSettings(), classesQ,
      supabase.from('teachers').select('teacher_code, prefix, first_name, last_name').eq('school_id', schoolId).limit(500),
    ])
    const slotsRes = { data: slotsData }
    const actualsRes = { data: actualsRows }

    const homeroomPeriods     = settingsResult.teaching_log_settings?.homeroom_special_periods || []
    const classesWithHomeroom = (classesRes.data || []).filter(c =>
      (Array.isArray(c.homeroom_teacher_ids) ? c.homeroom_teacher_ids : [c.homeroom_teacher_id].filter(Boolean)).length > 0
    )
    const teacherNameMap2 = new Map()
    for (const t of (teachersRes2?.data || [])) {
      teacherNameMap2.set(t.teacher_code, `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim())
    }

    const slotsByDay = {}
    for (const slot of (slotsRes.data || [])) {
      const day = slot.day_of_week
      if (!slotsByDay[day]) slotsByDay[day] = []
      slotsByDay[day].push(slot)
    }

    const actualsMap = new Map()
    for (const row of (actualsRes.data || [])) {
      actualsMap.set(`${row.date}_${row.class_id}_${row.period_number}`, mapTeachActual(row))
    }

    const results = []
    const start = new Date(startKey + 'T00:00:00')
    const end   = new Date(endKey   + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr     = localDateStr(d)
      const thaiDay     = THAI_DAYS_ARR[d.getDay()]
      const dayNum      = THAI_DAY_TO_NUMBER[thaiDay]
      const slotsForDay = slotsByDay[dayNum] || []
      for (const slot of slotsForDay) {
        const key      = `${dateStr}_${slot.class_id}_${slot.period_number}`
        const existing = actualsMap.get(key)
        const slotInfo = {
          subject_plan_id:   slot.subject_id   || '',
          subject_name:      slot.subject_name  || slot.subject_id || '',
          teacher_plan_id:   slot.teacher_id    || '',
          teacher_plan_name: teacherNameMap2.get(slot.teacher_id) || slot.teacher_name || slot.teacher_id || '',
          class_id:          slot.class_id,
          class_name:        slot.class_id,
        }
        if (existing) results.push({ ...existing, ...slotInfo })
        else results.push({
          id: null, teach_actual_id: null,
          date: dateStr, day_of_week: thaiDay,
          period: slot.period_number, period_number: slot.period_number,
          is_filled: false, is_substitute_mandatory: false,
          topic: '', activity_type: 'บรรยาย', record_by_name: '', timestamp: null, student_records: {},
          ...slotInfo,
        })
      }
      // เพิ่ม homeroom periods
      for (const cls of classesWithHomeroom) {
        const cId = cls.class_name
        for (const hp of homeroomPeriods) {
          const period = Number(hp.period)
          if (!Number.isFinite(period)) continue
          const days = Array.isArray(hp.days) ? hp.days : []
          if (days.length && !days.includes('all') && !days.includes(thaiDay)) continue
          if (results.some(r => r.date === dateStr && r.class_id === cId && r.period === period)) continue
          const key = `${dateStr}_${cId}_${period}`
          const existing = actualsMap.get(key)
          const hmTeacherId2 = (Array.isArray(cls.homeroom_teacher_ids) && cls.homeroom_teacher_ids.length
            ? cls.homeroom_teacher_ids[0] : cls.homeroom_teacher_id) || ''
          const hmSnapName2 = (() => {
            const snap = Array.isArray(cls.homeroom_teacher_names_snapshot) ? cls.homeroom_teacher_names_snapshot
              : (cls.homeroom_teacher_name_snapshot ? [cls.homeroom_teacher_name_snapshot] : [])
            return snap[0] || ''
          })()
          const hmTeacherName2 = teacherNameMap2.get(hmTeacherId2) || hmSnapName2 || hmTeacherId2
          const hmInfo = {
            subject_plan_id: '', subject_name: hp.name || hp.subject_name || '',
            teacher_plan_id: hmTeacherId2,
            teacher_plan_name: hmTeacherName2,
            class_id: cId, class_name: cId, slot_type: 'homeroom',
          }
          if (existing) results.push({ ...existing, ...hmInfo })
          else results.push({
            id: null, teach_actual_id: null,
            date: dateStr, day_of_week: thaiDay,
            period, period_number: period,
            is_filled: false, is_substitute_mandatory: false,
            topic: '', activity_type: 'บรรยาย', record_by_name: '', timestamp: null, student_records: {},
            ...hmInfo,
          })
        }
      }
    }

    return results.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      if ((a.class_id || '') !== (b.class_id || '')) return (a.class_id || '') < (b.class_id || '') ? -1 : 1
      return (a.period || 0) - (b.period || 0)
    })
  }

  // สร้าง teach_actual จาก timetable สำหรับวันที่กำหนด
  async function generateTeachActualsForDate(date, dayName, timetableSlots) {
    const dateKey = normalizeDateKey(date)
    const dayNumber = THAI_DAY_TO_NUMBER[dayName]
    if (!dayNumber) throw new Error(`วันที่ไม่รู้จัก: ${dayName}`)
    const termId = term()

    const slotsForDay = (Array.isArray(timetableSlots) ? timetableSlots : [])
      .filter(s => {
        if (s?.type === 'activity' || s?.slot_type === 'activity') return false
        if (s?.type === 'manual_lock' || s?.slot_type === 'manual_lock') return false
        if (s?.day === dayName || s?.day_of_week === dayName) return true
        return normalizeDayNumber(s?.day ?? s?.day_of_week) === dayNumber
      })

    // Load school_info and classes in parallel
    const [settingsResult, classesResult] = await Promise.all([
      getSchoolSettings(),
      supabase
        .from('classes')
        .select('*')
        .eq('school_id', authStore.schoolId)
        .order('class_name'),
    ])

    const homeroomPeriods = Array.isArray(settingsResult.teaching_log_settings?.homeroom_special_periods)
      ? settingsResult.teaching_log_settings.homeroom_special_periods
      : []
    const classes = (classesResult.data || []).map(d => ({
      ...d,
      class_id: d.class_name,
    }))

    const payloads = []

    // ชุด period ที่ admin กำหนดเป็น homeroom (ไม่สร้าง regular slot ซ้อน)
    const homeroomPeriodNums = new Set(homeroomPeriods.map(hp => Number(hp.period)).filter(Number.isFinite))

    // Normal timetable slots
    for (const slot of slotsForDay) {
      const period = Number(slot?.period ?? slot?.period_number)
      if (!Number.isFinite(period)) continue
      // ถ้า period นี้เป็น homeroom period — ข้ามไป ให้ homeroom section สร้างแทน
      if (homeroomPeriodNums.has(period)) continue
      const classId = asText(slot?.class_id)
      if (!classId) continue

      payloads.push({
        school_id: authStore.schoolId,
        term_id: termId,
        class_id: classId,
        date: dateKey,
        period_number: period,
        planned_teacher_id: asText(slot?.teacher_id ?? slot?.teacher_id_snapshot ?? '') || null,
        actual_teacher_id: null,
        subject_id: asText(slot?.subject_id ?? slot?.subject_code ?? '') || null,
        is_filled: false,
        slot_type: slot?.slot_type ?? slot?.type ?? 'normal',
        teacher_plan_name: asText(slot?.teacher_name ?? slot?.teacher_name_snapshot ?? ''),
        class_name: asText(slot?.class_name ?? slot?.class_name_snapshot ?? classId),
      })
    }

    // Homeroom special periods — สร้างให้ครูคนแรกในรายชื่อที่ปรึกษาเท่านั้น
    for (const cls of classes) {
      const rawFirstTeacher = (Array.isArray(cls.homeroom_teacher_ids) && cls.homeroom_teacher_ids.length)
        ? cls.homeroom_teacher_ids[0]
        : cls.homeroom_teacher_id
      // กรณี homeroom_teacher_id เก็บ "307, 703" เป็น string → เอาแค่ตัวแรก
      const hmFirstTeacher = rawFirstTeacher ? String(rawFirstTeacher).split(',')[0].trim() : null
      if (!hmFirstTeacher) continue
      for (const hp of homeroomPeriods) {
        const period = Number(hp.period)
        if (!Number.isFinite(period)) continue
        const days = Array.isArray(hp.days) ? hp.days : []
        const appliesToday = !days.length || days.includes('all') || days.includes(dayName)
        if (!appliesToday) continue
        const classId = asText(cls.class_id)
        if (!classId) continue
        const hmFirstName = (Array.isArray(cls.homeroom_teacher_names_snapshot) && cls.homeroom_teacher_names_snapshot.length)
          ? cls.homeroom_teacher_names_snapshot[0]
          : (cls.homeroom_teacher_name_snapshot ?? hmFirstTeacher)
        payloads.push({
          school_id: authStore.schoolId,
          term_id: termId,
          class_id: classId,
          date: dateKey,
          period_number: period,
          planned_teacher_id: asText(hmFirstTeacher) || null,
          actual_teacher_id: null,
          subject_id: null,
          is_filled: false,
          slot_type: 'homeroom',
          teacher_plan_name: asText(hmFirstName),
          class_name: asText(cls.class_name ?? classId),
        })
      }
    }

    // DEBUG — ลบออกหลัง verify
    console.log('[generate] date:', dateKey, 'day:', dayName, 'slots total:', timetableSlots?.length,
      'slotsForDay:', slotsForDay.length, 'payloads:', payloads.length)
    const m6 = payloads.filter(p => p.class_id?.startsWith('ม.6'))
    console.log('[generate] ม.6 payloads:', m6.length, m6.map(p => `${p.class_id} p${p.period_number} t:${p.planned_teacher_id}`))

    if (payloads.length === 0) return 0

    // Strip fields not in schema before upserting
    const cleanPayloads = payloads.map(({ teacher_plan_name, class_name, ...rest }) => rest)

    // ลบ records ที่เสีย (is_filled=false + planned_teacher_id IS NULL) ก่อน insert
    // is_filled=true (ครูบันทึกแล้ว) จะไม่ถูกแตะ
    await supabase
      .from('teach_actuals')
      .delete()
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)
      .eq('date', dateKey)
      .eq('is_filled', false)
      .is('planned_teacher_id', null)

    // upsert: เพิ่มเฉพาะที่ยังไม่มี (ignoreDuplicates=true ไม่แตะ record ที่มีอยู่แล้ว)
    const CHUNK = 400
    for (let i = 0; i < cleanPayloads.length; i += CHUNK) {
      const { error } = await supabase
        .from('teach_actuals')
        .upsert(cleanPayloads.slice(i, i + CHUNK), { onConflict: 'school_id,term_id,class_id,date,period_number', ignoreDuplicates: true })
      if (error) throw error
    }
    return cleanPayloads.length
  }

  // บันทึก/อัพเดต teach_actual (ครูกรอก)
  async function saveTeachActual(data) {
    const termId = term()
    // Accept both old shape (teach_actual_id) and new shape (id)
    const rowId = data.id && data.id.includes('-') ? data.id : null
    const classId = data.class_id
    const dateKey = normalizeDateKey(data.date)
    const periodNum = Number(data.period ?? data.period_number)

    const payload = {
      school_id: authStore.schoolId,
      term_id: termId,
      class_id: classId,
      date: dateKey,
      period_number: periodNum,
      planned_teacher_id: null,
      actual_teacher_id: null,
      subject_id: data.subject_id || data.subject_plan_id || null,
      topic: data.topic ?? null,
      activity_type: data.activity_type ?? null,
      images: data.images ?? null,
      is_filled: data.is_filled ?? false,
      is_substitute_mandatory: data.is_substitute_mandatory ?? false,
      leave_request_id: data.leave_request_id ?? null,
      updated_at: new Date().toISOString(),
    }

    if (rowId) {
      const { error } = await supabase.from('teach_actuals').update(payload).eq('id', rowId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('teach_actuals')
        .upsert([payload], { onConflict: 'school_id,term_id,class_id,date,period_number' })
      if (error) throw error
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HOMEROOM CLASS
  // ═════════════════════════════════════════════════════════════════════════
  async function getHomeroomClass(teacherId) {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .eq('homeroom_teacher_id', teacherId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return { ...data, class_id: data.class_name }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ATTENDANCE DAILY CLASS (stored in schools.settings.attendance_daily)
  // ═════════════════════════════════════════════════════════════════════════
  function encodeAttendanceDailyId(date, classId) {
    return `${date}_${(classId || '').replace(/\//g, '_')}`
  }

  async function getAttendanceDailySummary(date, classId) {
    const settings = await getSchoolSettings()
    const key = encodeAttendanceDailyId(date, classId)
    const record = (settings.attendance_daily || {})[key]
    return record ? { id: key, ...record } : null
  }

  async function saveAttendanceDailySummary(date, classId, data) {
    const key = encodeAttendanceDailyId(date, classId)
    const settings = await getSchoolSettings()
    const dailyMap = { ...(settings.attendance_daily || {}) }
    dailyMap[key] = { ...data, date, class_id: classId }
    await updateSchoolSettings({ attendance_daily: dailyMap })
  }

  // ═════════════════════════════════════════════════════════════════════════
  // LEAVE REQUESTS
  // ═════════════════════════════════════════════════════════════════════════
  function filterSlotsForTeacherOnDate(timetableSlots, teacherId, dateStr) {
    const thaiDay = getThaiDayFromDate(dateStr)
    return (timetableSlots || []).filter(s => {
      if (s?.type === 'activity' || s?.slot_type === 'activity') return false
      if (s?.type === 'manual_lock' || s?.slot_type === 'manual_lock') return false
      const dayMatch =
        s.day === thaiDay ||
        s.day_of_week === thaiDay ||
        String(s.day) === String(THAI_DAY_TO_NUMBER[thaiDay])
      const teacherMatch = (s.teacher_id ?? s.teacher_id_snapshot) === teacherId
      return dayMatch && teacherMatch
    })
  }

  async function createLeaveRequest(data, timetableSlots) {
    const termId = await getTermId()
    const assignments = {}
    for (const dateStr of (data.dates || [])) {
      const slots = filterSlotsForTeacherOnDate(timetableSlots, data.teacher_id, dateStr)
      for (const s of slots) {
        const classId = s.class_id || s.class_id_snapshot || ''
        const period = Number(s.period ?? s.period_number)
        if (!classId || !period) continue
        const key = encodeTeachActualId(dateStr, classId, period)
        assignments[key] = {
          date: dateStr,
          period_no: period,
          class_id: classId,
          class_name: s.class_name ?? s.class_name_snapshot ?? classId,
          subject_name: s.subject_name ?? s.subject_name_snapshot ?? '',
          subject_plan_id: s.subject_code ?? s.subject_id ?? s.subject_code_snapshot ?? '',
          teach_actual_id: key,
          sub_teacher_id: null,
          sub_teacher_name: null,
          assigned_by: null,
          assigned_by_name: null,
          assigned_at: null,
          status: 'unassigned',
        }
      }
    }

    const payload = {
      school_id: authStore.schoolId,
      term_id: termId,
      teacher_id: data.teacher_id,
      teacher_name: data.teacher_name,
      leave_type: data.leave_type || 'sick',
      dates: data.dates || [],
      note: data.note || '',
      status: 'pending',
      assignments,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: inserted, error } = await supabase
      .from('leave_requests')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    return inserted.id
  }

  async function getLeaveRequests({ teacherId, status } = {}) {
    const termId = await getTermId()
    let q = supabase
      .from('leave_requests')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)
    if (teacherId) q = q.eq('teacher_id', teacherId)
    if (status)    q = q.eq('status', status)
    q = q.order('created_at', { ascending: false })
    const { data, error } = await q
    if (error) throw error
    return data || []
  }

  async function cancelLeaveRequest(leaveId) {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', leaveId)
    if (error) throw error
  }

  // จัดสอนแทน: update teach_actual + update leave_request.assignments JSONB
  async function assignSubstituteTeacher(leaveId, assignmentKey, slotData, subTeacher, absentTeacher) {
    const { date, period_no, class_id, subject_name, subject_plan_id } = slotData
    const termId = term()
    const periodNum = Number(period_no)

    // Upsert teach_actual
    const taPayload = {
      school_id: authStore.schoolId,
      term_id: termId,
      class_id,
      date: normalizeDateKey(date),
      period_number: periodNum,
      planned_teacher_id: absentTeacher.teacher_id,
      actual_teacher_id: subTeacher.teacher_id,
      subject_id: subject_plan_id || null,
      is_substitute_mandatory: true,
      leave_request_id: leaveId,
      updated_at: new Date().toISOString(),
    }
    const { error: taError } = await supabase
      .from('teach_actuals')
      .upsert([taPayload], { onConflict: 'school_id,term_id,class_id,date,period_number' })
    if (taError) throw taError

    // Update leave_request.assignments using JSONB path update via RPC or read-modify-write
    const { data: lr, error: lrFetchError } = await supabase
      .from('leave_requests')
      .select('assignments')
      .eq('id', leaveId)
      .single()
    if (lrFetchError) throw lrFetchError

    const assignments = { ...(lr.assignments || {}) }
    assignments[assignmentKey] = {
      ...(assignments[assignmentKey] || {}),
      sub_teacher_id: subTeacher.teacher_id,
      sub_teacher_name: subTeacher.teacher_name,
      assigned_by: authStore.profile?.uid || '',
      assigned_by_name: authStore.profile?.displayName || '',
      assigned_at: new Date().toISOString(),
      status: 'assigned',
    }

    const { error: lrUpdateError } = await supabase
      .from('leave_requests')
      .update({ assignments, updated_at: new Date().toISOString() })
      .eq('id', leaveId)
    if (lrUpdateError) throw lrUpdateError
  }

  // ยกเลิก assignment
  async function unassignSubstituteTeacher(leaveId, assignmentKey, slotData) {
    const termId = term()
    const { date, class_id, period_no } = slotData || {}

    // Clear teach_actual by exact slot coordinates (school+term+class+date+period)
    if (date && class_id && period_no) {
      await supabase
        .from('teach_actuals')
        .update({
          actual_teacher_id: null,
          is_substitute_mandatory: false,
          leave_request_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('school_id', authStore.schoolId)
        .eq('term_id', termId)
        .eq('class_id', class_id)
        .eq('date', normalizeDateKey(date))
        .eq('period_number', Number(period_no))
    }

    // Update leave_request.assignments
    const { data: lr, error: lrFetchError } = await supabase
      .from('leave_requests')
      .select('assignments')
      .eq('id', leaveId)
      .single()
    if (lrFetchError) throw lrFetchError

    const assignments = { ...(lr.assignments || {}) }
    assignments[assignmentKey] = {
      ...(assignments[assignmentKey] || {}),
      sub_teacher_id: null,
      sub_teacher_name: null,
      assigned_by: null,
      assigned_by_name: null,
      assigned_at: null,
      status: 'unassigned',
    }

    const { error: lrUpdateError } = await supabase
      .from('leave_requests')
      .update({ assignments, updated_at: new Date().toISOString() })
      .eq('id', leaveId)
    if (lrUpdateError) throw lrUpdateError
  }

  // ═════════════════════════════════════════════════════════════════════════
  // REAL-TIME LISTENERS (Supabase Realtime)
  // ═════════════════════════════════════════════════════════════════════════
  function listenTimetable(callback) {
    let latestData = []
    const fetchAll = async () => {
      try {
        const { data } = await supabase
          .from('timetable_slots')
          .select('*')
          .eq('term_id', term())
        latestData = (data || []).map(mapTimetableSlot)
        callback(latestData)
      } catch (e) {
        console.warn('listenTimetable fetch error:', e)
      }
    }
    fetchAll()

    const channel = supabase
      .channel(`timetable_slots_${term()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timetable_slots',
          filter: `term_id=eq.${term()}`,
        },
        () => fetchAll()
      )
      .subscribe()

    // Return unsubscribe function matching Firestore onSnapshot return shape
    return () => supabase.removeChannel(channel)
  }

  // listenTeachingLog subscribes to a single teach_actual row by UUID
  function listenTeachingLog(logId, callback) {
    // Initial fetch
    supabase
      .from('teach_actuals')
      .select('*')
      .eq('id', logId)
      .maybeSingle()
      .then(({ data }) => callback(data ? { ...mapTeachActual(data), log_id: data.id } : null))
      .catch(e => console.warn('listenTeachingLog initial fetch error:', e))

    const channel = supabase
      .channel(`teach_actual_${logId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teach_actuals',
          filter: `id=eq.${logId}`,
        },
        payload => {
          const row = payload.new || payload.old
          callback(row ? { ...mapTeachActual(row), log_id: row.id } : null)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  // Realtime subscription for leave_requests
  function subscribeLeaveRequests(onData, onError) {
    const fetchAll = async () => {
      try {
        const rows = await getLeaveRequests()
        onData(rows)
      } catch (e) {
        if (onError) onError(e)
      }
    }
    fetchAll()

    const channel = supabase
      .channel(`leave_requests_${term()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
          filter: `term_id=eq.${term()}`,
        },
        () => fetchAll()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC EXPORTS
  // ═════════════════════════════════════════════════════════════════════════
  return {
    getAuditFields,
    // Teachers
    getTeachers,
    saveTeacher,
    deleteTeacher,
    // Subjects
    getSubjects,
    saveSubject,
    deleteSubject,
    // Classes
    getClasses,
    saveClass,
    deleteClass,
    // Students
    getStudents,
    saveStudent,
    // Attendance status settings
    getAttendanceStatuses,
    saveAttendanceStatus,
    // Behavior settings
    getBehaviorSettings,
    saveBehaviorSetting,
    // Teaching assignments (timetable_slots)
    getTeachingAssignments,
    saveTeachingAssignment,
    deleteTeachingAssignment,
    // Timetable
    getTimetable,
    getPublishedTimetableSlots,
    saveTimetableSlot,
    saveTimetableBatch,
    // Teaching logs (alias → teach_actuals)
    getTeachingLogs,
    getTeachingLog,
    // Behavior
    getBehaviorSummary,
    getBehaviorLogs,
    // Activity bookings
    getActivityBookings,
    saveActivityBooking,
    deleteActivityBooking,
    // Rooms
    getRooms,
    getRoomCatalog,
    rebuildRoomCatalog,
    saveRoom,
    deleteRoom,
    // Teach actuals
    getTeachActuals,
    getTeachActualsRange,
    getUnfilledTeachActuals,
    getTeachActualsRangeByClass,
    generateTeachActualsForDate,
    saveTeachActual,
    encodeTeachActualId,
    // Homeroom
    getHomeroomClass,
    // Attendance daily summary
    getAttendanceDailySummary,
    saveAttendanceDailySummary,
    // Leave requests
    filterSlotsForTeacherOnDate,
    getThaiDayFromDate,
    createLeaveRequest,
    getLeaveRequests,
    cancelLeaveRequest,
    assignSubstituteTeacher,
    unassignSubstituteTeacher,
    // Realtime
    listenTimetable,
    listenTeachingLog,
    subscribeLeaveRequests,
    // School settings helpers (exposed for views that need direct settings access)
    getSchoolSettings,
    updateSchoolSettings,
  }
}
