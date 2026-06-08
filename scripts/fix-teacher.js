import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

const SERVICE_ACCOUNT_PATH = path.resolve('scripts/service-account.json')
const SCHOOL_ID = '_mnwrsjpn'
const TERM_ID = '2568_1'
const TEACHER_ID = '309'
const TEACHER_EMAIL = 'boonmeemuk@phetlakorn.ac.th'

async function main() {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  const db = admin.firestore()
  const auth = admin.auth()

  console.log(`🚀 กำลังตรวจสอบบัญชีครู ${TEACHER_EMAIL}...`)

  let teacherUid
  try {
    const userRecord = await auth.getUserByEmail(TEACHER_EMAIL)
    teacherUid = userRecord.uid
    console.log(`✅ พบ Auth ของครูแล้ว (UID: ${teacherUid})`)
  } catch (error) {
    console.error(`❌ ไม่พบ Auth ของอีเมลนี้ กรุณาตรวจสอบอีเมลอีกครั้ง`)
    process.exit(1)
  }

  // 1. อัปเดต Users Collection ให้ชี้ไปที่โรงเรียนและรหัสครูนี้
  const userRef = db.collection('users').doc(teacherUid)
  await userRef.set({
    uid: teacherUid,
    email: TEACHER_EMAIL,
    role: 'teacher',
    schoolId: SCHOOL_ID,
    teacherId: TEACHER_ID,
    isActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
  console.log('✅ อัปเดตข้อมูลสิทธิ์การเข้าถึงในคอลเล็กชัน users สำเร็จ')

  // 2. อัปเดตสถานะใน Teacher Collection ว่ามีบัญชีแล้ว
  const teacherRef = db.collection('schools').doc(SCHOOL_ID).collection('terms').doc(TERM_ID).collection('teachers').doc(TEACHER_ID)
  await teacherRef.set({
    uid: teacherUid,
    has_account: true,
    hasAccount: true
  }, { merge: true })
  console.log('✅ เชื่อมโยงบัญชีและอัปเดตสถานะในข้อมูลครูรหัส 309 สำเร็จ')

  console.log('🎉 แก้ไขสถานะบัญชีครูเสร็จสิ้นเรียบร้อยแล้ว!')
  process.exit(0)
}

main()