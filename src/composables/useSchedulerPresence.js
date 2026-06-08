import { collection, doc, getDocs, query, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { useAuthStore } from '@/stores/auth'

const HEARTBEAT_MS = 30000
const ACTIVE_WINDOW_MS = 90000

function toMillis(v) {
  if (!v) return 0
  if (typeof v?.toMillis === 'function') return v.toMillis()
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

export function useSchedulerPresence() {
  const authStore = useAuthStore()

  let heartbeatTimer = null

  function isSchedulableRole() {
    return authStore.hasAnyRole(['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'])
  }

  function schoolRootRef() {
    return getSchoolDb()
  }

  function presenceRef(uid = authStore.profile?.uid) {
    return doc(schoolRootRef(), 'scheduler_presence', uid)
  }

  async function upsertPresence() {
    if (!isSchedulableRole()) return
    const uid = authStore.profile?.uid
    if (!uid) return

    await setDoc(presenceRef(uid), {
      uid,
      role: authStore.role || '',
      display_name: authStore.profile?.displayName || authStore.profile?.name || authStore.profile?.email || 'unknown',
      entered_at: serverTimestamp(),
      last_seen_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true })
  }

  async function heartbeat() {
    if (!isSchedulableRole()) return
    const uid = authStore.profile?.uid
    if (!uid) return

    await setDoc(presenceRef(uid), {
      uid,
      last_seen_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true })
  }

  async function leave() {
    const uid = authStore.profile?.uid
    if (!uid) return
    try {
      await deleteDoc(presenceRef(uid))
    } catch {
      // ignore to avoid noisy logout/unmount flow
    }
  }

  async function getActiveSchedulerCount() {
    const snap = await getDocs(query(collection(schoolRootRef(), 'scheduler_presence')))
    const now = Date.now()
    let active = 0

    snap.forEach((d) => {
      const data = d.data() || {}
      const role = String(data.role || '')
      const isSchedulerRole = ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'].includes(role)
      if (!isSchedulerRole) return

      const lastSeenAt = toMillis(data.last_seen_at)
      if (now - lastSeenAt <= ACTIVE_WINDOW_MS) {
        active += 1
      }
    })

    return active
  }

  async function canEnterByLimit(limit) {
    if (!isSchedulableRole()) return { allowed: true, activeCount: 0, limit: Number(limit || 0) }

    const planLimit = Number(limit || 0)
    if (!planLimit || planLimit < 1) {
      return { allowed: false, activeCount: 0, limit: 0 }
    }

    await upsertPresence()
    const activeCount = await getActiveSchedulerCount()
    if (activeCount > planLimit) {
      await leave()
      return { allowed: false, activeCount, limit: planLimit }
    }

    return { allowed: true, activeCount, limit: planLimit }
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
      heartbeat().catch(() => {})
    }, HEARTBEAT_MS)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  return {
    HEARTBEAT_MS,
    ACTIVE_WINDOW_MS,
    isSchedulableRole,
    canEnterByLimit,
    startHeartbeat,
    stopHeartbeat,
    leave,
  }
}
