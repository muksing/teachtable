import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

// ตั้งค่าตัวแปร
const SERVICE_ACCOUNT_PATH = path.resolve('scripts/service-account.json')
const TERM_ID = '2568_1' // เปลี่ยนให้ตรงกับเทอมปัจจุบันของคุณ

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ ไม่พบไฟล์ Service Account ที่:', SERVICE_ACCOUNT_PATH)
    process.exit(1)
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  const db = admin.firestore()

  console.log(`🚀 กำลังค้นหาข้อมูลบันทึกเข้าสอนในเทอม ${TERM_ID}...`)
  
  // หากระบบของคุณเป็น Multi-tenant (มีหลายโรงเรียน) ให้เปลี่ยน Path เป็น `schools/SCHOOL_ID/terms/${TERM_ID}/teach_actual`
  const teachActualsRef = db.collection(`terms/${TERM_ID}/teach_actual`)
  const snapshot = await teachActualsRef.get()

  if (snapshot.empty) {
    console.log('ℹ️ ไม่พบข้อมูลบันทึกเข้าสอนให้ลบ')
    process.exit(0)
  }

  console.log(`🗑️ พบข้อมูลทั้งหมด ${snapshot.size} รายการ กำลังดำเนินการลบ...`)

  const batch = db.batch()
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })

  await batch.commit()

  console.log('🎉 ลบข้อมูลบันทึกเข้าสอนสมมุติทั้งหมดเรียบร้อยแล้ว!')
  process.exit(0)
}

main().catch(error => {
  console.error('❌ เกิดข้อผิดพลาด:', error)
  process.exit(1)
})