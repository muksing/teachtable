// Firebase Project B — School DB (dynamic per school)
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

let schoolApp = null
let schoolDb = null
let schoolAuth = null

export function initSchoolApp(config) {
  const existing = getApps().find(a => a.name === 'school')
  if (existing) {
    schoolApp = existing
  } else {
    schoolApp = initializeApp(config, 'school')
  }
  schoolDb = getDatabase(schoolApp)
  schoolAuth = getAuth(schoolApp)
  return { schoolApp, schoolDb, schoolAuth }
}

export function getSchoolDb() { return schoolDb }
export function getSchoolAuth() { return schoolAuth }
