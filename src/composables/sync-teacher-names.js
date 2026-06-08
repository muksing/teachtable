import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

const SERVICE_ACCOUNT_PATH = path.resolve('scripts/service-account.json')
const SCHOOL_ID = '_mnwrsjpn'
const TERM_ID = '2568_1'

async function commitInChunks(db, operations) {
  const CHUNK_SIZE = 400
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE)
    const batch = db.batch()
    chunk.forEach(op => batch.update(op.ref, op.data))
    await batch.commit()
  }
}

async function main() {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  const db = admin.firestore()
  
  console.log('🚀 เริ่มซิงค์ชื่อครูให้ตรงกับรหัส...')
  const termRef = db.collection('schools').doc(SCHOOL_ID).collection('terms').doc(TERM_ID)
  
  // 1. ดึงข้อมูลครูทั้งหมดมาเป็น Master (แม่แบบ)
  const teachersSnap = await termRef.collection('teachers').get()
  const teacherMap = {}
  teachersSnap.forEach(doc => {
    const t = doc.data()
    teacherMap[t.teacher_id] = `${t.prefix || ''}${t.name} ${t.surname}`.trim()
  })
  console.log(`✅ โหลดข้อมูลครูหลักทั้งหมด ${Object.keys(teacherMap).length} คน`)

  const ops = []

  // 2. ซิงค์ ภาระงานสอน
  const assignSnap = await termRef.collection('teaching_assignments').get()
  assignSnap.forEach(doc => {
    const data = doc.data()
    if (data.teacher_id && teacherMap[data.teacher_id] && data.teacher_name !== teacherMap[data.teacher_id]) {
      ops.push({ ref: doc.ref, data: { teacher_name: teacherMap[data.teacher_id] } })
    }
  })

  // 3. ซิงค์ ตารางสอน
  const gridSnap = await termRef.collection('timetable_grid').get()
  gridSnap.forEach(doc => {
    const data = doc.data()
    if (data.teacher_id && teacherMap[data.teacher_id] && data.teacher_name !== teacherMap[data.teacher_id]) {
      ops.push({ ref: doc.ref, data: { teacher_name: teacherMap[data.teacher_id] } })
    }
  })

  // 4. ซิงค์ บันทึกเข้าสอน
  const taSnap = await termRef.collection('teach_actual').get()
  taSnap.forEach(doc => {
    const data = doc.data()
    const updates = {}
    if (data.teacher_plan_id && teacherMap[data.teacher_plan_id] && data.teacher_plan_name !== teacherMap[data.teacher_plan_id]) {
      updates.teacher_plan_name = teacherMap[data.teacher_plan_id]
    }
    if (data.subject_actual_teacher_id && teacherMap[data.subject_actual_teacher_id] && data.sub_teacher_name !== teacherMap[data.subject_actual_teacher_id]) {
      updates.sub_teacher_name = teacherMap[data.subject_actual_teacher_id]
    }
    if (Object.keys(updates).length > 0) ops.push({ ref: doc.ref, data: updates })
  })

  console.log(`⏳ พบรายการที่ชื่อผิดเพี้ยนทั้งหมด ${ops.length} รายการ กำลังอัปเดต...`)
  if (ops.length > 0) {
    await commitInChunks(db, ops)
    console.log(`🎉 ซ่อมแซมข้อมูลสำเร็จ! ชื่อครูตรงกับรหัสเรียบร้อยแล้ว`)
  } else {
    console.log(`✨ ข้อมูลถูกต้องตรงกันทั้งหมดแล้ว ไม่มีอะไรต้องอัปเดต`)
  }
  process.exit(0)
}
main()