/**
 * backfill-teach-actuals.js
 *
 * สร้าง teach_actuals ที่ขาดหายตั้งแต่วันเปิดเรียนถึงวันนี้
 * ตรวจว่าแต่ละ (class_id, date, period_number) มีอยู่แล้วหรือยัง
 * ถ้ายังไม่มี → insert (ignoreDuplicates=true ไม่แตะของที่มีอยู่)
 *
 * Usage:
 *   node scripts/backfill-teach-actuals.js
 *   SCHOOL_ID=xxx TERM_ID=2568_1 node scripts/backfill-teach-actuals.js
 *   DRY_RUN=1 node scripts/backfill-teach-actuals.js   ← แค่นับ ไม่ insert
 */

import { getSupabaseAdmin, loadScriptEnv } from './supabase-admin.js'

loadScriptEnv()

const SCHOOL_ID  = process.env.SCHOOL_ID  || ''
const TERM_ID    = process.env.TERM_ID    || '2568_1'
const TERM_START = process.env.TERM_START || ''   // เช่น 2026-05-11 (ถ้า settings ไม่มี)
const DRY_RUN    = process.env.DRY_RUN    === '1'

const THAI_DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_DAY_TO_NUM = { จันทร์: 1, อังคาร: 2, พุธ: 3, พฤหัสบดี: 4, ศุกร์: 5, เสาร์: 6, อาทิตย์: 7 }

function localDateStr(d) {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

async function paginate(queryFn) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await queryFn(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE) break
  }
  return rows
}

