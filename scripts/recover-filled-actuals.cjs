/**
 * recover-filled-actuals.cjs
 * กู้คืน teach_actuals ที่ is_filled ถูก reset เป็น false โดยบั๊ก generateTeachActualsForDate
 *
 * หลักการ: ถ้า is_filled=false แต่ยังมี student_records / record_by_name อยู่
 * แสดงว่าเคยบันทึกแล้ว → set is_filled=true คืนให้
 *
 * วิธีใช้:
 *   node scripts/recover-filled-actuals.cjs          (dry-run ดูก่อน)
 *   node scripts/recover-filled-actuals.cjs --fix    (แก้จริง)
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// ── โหลด .env ────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const SUPABASE_URL        = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ไม่พบ SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const DRY_RUN = !process.argv.includes('--fix')

async function main() {
  console.log(DRY_RUN ? '🔍 DRY-RUN mode (ดูข้อมูลเท่านั้น)' : '🔧 FIX mode (แก้ไขจริง)')
  console.log('')

  // ── ค้นหา teach_actuals ที่ is_filled=false แต่มีข้อมูลจริง ──────────────
  const PAGE = 1000
  let affected = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('teach_actuals')
      .select('id, school_id, class_id, date, period_number, planned_teacher_id, record_by_name, topic, student_records, is_filled')
      .eq('is_filled', false)
      .range(from, from + PAGE - 1)
    if (error) { console.error('Query error:', error); process.exit(1) }
    if (!data?.length) break

    for (const row of data) {
      const hasStudentRecords = row.student_records
        && typeof row.student_records === 'object'
        && Object.keys(row.student_records).length > 0
      const hasRecordByName = row.record_by_name && row.record_by_name.trim() !== ''
      const hasTopic = row.topic && row.topic.trim() !== ''

      if (hasStudentRecords || hasRecordByName) {
        affected.push({
          ...row,
          _reason: hasStudentRecords ? `student_records มี ${Object.keys(row.student_records).length} คน`
                                     : `record_by_name="${row.record_by_name}"`,
        })
      }
    }
    if (data.length < PAGE) break
  }

  console.log(`พบ teach_actuals ที่ is_filled=false แต่มีข้อมูลจริง: ${affected.length} record`)
  console.log('')

  if (!affected.length) {
    console.log('✅ ไม่มี record ที่ต้องกู้คืน')
    return
  }

  // ── แสดงตัวอย่าง 20 แรก ─────────────────────────────────────────────────
  const preview = affected.slice(0, 20)
  console.log('ตัวอย่าง 20 record แรก:')
  console.log('─'.repeat(90))
  console.log(`${'วันที่'.padEnd(12)} ${'ห้อง'.padEnd(10)} ${'คาบ'.padEnd(6)} ${'ครู'.padEnd(20)} เหตุผล`)
  console.log('─'.repeat(90))
  for (const r of preview) {
    const date     = String(r.date || '').slice(0, 10)
    const cls      = String(r.class_id || '').padEnd(10)
    const period   = String(r.period_number || '').padEnd(6)
    const teacher  = String(r.planned_teacher_id || '-').slice(0, 20).padEnd(20)
    console.log(`${date.padEnd(12)} ${cls} ${period} ${teacher} ${r._reason}`)
  }
  if (affected.length > 20) console.log(`  ... และอีก ${affected.length - 20} record`)

  // ── สรุปแยกตามโรงเรียน ──────────────────────────────────────────────────
  const bySchool = {}
  for (const r of affected) {
    bySchool[r.school_id] = (bySchool[r.school_id] || 0) + 1
  }
  console.log('')
  console.log('สรุปแยกตามโรงเรียน:')
  for (const [sid, cnt] of Object.entries(bySchool)) {
    console.log(`  ${sid}: ${cnt} record`)
  }

  if (DRY_RUN) {
    console.log('')
    console.log('💡 รันด้วย --fix เพื่อแก้ไขจริง:')
    console.log('   node scripts/recover-filled-actuals.cjs --fix')
    return
  }

  // ── แก้ไขจริง: set is_filled=true ──────────────────────────────────────
  console.log('')
  console.log('⚙️  กำลังกู้คืน...')
  const ids = affected.map(r => r.id)
  const CHUNK = 500
  let fixed = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('teach_actuals')
      .update({ is_filled: true, updated_at: new Date().toISOString() })
      .in('id', chunk)
    if (error) {
      console.error(`❌ ERROR chunk ${i}–${i + CHUNK}:`, error)
      process.exit(1)
    }
    fixed += chunk.length
    process.stdout.write(`\r  กู้คืนแล้ว ${fixed}/${ids.length}`)
  }
  console.log('')
  console.log(`\n✅ กู้คืนสำเร็จ ${fixed} record`)
}

main().catch(e => { console.error(e); process.exit(1) })
