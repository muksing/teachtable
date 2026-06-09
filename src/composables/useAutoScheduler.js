// src/composables/useAutoScheduler.js
// ระบบจัดตารางสอนอัตโนมัติ
// Algorithm: Pre-lock → Most Constrained First → Double Period First → Greedy + Retry → AI Mode

import { ref } from 'vue'
import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from '@/supabase/firestore'
import { getSchoolDb } from '@/supabase/db'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { useQuotaTracking, calculateScheduleQuota } from '@/composables/useQuotaTracking'

const BATCH_CHUNK_SIZE = 400

export function useAutoScheduler() {
  const schoolStore = useSchoolStore()
  const authStore = useAuthStore()
  const quotaTracking = useQuotaTracking()
  const db = () => getSchoolDb()
  const batchDb = () => db().firestore || db()
  const term = () => schoolStore.currentTerm || '2568_1'

  const scheduling = ref(false)
  const scheduleLog = ref([])    // log ขั้นตอน
  const scheduleResult = ref(null) // { placed, unplaced, total }

  function log(msg) { scheduleLog.value.push(msg) }

  // ====================================================
  // MAIN ENTRY: runAutoSchedule
  // ====================================================
  async function runAutoSchedule({ assignments, days, periodsPerDay, onSnapshot } = {}) {
    scheduling.value = true
    scheduleLog.value = []
    scheduleResult.value = null

    try {
      log('🚀 เริ่มจัดตารางอัตโนมัติ...')

      // 1. โหลดข้อมูลทั้งหมด
      const [gridSnap, actSnap, supSnap] = await Promise.all([
        getDocs(collection(db(), `terms/${term()}/timetable_grid`)),
        getDocs(collection(db(), `terms/${term()}/activity_booking`)),
        getDocs(collection(db(), `terms/${term()}/activity_supervision`)),
      ])

      // สร้าง grid state (day → period → class_id → slot)
      const grid = {}      // key: `${day}_${period}_${classId}` → slot
      const teacherGrid = {} // key: `${day}_${period}_${teacherId}` → true
      const roomGrid = {}    // key: `${day}_${period}_${roomId}` → true

      // โหลด existing slots
      gridSnap.docs.forEach(d => {
        const s = { id: d.id, ...d.data() }
        const key = `${s.day}_${s.period}_${s.class_id}`
        grid[key] = s
        if (s.teacher_id) teacherGrid[`${s.day}_${s.period}_${s.teacher_id}`] = true
        if (s.preferred_room) roomGrid[`${s.day}_${s.period}_${s.preferred_room}`] = true
      })

      // 2. Pre-lock: กิจกรรม (lock ห้องนักเรียน)
      const activities = actSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      let locked = 0
      for (const act of activities) {
        const actDays = Array.isArray(act.days) && act.days.length ? act.days : (act.day ? [act.day] : [])
        for (const dayVal of actDays) {
          for (let p = act.start_period; p < act.start_period + (act.duration_periods || 1); p++) {
            for (const classId of (act.target_classes || [])) {
              const key = `${dayVal}_${p}_${classId}`
              if (!grid[key]) {
                grid[key] = { day: dayVal, period: p, class_id: classId, type: 'activity', is_locked: true, name: act.name, act_id: act.id }
                locked++
              }
            }
          }
        }
      }
      log(`🔒 Pre-lock กิจกรรม: ${locked} คาบ`)

      // 3. Pre-lock: ครูคุมกิจกรรม
      const supervisions = supSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      let teacherLocked = 0
      for (const sup of supervisions) {
        const act = activities.find(a => a.id === sup.act_id || a.act_id === sup.act_id)
        if (!act) continue
        const actDays = Array.isArray(act.days) && act.days.length ? act.days : (act.day ? [act.day] : [])
        for (const dayVal of actDays) {
          for (let p = act.start_period; p < act.start_period + (act.duration_periods || 1); p++) {
            const key = `${dayVal}_${p}_${sup.teacher_id}`
            if (!teacherGrid[key]) { teacherGrid[key] = true; teacherLocked++ }
            if (sup.room_id) roomGrid[`${dayVal}_${p}_${sup.room_id}`] = true
          }
        }
      }
      log(`🔒 Pre-lock ครูคุมกิจกรรม: ${teacherLocked} คาบ`)

      // 4. เตรียม assignment list — กรองเฉพาะที่ยังไม่ได้จัดครบ
      const pendingList = []
      for (const a of assignments) {
        const placed = Object.values(grid).filter(s => s.assign_id === (a.assign_id || a.id) && s.type === 'subject').length
        const remaining = (a.periods_per_week || 0) - placed
        if (remaining <= 0) continue

        const tempAssign = { ...a, remaining, consecutive_periods: a.consecutive_periods || 1 }
        const plan = buildPlan(tempAssign)
        pendingList.push({
          ...a,
          remaining,
          plan,
          needsRoom: !!(a.preferred_room),
          constraintScore: calcConstraint(a, assignments),
        })
      }

      log(`📚 วิชาที่ต้องจัด: ${pendingList.length} รายการ (${pendingList.reduce((s, a) => s + a.remaining, 0)} คาบ)`)

      // 5. เรียง: คาบติดก่อน → Most Constrained First
      pendingList.sort((a, b) => {
        const aConsec = (a.consecutive_periods || 1) > 1 ? 1 : 0
        const bConsec = (b.consecutive_periods || 1) > 1 ? 1 : 0
        if (bConsec !== aConsec) return bConsec - aConsec   // คาบติดก่อน
        return b.constraintScore - a.constraintScore
      })

      // 6. Greedy placement (หลายรอบ)
      const MAX_RETRIES = 8
      let placed = 0
      let unplaced = [...pendingList]
      const newSlots = []

      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        if (!unplaced.length) break
        if (retry > 0) {
          // Shuffle เพื่อลองลำดับใหม่
          unplaced = shuffle([...unplaced])
          log(`🔄 รอบที่ ${retry + 1}: ลองสลับลำดับ...`)
        }

        const stillUnplaced = []
        for (const assign of unplaced) {
          const result = tryPlaceAssignment(assign, grid, teacherGrid, roomGrid, days, periodsPerDay)
          if (result.success) {
            newSlots.push(...result.slots)
            placed += result.slots.length
            log(`✅ ${assign.subject_name} (${assign.class_id}): ${result.slots.length} คาบ`)
          } else {
            stillUnplaced.push(assign)
          }
        }
        unplaced = stillUnplaced
      }

      log(`\n📊 สรุป: จัดได้ ${placed} คาบ | ยังไม่ได้จัด ${unplaced.length} วิชา`)

      // 7. บันทึกลง Firestore
      if (newSlots.length) {
        log(`💾 บันทึก ${newSlots.length} คาบลง Firestore...`)
        const ts = serverTimestamp()
        const uid = authStore.profile?.uid || 'auto'
        for (let i = 0; i < newSlots.length; i += BATCH_CHUNK_SIZE) {
          const chunk = newSlots.slice(i, i + BATCH_CHUNK_SIZE)
          const batch = writeBatch(batchDb())
          chunk.forEach((slot) => {
            batch.set(doc(db(), `terms/${term()}/timetable_grid`, slot.id), {
              ...slot,
              created_by: uid,
              updated_at: ts,
            })
          })
          await batch.commit()
        }
        log('✅ บันทึกสำเร็จ!')

        // บันทึก Quota Usage
        const quotaUsed = calculateScheduleQuota(
          pendingList.length, // จำนวนชั้น (approx)
          newSlots.length,    // จำนวนคาบ
          1.0                 // ความเข้ม
        )
        
        const quotaResult = await quotaTracking.logQuotaUsage({
          quota_used: quotaUsed,
          usage_type: 'auto_schedule',
          description: `จัดตารางอัตโนมัติสำเร็จ ${newSlots.length} คาบ`,
          metadata: {
            placed,
            total_slots: newSlots.length,
            assignments_count: pendingList.length,
          },
          created_by: authStore.profile?.uid || 'auto',
          created_by_name: authStore.profile?.displayName || 'System',
        })
        
        if (quotaResult.success) {
          log(`📊 บันทึก Quota: ${quotaUsed} units`)
        } else {
          log(`⚠️ ไม่สามารถบันทึก Quota: ${quotaResult.error}`)
        }
      }

      scheduleResult.value = {
        placed,
        unplaced: unplaced.length,
        total: pendingList.reduce((s, a) => s + a.remaining, 0),
        unplacedList: unplaced,
      }

      return scheduleResult.value
    } catch (e) {
      log(`❌ เกิดข้อผิดพลาด: ${e.message}`)
      throw e
    } finally {
      scheduling.value = false
    }
  }

  // ====================================================
  // buildPlan: สร้างแผน double/single
  // hours=4 → [2,2], hours=3 → [2,1], hours=2 → [2], hours=1 → [1]
  // hours=5 → [2,2,1], hours=6 → [2,2,2]
  // ====================================================
  function buildPlan(assign) {
    const consecutive = assign.consecutive_periods || 1
    const remaining   = assign.remaining
    const plan = []
    if (consecutive <= 1) {
      // Single-period subject: all blocks of 1
      for (let i = 0; i < remaining; i++) plan.push(1)
    } else {
      let rem = remaining
      while (rem >= consecutive) { plan.push(consecutive); rem -= consecutive }
      // leftover singles
      while (rem > 0) { plan.push(1); rem-- }
    }
    return plan
  }

  // ====================================================
  // calcConstraint: คะแนนความยาก (สูง = จัดยาก = ทำก่อน)
  // ====================================================
  function calcConstraint(assign, allAssignments) {
    let score = 0
    // ต้องการห้อง Lab → ยาก
    if (assign.preferred_room) score += 30
    // ชั่วโมงเยอะ → ยาก
    score += (assign.periods_per_week || 0) * 5
    // ครูสอนหลายวิชา → ยาก
    const sameTeacher = allAssignments.filter(a => a.teacher_id === assign.teacher_id).length
    score += sameTeacher * 10
    // consecutive_periods สูง → ยาก
    score += (assign.consecutive_periods || 1) * 8
    return score
  }

  // ====================================================
  // tryPlaceAssignment: ลองวาง assignment ตาม plan
  // ====================================================
  function tryPlaceAssignment(assign, grid, teacherGrid, roomGrid, days, periodsPerDay) {
    const slots = []
    const plan = [...assign.plan]  // [2, 2, 1, ...]
    const usedDays = new Set()     // ไม่วาง 2 กลุ่มในวันเดียวกัน ถ้าเป็นไปได้

    for (const blockSize of plan) {
      const placed = tryPlaceBlock(assign, blockSize, grid, teacherGrid, roomGrid, days, periodsPerDay, usedDays)
      if (!placed) return { success: false }
      slots.push(...placed)
      usedDays.add(placed[0].day)
    }

    // commit slots to grid
    for (const slot of slots) {
      grid[`${slot.day}_${slot.period}_${slot.class_id}`] = slot
      if (slot.teacher_id) teacherGrid[`${slot.day}_${slot.period}_${slot.teacher_id}`] = true
      if (slot.preferred_room) roomGrid[`${slot.day}_${slot.period}_${slot.preferred_room}`] = true
    }

    return { success: true, slots }
  }

  // ====================================================
  // buildDayLoads: นับภาระงานต่อวันของครูและห้องเรียน
  // คืน { teacherLoad, classLoad } → Map[id][day] = count
  // ====================================================
  function buildDayLoads(grid, teacherGrid) {
    const teacherLoad = {}  // teacherId → { day → count }
    const classLoad = {}    // classId   → { day → count }

    // นับจาก grid (วิชาที่ลงแล้ว)
    Object.values(grid).forEach(s => {
      if (!s || !s.day) return
      // class load
      if (s.class_id) {
        if (!classLoad[s.class_id]) classLoad[s.class_id] = {}
        classLoad[s.class_id][s.day] = (classLoad[s.class_id][s.day] || 0) + 1
      }
    })
    // นับจาก teacherGrid key = `${day}_${period}_${teacherId}`
    Object.keys(teacherGrid).forEach(key => {
      const parts = key.split('_')
      if (parts.length < 3) return
      const day = Number(parts[0])
      const tid = parts.slice(2).join('_')
      if (!teacherLoad[tid]) teacherLoad[tid] = {}
      teacherLoad[tid][day] = (teacherLoad[tid][day] || 0) + 1
    })
    return { teacherLoad, classLoad }
  }

  // dayScore ต่ำ = ควรวางวันนี้ก่อน (กระจายได้ดีกว่า)
  function getDayScore(dayVal, assign, teacherLoad, classLoad, usedDays) {
    const tl = teacherLoad[assign.teacher_id]?.[dayVal] || 0  // ครูสอนวันนี้กี่คาบ
    const cl = classLoad[assign.class_id]?.[dayVal] || 0       // ห้องเรียนมีคาบวันนี้กี่คาบ
    const penalty = usedDays.has(dayVal) ? 100 : 0             // หลีกเลี่ยงวันซ้ำกัน
    return tl * 2 + cl * 3 + penalty
  }

  // ====================================================
  // tryPlaceBlock: หาตำแหน่งวาง blockSize คาบติดกัน
  // เรียง วัน ตาม dayScore (load balancing) — กระจายคาบให้เฉลี่ยต่อวัน
  // ====================================================
  function tryPlaceBlock(assign, blockSize, grid, teacherGrid, roomGrid, days, periodsPerDay, usedDays) {
    const maxPeriod = periodsPerDay - blockSize + 1

    // คำนวณภาระงานปัจจุบัน
    const { teacherLoad, classLoad } = buildDayLoads(grid, teacherGrid)

    // แยกวันออกเป็น preferredDays (ยังไม่ได้ใช้) และ fallbackDays (ใช้ไปแล้ว)
    const preferredDays = [...days].filter(d => !usedDays.has(d.value))
    const fallbackDays  = [...days].filter(d =>  usedDays.has(d.value))

    // เรียงแต่ละกลุ่มตาม dayScore (load balancing)
    const sortByScore = arr => arr.sort((a, b) =>
      getDayScore(a.value, assign, teacherLoad, classLoad, new Set()) -
      getDayScore(b.value, assign, teacherLoad, classLoad, new Set())
    )
    const dayOrder = [...sortByScore(preferredDays), ...sortByScore(fallbackDays)]

    const makeSlots = (d, p) => Array.from({ length: blockSize }, (_, i) => ({
      id: safeId(d, p + i, assign.class_id),
      day: d,
      period: p + i,
      class_id: assign.class_id,
      assign_id: assign.assign_id || assign.id,
      teacher_id: assign.teacher_id || '',
      teacher_name: assign.teacher_name || '',
      subject_code: assign.subject_code || '',
      subject_name: assign.subject_name || '',
      preferred_room: assign.preferred_room || '',
      type: 'subject',
      is_locked: false,
      is_auto: true,
    }))

    for (const dayObj of dayOrder) {
      const d = dayObj.value
      for (let p = 1; p <= maxPeriod; p++) {
        let ok = true
        for (let i = 0; i < blockSize; i++) {
          if (!isSlotFree(assign, d, p + i, grid, teacherGrid, roomGrid)) { ok = false; break }
        }
        if (ok) return makeSlots(d, p)
      }
    }
    return null  // หาไม่ได้
  }

  // ====================================================
  // isSlotFree: ตรวจ 3 มิติ
  // ====================================================
  function isSlotFree(assign, day, period, grid, teacherGrid, roomGrid) {
    // 1. ห้องเรียน (class) ว่างไหม
    if (grid[`${day}_${period}_${assign.class_id}`]) return false
    // 2. ครูว่างไหม
    if (assign.teacher_id && teacherGrid[`${day}_${period}_${assign.teacher_id}`]) return false
    // 3. ห้อง Lab ว่างไหม
    if (assign.preferred_room && roomGrid[`${day}_${period}_${assign.preferred_room}`]) return false
    return true
  }

  // ====================================================
  // checkSlotStatus: ตรวจสถานะ slot สำหรับ UI
  // คืนค่า { classOk, teacherOk, roomOk }
  // ====================================================
  function checkSlotStatus(assign, day, period, currentGrid, tGrid, rGrid) {
    return {
      classOk:   !currentGrid[`${day}_${period}_${assign.class_id}`],
      teacherOk: !assign.teacher_id || !tGrid[`${day}_${period}_${assign.teacher_id}`],
      roomOk:    !assign.preferred_room || !rGrid[`${day}_${period}_${assign.preferred_room}`],
    }
  }

  // ====================================================
  // findSwappableSlots: หา slot ที่สามารถสลับกับ targetSlot ได้
  // ====================================================
  function findSwappableSlots(targetSlot, allSlots, teacherGridState, roomGridState) {
    const swappable = []
    const candidateSlots = allSlots.filter(s =>
      s.type === 'subject' &&
      s.class_id === targetSlot.class_id &&
      !(s.day === targetSlot.day && s.period === targetSlot.period)
    )

    for (const candidate of candidateSlots) {
      // จะสลับได้ต้องไม่ชนทั้งคู่หลังสลับ
      const targetMovesToCandidate = canMove(targetSlot, candidate.day, candidate.period, allSlots, teacherGridState, roomGridState, candidate)
      const candidateMovesToTarget = canMove(candidate, targetSlot.day, targetSlot.period, allSlots, teacherGridState, roomGridState, targetSlot)

      if (targetMovesToCandidate && candidateMovesToTarget) {
        swappable.push(candidate)
      }
    }
    return swappable
  }

  function canMove(slot, newDay, newPeriod, allSlots, teacherGridState, roomGridState, excludeSlot) {
    // ตรวจห้องเรียน
    const existingClass = allSlots.find(s =>
      s.day === newDay && s.period === newPeriod && s.class_id === slot.class_id &&
      s.id !== excludeSlot?.id
    )
    if (existingClass) return false
    // ตรวจครู
    if (slot.teacher_id) {
      const teacherBusy = allSlots.find(s =>
        s.day === newDay && s.period === newPeriod && s.teacher_id === slot.teacher_id &&
        s.id !== excludeSlot?.id && s.id !== slot.id
      )
      if (teacherBusy) return false
    }
    // ตรวจห้อง Lab
    if (slot.preferred_room) {
      const roomBusy = allSlots.find(s =>
        s.day === newDay && s.period === newPeriod && s.preferred_room === slot.preferred_room &&
        s.id !== excludeSlot?.id && s.id !== slot.id
      )
      if (roomBusy) return false
    }
    return true
  }

  // ====================================================
  // clearAutoSlots: ลบเฉพาะ slot ที่ auto จัด (ไม่ลบ manual)
  // ====================================================
  async function clearAutoSlots() {
    const snap = await getDocs(
      query(collection(db(), `terms/${term()}/timetable_grid`), where('is_auto', '==', true))
    )
    const toDelete = snap.docs
    for (let i = 0; i < toDelete.length; i += BATCH_CHUNK_SIZE) {
      const chunk = toDelete.slice(i, i + BATCH_CHUNK_SIZE)
      const batch = writeBatch(batchDb())
      chunk.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    return toDelete.length
  }

  // ====================================================
  // Helpers
  // ====================================================
  // safeId: แปลง / → - เพื่อใช้เป็น Firestore document ID (ห้ามมี slash)
  function safeId(...parts) {
    return parts.map(p => String(p ?? '').replace(/\//g, '-')).join('_')
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // ====================================================
  // AI Mode: ส่ง unplaced list → Claude API → apply suggestions
  // ====================================================
  async function runAISchedule(unplacedAssignments, currentGrid, apiKey) {
    if (!apiKey) throw new Error('ไม่มี Anthropic API Key')

    const gridSummary = buildGridSummary(currentGrid)
    const prompt = buildAIPrompt(unplacedAssignments, gridSummary)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) throw new Error(`AI API Error: ${response.status}`)
    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // parse JSON from response
    const match = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (!match) throw new Error('AI ไม่ได้ส่ง JSON กลับมา')
    return JSON.parse(match[1])
  }

  function buildGridSummary(grid) {
    // แบ่งข้อมูลตาม type เพื่อให้ AI เข้าใจบริบทครบถ้วน
    const subjects = {}   // วิชาที่ลงแล้ว
    const locked = []     // คาบที่ห้ามแตะ (กิจกรรม + lock ทุกประเภท)

    Object.values(grid).forEach(s => {
      const key = `วัน${s.day}_คาบ${s.period}`
      if (s.type === 'subject' && !s.is_locked) {
        if (!subjects[key]) subjects[key] = []
        subjects[key].push(`${s.class_id}:${s.teacher_id || '?'}:${s.subject_name || s.subject_code || ''}`)
      } else if (s.type === 'activity' || s.is_locked) {
        locked.push({
          วัน: s.day, คาบ: s.period,
          ห้อง: s.class_id || '',
          ครู: s.teacher_id || '',
          ประเภท: s.type === 'activity' ? 'กิจกรรม' : 'ล็อก',
          ชื่อ: s.name || s.subject_name || s.label || '',
        })
      }
    })
    return { subjects: JSON.stringify(subjects), locked: JSON.stringify(locked) }
  }

  function buildAIPrompt(unplaced, gridSummary) {
    return `คุณเป็น AI ช่วยจัดตารางสอนโรงเรียน

== วิชาที่ยังจัดไม่ได้ ==
${JSON.stringify(unplaced.map(a => ({
  วิชา: a.subject_name,
  ห้อง: a.class_id,
  ครู: a.teacher_id,
  คาบที่เหลือ: a.remaining,
  ต้องการห้อง: a.preferred_room || 'ไม่ระบุ',
})), null, 2)}

== ตารางวิชาที่จัดไปแล้ว (วันN_คาบN → [ห้อง:ครู:วิชา]) ==
${gridSummary.subjects}

== คาบที่ล็อกแล้ว ห้ามย้ายหรือใช้ (กิจกรรม/ล็อก) ==
${gridSummary.locked}

กฎที่ต้องปฏิบัติตาม:
1. ห้ามวางวิชาในคาบที่ล็อกหรือกิจกรรม (รายการใน locked ด้านบน)
2. ครูคนเดียวต้องไม่สอน 2 ห้องในคาบเดียวกัน
3. ห้องเรียนเดียวกันต้องไม่มี 2 วิชาในคาบเดียวกัน
4. ถ้าวิชาต้องการห้อง Lab ห้องนั้นต้องว่างในคาบนั้น
5. ไม่ควรให้วิชาเดียวกันซ้ำในวันเดียวกัน

โปรดแนะนำการสลับ slot เพื่อให้วิชาที่เหลือลงได้ ตอบเป็น JSON เท่านั้น:
\`\`\`json
{
  "suggestions": [
    {
      "action": "swap",
      "slot1": {"day": 1, "period": 2, "class_id": "ม.1/1"},
      "slot2": {"day": 2, "period": 3, "class_id": "ม.1/1"},
      "reason": "เหตุผล"
    }
  ]
}
\`\`\``
  }

  return {
    scheduling,
    scheduleLog,
    scheduleResult,
    runAutoSchedule,
    clearAutoSlots,
    checkSlotStatus,
    findSwappableSlots,
    runAISchedule,
  }
}
