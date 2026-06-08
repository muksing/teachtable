/**
 * scripts/clean-schools.cjs
 * ลบ users ที่มี role === 'school_admin' ออกจาก Firestore
 * (ใช้ Firebase Web SDK + superadmin credentials)
 *
 * รัน: node scripts/clean-schools.cjs
 * สิ่งที่ต้องทำหลังรัน: ลบ Auth accounts จาก Firebase Console ด้วยตัวเอง
 */

const { initializeApp } = require('firebase/app')
const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = require('firebase/firestore')
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth')

const firebaseConfig = {
  apiKey: "AIzaSyBgQjPIx0FpoJnVdjhSHs2WitU_lvSdpsE",
  authDomain: "master-teachtable.firebaseapp.com",
  projectId: "master-teachtable",
}

const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)
const auth = getAuth(app)

const db   = admin.firestore()
const auth = admin.auth()

async function deleteCollection(colName) {
  const snap = await db.collection(colName).get()
  if (snap.empty) {
    console.log(`  ${colName}: ไม่มีเอกสาร`)
    return 0
  }
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  console.log(`  ${colName}: ลบแล้ว ${snap.size} เอกสาร`)
  return snap.size
}

async function main() {
  console.log('=== เริ่มลบข้อมูลโรงเรียน ===\n')

  // 1. ลบ schools
  console.log('1. ลบ schools...')
  await deleteCollection('schools')

  // 2. ลบ school_requests
  console.log('2. ลบ school_requests...')
  await deleteCollection('school_requests')

  // 3. ลบ users ที่เป็น school_admin + ลบ Auth account
  console.log('3. ลบ school_admin users...')
  const usersSnap = await db.collection('users')
    .where('role', '==', 'school_admin')
    .get()

  if (usersSnap.empty) {
    console.log('  users: ไม่พบ school_admin')
  } else {
    const batch = db.batch()
    const deleteAuthPromises = []

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data()
      console.log(`  ลบ user: ${data.email} (${userDoc.id})`)
      batch.delete(userDoc.ref)

      // ลบ Firebase Auth account
      if (userDoc.id) {
        deleteAuthPromises.push(
          auth.deleteUser(userDoc.id).catch(err => {
            // ถ้า user ไม่มีใน Auth ก็ข้ามไป
            if (err.code === 'auth/user-not-found') {
              console.log(`    (Auth account ไม่พบสำหรับ ${data.email} — ข้ามไป)`)
            } else {
              console.error(`    Error ลบ Auth ${data.email}:`, err.message)
            }
          })
        )
      }
    }

    await batch.commit()
    await Promise.all(deleteAuthPromises)
    console.log(`  users: ลบแล้ว ${usersSnap.size} คน`)
  }

  // 4. ลบ email_queue ที่ค้างอยู่ (optional)
  console.log('4. ลบ email_queue...')
  await deleteCollection('email_queue')

  console.log('\n=== เรียบร้อย! ===')
  console.log('สามารถสมัครโรงเรียนใหม่ได้เลย')
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
