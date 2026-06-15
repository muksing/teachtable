// src/composables/useRealtimeTimetable.js
// Real-time sync ตารางสอน ผ่าน Supabase Realtime postgres_changes
// รองรับผู้จัดหลายคนพร้อมกัน

import { ref, onUnmounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'

// safeId: สร้าง composite key ใช้เป็น local map key
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
    day: Number(source.day ?? source.day_of_week),
    period: Number(source.period ?? source.period_number),
    class_id: normalizeScalar(source.class_id != null ? String(source.class_id) : null),
    teacher_id: normalizeScalar(source.teacher_id != null ? String(source.teacher_id) : null),
    teacher_name: normalizeScalar(source.teacher_name != null ? String(source.teacher_name) : null),
    preferred_room: normalizeScalar(source.preferred_room != null ? String(source.preferred_room) : (source.room_id != null ? String(source.room_id) : null)),
    assign_id: normalizeScalar(source.assign_id != null ? String(source.assign_id) : null),
    subject_code: normalizeScalar(source.subject_code != null ? String(source.subject_code) : null),
    subject_name: normalizeScalar(source.subject_name != null ? String(source.subject_name) : null),
    type: String(source.type || source.slot_type || 'subject'),
    slot_type: String(source.slot_type || source.type || 'subject'),
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

// Convert a raw timetable_slots row → local slot shape
// IMPORTANT: explicit overrides come AFTER ...row so they win over DB column names
function rowToSlot(row) {
  const slot = buildSlotPayload({
    ...row,                                                               // DB columns first
    id: safeId(row.day_of_week, row.period_number, row.class_id),        // composite key overrides DB uuid
    day: row.day_of_week,
    period: row.period_number,
    class_id: row.class_id,
    teacher_id: row.teacher_id,
    preferred_room: row.room_id,                                          // map room_id → preferred_room
    assign_id: row.assign_id || null,
    subject_code: row.subject_id || null,                                 // map subject_id → subject_code
    subject_name: row.subject_name || null,
    teacher_name: row.teacher_name || null,
    slot_type: row.slot_type,
    type: row.slot_type,
    is_locked: row.slot_type === 'activity' || row.slot_type === 'manual_lock',
  })
  slot._db_id = row.id   // save DB UUID separately (not in buildSlotPayload output)
  return slot
}

export function useRealtimeTimetable() {
  const schoolStore = useSchoolStore()
  const authStore = useAuthStore()
  const schoolId = () => authStore.schoolId
  const term = () => schoolStore.currentTerm || '2568_1'

  // State
  const timetableSlots = ref([])
  const timetableMap = ref({})     // key: `${day}_${period}_${classId}` → slot
  const teacherMap = ref({})       // key: `${day}_${period}_${teacherId}` → slot
  const roomMap = ref({})          // key: `${day}_${period}_${roomId}` → slot
  const connected = ref(false)
  const lastUpdate = ref(null)

  let realtimeChannel = null

  // ====================================================
  // subscribe: โหลดข้อมูลเริ่มต้น + เริ่ม realtime listener
  // ====================================================
  async function subscribe() {
    const sid = schoolId()
    const t = term()

    console.log('[RT subscribe] schoolId:', sid, '| term:', t)

    // โหลดข้อมูลเริ่มต้น
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*')
      .eq('school_id', sid)
      .eq('term_id', t)

    console.log('[RT subscribe] loaded slots:', data?.length ?? 0, '| error:', error?.message)

    if (!error && data) {
      const slots = data.map(rowToSlot)
      timetableSlots.value = slots
      rebuildMaps(slots)
      connected.value = true
      lastUpdate.value = new Date()
    }

    // เริ่ม realtime channel
    realtimeChannel = supabase
      .channel(`timetable_slots_${sid}_${t}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timetable_slots',
          filter: `school_id=eq.${sid}`,
        },
        (payload) => {
          handleRealtimeEvent(payload)
          lastUpdate.value = new Date()
        }
      )
      .subscribe((status) => {
        connected.value = status === 'SUBSCRIBED'
      })

    return realtimeChannel
  }

  function handleRealtimeEvent(payload) {
    const { eventType, new: newRow, old: oldRow } = payload

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (newRow.term_id !== term()) return
      const slot = rowToSlot(newRow)
      const key = slot.id  // composite key (safeId)

      // Match by composite key (same position = same slot)
      const idx = timetableSlots.value.findIndex(s => s.id === key)
      if (idx >= 0) {
        timetableSlots.value.splice(idx, 1, slot)
      } else {
        timetableSlots.value.push(slot)
      }
    } else if (eventType === 'DELETE') {
      if (oldRow) {
        // Use DB UUID (_db_id) to match — composite key fields may not exist in oldRow
        timetableSlots.value = timetableSlots.value.filter(s => s._db_id !== oldRow.id)
      }
    }

    rebuildMaps(timetableSlots.value)
  }

  function unsubscribe() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
    connected.value = false
  }

  onUnmounted(unsubscribe)

  // ====================================================
  // rebuildMaps
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
  // placeSlot: วาง slot เดี่ยว — อัปเดต local state ทันที (ไม่รอ realtime)
  // ====================================================
  async function placeSlot(slot) {
    const sid = schoolId()
    const t = term()
    const day = slot.day ?? slot.day_of_week
    const period = slot.period ?? slot.period_number
    const payload = buildSlotPayload(slot, {
      id: safeId(day, period, slot.class_id),
    })

    console.log('[placeSlot] writing:', { school_id: sid, term_id: t, class_id: payload.class_id, day: payload.day, period: payload.period })

    const { data, error } = await supabase
      .from('timetable_slots')
      .upsert({
        term_id: t,
        class_id: payload.class_id,
        assign_id: payload.assign_id || null,
        subject_id: payload.subject_code || null,
        subject_name: payload.subject_name || null,
        teacher_id: payload.teacher_id || null,
        teacher_name: payload.teacher_name || null,
        room_id: payload.preferred_room || null,
        day_of_week: payload.day,
        period_number: payload.period,
        slot_type: payload.slot_type || payload.type || 'subject',
        school_id: sid,
        updated_by: authStore.profile?.uid || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      .select()

    console.log('[placeSlot] result rows:', data?.length ?? 0, '| error:', error?.message)

    if (error) {
      console.error('[placeSlot] DB error:', error, { school_id: sid, term_id: t, class_id: payload.class_id })
      throw error
    }

    if (!data || data.length === 0) {
      // Write was silently blocked — most likely causes:
      // 1) RLS policy on timetable_slots blocks INSERT for this user
      // 2) Unique constraint (school_id,term_id,class_id,day_of_week,period_number) missing
      console.error('[placeSlot] silent failure — DB returned no rows', { school_id: sid, term_id: t })
      throw new Error('บันทึกคาบสอนล้มเหลว\nสาเหตุที่เป็นไปได้: RLS policy ไม่อนุญาต หรือ unique constraint ขาดหาย\nกรุณาตรวจสอบ Supabase dashboard หรือแจ้งผู้ดูแลระบบ')
    }

    // อัปเดต local state ทันที (ไม่ต้องรอ realtime)
    const newSlot = rowToSlot(data[0])
    const key = newSlot.id  // composite key
    const idx = timetableSlots.value.findIndex(s => s.id === key)
    if (idx >= 0) {
      timetableSlots.value.splice(idx, 1, newSlot)
    } else {
      timetableSlots.value.push(newSlot)
    }
    rebuildMaps(timetableSlots.value)

    return payload.id
  }

  // ====================================================
  // swapSlots: สลับ 2 slots — อัปเดต local state ทันที
  // ====================================================
  async function swapSlots(slotA, slotB) {
    const sid = schoolId()
    const t = term()
    const ts = new Date().toISOString()
    const uid = authStore.profile?.uid || ''

    const dayA = slotA.day ?? slotA.day_of_week
    const periodA = slotA.period ?? slotA.period_number
    const dayB = slotB.day ?? slotB.day_of_week
    const periodB = slotB.period ?? slotB.period_number

    // ลบ slot เดิมทั้งคู่ (ใช้ _db_id หรือ id)
    const deleteIds = [slotA._db_id || slotA.id, slotB._db_id || slotB.id].filter(Boolean)
    if (deleteIds.length) {
      const { error: delErr } = await supabase
        .from('timetable_slots')
        .delete()
        .in('id', deleteIds)
      if (delErr) throw delErr
    }

    // สร้าง slot ใหม่สลับวัน+คาบ
    const rows = [
      {
        term_id: t,
        class_id: slotA.class_id,
        assign_id: slotA.assign_id || null,
        subject_id: slotA.subject_code || slotA.subject_id || null,
        subject_name: slotA.subject_name || null,
        teacher_id: slotA.teacher_id || null,
        teacher_name: slotA.teacher_name || null,
        room_id: slotA.preferred_room || slotA.room_id || null,
        day_of_week: dayB,
        period_number: periodB,
        slot_type: slotA.slot_type || slotA.type || 'subject',
        school_id: sid,
        updated_by: uid,
        updated_at: ts,
      },
      {
        term_id: t,
        class_id: slotB.class_id,
        assign_id: slotB.assign_id || null,
        subject_id: slotB.subject_code || slotB.subject_id || null,
        subject_name: slotB.subject_name || null,
        teacher_id: slotB.teacher_id || null,
        teacher_name: slotB.teacher_name || null,
        room_id: slotB.preferred_room || slotB.room_id || null,
        day_of_week: dayA,
        period_number: periodA,
        slot_type: slotB.slot_type || slotB.type || 'subject',
        school_id: sid,
        updated_by: uid,
        updated_at: ts,
      },
    ]

    const { data: insertData, error: insertErr } = await supabase
      .from('timetable_slots')
      .upsert(rows, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      .select()

    if (insertErr) throw insertErr

    // อัปเดต local state ทันที
    // ลบ slot เดิมออกจาก local
    const idsToRemove = [slotA.id, slotB.id].filter(Boolean)
    let updatedSlots = timetableSlots.value.filter(s => !idsToRemove.includes(s.id))
    // เพิ่ม slot ใหม่
    if (insertData?.length) {
      insertData.forEach(row => updatedSlots.push(rowToSlot(row)))
    } else {
      // fallback: ใช้ข้อมูล local
      updatedSlots.push(
        { ...buildSlotPayload({ ...slotA, day: dayB, period: periodB }), _db_id: null },
        { ...buildSlotPayload({ ...slotB, day: dayA, period: periodA }), _db_id: null }
      )
    }
    timetableSlots.value = updatedSlots
    rebuildMaps(timetableSlots.value)
  }

  // ====================================================
  // moveSlot: ย้าย slot ไปตำแหน่งใหม่ — อัปเดต local state ทันที
  // ====================================================
  async function moveSlot(slot, newDay, newPeriod) {
    const sid = schoolId()
    const t = term()
    const uid = authStore.profile?.uid || ''

    // ลบ slot เดิม (ใช้ _db_id หรือ id)
    const oldDbId = slot._db_id || slot.id
    if (oldDbId) {
      const { error: delErr } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('id', oldDbId)
      if (delErr) throw delErr
    }

    // Insert ที่ตำแหน่งใหม่
    const { data: insertData, error: insertErr } = await supabase
      .from('timetable_slots')
      .upsert({
        term_id: t,
        class_id: slot.class_id,
        assign_id: slot.assign_id || null,
        subject_id: slot.subject_code || slot.subject_id || null,
        subject_name: slot.subject_name || null,
        teacher_id: slot.teacher_id || null,
        teacher_name: slot.teacher_name || null,
        room_id: slot.preferred_room || slot.room_id || null,
        day_of_week: newDay,
        period_number: newPeriod,
        slot_type: slot.slot_type || slot.type || 'subject',
        school_id: sid,
        updated_by: uid,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      .select()

    if (insertErr) throw insertErr

    // อัปเดต local state ทันที
    let updatedSlots = timetableSlots.value.filter(s => s.id !== slot.id)
    if (insertData?.[0]) {
      updatedSlots.push(rowToSlot(insertData[0]))
    } else {
      const newKey = safeId(newDay, newPeriod, slot.class_id)
      updatedSlots.push({ ...buildSlotPayload({ ...slot, day: newDay, period: newPeriod }, { id: newKey }), _db_id: null })
    }
    timetableSlots.value = updatedSlots
    rebuildMaps(timetableSlots.value)
  }

  // ====================================================
  // lockSlot: ล็อกคาบ manual
  // ====================================================
  async function lockSlot({ day, period, classId, teacherId, roomId, label, lockType }) {
    const sid = schoolId()
    const t = term()

    const { data, error } = await supabase
      .from('timetable_slots')
      .upsert({
        term_id: t,
        class_id: lockType === 'class' ? classId : null,
        teacher_id: lockType === 'teacher' ? teacherId : (teacherId || null),
        room_id: lockType === 'room' ? roomId : null,
        day_of_week: day,
        period_number: period,
        slot_type: 'manual_lock',
        school_id: sid,
        updated_by: authStore.profile?.uid || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id,term_id,class_id,day_of_week,period_number' })
      .select()

    if (error) throw error

    // อัปเดต local state ทันที
    if (data?.[0]) {
      const newSlot = rowToSlot(data[0])
      const key = newSlot.id
      const idx = timetableSlots.value.findIndex(s => s.id === key)
      if (idx >= 0) timetableSlots.value.splice(idx, 1, newSlot)
      else timetableSlots.value.push(newSlot)
      rebuildMaps(timetableSlots.value)
    }
  }

  // ====================================================
  // unlockSlot / removeSlot: ลบ slot — อัปเดต local state ทันที
  // ====================================================
  async function unlockSlot(slotId) {
    await removeSlot(slotId)
  }

  async function removeSlot(slotId) {
    const local = timetableSlots.value.find(s => s.id === slotId || s._db_id === slotId)
    const dbId = local?._db_id || slotId

    const { error } = await supabase
      .from('timetable_slots')
      .delete()
      .eq('id', dbId)

    if (error) throw error

    // อัปเดต local state ทันที (ไม่ต้องรอ realtime DELETE event)
    timetableSlots.value = timetableSlots.value.filter(s => s.id !== slotId && s._db_id !== slotId)
    rebuildMaps(timetableSlots.value)
  }

  async function reload() {
    const sid = schoolId()
    const t = term()
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*')
      .eq('school_id', sid)
      .eq('term_id', t)
    if (error) throw error
    if (data) {
      const slots = data.map(rowToSlot)
      timetableSlots.value = slots
      rebuildMaps(slots)
    }
  }

  return {
    timetableSlots, timetableMap, teacherMap, roomMap,
    connected, lastUpdate,
    subscribe, unsubscribe, reload,
    getClassSlot, getTeacherSlot, getRoomSlot,
    getSlotsForClass, getSlotsForTeacher, getSlotsForRoom,
    checkFree,
    placeSlot, moveSlot, swapSlots,
    lockSlot, unlockSlot, removeSlot,
  }
}
