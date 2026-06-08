import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

const SERVICE_ACCOUNT_PATH = path.resolve('scripts/service-account.json')
const ADMIN_EMAIL = 'mee.muk@phetlakorn.ac.th'

async function main() {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  const db = admin.firestore()
  const auth = admin.auth()

  console.log(`🚀 กำลังปลดล็อกบัญชี ${ADMIN_EMAIL}...`)
  try {
    const userRecord = await auth.getUserByEmail(ADMIN_EMAIL)
    await auth.updateUser(userRecord.uid, { disabled: false })
    await db.collection('users').doc(userRecord.uid).update({ isActive: true })
    
    console.log(`✅ ปลดล็อกบัญชี ${ADMIN_EMAIL} สำเร็จ ตอนนี้สามารถเข้าสู่ระบบได้แล้วครับ!`)
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message)
  }
  process.exit(0)
}

main()