/**
 * scripts/init-school.js
 * สร้างข้อมูลตั้งต้นสำหรับโรงเรียน + สร้าง Admin user แรก
 *
 * วิธีใช้:
 *   1. npm install firebase-admin (ใน root หรือ scripts/)
 *   2. Download Service Account Key จาก Firebase Console
 *      → Project Settings → Service Accounts → Generate new private key
 *   3. node scripts/init-school.js
 */

const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

const DEFAULTS_PATH = path.resolve('./scripts/school-defaults.json')

// ===== ตั้งค่าตรงนี้ =====
const SERVICE_ACCOUNT_PATH = './scripts/service-account.json' // วาง key ไว้ที่นี่

const SCHOOL_CONFIG = {
  name: 'โรงเรียนตัวอย่าง',
  current_term: '2568_1',
  year: 2568,
  address: '',
  phone: '',
  email: '',
}

const ADMIN_USER = {
  email: 'admin@school.ac.th',     // ← เปลี่ยนเป็นอีเมลจริง
  password: 'Admin@123456',         // ← เปลี่ยนรหัสผ่าน
  displayName: 'ผู้ดูแลระบบ',
  role: 'admin',
}
// ===========================

async function main() {
  // Init Admin SDK
  const serviceAccount = require(SERVICE_ACCOUNT_PATH)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'master-teachtable'
  })

  const db   = admin.firestore()
  const auth = admin.auth()
  const schoolDefaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'))

  console.log('🚀 เริ่มสร้างข้อมูลตั้งต้น...\n')

  // 1. สร้าง Admin User ใน Firebase Auth
  console.log('👤 สร้าง Admin user...')
  let uid
  try {
    const user = await auth.createUser({
      email:        ADMIN_USER.email,
      password:     ADMIN_USER.password,
      displayName:  ADMIN_USER.displayName,
      emailVerified: true,
    })
    uid = user.uid
    console.log(`   ✅ สร้าง user สำเร็จ: ${uid}`)
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(ADMIN_USER.email)
      uid = user.uid
      console.log(`   ℹ️  user มีอยู่แล้ว: ${uid}`)
    } else throw e
  }

  // 2. บันทึก user profile ใน Firestore
  console.log('📝 บันทึก user profile...')
  await db.collection('users').doc(uid).set({
    uid,
    email:        ADMIN_USER.email,
    displayName:  ADMIN_USER.displayName,
    role:         ADMIN_USER.role,
    is_active:    true,
    created_at:   admin.firestore.FieldValue.serverTimestamp(),
    last_login:   null,
  }, { merge: true })
  console.log('   ✅ บันทึก profile เรียบร้อย')

  // 3. บันทึก School Info
  console.log('🏫 บันทึกข้อมูลโรงเรียน...')
  await db.collection('school_info').doc('main').set({
    ...SCHOOL_CONFIG,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  console.log('   ✅ บันทึกข้อมูลโรงเรียนเรียบร้อย')

  // 4. สร้างข้อมูลตั้งต้น term
  const term = SCHOOL_CONFIG.current_term
  console.log(`\n📅 สร้างข้อมูลตั้งต้นสำหรับเทอม ${term}...`)

  const batch = db.batch()

  // สถานะการมาเรียน
  const statuses = schoolDefaults.attendance_statuses || []
  statuses.forEach(s => {
    batch.set(db.collection(`terms/${term}/attendance_status_settings`).doc(s.status_code), s)
  })
  console.log('   ✅ สถานะการมาเรียน 5 รายการ')

  // ตั้งค่าพฤติกรรม
  const behaviors = schoolDefaults.behavior_settings || []
  behaviors.forEach(b => {
    batch.set(db.collection(`terms/${term}/behavior_settings`).doc(b.setting_id), b)
  })
  console.log('   ✅ ตั้งค่าพฤติกรรม 8 รายการ')

  await batch.commit()
  console.log('   ✅ Batch commit เรียบร้อย')

  console.log('\n🎉 สร้างข้อมูลตั้งต้นเรียบร้อยทั้งหมด!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📧 Email:    ', ADMIN_USER.email)
  console.log('🔑 Password: ', ADMIN_USER.password)
  console.log('🏫 โรงเรียน: ', SCHOOL_CONFIG.name)
  console.log('📅 เทอม:     ', term)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  เปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบครั้งแรก!')

  process.exit(0)
}

main().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
