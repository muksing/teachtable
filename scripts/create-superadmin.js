import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve('scripts/service-account-master.json')

if (!fs.existsSync(keyPath)) {
  console.error('Service account file not found. Set GOOGLE_APPLICATION_CREDENTIALS or place the file at scripts/service-account-master.json.')
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://master-teachtable-default-rtdb.asia-southeast1.firebasedatabase.app'
})

const auth = admin.auth()
const db = admin.firestore()

const SUPERADMIN_EMAIL = 'muksingapp@gmail.com'
const SUPERADMIN_PASSWORD = 'SuperMuksing'
const SUPERADMIN_DISPLAY_NAME = 'Super Admin'

async function createSuperAdmin() {
  try {
    let userRecord

    try {
      userRecord = await auth.getUserByEmail(SUPERADMIN_EMAIL)
      console.log('SuperAdmin already exists:', userRecord.uid)
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: SUPERADMIN_EMAIL,
          emailVerified: true,
          password: SUPERADMIN_PASSWORD,
          displayName: SUPERADMIN_DISPLAY_NAME
        })
        console.log('Created SuperAdmin auth user:', userRecord.uid)
      } else {
        throw error
      }
    }

    const userDocRef = db.collection('users').doc(userRecord.uid)
    const userDoc = await userDocRef.get()

    if (!userDoc.exists) {
      await userDocRef.set({
        uid: userRecord.uid,
        email: SUPERADMIN_EMAIL,
        displayName: SUPERADMIN_DISPLAY_NAME,
        firstName: 'Super',
        lastName: 'Admin',
        globalRole: 'superadmin',
        role: 'superadmin',
        isActive: true,
        permissions: ['all'],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: null
      })
      console.log('Created SuperAdmin user profile in Firestore')
    } else {
      console.log('SuperAdmin user profile already exists in Firestore')
    }

    console.log('SuperAdmin setup complete.')
    process.exit(0)
  } catch (error) {
    console.error('Failed to create SuperAdmin:', error)
    process.exit(1)
  }
}

createSuperAdmin()
