const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

const SERVICE_ACCOUNT_PATH = path.resolve('./scripts/service-account.json')
const DEFAULTS_PATH = path.resolve('./scripts/school-defaults.json')

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function normalizeAttendanceLabel(label) {
  const value = String(label || '').trim()
  const map = {
    'ขาดเรียน': 'โดดเรียน',
    'ลา': 'ลากิจ',
    'ราชการ': 'ไปราชการ',
  }
  return map[value] || value
}

function normalizeBehaviorLabel(type, label) {
  const value = String(label || '').trim()
  if (type === 'learning') {
    const map = {
      'ก่อกวนในชั้นเรียน': 'ก่อกวน',
    }
    return map[value] || value
  }
  return value
}

function buildStatusPayload(existing, defaults) {
  return {
    status_code: existing?.status_code || defaults.status_code,
    label: normalizeAttendanceLabel(existing?.label || defaults.label),
    color: existing?.color || defaults.color,
    sort_order: Number(existing?.sort_order ?? defaults.sort_order ?? 0),
    affects_behavior: typeof existing?.affects_behavior === 'boolean' ? existing.affects_behavior : defaults.affects_behavior,
    points_default: Number(existing?.points_default ?? defaults.points_default ?? 0),
    points_min: Number(existing?.points_min ?? defaults.points_min ?? 0),
    points_max: Number(existing?.points_max ?? defaults.points_max ?? 0),
    is_active: existing?.is_active !== false,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }
}

function buildBehaviorPayload(existing, defaults) {
  return {
    setting_id: existing?.setting_id || defaults.setting_id,
    behavior_type: existing?.behavior_type || defaults.behavior_type,
    label: normalizeBehaviorLabel(defaults.behavior_type, existing?.label || defaults.label),
    category: existing?.category || defaults.category || null,
    points_default: Number(existing?.points_default ?? defaults.points_default ?? 0),
    points_min: Number(existing?.points_min ?? defaults.points_min ?? 0),
    points_max: Number(existing?.points_max ?? defaults.points_max ?? 0),
    is_auto: existing?.is_auto === true || defaults.is_auto === true,
    is_active: existing?.is_active !== false,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }
}

async function getTermDocs(schoolRef, schoolInfo) {
  const termsCollection = schoolRef.collection('terms')
  const existingTerms = await termsCollection.listDocuments()
  if (existingTerms.length > 0) {
    return existingTerms
  }

  const currentTerm = schoolInfo?.current_term
  if (!currentTerm) return []
  return [termsCollection.doc(String(currentTerm))]
}

async function syncTermDefaults(termRef, defaults, dryRun) {
  const attendanceSnapshot = await termRef.collection('attendance_status_settings').get()
  const behaviorSnapshot = await termRef.collection('behavior_settings').get()

  const existingStatuses = new Map()
  attendanceSnapshot.forEach((docSnap) => {
    const data = docSnap.data() || {}
    existingStatuses.set(normalizeAttendanceLabel(data.label || docSnap.id), { id: docSnap.id, ...data })
  })

  const existingBehaviors = new Map()
  behaviorSnapshot.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const key = `${data.behavior_type || ''}:${normalizeBehaviorLabel(data.behavior_type, data.label || docSnap.id)}`
    existingBehaviors.set(key, { id: docSnap.id, ...data })
  })

  let writes = 0
  const batch = admin.firestore().batch()

  for (const statusDefaults of defaults.attendance_statuses || []) {
    const key = normalizeAttendanceLabel(statusDefaults.label)
    const existing = existingStatuses.get(key)
    const targetRef = existing
      ? termRef.collection('attendance_status_settings').doc(existing.id)
      : termRef.collection('attendance_status_settings').doc(statusDefaults.status_code)
    const payload = buildStatusPayload(existing, statusDefaults)
    writes += 1
    if (!dryRun) {
      batch.set(targetRef, payload, { merge: true })
    }
  }

  for (const behaviorDefaults of defaults.behavior_settings || []) {
    const key = `${behaviorDefaults.behavior_type}:${normalizeBehaviorLabel(behaviorDefaults.behavior_type, behaviorDefaults.label)}`
    const existing = existingBehaviors.get(key)
    const targetRef = existing
      ? termRef.collection('behavior_settings').doc(existing.id)
      : termRef.collection('behavior_settings').doc(behaviorDefaults.setting_id)
    const payload = buildBehaviorPayload(existing, behaviorDefaults)
    writes += 1
    if (!dryRun) {
      batch.set(targetRef, payload, { merge: true })
    }
  }

  if (!dryRun && writes > 0) {
    await batch.commit()
  }

  return writes
}

async function main() {
  const dryRun = !process.argv.includes('--write')

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ ไม่พบไฟล์ service-account.json ที่ scripts/service-account.json')
    process.exit(1)
  }

  const serviceAccount = loadJson(SERVICE_ACCOUNT_PATH)
  const defaults = loadJson(DEFAULTS_PATH)

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'master-teachtable',
  })

  const db = admin.firestore()
  const schoolsSnapshot = await db.collection('schools').get()

  console.log(dryRun ? '🔎 Dry run sync school defaults' : '🚀 Sync school defaults')
  console.log(`โรงเรียนทั้งหมด ${schoolsSnapshot.size} แห่ง`)

  let totalTerms = 0
  let totalWrites = 0

  for (const schoolDoc of schoolsSnapshot.docs) {
    const schoolRef = db.collection('schools').doc(schoolDoc.id)
    const schoolInfoSnapshot = await schoolRef.collection('school_info').doc('main').get()
    const schoolInfo = schoolInfoSnapshot.exists ? schoolInfoSnapshot.data() : {}
    const termDocs = await getTermDocs(schoolRef, schoolInfo)

    for (const termDoc of termDocs) {
      const writes = await syncTermDefaults(termDoc, defaults, dryRun)
      totalTerms += 1
      totalWrites += writes
      console.log(`- ${schoolDoc.id} / ${termDoc.id}: ${writes} writes${dryRun ? ' (dry-run)' : ''}`)
    }
  }

  console.log(`เสร็จสิ้น: ${totalTerms} เทอม, ${totalWrites} writes${dryRun ? ' (ยังไม่เขียนจริง)' : ''}`)
  if (dryRun) {
    console.log('ใช้ --write เพื่อเขียนข้อมูลจริง')
  }
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.message)
  process.exit(1)
})