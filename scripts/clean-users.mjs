/**
 * scripts/clean-users.mjs
 * ลบ Firestore docs ของ school_admin ทั้งหมด
 * พิมพ์ UIDs ที่ต้องลบจาก Firebase Auth Console
 *
 * รัน: node scripts/clean-users.mjs
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import * as readline from 'readline'

// ใส่อีเมล/รหัสผ่าน SuperAdmin เพื่อ authenticate
const SUPERADMIN_EMAIL = 'muksingapp@gmail.com'
const SUPERADMIN_PASSWORD_PROMPT = true  // จะถามรหัสผ่านตอน run

const firebaseConfig = {
  apiKey: 'AIzaSyBgQjPIx0FpoJnVdjhSHs2WitU_lvSdpsE',
  authDomain: 'master-teachtable.firebaseapp.com',
  projectId: 'master-teachtable',
}

const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)
const auth = getAuth(app)

function askPassword(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans) }))
}

async function main() {
  console.log('=== ลบ school_admin users ===\n')

  // Sign in เป็น SuperAdmin ก่อน
  const password = await askPassword(`รหัสผ่าน SuperAdmin (${SUPERADMIN_EMAIL}): `)
  
  try {
    await signInWithEmailAndPassword(auth, SUPERADMIN_EMAIL, password)
    console.log('✓ Login สำเร็จ\n')
  } catch (err) {
    console.error('Login ล้มเหลว:', err.message)
    process.exit(1)
  }

  // Query users ที่เป็น school_admin
  const q = query(collection(db, 'users'), where('role', '==', 'school_admin'))
  const snap = await getDocs(q)

  if (snap.empty) {
    console.log('ไม่พบ school_admin users ใน Firestore')
  } else {
    console.log(`พบ ${snap.size} accounts:\n`)
    const uids = []
    for (const userDoc of snap.docs) {
      const data = userDoc.data()
      console.log(`  - ${data.email} (UID: ${userDoc.id})`)
      uids.push(userDoc.id)
      await deleteDoc(doc(db, 'users', userDoc.id))
    }
    console.log(`\n✓ ลบ Firestore docs เรียบร้อย ${snap.size} รายการ`)
    console.log('\n⚠️  ยังต้องลบ Firebase Auth accounts ด้วยตัวเองที่:')
    console.log('   https://console.firebase.google.com/project/master-teachtable/authentication/users')
    console.log('\nUIDs ที่ต้องลบ:')
    uids.forEach(uid => console.log(`  ${uid}`))
  }

  await signOut(auth)
  console.log('\n=== เรียบร้อย ===')
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
