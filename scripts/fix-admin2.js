import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

const SERVICE_ACCOUNT_PATH = path.resolve('scripts/service-account.json')
const TARGET_EMAIL = 'advisor5@phetlakorn.ac.th'

async function main() {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  const db = admin.firestore()
  const auth = admin.auth()

  console.log(`🚀 กำลังตรวจสอบและซ่อมแซมบัญชี ${TARGET_EMAIL}...`)

  try {
    // 1. ดึงข้อมูลผู้ใช้จาก Auth
    const userRecord = await auth.getUserByEmail(TARGET_EMAIL)
    const uid = userRecord.uid
    console.log(`✅ พบ UID ในระบบ Auth: ${uid}`)

    // ปลดล็อกบัญชีหากถูกระงับ
    if (userRecord.disabled) {
      await auth.updateUser(uid, { disabled: false })
      console.log(`✅ ปลดล็อกสถานะ Disabled ใน Auth เรียบร้อยแล้ว`)
    }

    // 2. ค้นหารหัสโรงเรียน (School ID) ที่แอดมินคนนี้ดูแลอยู่
    const schoolsSnap = await db.collection('schools').where('adminEmail', '==', TARGET_EMAIL).get()
    let schoolId = null
    if (!schoolsSnap.empty) {
      schoolId = schoolsSnap.docs[0].id
      console.log(`✅ พบข้อมูลโรงเรียนที่สังกัด (School ID: ${schoolId})`)
      
      // เปิดใช้งานโรงเรียนเผื่อกรณีถูกระงับ
      await db.collection('schools').doc(schoolId).update({ isActive: true })
    } else {
      console.log(`⚠️ ไม่พบโรงเรียนที่เชื่อมกับอีเมลนี้ (อาจส่งผลให้เข้าใช้งานหน้าแอดมินโรงเรียนไม่ได้)`)
    }

    // 3. ซ่อมแซมข้อมูลใน Firestore (users collection)
    const userRef = db.collection('users').doc(uid)
    const userData = {
      uid: uid,
      email: TARGET_EMAIL,
      role: 'school_admin',
      roles: ['school_admin', 'admin'],
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
    
    if (schoolId) {
      userData.schoolId = schoolId
      userData.schoolRole = 'admin'
    }

    await userRef.set(userData, { merge: true })
    console.log(`✅ ซ่อมแซมสิทธิ์ (Roles) และสถานะบัญชีใน Firestore สำเร็จ!`)

    console.log(`🎉 เรียบร้อย! คุณสามารถนำอีเมล ${TARGET_EMAIL} ไปเข้าสู่ระบบได้เลยครับ`)
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message)
  }
  process.exit(0)
}

main()