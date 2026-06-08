// src/composables/useTimetable.js
// Logic หลักของระบบจัดตารางสอน
import { ref, computed } from 'vue'
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  writeBatch, query, where, serverTimestamp
} from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

export function useTimetable() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const db = () => getSchoolDb()
  const batchDb = () => db().firestore || db()
  const term = () => schoolStore.currentTerm || '2568_1'

  // ===== Constants =====
  // Master list — ครอบคลุมทุกวันที่เป็นไปได้ (ค่า value ตรงกับ day_of_week ในระบบ)
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
    if (!selected || !selected.length) return ALL_DAYS.slice(0, 5) // default จ-ศ
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
    // fallback defaults
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
      updated_at: serverTimestamp()
    }
  }

  // ===== โหลดข้อมูล =====
  async function loadTimetable() {
    loading.value = true
    try {
      const snap = await getDocs(collection(db(), `terms/${term()}/timetable_grid`))
      const grid = {}
      snap.docs.forEach(d => { grid[d.id] = { id: d.id, ...d.data() } })
      timetableGrid.value = grid
    } finally {
      loading.value = false
    }
  }

  async function loadAssignments() {
    const snap = await getDocs(collection(db(), `terms/${term()}/teaching_assignments`))
    assignments.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  async function loadActivities() {
    const snap = await getDocs(collection(db(), `terms/${term()}/activity_booking`))
    activities.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // ===== ดึง Grid ต่อห้อง =====
  function getClassGrid(classId) {
    // return grid[day][period] = slot | null
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

      // ครูสอนซ้ำ
      if (slot.teacher_id === teacherId && teacherId) {
        conflicts.push({
          type: 'teacher_conflict',
          message: `ครูสอนซ้ำในคาบที่ ${period} วัน${DAYS.value.find(d => d.value === day)?.label}`,
          slot
        })
      }

      // ห้องเรียนซ้ำ
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
      if (act.day !== day) return
      const periods = Array.from(
        { length: act.duration_periods },
        (_, i) => act.start_period + i
      )
      if (periods.includes(period)) {
        if (act.target_classes.includes(classId)) {
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
    // ตรวจว่า count คาบติดกันบน day เดิมว่างหรือไม่
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

    // ตรวจ conflict
    const conflicts = checkConflicts(day, period, assignment.teacher_id, classId, slotId)
    const hardConflicts = conflicts.filter(c => c.type !== 'teacher_conflict' || true)
    if (hardConflicts.length > 0) {
      return { success: false, conflicts: hardConflicts }
    }

    const slotData = {
      slot_id: slotId,
      day,
      period,
      class_id: classId,
      type: 'subject',
      ref_id: assignment.assign_id,
      assign_id: assignment.assign_id,
      subject_code: assignment.subject_code,
      subject_name: assignment.subject_name,
      teacher_id: assignment.teacher_id,
      teacher_name: assignment.teacher_name,
      preferred_room: assignment.preferred_room || '',
      group_id: groupId || slotId,
      is_locked: false,
      ...audit()
    }

    await setDoc(doc(db(), `terms/${term()}/timetable_grid`, slotId), slotData)
    timetableGrid.value[slotId] = { id: slotId, ...slotData }
    return { success: true }
  }

  // ===== วางวิชา Consecutive หลายคาบ =====
  async function placeConsecutiveSlots({ day, startPeriod, count, classId, assignment }) {
    // ตรวจก่อน
    const errors = checkConsecutive(day, startPeriod, count, classId, assignment.teacher_id)
    if (errors.length > 0) {
      return { success: false, errors }
    }

    const groupId = `group_${assignment.assign_id}_${day}_${startPeriod}`
    const batch = writeBatch(batchDb())

    for (let i = 0; i < count; i++) {
      const period = startPeriod + i
      const slotId = `${day}_${period}_${classId}`
      const slotData = {
        slot_id: slotId,
        day,
        period,
        class_id: classId,
        type: 'subject',
        ref_id: assignment.assign_id,
        assign_id: assignment.assign_id,
        subject_code: assignment.subject_code,
        subject_name: assignment.subject_name,
        teacher_id: assignment.teacher_id,
        teacher_name: assignment.teacher_name,
        preferred_room: assignment.preferred_room || '',
        group_id: groupId,
        is_locked: false,
        ...audit()
      }
      batch.set(doc(db(), `terms/${term()}/timetable_grid`, slotId), slotData)
      timetableGrid.value[slotId] = { id: slotId, ...slotData }
    }

    await batch.commit()
    return { success: true, groupId }
  }

  // ===== ลบ Slot (ถ้า consecutive ลบทั้ง group) =====
  async function removeSlot(slotId, removeGroup = false) {
    const slot = timetableGrid.value[slotId]
    if (!slot) return

    if (removeGroup && slot.group_id) {
      // ลบทั้ง group
      const groupSlots = Object.values(timetableGrid.value)
        .filter(s => s.group_id === slot.group_id)
      const batch = writeBatch(batchDb())
      groupSlots.forEach(s => {
        batch.delete(doc(db(), `terms/${term()}/timetable_grid`, s.id))
        delete timetableGrid.value[s.id]
      })
      await batch.commit()
    } else {
      await deleteDoc(doc(db(), `terms/${term()}/timetable_grid`, slotId))
      delete timetableGrid.value[slotId]
    }
  }

  // ===== Lock กิจกรรม =====
  async function lockActivitySlots(activity) {
    const batch = writeBatch(batchDb())
    activity.target_classes.forEach(classId => {
      for (let p = activity.start_period; p < activity.start_period + activity.duration_periods; p++) {
        const slotId = `${activity.day}_${p}_${classId}`
        const slotData = {
          slot_id: slotId,
          day: activity.day,
          period: p,
          class_id: classId,
          type: 'activity',
          ref_id: activity.act_id,
          act_id: activity.act_id,
          act_name: activity.name,
          group_id: `act_${activity.act_id}_${p}`,
          is_locked: true,
          ...audit()
        }
        batch.set(doc(db(), `terms/${term()}/timetable_grid`, slotId), slotData)
        timetableGrid.value[slotId] = { id: slotId, ...slotData }
      }
    })
    await batch.commit()
  }

  // ===== สถิติ Assignment =====
  function getAssignmentStats(assignId) {
    const slots = Object.values(timetableGrid.value)
      .filter(s => s.assign_id === assignId && s.type === 'subject')
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
