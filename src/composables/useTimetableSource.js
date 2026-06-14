import { computed } from 'vue'
import { useSchoolStore } from '@/stores/school'

// คืนชื่อตารางที่ถูกต้อง:
//   ถ้า Admin เคย Publish แล้ว → 'timetable_slots_published'
//   ยังไม่เคย Publish          → 'timetable_slots' (fallback)
export function useTimetableSource() {
  const schoolStore = useSchoolStore()

  const slotTable = computed(() =>
    schoolStore.settingsObj?.timetable_published_at
      ? 'timetable_slots_published'
      : 'timetable_slots'
  )

  const lastPublishedAt  = computed(() => schoolStore.settingsObj?.timetable_published_at  || null)
  const lastPublishedBy  = computed(() => schoolStore.settingsObj?.timetable_published_by  || '')
  const isPublished      = computed(() => !!lastPublishedAt.value)

  return { slotTable, lastPublishedAt, lastPublishedBy, isPublished }
}
