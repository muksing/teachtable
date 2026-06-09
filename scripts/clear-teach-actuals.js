import { getSupabaseAdmin, listCompatChildren } from './supabase-admin.js'

const TERM_ID = process.env.CLEAR_TERM || '2568_1'
const SCHOOL_ID = process.env.CLEAR_SCHOOL_ID || ''

async function main() {
  const supabase = getSupabaseAdmin()

  const parentPath = SCHOOL_ID
    ? `schools/${SCHOOL_ID}/terms/${TERM_ID}/teach_actual`
    : `terms/${TERM_ID}/teach_actual`

  console.log(`🔍 กำลังค้นหา teach_actual ใน: ${parentPath}`)

  const rows = await listCompatChildren(supabase, parentPath)

  if (rows.length === 0) {
    console.log('ℹ️ ไม่พบข้อมูลบันทึกเข้าสอน')
    process.exit(0)
  }

  console.log(`🗑️ พบ ${rows.length} รายการ กำลังลบ...`)

  const paths = rows.map(r => r.path)
  const { error } = await supabase
    .from('firestore_documents')
    .delete()
    .in('path', paths)

  if (error) throw error

  console.log(`✅ ลบข้อมูลบันทึกเข้าสอนเรียบร้อย ${rows.length} รายการ`)
  process.exit(0)
}

main().catch(err => {
  console.error('❌ เกิดข้อผิดพลาด:', err.message)
  process.exit(1)
})
