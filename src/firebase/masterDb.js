// Firebase Project A — Master DB
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'

const masterConfig = {
  apiKey: "YOUR_MASTER_API_KEY",
  authDomain: "YOUR_MASTER_AUTH_DOMAIN",
  databaseURL: "YOUR_MASTER_DB_URL",
  projectId: "YOUR_MASTER_PROJECT_ID",
  storageBucket: "YOUR_MASTER_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MASTER_SENDER_ID",
  appId: "YOUR_MASTER_APP_ID"
}

export const masterApp = initializeApp(masterConfig, 'master')
export const masterDb = getDatabase(masterApp)
export const masterAuth = getAuth(masterApp)
export const masterFunctions = getFunctions(masterApp, 'asia-southeast1')
