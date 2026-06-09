// src/composables/useSchoolDb.js
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch, FieldPath
} from '@/supabase/firestore'
import { getSchoolDb } from '@/supabase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { supabase } from '@/supabase/client'

// Day mapping: Thai day name to numeric value (1-7: Mon-Sun)
const THAI_DAY_TO_NUMBER = {
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 7,
}

function normalizeDateKey(input) {
  if (typeof input === 'string') return input
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().split('T')[0]
  }
  // รองรับ object วันที่จาก UI libs (เช่น dayjs) ที่มี format()
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

export function useSchoolDb() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()

  function getAuditFields() {
    return {
      updated_by: authStore.profile?.uid || 'system',
      updated_by_name: authStore.profile?.displayName || 'ระบบ',
      updated_at: serverTimestamp()
    }
  }

  const db = () => getSchoolDb()
  const batchDb = () => db().firestore || db()
  const term = () => schoolStore.currentTerm || '2568_1'

  async function syncCompatTeacherDoc(teacher) {
    if (!teacher?.teacher_id) return
    await setDoc(
      doc(db(), `terms/${term()}/teachers`, teacher.teacher_id),
      {
        teacher_id: teacher.teacher_id,
        prefix: teacher.prefix || '',
        name: teacher.name || '',
        surname: teacher.surname || '',
        academic_rank: teacher.academic_rank || '',
        dept: teacher.dept || teacher.department || '',
        department: teacher.dept || teacher.department || '',
        position: teacher.position || '',
        is_dept_head: teacher.is_dept_head === true,
        email: teacher.email || '',
        phone: teacher.phone || '',
        is_active: teacher.is_active !== false,
        ...getAuditFields()
      },
      { merge: true }
    )
  }

  // ===== TEACHERS =====
  async function getTeachers() {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('first_name', { ascending: true })
      
    if (error) throw error
    
    // Map SQL format กลับไปเป็นรูปแบบที่ Frontend ใช้
    return data.map(d => ({
      ...d,
      id: d.id,
      teacher_id: d.teacher_code,
      name: d.first_name,
      surname: d.last_name,
      dept: d.department || d.dept || '',
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

    if (teacher.id && teacher.id.includes('-')) { // เช็คว่าเป็น UUID ของ Supabase แล้วหรือยัง
      const { error } = await supabase.from('teachers').update(payload).eq('id', teacher.id)
      if (error) throw error
      return teacher.id
    } else {
      const { data, error } = await supabase.from('teachers').insert([payload]).select().single()
      if (error) throw error
      return data.id
    }
  }

  async function deleteTeacher(id) {
    if (!id || !id.includes('-')) return // ป้องกันการส่งค่า ID เก่า (Firebase) มาใช้ลบ
    const { error } = await supabase.from('teachers').delete().eq('id', id)
    if (error) throw error
  }

  // ===== SUBJECTS =====
  async function getSubjects() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('subject_code')
      
    if (error) throw error
    return data.map(d => ({ id: d.id, ...d }))
  }

  async function saveSubject(subject) {
    const payload = {
      school_id: authStore.schoolId,
      subject_code: subject.subject_code,
      name: subject.name,
    }

    if (subject.id && subject.id.includes('-')) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', subject.id)
      if (error) throw error
      return subject.id
    } else {
      const { data, error } = await supabase.from('subjects').insert([payload]).select().single()
      if (error) throw error
      return data.id
    }
  }

  async function deleteSubject(id) {
    if (!id || !id.includes('-')) return
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) throw error
  }

  // ===== CLASSES =====
  function encodeClassId(classId) {
    return (classId || '').replace(/\//g, '_')
  }

  async function getClasses() {
    if (!authStore.schoolId || authStore.schoolId === 'undefined') return []
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('class_name')
      
    if (error) throw error
    return data.map(d => ({ 
      ...d,
      id: d.id, 
      class_id: d.class_name // Map กลับไปให้ตรงกับชื่อ field เก่าที่ Frontend ใช้
    }))
  }

  async function saveClass(cls) {
    const payload = {
      school_id: authStore.schoolId,
      class_name: cls.class_id,
      homeroom_teacher_id: cls.homeroom_teacher_id || null
    }

    if (cls.id && cls.id.includes('-')) {
      const { error } = await supabase.from('classes').update(payload).eq('id', cls.id)
      if (error) throw error
      return cls.id
    } else {
      const { data, error } = await supabase.from('classes').insert([payload]).select().single()
      if (error) throw error
      return data.id
    }
  }

  async function deleteClass(classId) {
    // เนื่องจาก UI ส่ง `class_id` หรือ `id` มา เราต้องเช็คเพื่อลบด้วย UUID ถ้ามี
    // ฟังก์ชันนี้ใน UI เดิมอาจจะลบผ่าน classId ตรงๆ (ม.1/1)
    const { data } = await supabase.from('classes').select('id').eq('school_id', authStore.schoolId).eq('class_name', classId).single()
    if (data && data.id) {
      await supabase.from('classes').delete().eq('id', data.id)
    }
  }

  // ===== STUDENTS =====
  async function getStudents(classId = null) {
    let query = supabase
      .from('students')
      .select('*')
      .eq('school_id', authStore.schoolId)

    if (classId) {
      query = query.eq('class_id', classId)
    } else {
      query = query.order('class_id')
    }
    
    const { data, error } = await query
    if (error) throw error
    
    let results = data.map(d => ({ 
      ...d, 
      id: d.id,
      student_id: d.student_code,
      name: d.first_name,
      surname: d.last_name,
      student_status: d.status
    }))
    
    if (classId) {
      results.sort((a, b) => {
        const numA = parseInt(a.seat_number, 10); const valA = isNaN(numA) ? 999 : numA
        const numB = parseInt(b.seat_number, 10); const valB = isNaN(numB) ? 999 : numB
        return valA - valB
      })
    }
    return results
  }

  async function saveStudent(student) {
    const payload = {
      school_id: authStore.schoolId,
      class_id: student.class_id || null, // Note: In full refactor, this should map to class UUID
      student_code: student.student_id,
      seat_number: student.seat_number,
      prefix: student.prefix,
      first_name: student.name,
      last_name: student.surname,
      gender: student.gender,
      status: student.student_status || 'เรียนอยู่',
      total_behavior_score: student.total_behavior_score ?? 100,
      attendance_behavior_score: student.attendance_behavior_score ?? 0,
      learning_behavior_score: student.learning_behavior_score ?? 0,
      photo_url: student.photo_url || null
    }

    if (student.id && student.id.includes('-')) {
      const { error } = await supabase.from('students').update(payload).eq('id', student.id)
      if (error) throw error
      return student.id
    } else {
      const { data, error } = await supabase.from('students').insert([payload]).select().single()
      if (error) throw error
      return data.id
    }
  }

  // ===== ATTENDANCE STATUS SETTINGS =====
  async function getAttendanceStatuses() {
    const snap = await getDocs(
      query(
        collection(db(), `terms/${term()}/attendance_status_settings`),
        where('is_active', '==', true),
        orderBy('sort_order')
      )
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  async function saveAttendanceStatus(status) {
    const id = status.status_code
    await setDoc(
      doc(db(), `terms/${term()}/attendance_status_settings`, id),
      { ...status, ...getAuditFields() },
      { merge: true }
    )
  }

  // ===== BEHAVIOR SETTINGS =====
  // Load all without composite index; filter/sort in memory
  async function getBehaviorSettings(type = null) {
    const snap = await getDocs(collection(db(), `terms/${term()}/behavior_settings`))
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (type) {
      items = items.filter(s => s.behavior_type === type && s.is_active !== false)
    }
    return items.sort((a, b) => (a.behavior_type || '').localeCompare(b.behavior_type || ''))
  }

  // ===== TEACHING ASSIGNMENTS =====
  async function getTeachingAssignments() {
    const snap = await getDocs(
      collection(db(), `terms/${term()}/teaching_assignments`)
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  async function saveTeachingAssignment(assignment) {
    const id = assignment.assign_id
    await setDoc(
      doc(db(), `terms/${term()}/teaching_assignments`, id),
      { ...assignment, ...getAuditFields() },
      { merge: true }
    )
  }

  // ===== TIMETABLE =====
  async function getTimetable() {
    const snap = await getDocs(
      collection(db(), `terms/${term()}/timetable_grid`)
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // Get timetable slots from published snapshot (publish-only source)
  async function getPublishedTimetableSlots() {
    try {
      // Check if timetable is published
      const schoolInfoSnap = await getDoc(doc(getSchoolDb(), 'school_info', 'main'))
      const publishStatus = schoolInfoSnap.exists() ? schoolInfoSnap.data()?.timetable_publish?.status : null
      if (publishStatus !== 'published') {
        throw new Error('ตารางสอนยังไม่พร้อมใช้งาน กรุณารอให้ผู้บริหารอนุมัติก่อน')
      }
      // Fetch published snapshot
      const snapshotDoc = await getDoc(
        doc(getSchoolDb(), 'public_timetable_snapshots', 'current')
      )
      if (!snapshotDoc.exists()) {
        throw new Error('ไม่พบสแนปชอตตารางสอน')
      }
      const data = snapshotDoc.data()
      return data.timetable || []
    } catch (e) {
      throw new Error(`โหลดตารางสอนล้มเหลว: ${e.message}`)
    }
  }

  async function saveTimetableSlot(slot) {
    const id = `${slot.day}_${slot.period}_${slot.class_id}`
    await setDoc(
      doc(db(), `terms/${term()}/timetable_grid`, id),
      { ...slot, slot_id: id, ...getAuditFields() },
      { merge: true }
    )
  }

  // Save หลาย slots พร้อมกัน (Batch)
  async function saveTimetableBatch(slots) {
    const batch = writeBatch(batchDb())
    slots.forEach(slot => {
      const id = `${slot.day}_${slot.period}_${slot.class_id}`
      batch.set(
        doc(db(), `terms/${term()}/timetable_grid`, id),
        { ...slot, slot_id: id, ...getAuditFields() },
        { merge: true }
      )
    })
    await batch.commit()
  }

  // ===== TEACHING LOGS =====
  async function getTeachingLogs(date, classId = null, teacherId = null) {
    const filters = [where('date', '==', date)]
    if (classId) {
      filters.push(where('class_id', '==', classId))
    }
    if (teacherId) {
      filters.push(where('teacher_id_snapshot', '==', teacherId))
    }
    const q = query(collection(db(), `terms/${term()}/teaching_logs`), ...filters)
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  async function getTeachingLog(logId) {
    const snap = await getDoc(doc(db(), `terms/${term()}/teaching_logs`, logId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  }

  // ===== BEHAVIOR SUMMARY =====
  async function getBehaviorSummary(studentId) {
    const snap = await getDoc(
      doc(db(), `terms/${term()}/behavior_summary`, studentId)
    )
    return snap.exists() ? snap.data() : {
      total_score: 0,
      general_score: 0,
      attendance_score: 0,
      learning_score: 0,
      general_score_init: 0,
      attendance_score_init: 0,
      learning_score_init: 0,
    }
  }

  // ===== BEHAVIOR LOGS =====
  async function getBehaviorLogs({ studentId, classId, type, startDate, endDate } = {}) {
    let q = collection(db(), `terms/${term()}/behavior_logs`)
    const conditions = []
    if (studentId) conditions.push(where('student_id', '==', studentId))
    if (classId)   conditions.push(where('class_id', '==', classId))
    if (type)      conditions.push(where('behavior_type', '==', type))
    if (startDate) conditions.push(where('date', '>=', startDate))
    if (endDate)   conditions.push(where('date', '<=', endDate))
    conditions.push(orderBy('date', 'desc'))
    q = query(q, ...conditions)
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // ===== ACTIVITY BOOKING =====
  async function getActivityBookings() {
    const snap = await getDocs(
      collection(db(), `terms/${term()}/activity_booking`)
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // ===== ROOMS =====
  async function getRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('room_code')
      
    if (error) throw error
    return data.map(d => ({ 
      ...d,
      id: d.id,
      room_id: d.room_code,
      room_name: d.room_name,
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
    await setDoc(
      doc(db(), `terms/${term()}/lookups`, 'room_catalog'),
      { ...catalog, ...getAuditFields() },
      { merge: true }
    )
    return catalog
  }

  async function getRoomCatalog() {
    const ref = doc(db(), `terms/${term()}/lookups`, 'room_catalog')
    const snap = await getDoc(ref)
    if (snap.exists()) return snap.data()
    return rebuildRoomCatalog()
  }

  async function saveRoom(room) {
    const payload = {
      school_id: authStore.schoolId,
      room_code: room.room_id,
      room_name: room.room_name,
      room_type: room.room_type || 'other',
      capacity: room.capacity || null,
      is_active: room.is_active !== false
    }

    let savedId = room.id
    if (room.id && room.id.includes('-')) {
      const { error } = await supabase.from('rooms').update(payload).eq('id', room.id)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('rooms').insert([payload]).select().single()
      if (error) throw error
      savedId = data.id
    }
    
    try {
      await rebuildRoomCatalog()
    } catch (e) {
      console.warn('rebuildRoomCatalog failed:', e)
    }
    return savedId
  }

  async function deleteRoom(roomId) {
    if (!roomId) return
    const { data } = await supabase.from('rooms').select('id').eq('school_id', authStore.schoolId).eq('room_code', roomId).single()
    if (data && data.id) {
      await supabase.from('rooms').delete().eq('id', data.id)
    }
    
    try {
      await rebuildRoomCatalog()
    } catch (e) {
      console.warn('rebuildRoomCatalog failed:', e)
    }
  }

  // ===== TEACH ACTUAL (บันทึกการสอนล่วงหน้า) =====
  function encodeTeachActualId(date, classId, period) {
    const encodedClass = (classId || '').replace(/\//g, '_')
    return `${date}_${encodedClass}_${period}`
  }

  // ดึง teach_actual รายวัน — รวมคาบที่สอนแทน (subject_actual_teacher_id)
  async function getTeachActuals(date, teacherPlanId = null) {
    const dateKey = normalizeDateKey(date)
    if (!teacherPlanId) {
      const snap = await getDocs(query(
        collection(db(), `terms/${term()}/teach_actual`),
        where('date', '==', dateKey)
      ))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.period || 0) - (b.period || 0))
    }
    // สองคิวรี่ขนานกัน: คาบของตัวเอง + คาบที่สอนแทน
    const [snap1, snap2] = await Promise.all([
      getDocs(query(
        collection(db(), `terms/${term()}/teach_actual`),
        where('date', '==', dateKey),
        where('teacher_plan_id', '==', teacherPlanId)
      )),
      getDocs(query(
        collection(db(), `terms/${term()}/teach_actual`),
        where('date', '==', dateKey),
        where('subject_actual_teacher_id', '==', teacherPlanId)
      )),
    ])
    const seen = new Set()
    const items = []
    // snap1: คาบของตัวเอง — ยกเว้นคาบที่มอบให้ครูสอนแทนแล้ว (is_substitute_mandatory)
    for (const d of snap1.docs) {
      const data = { id: d.id, ...d.data() }
      if (!data.is_substitute_mandatory) {
        seen.add(d.id)
        items.push(data)
      }
    }
    // snap2: คาบที่ teacher คนนี้รับสอนแทน — เพิ่มเสมอ (dedup)
    for (const d of snap2.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        items.push({ id: d.id, ...d.data() })
      }
    }
    return items.sort((a, b) => (a.period || 0) - (b.period || 0))
  }

  // ดึงช่วงวันที่ (สำหรับรายงาน)
  async function getTeachActualsRange(startDate, endDate) {
    const startKey = normalizeDateKey(startDate)
    const endKey = normalizeDateKey(endDate)
    const q = query(
      collection(db(), `terms/${term()}/teach_actual`),
      where('date', '>=', startKey),
      where('date', '<=', endKey),
      orderBy('date')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // สร้าง teach_actual จาก timetable สำหรับวันที่กำหนด
  async function generateTeachActualsForDate(date, dayName, timetableSlots) {
    const dateKey = normalizeDateKey(date)
    const dayNumber = THAI_DAY_TO_NUMBER[dayName]
    if (!dayNumber) throw new Error(`วันที่ไม่รู้จัก: ${dayName}`)

    // กรองเฉพาะคาบสอนจริง — ข้ามคาบกิจกรรม (type === 'activity')
    const slotsForDay = (Array.isArray(timetableSlots) ? timetableSlots : [])
      .filter(s => {
        if (s?.type === 'activity') return false
        if (s?.day === dayName) return true
        return normalizeDayNumber(s?.day) === dayNumber
      })

    // โหลด homeroom_special_periods และ classes ขนานกัน
    const [schoolInfoSnap, classesSnap] = await Promise.all([
      getDoc(doc(db(), 'school_info', 'main')),
      getDocs(query(collection(db(), `terms/${term()}/classes`), orderBy('class_id'))),
    ])
    const homeroomPeriods = Array.isArray(schoolInfoSnap.data()?.homeroom_special_periods)
      ? schoolInfoSnap.data().homeroom_special_periods
      : []
    const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const batch = writeBatch(batchDb())
    let created = 0

    // ── คาบสอนปกติจากตาราง ──────────────────────────────────────────
    for (const slot of slotsForDay) {
      const period = Number(slot?.period)
      if (!Number.isFinite(period)) continue
      const classId = asText(slot?.class_id)
      if (!classId) continue

      const id = encodeTeachActualId(dateKey, classId, period)
      batch.set(doc(db(), `terms/${term()}/teach_actual`, id), {
        teach_actual_id: id,
        date: dateKey,
        class_id: classId,
        class_name: asText(slot?.class_name || slot?.class_name_snapshot || classId),
        day_of_week: asText(dayName),
        period,
        subject_plan_id: asText(slot?.subject_code || slot?.subject_code_snapshot),
        subject_name: asText(slot?.subject_name || slot?.subject_name_snapshot),
        teacher_plan_id: asText(slot?.teacher_id || slot?.teacher_id_snapshot),
        teacher_plan_name: asText(slot?.teacher_name || slot?.teacher_name_snapshot),
        generated_at: serverTimestamp(),
      }, { merge: true })
      created += 1
    }

    // ── คาบพิเศษสำหรับครูที่ปรึกษา ──────────────────────────────────
    for (const cls of classes) {
      if (!cls.homeroom_teacher_id) continue
      for (const hp of homeroomPeriods) {
        const period = Number(hp.period)
        if (!Number.isFinite(period)) continue
        // days: ['all'] หรือ ['จันทร์','อังคาร',...] หรือ [] = ทุกวัน
        const days = Array.isArray(hp.days) ? hp.days : []
        const appliesToday = !days.length || days.includes('all') || days.includes(dayName)
        if (!appliesToday) continue

        const classId = asText(cls.class_id)
        if (!classId) continue
        // ID แบบพิเศษ (hr) เพื่อไม่ชนกับคาบสอนปกติ
        const id = `${dateKey}_${classId.replace(/\//g, '_')}_hr${period}`
        batch.set(doc(db(), `terms/${term()}/teach_actual`, id), {
          teach_actual_id: id,
          date: dateKey,
          class_id: classId,
          class_name: asText(cls.class_name || classId),
          day_of_week: asText(dayName),
          period,
          subject_plan_id: '',
          subject_name: asText(hp.name),
          teacher_plan_id: asText(cls.homeroom_teacher_id),
          teacher_plan_name: asText(cls.homeroom_teacher_name_snapshot || cls.homeroom_teacher_id),
          slot_type: 'homeroom',
          generated_at: serverTimestamp(),
        }, { merge: true })
        created += 1
      }
    }

    if (created === 0) return 0
    await batch.commit()
    return created
  }

  // บันทึก/อัพเดต teach_actual (ครูกรอก)
  async function saveTeachActual(data) {
    const id = data.teach_actual_id
    if (!id) throw new Error('teach_actual_id ไม่ถูกต้อง')
    await setDoc(
      doc(db(), `terms/${term()}/teach_actual`, id),
      { ...data, ...getAuditFields() },
      { merge: true }
    )
  }

  // ===== HOMEROOM CLASS =====
  async function getHomeroomClass(teacherId) {
    const snap = await getDocs(collection(db(), `terms/${term()}/classes`))
    const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const hrClass = classes.find(c => 
      c.homeroom_teacher_id === teacherId || 
      (Array.isArray(c.homeroom_teacher_ids) && c.homeroom_teacher_ids.includes(teacherId))
    )
    return hrClass || null
  }

  // ===== ATTENDANCE DAILY CLASS (ครูประจำชั้น เช็คชื่อรายวัน) =====
  function encodeAttendanceDailyId(date, classId) {
    return `${date}_${(classId || '').replace(/\//g, '_')}`
  }

  async function getAttendanceDailySummary(date, classId) {
    const id = encodeAttendanceDailyId(date, classId)
    const snap = await getDoc(doc(db(), `terms/${term()}/attendance_daily_class`, id))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  }

  async function saveAttendanceDailySummary(date, classId, data) {
    const id = encodeAttendanceDailyId(date, classId)
    await setDoc(doc(db(), `terms/${term()}/attendance_daily_class`, id), {
      ...data,
      date,
      class_id: classId,
      ...getAuditFields()
    }, { merge: true })
  }

  // ดึง teach_actual ช่วงวันที่ กรองห้องใน memory (ประหยัด index)
  async function getTeachActualsRangeByClass(startDate, endDate, classId = null) {
    const startKey = normalizeDateKey(startDate)
    const endKey = normalizeDateKey(endDate)
    const q = query(
      collection(db(), `terms/${term()}/teach_actual`),
      where('date', '>=', startKey),
      where('date', '<=', endKey),
      orderBy('date')
    )
    const snap = await getDocs(q)
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (classId) items = items.filter(r => r.class_id === classId)
    return items
  }

  // ===== LEAVE REQUESTS =====
  const THAI_DAYS_ARR = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

  function getThaiDayFromDate(dateStr) {
    return THAI_DAYS_ARR[new Date(dateStr + 'T00:00:00').getDay()]
  }

  // กรองคาบสอนของครูคนนี้ในวันนั้นจากตาราง published
  function filterSlotsForTeacherOnDate(timetableSlots, teacherId, dateStr) {
    const thaiDay = getThaiDayFromDate(dateStr)
    return (timetableSlots || []).filter(s => {
      if (s?.type === 'activity') return false
      const dayMatch = s.day === thaiDay || String(s.day) === String(THAI_DAY_TO_NUMBER[thaiDay])
      const teacherMatch = (s.teacher_id || s.teacher_id_snapshot) === teacherId
      return dayMatch && teacherMatch
    })
  }

  // สร้างคำขอลา พร้อม assignments สำเร็จรูปจากตาราง
  async function createLeaveRequest(data, timetableSlots) {
    const leaveId = `lr_${data.teacher_id}_${Date.now()}`
    const assignments = {}
    for (const dateStr of (data.dates || [])) {
      const slots = filterSlotsForTeacherOnDate(timetableSlots, data.teacher_id, dateStr)
      for (const s of slots) {
        const classId = s.class_id || s.class_id_snapshot || ''
        const period   = Number(s.period)
        if (!classId || !period) continue
        const key = encodeTeachActualId(dateStr, classId, period)
        assignments[key] = {
          date: dateStr,
          period_no: period,
          class_id: classId,
          class_name: s.class_name || s.class_name_snapshot || classId,
          subject_name: s.subject_name || s.subject_name_snapshot || '',
          subject_plan_id: s.subject_code || s.subject_code_snapshot || '',
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
    const doc_ = {
      leave_id: leaveId,
      teacher_id: data.teacher_id,
      teacher_name: data.teacher_name,
      leave_type: data.leave_type || 'sick',
      dates: data.dates || [],
      note: data.note || '',
      status: 'pending',
      assignments,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }
    await setDoc(doc(db(), `terms/${term()}/leave_requests`, leaveId), doc_)
    return leaveId
  }

  async function getLeaveRequests({ teacherId, status } = {}) {
    const filters = []
    if (teacherId) filters.push(where('teacher_id', '==', teacherId))
    if (status)    filters.push(where('status', '==', status))
    const q = filters.length
      ? query(collection(db(), `terms/${term()}/leave_requests`), ...filters)
      : collection(db(), `terms/${term()}/leave_requests`)
    const snap = await getDocs(q)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
  }

  // Realtime subscription — ใช้ db()/term() เดียวกันกับ write functions
  function subscribeLeaveRequests(onData, onError) {
    const colRef = collection(db(), `terms/${term()}/leave_requests`)
    return onSnapshot(colRef,
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => onError && onError(err)
    )
  }

  async function cancelLeaveRequest(leaveId) {
    await updateDoc(doc(db(), `terms/${term()}/leave_requests`, leaveId), {
      status: 'cancelled', ...getAuditFields(),
    })
  }

  // จัดสอนแทน: บันทึก assignment + upsert teach_actual
  async function assignSubstituteTeacher(leaveId, assignmentKey, slotData, subTeacher, absentTeacher) {
    const { date, period_no, class_id, class_name, subject_name, subject_plan_id } = slotData
    const taId = encodeTeachActualId(date, class_id, period_no)
    const thaiDay = getThaiDayFromDate(date)

    // upsert teach_actual: สร้างถ้ายังไม่มี แล้วตั้งค่า sub
    await setDoc(doc(db(), `terms/${term()}/teach_actual`, taId), {
      teach_actual_id: taId,
      date,
      class_id,
      class_name,
      day_of_week: thaiDay,
      period: period_no,
      subject_plan_id: subject_plan_id || '',
      subject_name,
      teacher_plan_id: absentTeacher.teacher_id,
      teacher_plan_name: absentTeacher.teacher_name,
      subject_actual_teacher_id: subTeacher.teacher_id,
      sub_teacher_name: subTeacher.teacher_name,
      is_substitute_mandatory: true,
      leave_request_id: leaveId,
    }, { merge: true })

    // update assignment in leave_request — use FieldPath to avoid dot-notation
    // misparse when assignmentKey contains "." (e.g. "ม.4_1" from class_id "ม.4/1")
    const now = new Date()
    await updateDoc(doc(db(), `terms/${term()}/leave_requests`, leaveId),
      new FieldPath('assignments', assignmentKey, 'sub_teacher_id'), subTeacher.teacher_id,
      new FieldPath('assignments', assignmentKey, 'sub_teacher_name'), subTeacher.teacher_name,
      new FieldPath('assignments', assignmentKey, 'assigned_by'), authStore.profile?.uid || '',
      new FieldPath('assignments', assignmentKey, 'assigned_by_name'), authStore.profile?.displayName || '',
      new FieldPath('assignments', assignmentKey, 'assigned_at'), now,
      new FieldPath('assignments', assignmentKey, 'status'), 'assigned',
      'updated_at', serverTimestamp(),
    )
  }

  // ยกเลิก assignment
  async function unassignSubstituteTeacher(leaveId, assignmentKey, taId) {
    await setDoc(doc(db(), `terms/${term()}/teach_actual`, taId), {
      subject_actual_teacher_id: null,
      sub_teacher_name: null,
      is_substitute_mandatory: false,
      leave_request_id: null,
    }, { merge: true })
    await updateDoc(doc(db(), `terms/${term()}/leave_requests`, leaveId),
      new FieldPath('assignments', assignmentKey, 'sub_teacher_id'), null,
      new FieldPath('assignments', assignmentKey, 'sub_teacher_name'), null,
      new FieldPath('assignments', assignmentKey, 'assigned_by'), null,
      new FieldPath('assignments', assignmentKey, 'assigned_by_name'), null,
      new FieldPath('assignments', assignmentKey, 'assigned_at'), null,
      new FieldPath('assignments', assignmentKey, 'status'), 'unassigned',
      'updated_at', serverTimestamp(),
    )
  }

  // ===== REAL-TIME LISTENERS =====
  function listenTimetable(callback) {
    return onSnapshot(
      collection(db(), `terms/${term()}/timetable_grid`),
      (snap) => {
        const slots = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        callback(slots)
      }
    )
  }

  function listenTeachingLog(logId, callback) {
    return onSnapshot(
      doc(db(), `terms/${term()}/teaching_logs`, logId),
      (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    )
  }

  async function saveTeacherCompat(teacher) {
    const payload = {
      school_id: authStore.schoolId,
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
      const { data, error } = await supabase.from('teachers').insert([payload]).select().single()
      if (error) throw error
      savedId = data.id
    }

    await syncCompatTeacherDoc({
      ...teacher,
      id: savedId,
      dept: teacher.dept || teacher.department || '',
    })

    return savedId
  }

  async function deleteTeacherCompat(id) {
    if (!id) return

    let targetId = id
    let teacherCode = ''

    if (id.includes('-')) {
      const { data, error: lookupError } = await supabase
        .from('teachers')
        .select('id,teacher_code')
        .eq('id', id)
        .maybeSingle()
      if (lookupError) throw lookupError
      if (!data?.id) return
      targetId = data.id
      teacherCode = data.teacher_code || ''
    } else {
      const { data, error: lookupError } = await supabase
        .from('teachers')
        .select('id,teacher_code')
        .eq('school_id', authStore.schoolId)
        .eq('teacher_code', id)
        .maybeSingle()
      if (lookupError) throw lookupError
      if (!data?.id) return
      targetId = data.id
      teacherCode = data.teacher_code || id
    }

    const { error } = await supabase.from('teachers').delete().eq('id', targetId)
    if (error) throw error

    if (teacherCode) {
      await deleteDoc(doc(db(), `terms/${term()}/teachers`, teacherCode)).catch(() => {})
    }
  }

  return {
    getAuditFields,
    getTeachers, saveTeacher: saveTeacherCompat, deleteTeacher: deleteTeacherCompat,
    getSubjects, saveSubject, deleteSubject,
    getClasses, saveClass, deleteClass,
    getStudents, saveStudent,
    getAttendanceStatuses, saveAttendanceStatus,
    getBehaviorSettings,
    getTeachingAssignments, saveTeachingAssignment,
    getTimetable, getPublishedTimetableSlots, saveTimetableSlot, saveTimetableBatch,
    getTeachingLogs, getTeachingLog,
    getBehaviorSummary, getBehaviorLogs,
    getActivityBookings,
    listenTimetable, listenTeachingLog,
    getRooms, getRoomCatalog, rebuildRoomCatalog, saveRoom, deleteRoom,
    getTeachActuals, getTeachActualsRange, getTeachActualsRangeByClass,
    generateTeachActualsForDate, saveTeachActual, encodeTeachActualId,
    getHomeroomClass,
    getAttendanceDailySummary, saveAttendanceDailySummary,
    filterSlotsForTeacherOnDate, getThaiDayFromDate,
    createLeaveRequest, getLeaveRequests, cancelLeaveRequest,
    assignSubstituteTeacher, unassignSubstituteTeacher,
    subscribeLeaveRequests,
  }
}
