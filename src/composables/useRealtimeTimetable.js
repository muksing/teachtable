// src/composables/useRealtimeTimetable.js
// Real-time sync ตารางสอน ผ่าน Firestore onSnapshot
// รองรับผู้จัดหลายคนพร้อมกัน

import { ref, onUnmounted } from 'vue'
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, writeBatch } from '@/supabase/firestore'
import { getSchoolDb } from '@/supabase/db'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'

// safeId: แปลง / → - เพื่อใช้เป็น Firestore document ID (ห้ามมี slash)
function safeId(...parts) {
  return parts.map(p => String(p ?? '').replace(/\//g, '-')).join('_')
}

function normalizeScalar(value) {
  return value == null ? null : value
}

function buildSlotPayload(slot, overrides = {}) {
  const source = { ...slot, ...overrides }
  return {
    id: String(source.id ?? ''),
    day: Number(source.day),
    period: Number(source.period),
    class_id: normalizeScalar(source.class_id != null ? String(source.class_id) : null),
    teacher_id: normalizeScalar(source.teacher_id != null ? String(source.teacher_id) : null),
    teacher_name: normalizeScalar(source.teacher_name != null ? String(source.teacher_name) : null),
    preferred_room: normalizeScalar(source.preferred_room != null ? String(source.preferred_room) : null),
    assign_id: normalizeScalar(source.assign_id != null ? String(source.assign_id) : null),
    subject_code: normalizeScalar(source.subject_code != null ? String(source.subject_code) : null),
    subject_name: normalizeScalar(source.subject_name != null ? String(source.subject_name) : null),
    type: String(source.type || 'subject'),
    group_id: normalizeScalar(source.group_id != null ? String(source.group_id) : null),
    ref_id: normalizeScalar(source.ref_id != null ? String(source.ref_id) : null),
    act_id: normalizeScalar(source.act_id != null ? String(source.act_id) : null),
    act_name: normalizeScalar(source.act_name != null ? String(source.act_name) : null),
    name: normalizeScalar(source.name != null ? String(source.name) : null),
    lock_type: normalizeScalar(source.lock_type != null ? String(source.lock_type) : null),
    is_locked: Boolean(source.is_locked),
    is_coteach: Boolean(source.is_coteach),
  }
}

export function useRealtimeTimetable() {
  const schoolStore = useSchoolStore()
  const authStore = useAuthStore()
  const db = () => getSchoolDb()
  const batchDb = () => db().firestore || db()
  const term = () => schoolStore.currentTerm || '2568_1'

  // State
  const timetableSlots = ref([])   // array ของ slots ทั้งหมด
  const timetableMap = ref({})     // key: `${day}_${period}_${classId}` → slot
  const teacherMap = ref({})       // key: `${day}_${period}_${teacherId}` → slot
  const roomMap = ref({})          // key: `${day}_${period}_${roomId}` → slot
  const connected = ref(false)
  const lastUpdate = ref(null)

  let unsubGrid = null
  let unsubAct = null

  // ====================================================
  // subscribe: เริ่ม real-time listener
  // ====================================================
  function subscribe() {
    // Grid listener
    unsubGrid = onSnapshot(
      collection(db(), `terms/${term()}/timetable_grid`),
      (snap) => {
        const slots = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        timetableSlots.value = slots
        rebuildMaps(slots)
        connected.value = true
        lastUpdate.value = new Date()
      },
      (err) => {
        console.error('Timetable realtime error:', err)
        connected.value = false
      }
    )
    return unsubGrid
  }

  function unsubscribe() {
    if (unsubGrid) { unsubGrid(); unsubGrid = null }
    if (unsubAct) { unsubAct(); unsubAct = null }
    connected.value = false
  }

  onUnmounted(unsubscribe)

  // ====================================================
  // rebuildMaps: สร้าง lookup maps จาก slots array
  // ====================================================
  function rebuildMaps(slots) {
    const gMap = {}
    const tMap = {}
    const rMap = {}
    for (const s of slots) {
      gMap[`${s.day}_${s.period}_${s.class_id}`] = s
      if (s.teacher_id) tMap[`${s.day}_${s.period}_${s.teacher_id}`] = s
      if (s.preferred_room) rMap[`${s.day}_${s.period}_${s.preferred_room}`] = s
    }
    timetableMap.value = gMap
    teacherMap.value = tMap
    roomMap.value = rMap
  }

  // ====================================================
  // getSlot helpers
  // ====================================================
  function getClassSlot(day, period, classId) {
    return timetableMap.value[`${day}_${period}_${classId}`] || null
  }
  function getTeacherSlot(day, period, teacherId) {
    return teacherMap.value[`${day}_${period}_${teacherId}`] || null
  }
  function getRoomSlot(day, period, roomId) {
    return roomMap.value[`${day}_${period}_${roomId}`] || null
  }
  function getSlotsForClass(classId) {
    return timetableSlots.value.filter(s => s.class_id === classId)
  }
  function getSlotsForTeacher(teacherId) {
    return timetableSlots.value.filter(s => s.teacher_id === teacherId)
  }
  function getSlotsForRoom(roomId) {
    return timetableSlots.value.filter(s => s.preferred_room === roomId)
  }

  // ====================================================
  // checkFree: ตรวจ 3 มิติ
  // ====================================================
  function checkFree(day, period, classId, teacherId, roomId, excludeIds = []) {
    const classSlot = getClassSlot(day, period, classId)
    const teacherSlot = teacherId ? getTeacherSlot(day, period, teacherId) : null
    const roomSlot = roomId ? getRoomSlot(day, period, roomId) : null

    const classOk = !classSlot || excludeIds.includes(classSlot.id)
    const teacherOk = !teacherSlot || excludeIds.includes(teacherSlot.id)
    const roomOk = !roomSlot || excludeIds.includes(roomSlot.id)

    return { classOk, teacherOk, roomOk, allOk: classOk && teacherOk && roomOk }
  }

  // ====================================================
  // placeSlot: วาง slot เดี่ยว
  // ====================================================
  async function placeSlot(slot) {
    const id = safeId(slot.day, slot.period, slot.class_id)
    const payload = buildSlotPayload(slot, { id })
    await setDoc(doc(db(), `terms/${term()}/timetable_grid`, id), {
      ...payload,
      updated_by: authStore.profile?.uid || '',
      updated_at: serverTimestamp(),
    })
    return id
  }

  // ====================================================
  // swapSlots: สลับ 2 slots
  // ====================================================
  async function swapSlots(slotA, slotB) {
    const batch = writeBatch(batchDb())
    const idA = safeId(slotA.day, slotA.period, slotA.class_id)
    const idB = safeId(slotB.day, slotB.period, slotB.class_id)
    const newIdA = safeId(slotB.day, slotB.period, slotA.class_id)
    const newIdB = safeId(slotA.day, slotA.period, slotB.class_id)
    const ts = serverTimestamp()
    const uid = authStore.profile?.uid || ''
    const payloadA = buildSlotPayload(slotA, { id: newIdA, day: slotB.day, period: slotB.period })
    const payloadB = buildSlotPayload(slotB, { id: newIdB, day: slotA.day, period: slotA.period })

    // ลบ slot เดิม
    batch.delete(doc(db(), `terms/${term()}/timetable_grid`, idA))
    batch.delete(doc(db(), `terms/${term()}/timetable_grid`, idB))

    // สร้าง slot ใหม่ (สลับวัน+คาบ)
    batch.set(doc(db(), `terms/${term()}/timetable_grid`, newIdA), {
      ...payloadA,
      updated_by: uid, updated_at: ts,
    })
    batch.set(doc(db(), `terms/${term()}/timetable_grid`, newIdB), {
      ...payloadB,
      updated_by: uid, updated_at: ts,
    })

    await batch.commit()
  }

  // ====================================================
  // moveSlot: ย้าย slot ไปตำแหน่งใหม่
  // ====================================================
  async function moveSlot(slot, newDay, newPeriod) {
    const oldId = safeId(slot.day, slot.period, slot.class_id)
    const newId = safeId(newDay, newPeriod, slot.class_id)
    const batch = writeBatch(batchDb())
    const payload = buildSlotPayload(slot, { id: newId, day: newDay, period: newPeriod })
    batch.delete(doc(db(), `terms/${term()}/timetable_grid`, oldId))
    batch.set(doc(db(), `terms/${term()}/timetable_grid`, newId), {
      ...payload,
      updated_by: authStore.profile?.uid || '',
      updated_at: serverTimestamp(),
    })
    await batch.commit()
  }

  // ====================================================
  // lockSlot: ล็อกคาบ manual (click แล้วพิมพ์)
  // ====================================================
  async function lockSlot({ day, period, classId, teacherId, roomId, label, lockType }) {
    // lockType: 'class' | 'teacher' | 'room'
    const id = lockType === 'teacher'
      ? safeId('lock-t', day, period, teacherId)
      : lockType === 'room'
        ? safeId('lock-r', day, period, roomId)
        : safeId(day, period, classId)

    await setDoc(doc(db(), `terms/${term()}/timetable_grid`, id), {
      id, day, period,
      class_id: lockType === 'class' ? classId : null,
      teacher_id: lockType === 'teacher' ? teacherId : (teacherId || null),
      preferred_room: lockType === 'room' ? roomId : null,
      type: 'manual_lock',
      is_locked: true,
      name: label || 'ล็อกคาบ',
      lock_type: lockType,
      updated_by: authStore.profile?.uid || '',
      updated_at: serverTimestamp(),
    })
  }

  // ====================================================
  // unlockSlot: ลบ lock
  // ====================================================
  async function unlockSlot(slotId) {
    await deleteDoc(doc(db(), `terms/${term()}/timetable_grid`, slotId))
  }

  // ====================================================
  // removeSlot: ลบ slot (ไม่ใช่ lock)
  // ====================================================
  async function removeSlot(slotId) {
    await deleteDoc(doc(db(), `terms/${term()}/timetable_grid`, slotId))
  }

  return {
    timetableSlots, timetableMap, teacherMap, roomMap,
    connected, lastUpdate,
    subscribe, unsubscribe,
    getClassSlot, getTeacherSlot, getRoomSlot,
    getSlotsForClass, getSlotsForTeacher, getSlotsForRoom,
    checkFree,
    placeSlot, moveSlot, swapSlots,
    lockSlot, unlockSlot, removeSlot,
  }
}
