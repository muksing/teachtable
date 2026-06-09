import { serverTimestamp } from '@/supabase/firestore'
import { useAuthStore } from '@/stores/auth'

/**
 * สร้าง audit fields สำหรับทุก write operation
 * บังคับทุกครั้งที่บันทึกข้อมูล
 */
export function getAuditFields() {
  const authStore = useAuthStore()
  return {
    updated_by: authStore.profile?.uid || 'system',
    updated_by_name: authStore.profile?.displayName || 'ระบบ',
    updated_at: serverTimestamp()
  }
}

/**
 * Format audit info สำหรับแสดงในตาราง
 * "แก้ไขล่าสุดโดย: {ชื่อ} เมื่อ {เวลา}"
 */
export function formatAuditInfo(record) {
  if (!record?.updated_by_name || !record?.updated_at) return ''
  const date = new Date(record.updated_at)
  const formatted = date.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  return `แก้ไขล่าสุดโดย: ${record.updated_by_name} เมื่อ ${formatted}`
}
