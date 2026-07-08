<template>
  <div class="stb-page">
    <div class="stb-header">
      <div class="stb-title">📅 ตารางสอนห้อง {{ session.class_id }}</div>
      <div class="stb-term">{{ termLabel }}</div>
    </div>

    <div v-if="loading" class="stb-loading">กำลังโหลด...</div>
    <div v-else-if="error" class="stb-error">{{ error }}</div>
    <div v-else-if="!slots.length" class="stb-empty">ยังไม่มีตารางสอน</div>

    <div v-else class="stb-body">
      <div class="stb-table-wrap">
        <table class="stb-table">
          <thead>
            <tr>
              <th class="day-col">วัน</th>
              <th v-for="p in periodNums" :key="p" class="period-col">คาบ {{ p }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in activeDays" :key="d.num">
              <td class="day-col">{{ d.full }}</td>
              <td v-for="p in periodNums" :key="`${d.num}-${p}`" class="slot-cell" :class="slotClass(slotAt(d.num, p))">
                <div v-if="slotAt(d.num, p)" class="slot-content">
                  <template v-if="slotAt(d.num, p).slot_type === 'subject'">
                    <div v-if="slotAt(d.num, p).subject_id" class="subject-code">{{ slotAt(d.num, p).subject_id }}</div>
                    <div class="subject-name">{{ slotAt(d.num, p).subject_name || 'ไม่มีชื่อวิชา' }}</div>
                    <div v-if="slotAt(d.num, p).teacher_name?.trim()" class="teacher-name">{{ slotAt(d.num, p).teacher_name }}</div>
                    <div v-if="slotAt(d.num, p).room_id" class="room-name">{{ slotAt(d.num, p).room_id }}</div>
                  </template>
                  <template v-else-if="slotAt(d.num, p).slot_type === 'activity'">
                    <div class="subject-name act-name">{{ slotAt(d.num, p).act_name || 'กิจกรรม' }}</div>
                  </template>
                  <template v-else>
                    <div class="subject-name lock-name">{{ slotAt(d.num, p).lock_label || 'ล็อก' }}</div>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const session      = computed(() => studentStore.session || {})
const termLabel    = computed(() => {
  const s = session.value
  if (!s.term_semester || !s.term_year) return s.current_term || ''
  return `ภาคเรียนที่ ${s.term_semester} ปีการศึกษา ${s.term_year}`
})

const DAY_NAMES = [
  { num: 1, short: 'จ', full: 'จันทร์' },
  { num: 2, short: 'อ', full: 'อังคาร' },
  { num: 3, short: 'พ', full: 'พุธ' },
  { num: 4, short: 'พฤ', full: 'พฤหัสบดี' },
  { num: 5, short: 'ศ', full: 'ศุกร์' },
  { num: 6, short: 'ส', full: 'เสาร์' },
  { num: 7, short: 'อา', full: 'อาทิตย์' },
]

const loading   = ref(true)
const error     = ref('')
const slots     = ref([])

const activeDays = computed(() => {
  const days = new Set(slots.value.map(s => s.day_of_week))
  return DAY_NAMES.filter(d => days.has(d.num))
})

const periodNums = computed(() => {
  if (!slots.value.length) return []
  const max = Math.max(...slots.value.map(s => s.period_number))
  const min = Math.min(...slots.value.map(s => s.period_number))
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
})

const slotMap = computed(() => {
  const m = {}
  slots.value.forEach(s => { m[`${s.day_of_week}_${s.period_number}`] = s })
  return m
})

function slotAt(day, period) { return slotMap.value[`${day}_${period}`] || null }

function slotClass(slot) {
  if (!slot) return 'empty-cell'
  if (slot.slot_type === 'activity') return 'color-act'
  if (slot.slot_type === 'lock') return 'color-lock'
  return 'color-sub'
}

async function load() {
  loading.value = true
  error.value = ''
  const { school_id, class_id, current_term } = session.value
  if (!school_id || !class_id || !current_term) {
    error.value = 'ไม่พบข้อมูลห้องเรียน'
    loading.value = false
    return
  }
  const { data, error: err } = await supabase.rpc('get_class_timetable', {
    p_school_id: school_id,
    p_class_id:  class_id,
    p_term_id:   current_term,
  })
  if (err) { error.value = err.message; loading.value = false; return }
  slots.value = data || []
  loading.value = false
}

onMounted(load)
</script>

<style scoped>
.stb-page {
  padding: 0 0 24px;
}

.stb-header {
  background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%);
  padding: 20px 20px 16px;
  color: white;
  margin-bottom: 16px;
}
.stb-title { font-size: 20px; font-weight: 800; }
.stb-term  { font-size: 13px; opacity: .8; margin-top: 4px; }

.stb-loading, .stb-error, .stb-empty {
  text-align: center; padding: 40px 20px; color: #7c3aed; font-size: 16px;
}
.stb-error { color: #dc2626; }

.stb-body { padding: 0 12px; }

.stb-table-wrap {
  background: white; border-radius: 14px; padding: 10px;
  box-shadow: 0 2px 8px rgba(109,40,217,.1);
  overflow-x: auto;
}

.stb-table { width: 100%; min-width: 720px; border-collapse: collapse; table-layout: fixed; }
.stb-table th, .stb-table td { border: 1px solid #ede9fe; }

.day-col {
  width: 90px; background: #6d28d9; color: white;
  font-size: 12px; font-weight: 700; padding: 8px 6px; text-align: center;
}
td.day-col { background: #f5f3ff; color: #4c1d95; }

.period-col {
  background: #6d28d9; color: white;
  font-size: 11px; font-weight: 700; padding: 8px 4px; text-align: center;
}

.slot-cell {
  height: 64px; padding: 4px 5px; vertical-align: middle; text-align: center;
}
.slot-cell.color-sub  { background: #ede9fe; }
.slot-cell.color-act  { background: #fef3c7; }
.slot-cell.color-lock { background: #f3f4f6; }
.slot-cell.empty-cell { background: #fafafa; }

.slot-content { line-height: 1.25; }
.subject-code  { font-size: 10px; font-weight: 700; color: #7c3aed; }
.subject-name  { font-size: 11px; font-weight: 700; color: #1f2937; word-break: break-word; }
.teacher-name  { font-size: 10px; color: #6b7280; margin-top: 1px; }
.room-name     { font-size: 9px;  color: #9ca3af; margin-top: 1px; }
.act-name      { color: #92400e; }
.lock-name     { color: #6b7280; font-weight: 600; }

@media (max-width: 640px) {
  .stb-table { min-width: 620px; }
  .day-col { width: 68px; font-size: 11px; }
}
</style>
