// src/composables/useSchedulerPresence.js
// Scheduler presence tracking via Supabase Realtime Presence channel
// Falls back to no-ops if presence channel is unavailable.

import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const HEARTBEAT_MS = 30000
const ACTIVE_WINDOW_MS = 90000

export function useSchedulerPresence() {
  const authStore = useAuthStore()

  let heartbeatTimer = null
  let presenceChannel = null

  function isSchedulableRole() {
    return authStore.hasAnyRole(['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'])
  }

  /**
   * ลงทะเบียน presence ผ่าน Supabase Realtime Presence channel
   * channel ชื่อ 'scheduler_presence_{schoolId}'
   */
  async function upsertPresence() {
    if (!isSchedulableRole()) return
    const uid = authStore.profile?.uid
    if (!uid) return

    try {
      const schoolId = authStore.schoolId || 'unknown'
      if (!presenceChannel) {
        presenceChannel = supabase.channel(`scheduler_presence_${schoolId}`)
        presenceChannel.subscribe()
      }
      await presenceChannel.track({
        uid,
        role: authStore.role || '',
        display_name: authStore.profile?.displayName || authStore.profile?.name || authStore.profile?.email || 'unknown',
        last_seen_at: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Presence upsert failed (non-fatal):', err)
    }
  }

  async function heartbeat() {
    if (!isSchedulableRole()) return
    const uid = authStore.profile?.uid
    if (!uid) return

    try {
      if (presenceChannel) {
        await presenceChannel.track({
          uid,
          last_seen_at: new Date().toISOString(),
        })
      }
    } catch {
      // ignore heartbeat errors
    }
  }

  async function leave() {
    try {
      if (presenceChannel) {
        await presenceChannel.untrack()
        await supabase.removeChannel(presenceChannel)
        presenceChannel = null
      }
    } catch {
      // ignore to avoid noisy logout/unmount flow
    }
  }

  async function getActiveSchedulerCount() {
    if (!presenceChannel) return 0
    try {
      const state = presenceChannel.presenceState()
      const now = Date.now()
      let active = 0

      for (const presences of Object.values(state)) {
        for (const p of presences) {
          const role = String(p.role || '')
          const isSchedulerRole = ['school_admin', 'admin', 'superadmin', 'school_scheduler', 'scheduler'].includes(role)
          if (!isSchedulerRole) continue
          const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0
          if (now - lastSeen <= ACTIVE_WINDOW_MS) {
            active += 1
          }
        }
      }
      return active
    } catch {
      return 0
    }
  }

  async function canEnterByLimit(limit) {
    if (!isSchedulableRole()) return { allowed: true, activeCount: 0, limit: Number(limit || 0) }

    const planLimit = Number(limit || 0)
    // 0 = ไม่ได้ตั้งค่า = ไม่จำกัด → อนุญาตเสมอ
    if (!planLimit || planLimit < 1) {
      await upsertPresence()
      return { allowed: true, activeCount: 0, limit: 0 }
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
