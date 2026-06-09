// src/composables/useQuotaTracking.js
// ระบบติดตามการใช้ Quota ของการจัดตารางอัตโนมัติ

import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

/**
 * Schema สำหรับเก็บ Quota Usage Log
 * Stored in schools.settings.quota_tracking JSONB
 */
export const QUOTA_USAGE_SCHEMA = {
  id: '',
  school_id: '',
  year_month: '',
  term: '',
  usage_type: 'auto_schedule',
  quota_used: 0,
  description: '',
  metadata: {},
  created_by: '',
  created_by_name: '',
  created_at: null,
}

/**
 * Schema สำหรับเก็บ Quota Summary ต่อเดือน
 */
export const QUOTA_SUMMARY_SCHEMA = {
  id: '',
  school_id: '',
  year_month: '',
  package_code: '',
  package_limit: 0,
  total_quota_used: 0,
  usage_count: 0,
  period_start_date: null,
  period_end_date: null,
  updated_at: null,
}

export function useQuotaTracking() {
  const schoolStore = useSchoolStore()
  const authStore = useAuthStore()
  const schoolId = () => authStore.schoolId

  const loading = ref(false)
  const error = ref(null)

  /**
   * อ่าน quota_tracking ปัจจุบันจาก schools.settings
   */
  async function _readQuotaSettings() {
    const sid = schoolId()
    if (!sid) return {}
    const { data, error: err } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', sid)
      .single()
    if (err) throw err
    return (data?.settings?.quota_tracking) || {}
  }

  /**
   * เขียน quota_tracking กลับลง schools.settings (merge)
   */
  async function _writeQuotaSettings(quotaTracking) {
    const sid = schoolId()
    if (!sid) return

    // อ่าน settings ทั้งหมดก่อนเพื่อ merge
    const { data, error: readErr } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', sid)
      .single()
    if (readErr) throw readErr

    const existingSettings = data?.settings || {}
    const { error: writeErr } = await supabase
      .from('schools')
      .update({ settings: { ...existingSettings, quota_tracking: quotaTracking } })
      .eq('id', sid)
    if (writeErr) throw writeErr
  }

  /**
   * บันทึก Quota Usage เมื่อมีการจัดตารางอัตโนมัติ
   */
  async function logQuotaUsage(options = {}) {
    loading.value = true
    error.value = null

    try {
      const {
        quota_used = 0,
        usage_type = 'auto_schedule',
        description = '',
        metadata = {},
        created_by = '',
        created_by_name = '',
      } = options

      if (!schoolId()) throw new Error('School ID not found')
      if (quota_used <= 0) throw new Error('Quota used must be greater than 0')

      const now = new Date()
      const year = now.getFullYear() + 543
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const yearMonth = `${year}-${month}`

      const quotaTracking = await _readQuotaSettings()

      // Append to usage log array
      const usageLogs = quotaTracking.usage_logs || []
      const newEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        school_id: schoolId(),
        year_month: yearMonth,
        term: schoolStore.currentTerm || '',
        usage_type,
        quota_used: Math.max(0, Number(quota_used || 0)),
        description,
        metadata,
        created_by,
        created_by_name,
        created_at: now.toISOString(),
      }
      usageLogs.push(newEntry)

      // Update summary
      const summaries = quotaTracking.summaries || {}
      const prevSummary = summaries[yearMonth] || {
        school_id: schoolId(),
        year_month: yearMonth,
        package_code: 'unknown',
        package_limit: 0,
        total_quota_used: 0,
        usage_count: 0,
      }
      summaries[yearMonth] = {
        ...prevSummary,
        total_quota_used: (prevSummary.total_quota_used || 0) + quota_used,
        usage_count: (prevSummary.usage_count || 0) + 1,
        updated_at: now.toISOString(),
      }

      await _writeQuotaSettings({ usage_logs: usageLogs, summaries })
      console.log('✅ Quota usage logged:', newEntry.id)

      return { success: true, id: newEntry.id }
    } catch (err) {
      error.value = err.message
      console.error('❌ Log quota usage error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * ดูประวัติ Quota Usage ในเดือนที่ระบุ
   */
  async function getQuotaUsageHistory(yearMonth = null) {
    loading.value = true
    error.value = null

    try {
      if (!schoolId()) throw new Error('School ID not found')

      const ym = yearMonth || getCurrentYearMonth()
      const quotaTracking = await _readQuotaSettings()
      const usageLogs = quotaTracking.usage_logs || []

      return usageLogs
        .filter(entry => entry.year_month === ym)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } catch (err) {
      error.value = err.message
      console.error('Error getting quota history:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * ดู Quota Summary ในเดือนที่ระบุ
   */
  async function getQuotaSummary(yearMonth = null) {
    loading.value = true
    error.value = null

    try {
      if (!schoolId()) throw new Error('School ID not found')

      const ym = yearMonth || getCurrentYearMonth()
      const quotaTracking = await _readQuotaSettings()
      const summaries = quotaTracking.summaries || {}

      return summaries[ym] || null
    } catch (err) {
      error.value = err.message
      console.error('Error getting quota summary:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * คำนวณ Quota ที่เหลือสำหรับเดือนนี้
   */
  async function getRemainingQuota(packageLimit = 1000, yearMonth = null) {
    try {
      const summary = await getQuotaSummary(yearMonth)
      if (!summary) return packageLimit
      return Math.max(0, packageLimit - summary.total_quota_used)
    } catch (err) {
      console.error('Error calculating remaining quota:', err)
      return packageLimit
    }
  }

  /**
   * ตรวจสอบว่ามี Quota เพียงพอหรือไม่
   */
  async function hasEnoughQuota(requiredQuota = 1, packageLimit = 1000, yearMonth = null) {
    const remaining = await getRemainingQuota(packageLimit, yearMonth)
    return remaining >= requiredQuota
  }

  return {
    loading,
    error,
    logQuotaUsage,
    getQuotaUsageHistory,
    getQuotaSummary,
    getRemainingQuota,
    hasEnoughQuota,
  }
}

/**
 * คำนวณ Year-Month ปัจจุบัน (BE)
 */
function getCurrentYearMonth() {
  const now = new Date()
  const year = now.getFullYear() + 543
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * ฟังก์ชันช่วย: คำนวณ Quota ที่ใช้จากการจัดตาราง
 */
export function calculateScheduleQuota(classCount = 1, periodCount = 1, intensity = 1.0) {
  const quota = Math.ceil((classCount * periodCount * Math.max(0.5, Math.min(2.0, intensity))) / 10)
  return Math.max(1, quota)
}
