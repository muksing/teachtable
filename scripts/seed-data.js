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

const db = admin.firestore()

async function seedInitialData() {
  try {
    console.log('Seeding initial data...')

    // Seed master settings
    const masterSettingsRef = db.collection('masterSettings').doc('global')
    const masterSettingsDoc = await masterSettingsRef.get()

    if (!masterSettingsDoc.exists) {
      await masterSettingsRef.set({
        appName: 'Master TeachTable',
        version: '1.0.0',
        features: {
          multiTenant: true,
          autoScheduler: true,
          reports: true,
          realtime: true
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('✓ Created master settings')
    }

    // Seed system constants
    const constantsRef = db.collection('constants').doc('system')
    const constantsDoc = await constantsRef.get()

    if (!constantsDoc.exists) {
      await constantsRef.set({
        schoolStatuses: ['pending', 'approved', 'rejected', 'active', 'suspended'],
        userRoles: ['superadmin', 'schooladmin', 'teacher', 'student'],
        termTypes: ['semester', 'quarter', 'trimester'],
        attendanceStatuses: ['present', 'absent', 'late', 'excused'],
        behaviorTypes: ['positive', 'negative', 'neutral'],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('✓ Created system constants')
    }

    // Seed sample school request (for testing)
    const sampleSchoolRef = db.collection('school_requests').doc('sample-school')
    const sampleSchoolDoc = await sampleSchoolRef.get()

    if (!sampleSchoolDoc.exists) {
      await sampleSchoolRef.set({
        schoolName: 'โรงเรียนตัวอย่าง',
        schoolCode: 'SAMPLE001',
        adminEmail: 'admin@sample.school',
        adminName: 'ผู้ดูแลโรงเรียนตัวอย่าง',
        phone: '02-123-4567',
        address: '123 ถนนตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10100',
        status: 'pending',
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null
      })
      console.log('✓ Created sample school request')
    }

    console.log('Initial data seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('Failed to seed initial data:', error)
    process.exit(1)
  }
}

seedInitialData()
