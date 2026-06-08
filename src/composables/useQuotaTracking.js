// src/composables/useQuotaTracking.js
// ระบบติดตามการใช้ Quota ของการจัดตารางอัตโนมัติ

import { ref } from 'vue'
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { useSchoolStore } from '@/stores/school'

/**
 * Schema สำหรับเก็บ Quota Usage Log
 * locations: /schools/{schoolId}/quota_usage/{year_month}/{docId}
 */
export const QUOTA_USAGE_SCHEMA = {
  id: '', // auto generate
  school_id: '',
  year_month: '', // เช่น "2568-01"
  term: '', // เช่น "2568_1"
  
  // ประเภทการใช้
  usage_type: 'auto_schedule', // auto_schedule | manual_adjustment | etc
  
  // จำนวน Quota ที่ใช้
  quota_used: 0, // units
  
  // รายละเอียด
  description: '', // "จัดตารางอัตโนมัติสำหรับ ม.1"
  metadata: {}, // ข้อมูลเพิ่มเติม เช่น { classes: 12, periods: 96, ... }
  
  // ใครทำ
  created_by: '', // uid
  created_by_name: '', // display name
  
  // timestamp
  created_at: null, // Timestamp
}

/**
 * Schema สำหรับเก็บ Quota Summary ต่อเดือน
 * location: /schools/{schoolId}/quota_summary/2568-01
 */
export const QUOTA_SUMMARY_SCHEMA = {
  id: '', // key: "2568-01"
  school_id: '',
  year_month: '',
  
  // ข้อมูลแพกเกจ
  package_code: '', // "200", "300", "500"
  package_limit: 0, // quota limit ของแพกเกจ
  
  // การใช้
  total_quota_used: 0, // รวมทั้งเดือน
  usage_count: 0, // จำนวนครั้งที่ใช้
  
  // วันที่
  period_start_date: null, // Timestamp วันแรกของเดือน
  period_end_date: null, // Timestamp วันท้ายของเดือน
  
  // ข้อมูลเพิ่มเติม
  updated_at: null,
}

export function useQuotaTracking() {
  const schoolStore = useSchoolStore()
  const schoolId = () => schoolStore.schoolId
  const db = () => getSchoolDb()

  const loading = ref(false)
  const error = ref(null)

  /**
   * บันทึก Quota Usage เมื่อมีการจัดตารางอัตโนมัติ
   * @param {Object} options
   * @param {number} options.quota_used - จำนวน Quota ที่ใช้
   * @param {string} options.usage_type - ประเภทการใช้ (default: 'auto_schedule')
   * @param {string} options.description - คำอธิบาย
   * @param {Object} options.metadata - ข้อมูลเพิ่มเติม
   * @param {string} options.created_by - UID ผู้ทำการดำเนินการ
   * @returns {Promise}
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

      if (!schoolId()) {
        throw new Error('School ID not found')
      }

      if (quota_used <= 0) {
        throw new Error('Quota used must be greater than 0')
      }

      // คำนวณ year-month
      const now = new Date()
      const year = now.getFullYear() + 543 // Convert to Thai Buddhist Year
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const yearMonth = `${year}-${month}`

      // เก็บ usage log
      const usageRef = collection(db(), `schools/${schoolId()}/quota_usage/${yearMonth}`)
      const usageDoc = {
        ...QUOTA_USAGE_SCHEMA,
        school_id: schoolId(),
        year_month: yearMonth,
        usage_type,
        quota_used: Math.max(0, Number(quota_used || 0)),
        description,
        metadata,
        created_by,
        created_by_name,
        created_at: serverTimestamp(),
      }

      const result = await addDoc(usageRef, usageDoc)
      console.log('✅ Quota usage logged:', result.id)

      // อัปเดต Summary
      await updateQuotaSummary(yearMonth, quota_used)

      return { success: true, id: result.id }
    } catch (err) {
      error.value = err.message
      console.error('❌ Log quota usage error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * อัปเดต Quota Summary ต่อเดือน
   */
  async function updateQuotaSummary(yearMonth, quotaUsed) {
    try {
      const summaryRef = doc(db(), `schools/${schoolId()}/quota_summary`, yearMonth)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const snap = await getDoc(summaryRef)

      if (!snap.exists()) {
        // สร้าง summary ใหม่
        await setDoc(summaryRef, {
          id: yearMonth,
          school_id: schoolId(),
          year_month: yearMonth,
          package_code: 'unknown', // จะต้องดึงมาจากแพกเกจที่สมัครไว้
          package_limit: 0,
          total_quota_used: quotaUsed,
          usage_count: 1,
          period_start_date: monthStart,
          period_end_date: monthEnd,
          updated_at: serverTimestamp(),
        })
      } else {
        // อัปเดตข้อมูลเดิม
        const summary = snap.data() || {}
        await setDoc(summaryRef, {
          total_quota_used: (summary.total_quota_used || 0) + quotaUsed,
          usage_count: (summary.usage_count || 0) + 1,
          updated_at: serverTimestamp(),
        }, { merge: true })
      }
    } catch (err) {
      console.error('Error updating quota summary:', err)
    }
  }

  /**
   * ดูประวัติ Quota Usage ในเดือนปัจจุบัน
   */
  async function getQuotaUsageHistory(yearMonth = null) {
    loading.value = true
    error.value = null

    try {
      if (!schoolId()) {
        throw new Error('School ID not found')
      }

      const ym = yearMonth || getCurrentYearMonth()
      const usageRef = collection(db(), `schools/${schoolId()}/quota_usage/${ym}`)
      const q = query(usageRef, orderBy('created_at', 'desc'))
      const snap = await getDocs(q)

      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (err) {
      error.value = err.message
      console.error('Error getting quota history:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * ดู Quota Summary ในเดือนปัจจุบัน
   */
  async function getQuotaSummary(yearMonth = null) {
    loading.value = true
    error.value = null

    try {
      if (!schoolId()) {
        throw new Error('School ID not found')
      }

      const ym = yearMonth || getCurrentYearMonth()
      const summaryRef = doc(db(), `schools/${schoolId()}/quota_summary`, ym)
      const snap = await getDoc(summaryRef)

      if (!snap.exists()) {
        return null
      }

      return { id: snap.id, ...snap.data() }
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
      if (!summary) {
        return packageLimit
      }

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
 * @param {number} classCount - จำนวนห้องเรียน
 * @param {number} periodCount - จำนวนคาบรวม
 * @param {number} intensity - ความเข้ม (0.5-2.0)
 * @returns {number} quota units
 */
export function calculateScheduleQuota(classCount = 1, periodCount = 1, intensity = 1.0) {
  // สูตร: ห้อง × คาบ × ความเข้ม ÷ 10 (ปัด)
  const quota = Math.ceil((classCount * periodCount * Math.max(0.5, Math.min(2.0, intensity))) / 10)
  return Math.max(1, quota)
}
