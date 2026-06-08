/**
 * scripts/update-school-mnwrsjpn.js
 * สคริปต์สำหรับแก้ไขข้อมูล Admin โรงเรียน, เพิ่มครูใหม่ และอัปเดต created_by ของครูเดิม
 * 
 * วิธีใช้:
 * 1. ตรวจสอบว่ามีไฟล์ service-account.json ในโฟลเดอร์ scripts
 * 2. รันคำสั่ง: node scripts/update-school-mnwrsjpn.js
 */

import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

// ตั้งค่าตัวแปร
const SERVICE_ACCOUNT_PATH = path.resolve('scripts/service-account.json')

const SCHOOL_ID = '_mnwrsjpn'
const TERM_ID = '2568_1' // เทอมปัจจุบันอ้างอิงจากระบบ
const NEW_ADMIN_EMAIL = 'mee.muk@phetlakorn.ac.th'
const NEW_ADMIN_PASSWORD = 'meemuk1234'
const TEACHER_EMAIL = 'boonmeemuk@phetlakorn.ac.th'
const OLD_ADMIN_UID = 'o8k3AT9ZxcNmTfWcVCsamphrvc32'

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
  const auth = admin.auth()

  console.log(`🚀 เริ่มต้นการอัปเดตข้อมูลโรงเรียน ${SCHOOL_ID}...`)

  // 1. จัดการ Firebase Auth สำหรับ Admin ใหม่
  let newAdminUid
  try {
    const userRecord = await auth.getUserByEmail(NEW_ADMIN_EMAIL)
    newAdminUid = userRecord.uid
    await auth.updateUser(newAdminUid, { password: NEW_ADMIN_PASSWORD })
    console.log(`✅ [1/4] พบผู้ใช้เดิม ทำการอัปเดตรหัสผ่านสำเร็จ (UID: ${newAdminUid})`)
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email: NEW_ADMIN_EMAIL,
        password: NEW_ADMIN_PASSWORD,
        displayName: 'Admin โรงเรียน',
      })
      newAdminUid = newUser.uid
      console.log(`✅ [1/4] สร้างผู้ใช้ Auth ใหม่สำเร็จ (UID: ${newAdminUid})`)
    } else {
      throw error
    }
  }

  // 2. อัปเดตข้อมูลผู้ใช้ระบบและ School Admin Info
  const batch1 = db.batch()
  
  // อัปเดต Users Collection
  const userRef = db.collection('users').doc(newAdminUid)
  batch1.set(userRef, {
    uid: newAdminUid,
    email: NEW_ADMIN_EMAIL,
    displayName: 'Admin โรงเรียน',
    firstName: 'Admin',
    lastName: 'โรงเรียน',
    role: 'school_admin',
    schoolId: SCHOOL_ID,
    schoolRole: 'admin',
    isActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true })

  // อัปเดต Schools Collection
  const schoolRef = db.collection('schools').doc(SCHOOL_ID)
  batch1.update(schoolRef, {
    adminUid: newAdminUid,
    adminEmail: NEW_ADMIN_EMAIL,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  })
  await batch1.commit()
  console.log('✅ [2/4] อัปเดตข้อมูลในคอลเล็กชัน users และ schools สำเร็จ')

  // 3. เพิ่มครู 309
  const teachersCollection = db.collection('schools').doc(SCHOOL_ID).collection('terms').doc(TERM_ID).collection('teachers')
  const newTeacherId = '309'
  await teachersCollection.doc(newTeacherId).set({
    teacherId: newTeacherId,
    teacher_id: newTeacherId, // เผื่อรองรับ snake_case ของระบบเดิม
    title: 'นาย',
    firstName: 'บุญมี',
    lastName: 'มุคสิงห์',
    first_name: 'บุญมี', // เผื่อรองรับ snake_case ของระบบเดิม
    last_name: 'มุคสิงห์', // เผื่อรองรับ snake_case ของระบบเดิม
    email: TEACHER_EMAIL,
    isActive: true,
    is_active: true,
    created_by: newAdminUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
  console.log(`✅ [3/4] เพิ่มครูรหัส ${newTeacherId} สำเร็จ`)

  // 4. อัปเดต UID สำหรับครูคนอื่นๆ
  const teachersSnapshot = await teachersCollection
    .where('created_by', '==', OLD_ADMIN_UID)
    .get()

  if (!teachersSnapshot.empty) {
    const batch2 = db.batch()
    let count = 0
    teachersSnapshot.forEach((doc) => {
      batch2.update(doc.ref, { created_by: newAdminUid })
      count++
    })
    await batch2.commit()
    console.log(`✅ [4/4] อัปเดต created_by ให้กับครูจำนวน ${count} คน สำเร็จ`)
  } else {
    console.log('ℹ️ [4/4] ไม่พบครูที่ใช้ created_by จาก UID เก่า จึงไม่ต้องอัปเดตใครเพิ่มเติม')
  }

  // 5. ตรวจสอบและจัดการ Admin คนเดิม
  try {
    const oldAdminRecord = await auth.getUser(OLD_ADMIN_UID)
    console.log(`ℹ️ [5/5] พบข้อมูล Admin เดิม (Email: ${oldAdminRecord.email})`)
    
    // ปิดการใช้งาน (Disable) บัญชีเดิมเพื่อความปลอดภัย
    await auth.updateUser(OLD_ADMIN_UID, { disabled: true })
    console.log(`✅ [5/5] ระงับการใช้งาน (Disable) Auth ของ Admin เดิมเรียบร้อยแล้ว`)
    
    // อัปเดตสถานะใน Firestore
    await db.collection('users').doc(OLD_ADMIN_UID).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log(`✅ [5/5] อัปเดตสถานะ Admin เดิมใน Firestore เป็น Inactive แล้ว`)
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`ℹ️ [5/5] ไม่พบบัญชี Admin เดิม (UID: ${OLD_ADMIN_UID}) ในระบบ Auth (อาจถูกลบไปแล้ว)`)
    } else {
      console.error(`❌ [5/5] เกิดข้อผิดพลาดในการจัดการ Admin เดิม:`, error)
    }
  }

  console.log('🎉 ดำเนินการเสร็จสิ้นเรียบร้อยแล้ว!')
  process.exit(0)
}

main().catch(error => {
  console.error('❌ เกิดข้อผิดพลาด:', error)
  process.exit(1)
})