// src/composables/useScheduleGuard.js
// ป้องกันการแก้ไขตารางสอนเมื่อ admin ล็อคระบบ
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useSchoolStore } from '@/stores/school'

export function useScheduleGuard() {
  const schoolStore = useSchoolStore()

  /** true เมื่อ admin ล็อคระบบจัดตารางสอน */
  const isLocked = computed(() => schoolStore.isTimetableLocked)

  /** แสดง toast แจ้งเตือน */
  function showLockMsg() {
    ElMessage.warning({
      message: '🔒 ระบบจัดตารางสอนถูกล็อค — ไม่สามารถแก้ไขได้ในขณะนี้',
      duration: 2500,
    })
  }

  /**
   * ห่อ action ด้วยการตรวจสอบ lock
   * ถ้าล็อคอยู่จะแสดง toast และ return false
   * ถ้าไม่ล็อคจะ execute fn() และ return ผลลัพธ์
   */
  function guardAction(fn) {
    if (isLocked.value) { showLockMsg(); return false }
    return fn()
  }

  return { isLocked, showLockMsg, guardAction }
}
