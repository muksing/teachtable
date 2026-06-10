// src/composables/useTimetable.js
// Logic หลักของระบบจัดตารางสอน
import { ref, computed } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

export function useTimetable() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const schoolId = () => authStore.schoolId
  const term = () => schoolStore.currentTerm || '2568_1'

  // ===== Constants =====
  const ALL_DAYS = [
    { value: 1, label: 'จันทร์',    short: 'จ'  },
    { value: 2, label: 'อังคาร',    short: 'อ'  },
    { value: 3, label: 'พุธ',       short: 'พ'  },
    { value: 4, label: 'พฤหัสบดี',  short: 'พฤ' },
    { value: 5, label: 'ศุกร์',     short: 'ศ'  },
    { value: 6, label: 'เสาร์',     short: 'ส'  },
    { value: 7, label: 'อาทิตย์',   short: 'อา' },
  ]

  // Dynamic — อ่านจาก school_days ในการตั้งค่าโรงเรียน
  const DAYS = computed(() => {
    const selected = schoolStore.schoolInfo?.school_days
    if (!selected || !selected.length) return ALL_DAYS.slice(0, 5)
    return ALL_DAYS.filter(d => selected.includes(d.label))
  })

  // Dynamic periods from school settings
  const PERIODS = computed(() => {
    const n = schoolStore.schoolInfo?.periods_per_day || 8
    return Array.from({ length: n }, (_, i) => i + 1)
  })

  // Dynamic period times from school settings
  const PERIOD_TIMES = computed(() => {
    const times = schoolStore.schoolInfo?.period_times
    if (times && times.length > 0) {
      const map = {}
      times.forEach(t => {
        if (t.period > 0) map[t.period] = `${t.start}–${t.end}`
      })
      return map
    }
    return {
      1: '08:30–09:20', 2: '09:20–10:10', 3: '10:10–11:00', 4: '11:00–11:50',
      5: '12:40–13:30', 6: '13:30–14:20', 7: '14:20–15:10', 8: '15:10–16:00'
    }
  })

  // ===== State =====
  const timetableGrid = ref({}) // key: `${day}_${period}_${class_id}`
  const assignments = ref([])
  const activities = ref([])
  const loading = ref(false)
  const saving = ref(false)

  // ===== Audit =====
  function audit() {
    return {
      updated_by: authStore.profile?.uid || 'system',
      updated_by_name: authStore.profile?.displayName || 'ระบบ',
      updated_at: new Date().toISOString()
    }
  }

  // ===== โหลดข้อมูล =====
  async function loadTimetable() {
    loading.value = true
    try {
      const sid = schoolId()
      const t = term()
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('school_id', sid)
        .eq('term_id', t)

      if (error) throw error

      const grid = {}
      ;(data || []).forEach(slot => {
        const key = `${slot.day_of_week}_${slot.period_number}_${slot.class_id}`
        // normalise to grid-friendly shape
        grid[key] = {
          id: key,
          _id: slot.id,
          day: slot.day_of_week,
          period: slot.period_number,
          class_id: slot.class_id,
          teacher_id: slot.teacher_id,
          subject_id: slot.subject_id,
          room_id: slot.room_id,
          slot_type: slot.slot_type,
          ...slot,
        }
      })
      timetableGrid.value = grid
    } finally {
      loading.value = false
    }
  }

  async function loadAssignments() {
    // timetable_slots doubles as assignments — load unique assign combos
    // If there is a separate assignments table in the project, load from there.
    // For now we derive from timetable_slots grouping.
    const sid = schoolId()
    const t = term()
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*, subjects(name, subject_code), teachers(first_name, last_name, teacher_code)')
      .eq('school_id', sid)
      .eq('term_id', t)

    if (error) throw error
    assignments.value = (data || []).map(s => ({
      id: s.id,
      assign_id: s.id,
      class_id: s.class_id,
      subject_code: s.subjects?.subject_code || '',
      subject_name: s.subjects?.name || '',
      teacher_id: s.teacher_id,
      teacher_name: s.teachers ? `${s.teachers.first_name || ''} ${s.teachers.last_name || ''}`.trim() : '',
      preferred_room: s.room_id || '',
      periods_per_week: 1,
      day_of_week: s.day_of_week,
      period_number: s.period_number,
    }))
  }

  async function loadActivities() {
    const sid = schoolId()
    const t = term()
    const { data, error } = await supabase
      .from('activity_bookings')
      .select('*')
      .eq('school_id', sid)
      .eq('term_id', t)

    if (error) throw error
    activities.value = (data || []).map(act => ({
      id: act.id,
      act_id: act.id,
      name: act.name,
      days: act.days,
      day: Array.isArray(act.days) ? act.days[0] : act.days,
      start_period: act.start_period,
      duration_periods: act.duration_periods,
      target_classes: act.target_classes || [],
      color: act.color,
    }))
  }

  // ===== ดึง Grid ต่อห้อง =====
  function getClassGrid(classId) {
    const grid = {}
    DAYS.value.forEach(d => {
      grid[d.value] = {}
      PERIODS.value.forEach(p => {
        const key = `${d.value}_${p}_${classId}`
        grid[d.value][p] = timetableGrid.value[key] || null
      })
    })
    return grid
  }

  // ===== ดึง Grid ต่อครู =====
  function getTeacherGrid(teacherId) {
    const grid = {}
    DAYS.value.forEach(d => {
      grid[d.value] = {}
      PERIODS.value.forEach(p => {
        grid[d.value][p] = []
        Object.values(timetableGrid.value).forEach(slot => {
          if (slot.day === d.value && slot.period === p && slot.teacher_id === teacherId) {
            grid[d.value][p].push(slot)
          }
        })
      })
    })
    return grid
  }

  // ===== Conflict Detection =====
  function checkConflicts(day, period, teacherId, classId, excludeSlotId = null) {
    const conflicts = []

    Object.values(timetableGrid.value).forEach(slot => {
      if (excludeSlotId && slot.id === excludeSlotId) return
      if (slot.day !== day || slot.period !== period) return

      if (slot.teacher_id === teacherId && teacherId) {
        conflicts.push({
          type: 'teacher_conflict',
          message: `ครูสอนซ้ำในคาบที่ ${period} วัน${DAYS.value.find(d => d.value === day)?.label}`,
          slot
        })
      }

      if (slot.class_id === classId && classId) {
        conflicts.push({
          type: 'class_conflict',
          message: `ห้อง ${classId} มีวิชาแล้วในคาบที่ ${period}`,
          slot
        })
      }
    })

    // ตรวจ Activity lock
    activities.value.forEach(act => {
      const actDays = Array.isArray(act.days) ? act.days : (act.day ? [act.day] : [])
      if (!actDays.includes(day)) return
      const periods = Array.from(
        { length: act.duration_periods },
        (_, i) => act.start_period + i
      )
      if (periods.includes(period)) {
        if ((act.target_classes || []).includes(classId)) {
          conflicts.push({
            type: 'activity_locked',
            message: `คาบนี้ถูก lock สำหรับ "${act.name}"`,
            slot: act
          })
        }
      }
    })

    return conflicts
  }

  // ===== ตรวจ Consecutive Periods =====
  function checkConsecutive(day, startPeriod, count, classId, teacherId, excludeSlotIds = []) {
    const errors = []
    for (let p = startPeriod; p < startPeriod + count; p++) {
      if (p > (PERIODS.value?.length || 8)) {
        errors.push(`คาบที่ ${p} เกิน ${PERIODS.value?.length || 8} คาบ/วัน`)
        continue
      }
      const key = `${day}_${p}_${classId}`
      const existing = timetableGrid.value[key]
      if (existing && !excludeSlotIds.includes(existing.id)) {
        errors.push(`คาบที่ ${p} ไม่ว่าง`)
      }
      const teacherConflict = Object.values(timetableGrid.value).find(s =>
        s.day === day && s.period === p &&
        s.teacher_id === teacherId &&
        !excludeSlotIds.includes(s.id)
      )
      if (teacherConflict) {
        errors.push(`ครูติดสอนคาบที่ ${p}`)
      }
    }
    return errors
  }

  // ===== วางวิชาลงตาราง (1 slot) =====
  async function placeSlot({ day, period, classId, assignment, groupId = null }) {
    const slotId = `${day}_${period}_${classId}`
    saving.value = true

    try {
      const conflicts = checkConflicts(day, period, assignment.teacher_id, classId, slotId)
      const hardConflicts = conflicts.filter(c => c.type !== 'teacher_conflict' || true)
      if (hardConflicts.length > 0) {
        return { success: false, conflicts: hardConflicts }
      }

      const sid = schoolId()
      const t = term()
      const auditFields = audit()

      const slotData = {
        term_id: t,
        class_id: classId,
        subject_id: assignment.subject_id || null,
        teacher_id: assignment.teacher_id || null,
        room_id: assignment.preferred_room || null,
        day_of_week: day,
        period_number: period,
        slot_type: 'subject',
        school_id: sid,
        updated_by: auditFields.updated_by,
        updated_at: auditFields.updated_at,
      }

      // Upsert by unique key (term_id, class_id, day_of_week, period_number)
      const { data, error } = await supabase
        .from('timetable_slots')
        .upsert(slotData, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
        .select()
        .single()

      if (error) throw error

      const localSlot = {
        id: slotId,
        _id: data.id,
        day: day,
        period: period,
        class_id: classId,
        teacher_id: assignment.teacher_id,
        subject_id: assignment.subject_id,
        preferred_room: assignment.preferred_room || '',
        subject_code: assignment.subject_code,
        subject_name: assignment.subject_name,
        teacher_name: assignment.teacher_name,
        group_id: groupId || slotId,
        is_locked: false,
        slot_type: 'subject',
        ...auditFields,
      }
      timetableGrid.value[slotId] = localSlot

      return { success: true }
    } finally {
      saving.value = false
    }
  }

  // ===== วางวิชา Consecutive หลายคาบ =====
  async function placeConsecutiveSlots({ day, startPeriod, count, classId, assignment }) {
    const errors = checkConsecutive(day, startPeriod, count, classId, assignment.teacher_id)
    if (errors.length > 0) {
      return { success: false, errors }
    }

    saving.value = true
    try {
      const groupId = `group_${assignment.assign_id}_${day}_${startPeriod}`
      const sid = schoolId()
      const t = term()
      const auditFields = audit()

      const rows = []
      for (let i = 0; i < count; i++) {
        const p = startPeriod + i
        rows.push({
          term_id: t,
          class_id: classId,
          subject_id: assignment.subject_id || null,
          teacher_id: assignment.teacher_id || null,
          room_id: assignment.preferred_room || null,
          day_of_week: day,
          period_number: p,
          slot_type: 'subject',
          school_id: sid,
          updated_by: auditFields.updated_by,
          updated_at: auditFields.updated_at,
        })
      }

      const { data, error } = await supabase
        .from('timetable_slots')
        .upsert(rows, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
        .select()

      if (error) throw error

      ;(data || []).forEach(slot => {
        const key = `${slot.day_of_week}_${slot.period_number}_${slot.class_id}`
        timetableGrid.value[key] = {
          id: key,
          _id: slot.id,
          day: slot.day_of_week,
          period: slot.period_number,
          class_id: classId,
          teacher_id: assignment.teacher_id,
          subject_id: assignment.subject_id,
          preferred_room: assignment.preferred_room || '',
          subject_code: assignment.subject_code,
          subject_name: assignment.subject_name,
          teacher_name: assignment.teacher_name,
          group_id: groupId,
          is_locked: false,
          slot_type: 'subject',
          ...auditFields,
        }
      })

      return { success: true, groupId }
    } finally {
      saving.value = false
    }
  }

  // ===== ลบ Slot (ถ้า consecutive ลบทั้ง group) =====
  async function removeSlot(slotId, removeGroup = false) {
    const slot = timetableGrid.value[slotId]
    if (!slot) return

    saving.value = true
    try {
      if (removeGroup && slot.group_id) {
        const groupSlots = Object.values(timetableGrid.value)
          .filter(s => s.group_id === slot.group_id)

        const ids = groupSlots.map(s => s._id).filter(Boolean)
        if (ids.length) {
          const { error } = await supabase.from('timetable_slots').delete().in('id', ids)
          if (error) throw error
        }
        groupSlots.forEach(s => { delete timetableGrid.value[s.id] })
      } else {
        if (slot._id) {
          const { error } = await supabase.from('timetable_slots').delete().eq('id', slot._id)
          if (error) throw error
        }
        delete timetableGrid.value[slotId]
      }
    } finally {
      saving.value = false
    }
  }

  // ===== Lock กิจกรรม =====
  async function lockActivitySlots(activity) {
    saving.value = true
    try {
      const sid = schoolId()
      const t = term()
      const auditFields = audit()
      const actDays = Array.isArray(activity.days) ? activity.days : (activity.day ? [activity.day] : [])

      const rows = []
      for (const dayVal of actDays) {
        for (const classId of (activity.target_classes || [])) {
          for (let p = activity.start_period; p < activity.start_period + activity.duration_periods; p++) {
            rows.push({
              term_id: t,
              class_id: classId,
              subject_id: null,
              teacher_id: null,
              room_id: null,
              day_of_week: dayVal,
              period_number: p,
              slot_type: 'activity',
              school_id: sid,
              updated_by: auditFields.updated_by,
              updated_at: auditFields.updated_at,
            })
          }
        }
      }

      if (!rows.length) return

      const { data, error } = await supabase
        .from('timetable_slots')
        .upsert(rows, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
        .select()

      if (error) throw error

      ;(data || []).forEach(slot => {
        const key = `${slot.day_of_week}_${slot.period_number}_${slot.class_id}`
        timetableGrid.value[key] = {
          id: key,
          _id: slot.id,
          day: slot.day_of_week,
          period: slot.period_number,
          class_id: slot.class_id,
          slot_type: 'activity',
          act_id: activity.id,
          act_name: activity.name,
          is_locked: true,
          ...auditFields,
        }
      })
    } finally {
      saving.value = false
    }
  }

  // ===== สถิติ Assignment =====
  function getAssignmentStats(assignId) {
    const slots = Object.values(timetableGrid.value)
      .filter(s => s.assign_id === assignId && s.slot_type === 'subject')
    return {
      placed: slots.length,
      slots
    }
  }

  // ===== คำนวณ remaining ต่อ assignment =====
  const assignmentProgress = computed(() => {
    return assignments.value.map(a => {
      const stats = getAssignmentStats(a.assign_id || a.id)
      return {
        ...a,
        placed: stats.placed,
        remaining: (a.periods_per_week || 0) - stats.placed,
        done: stats.placed >= (a.periods_per_week || 0)
      }
    })
  })

  // ===== สีวิชา =====
  const SUBJECT_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
  ]

  function getSubjectColor(subjectCode, index) {
    if (!subjectCode) return '#9CA3AF'
    const hash = subjectCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return SUBJECT_COLORS[hash % SUBJECT_COLORS.length]
  }

  return {
    // constants
    DAYS, PERIODS, PERIOD_TIMES,
    // state
    timetableGrid, assignments, activities, loading, saving,
    // load
    loadTimetable, loadAssignments, loadActivities,
    // grid helpers
    getClassGrid, getTeacherGrid,
    // validation
    checkConflicts, checkConsecutive,
    // mutations
    placeSlot, placeConsecutiveSlots, removeSlot, lockActivitySlots,
    // computed
    assignmentProgress,
    // utils
    getAssignmentStats, getSubjectColor
  }
}