async function main() {
  const supabase = getSupabaseAdmin()

  // ── 1. หา school_id ──────────────────────────────────────────────
  let schoolId = SCHOOL_ID
  let schoolName = ''

  if (!schoolId) {
    const { data: schools, error } = await supabase
      .from('schools').select('id, name, settings').neq('is_active', false).order('name')
    if (error) throw error
    if (!schools?.length) throw new Error('ไม่พบโรงเรียน')
    if (schools.length === 1) {
      schoolId   = schools[0].id
      schoolName = schools[0].name
    } else {
      console.log('พบหลายโรงเรียน กรุณาระบุ SCHOOL_ID=')
      schools.forEach(s => console.log(`  ${s.id}  ${s.name}`))
      process.exit(1)
    }
  }

  // ── 2. โหลด settings ดึง term_start ─────────────────────────────
  const { data: schoolRow, error: schoolErr } = await supabase
    .from('schools').select('name, settings').eq('id', schoolId).single()
  if (schoolErr) throw schoolErr
  schoolName = schoolRow.name

  const settings      = schoolRow.settings || {}
  const termStart     = TERM_START || settings.term_start || settings.terms?.[TERM_ID]?.start_date || ''
  const homeroomSetup = settings.teaching_log_settings?.homeroom_special_periods || []
  const homeroomPeriodNums = new Set(
    homeroomSetup.map(hp => Number(hp.period)).filter(Number.isFinite)
  )

  if (!termStart) {
    throw new Error('ไม่พบ term_start ใน settings ของโรงเรียน กรุณาตั้งค่าวันเปิดภาคเรียน')
  }

  const today   = localDateStr(new Date())
  console.log(`\n🏫  ${schoolName}`)
  console.log(`📅  เทอม: ${TERM_ID}  |  เปิดเรียน: ${termStart}  →  วันนี้: ${today}`)
  if (DRY_RUN) console.log('🔍  DRY RUN — ไม่มีการ insert จริง\n')

  // ── 3. โหลด timetable slots (published) ─────────────────────────
  console.log('📥  โหลดตารางสอน...')
  const slots = await paginate((from, to) =>
    supabase.from('timetable_slots_published')
      .select('class_id, period_number, subject_id, subject_name, teacher_id, teacher_name, day_of_week, slot_type')
      .eq('school_id', schoolId).eq('term_id', TERM_ID)
      .not('slot_type', 'in', '("activity","manual_lock")')
      .range(from, to)
  )
  console.log(`   พบ ${slots.length} slot ในตารางสอน`)

  // slot lookup: day_of_week (number) → list
  const slotsByDay = {}
  for (const s of slots) {
    const d = Number(s.day_of_week)
    if (!slotsByDay[d]) slotsByDay[d] = []
    slotsByDay[d].push(s)
  }

  // ── 4. โหลด classes สำหรับ homeroom ─────────────────────────────
  console.log('📥  โหลดรายชื่อห้องเรียน...')
  const { data: classRows, error: clsErr } = await supabase
    .from('classes')
    .select('class_name, homeroom_teacher_id, homeroom_teacher_ids, homeroom_teacher_names_snapshot')
    .eq('school_id', schoolId)
    .order('class_name')
  if (clsErr) throw clsErr

  function parseJsonbArray(val) {
    if (Array.isArray(val)) return val
    if (typeof val === 'string') {
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
    }
    return []
  }

  // ── 5. โหลด existing teach_actuals ทั้งหมดในช่วง ────────────────
  console.log('📥  โหลด teach_actuals ที่มีอยู่...')
  const existing = await paginate((from, to) =>
    supabase.from('teach_actuals')
      .select('class_id, date, period_number')
      .eq('school_id', schoolId).eq('term_id', TERM_ID)
      .gte('date', termStart).lte('date', today)
      .range(from, to)
  )

  const existingSet = new Set(existing.map(r => `${r.class_id}|${r.date}|${r.period_number}`))
  console.log(`   พบ ${existing.length} records อยู่แล้ว (${existingSet.size} unique keys)\n`)

  // ── 6. วนแต่ละวัน สร้าง payloads ────────────────────────────────
  let totalCreated = 0
  let totalSkipped = 0
  const startD  = new Date(termStart + 'T00:00:00')
  const endD    = new Date(today     + 'T00:00:00')

  const allPayloads = []

  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const jsDay  = d.getDay()                         // 0=อา 1=จ ... 6=ส
    const dayNum = THAI_DAY_TO_NUM[THAI_DAY_NAMES[jsDay]]
    if (!dayNum || dayNum > 5) continue              // ข้ามเสาร์-อาทิตย์

    const dateStr  = localDateStr(d)
    const dayName  = THAI_DAY_NAMES[jsDay]
    const daySlots = slotsByDay[dayNum] || []

    // Normal timetable slots
    for (const slot of daySlots) {
      if (slot.slot_type === 'homeroom') continue
      const period = Number(slot.period_number)
      if (!Number.isFinite(period)) continue
      if (homeroomPeriodNums.has(period)) continue   // homeroom period — homeroom section จัดการ

      const key = `${slot.class_id}|${dateStr}|${period}`
      if (existingSet.has(key)) { totalSkipped++; continue }

      allPayloads.push({
        school_id:          schoolId,
        term_id:            TERM_ID,
        class_id:           slot.class_id,
        date:               dateStr,
        period_number:      period,
        planned_teacher_id: slot.teacher_id || null,
        actual_teacher_id:  null,
        subject_id:         slot.subject_id || null,
        is_filled:          false,
        slot_type:          slot.slot_type || 'normal',
      })
    }

    // Homeroom special periods
    if (homeroomSetup.length > 0) {
      for (const cls of classRows) {
        const hmIds = parseJsonbArray(cls.homeroom_teacher_ids)
        const rawFirst = hmIds.length ? hmIds[0] : cls.homeroom_teacher_id
        const hmTeacher = rawFirst ? String(rawFirst).split(',')[0].trim() : null
        if (!hmTeacher) continue

        for (const hp of homeroomSetup) {
          const period = Number(hp.period)
          if (!Number.isFinite(period)) continue
          const days = Array.isArray(hp.days) ? hp.days : []
          const applies = !days.length || days.includes('all') || days.includes(dayName)
          if (!applies) continue

          const key = `${cls.class_name}|${dateStr}|${period}`
          if (existingSet.has(key)) { totalSkipped++; continue }

          allPayloads.push({
            school_id:          schoolId,
            term_id:            TERM_ID,
            class_id:           cls.class_name,
            date:               dateStr,
            period_number:      period,
            planned_teacher_id: hmTeacher || null,
            actual_teacher_id:  null,
            subject_id:         null,
            is_filled:          false,
            slot_type:          'homeroom',
          })
        }
      }
    }
  }

  console.log(`📊  สรุปก่อน insert:`)
  console.log(`    มีอยู่แล้ว (ข้าม): ${totalSkipped.toLocaleString()} records`)
  console.log(`    ต้องสร้างใหม่:     ${allPayloads.length.toLocaleString()} records`)

  if (allPayloads.length === 0) {
    console.log('\n✅  ครบแล้ว ไม่มีคาบที่ขาดหาย')
    return
  }

  if (DRY_RUN) {
    console.log('\n🔍  DRY RUN — ตัวอย่าง 10 รายการแรกที่จะสร้าง:')
    allPayloads.slice(0, 10).forEach(p =>
      console.log(`    ${p.date}  ${p.class_id}  p${p.period_number}  ${p.subject_id || '(homeroom)'}  teacher:${p.planned_teacher_id || '-'}`)
    )
    return
  }

  // ── 7. Batch upsert (ignoreDuplicates=true = ไม่แตะที่มีอยู่) ───
  const CHUNK = 400
  let inserted = 0
  process.stdout.write(`\n⬆️  กำลัง insert ${allPayloads.length} records`)

  for (let i = 0; i < allPayloads.length; i += CHUNK) {
    const chunk = allPayloads.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('teach_actuals')
      .upsert(chunk, { onConflict: 'school_id,term_id,class_id,date,period_number', ignoreDuplicates: true })
    if (error) throw error
    inserted += chunk.length
    process.stdout.write('.')
  }

  console.log(`\n✅  เสร็จสิ้น — insert ${inserted.toLocaleString()} records`)
  console.log(`    ข้าม (มีอยู่แล้ว): ${totalSkipped.toLocaleString()} records`)
}

main().catch(err => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.message)
  process.exit(1)
})
