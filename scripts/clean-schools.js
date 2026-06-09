/**
 * scripts/clean-schools.js
 * ลบ school_admin users และข้อมูลโรงเรียนออกจาก Supabase
 *
 * รัน: node scripts/clean-schools.js
 * ตัวเลือก:
 *   --dry-run   แสดงรายการแต่ไม่ลบจริง
 */
import { getSupabaseAdmin } from './supabase-admin.js'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const supabase = getSupabaseAdmin()

  console.log('=== ลบ school_admin users ===\n')
  if (DRY_RUN) console.log('(dry-run mode — ไม่ลบจริง)\n')

  // ดึง users ที่เป็น school_admin จาก firestore_documents
  const { data: userDocs, error: fetchErr } = await supabase
    .from('firestore_documents')
    .select('path,id,data')
    .eq('parent_path', 'users')

  if (fetchErr) throw fetchErr

  const admins = (userDocs || []).filter(d => d.data?.role === 'school_admin')

  if (admins.length === 0) {
    console.log('ไม่พบ school_admin users')
    process.exit(0)
  }

  console.log(`พบ ${admins.length} school_admin accounts:\n`)
  for (const u of admins) {
    console.log(`  - ${u.data?.email || u.id} (path: ${u.path})`)
  }

  if (DRY_RUN) {
    console.log('\n(dry-run: ข้ามการลบ)')
    process.exit(0)
  }

  // ลบ firestore_documents records
  const paths = admins.map(u => u.path)
  const { error: delErr } = await supabase
    .from('firestore_documents')
    .delete()
    .in('path', paths)

  if (delErr) throw delErr

  console.log(`\n✅ ลบ Supabase DB records เรียบร้อย ${admins.length} รายการ`)

  // ลบ Supabase Auth accounts
  let authDeleted = 0
  for (const u of admins) {
    const uid = u.id
    const { error } = await supabase.auth.admin.deleteUser(uid)
    if (error) {
      console.warn(`  ⚠️ ลบ Auth ไม่ได้: ${uid} — ${error.message}`)
    } else {
      authDeleted++
    }
  }

  console.log(`✅ ลบ Supabase Auth accounts ${authDeleted}/${admins.length} รายการ`)
  console.log('\n=== เรียบร้อย ===')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ เกิดข้อผิดพลาด:', err.message)
  process.exit(1)
})
