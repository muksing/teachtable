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
      <!-- Day tabs -->
      <div class="stb-daytabs">
        <button
          v-for="d in activeDays" :key="d.num"
          class="stb-daytab"
          :class="{ active: activeDay === d.num }"
          @click="activeDay = d.num"
        >{{ d.short }}</button>
      </div>

      <!-- Table for selected day -->
      <div class="stb-table-wrap">
        <div v-if="!daySlots.length" class="stb-empty-day">ไม่มีคาบเรียนวันนี้</div>
        <table v-else class="stb-table">
          <thead>
            <tr>
              <th class="stb-col-period">คาบ</th>
              <th class="stb-col-code">รหัสวิชา</th>
              <th class="stb-col-subject">ชื่อวิชา</th>
              <th class="stb-col-teacher">ครูผู้สอน</th>
              <th class="stb-col-room">ห้อง</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="slot in daySlots" :key="slot.period_number" :class="slotClass(slot)">
              <td class="stb-col-period">{{ slot.period_number }}</td>
              <template v-if="slot.slot_type === 'subject'">
                <td class="stb-col-code">{{ slot.subject_id || '—' }}</td>
                <td class="stb-col-subject">{{ slot.subject_name || 'ไม่มีชื่อวิชา' }}</td>
                <td class="stb-col-teacher">{{ slot.teacher_name?.trim() || '—' }}</td>
                <td class="stb-col-room">{{ slot.room_id || '—' }}</td>
              </template>
              <template v-else-if="slot.slot_type === 'activity'">
                <td class="stb-col-code">—</td>
                <td class="stb-col-subject stb-act" colspan="2">{{ slot.act_name || 'กิจกรรม' }}</td>
                <td class="stb-col-room">{{ slot.room_id || '—' }}</td>
              </template>
              <template v-else>
                <td class="stb-col-code">—</td>
                <td class="stb-col-subject stb-lock" colspan="2">{{ slot.lock_label || 'ล็อก' }}</td>
                <td class="stb-col-room">{{ slot.room_id || '—' }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Full week grid (landscape) -->
      <div class="stb-grid-wrap">
        <div class="stb-grid-title">ตารางรายสัปดาห์</div>
        <div class="stb-grid">
          <div class="stb-grid-corner"></div>
          <div v-for="d in activeDays" :key="d.num" class="stb-grid-head">{{ d.short }}</div>
          <template v-for="p in periodNums" :key="p">
            <div class="stb-grid-period">{{ p }}</div>
            <div
              v-for="d in activeDays" :key="d.num"
              class="stb-grid-cell"
              :class="slotClass(slotAt(d.num, p))"
            >
              <span v-if="slotAt(d.num, p)">
                {{ slotLabel(slotAt(d.num, p)) }}
              </span>
            </div>
          </template>
        </div>
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
  { num: 4, short: 'พฤ', full: 'พฤหัส' },
  { num: 5, short: 'ศ', full: 'ศุกร์' },
  { num: 6, short: 'ส', full: 'เสาร์' },
  { num: 7, short: 'อา', full: 'อาทิตย์' },
]

const loading   = ref(true)
const error     = ref('')
const slots     = ref([])
const activeDay = ref(currentWeekday())

function currentWeekday() {
  const d = new Date().getDay() // 0=Sun
  return d === 0 ? 1 : d        // default to Monday if Sunday
}

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

const daySlots = computed(() =>
  slots.value
    .filter(s => s.day_of_week === activeDay.value)
    .sort((a, b) => a.period_number - b.period_number)
)

function slotAt(day, period) { return slotMap.value[`${day}_${period}`] || null }

function slotLabel(slot) {
  if (!slot) return ''
  if (slot.slot_type === 'subject') return slot.subject_name || '?'
  if (slot.slot_type === 'activity') return slot.act_name || 'กิจกรรม'
  return slot.lock_label || '-'
}

function slotClass(slot) {
  if (!slot) return 'stb-empty-cell'
  if (slot.slot_type === 'activity') return 'stb-color-act'
  if (slot.slot_type === 'lock') return 'stb-color-lock'
  return 'stb-color-sub'
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

  // set active day to nearest day that has slots
  const withSlots = new Set(slots.value.map(s => s.day_of_week))
  if (!withSlots.has(activeDay.value)) {
    activeDay.value = [...withSlots].sort((a, b) => a - b)[0] || 1
  }
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

/* Day tabs */
.stb-daytabs {
  display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;
}
.stb-daytab {
  flex-shrink: 0;
  padding: 8px 16px; border-radius: 20px; border: 2px solid #ddd6fe;
  background: white; color: #6d28d9; font-size: 15px; font-weight: 700;
  cursor: pointer; transition: all .15s;
}
.stb-daytab.active {
  background: #6d28d9; color: white; border-color: #6d28d9;
}

/* Day table */
.stb-table-wrap {
  background: white; border-radius: 14px; padding: 6px;
  box-shadow: 0 2px 8px rgba(109,40,217,.1);
  margin-bottom: 24px; overflow-x: auto;
}
.stb-empty-day { text-align: center; padding: 24px; color: #a78bfa; }

.stb-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.stb-table th {
  background: #6d28d9; color: white; font-size: 12px; font-weight: 700;
  padding: 8px 10px; text-align: left; white-space: nowrap;
}
.stb-table td {
  padding: 9px 10px; border-bottom: 1px solid #ede9fe; vertical-align: middle;
}
.stb-table tbody tr:last-child td { border-bottom: none; }
.stb-table tbody tr:nth-child(odd) { background: #faf9ff; }

.stb-col-period { width: 44px; text-align: center; font-weight: 800; color: #6d28d9; }
.stb-col-code   { width: 90px; color: #7c3aed; font-weight: 700; white-space: nowrap; }
.stb-col-subject{ font-weight: 700; color: #1f2937; }
.stb-col-teacher{ color: #4b5563; }
.stb-col-room   { width: 70px; color: #9ca3af; font-size: 12px; white-space: nowrap; }

tr.stb-color-act  .stb-col-subject.stb-act  { color: #92400e; font-weight: 700; }
tr.stb-color-lock .stb-col-subject.stb-lock { color: #6b7280; font-weight: 600; }
tr.stb-color-act  { background: #fffbeb; }
tr.stb-color-lock { background: #f9fafb; }

/* Grid */
.stb-grid-wrap {
  overflow-x: auto; margin-top: 8px;
  background: white; border-radius: 14px; padding: 14px;
  box-shadow: 0 2px 8px rgba(109,40,217,.1);
}
.stb-grid-title {
  font-size: 14px; font-weight: 700; color: #6d28d9; margin-bottom: 10px;
}
.stb-grid {
  display: grid;
  grid-template-columns: 32px repeat(var(--day-count, 5), 1fr);
  gap: 3px;
  min-width: 320px;
}
.stb-grid-corner { }
.stb-grid-head {
  background: #6d28d9; color: white; border-radius: 6px;
  font-size: 11px; font-weight: 700; text-align: center; padding: 4px 2px;
}
.stb-grid-period {
  font-size: 11px; color: #6d28d9; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.stb-grid-cell {
  background: #f5f3ff; border-radius: 5px;
  font-size: 9px; line-height: 1.2; padding: 4px 3px;
  text-align: center; min-height: 36px;
  display: flex; align-items: center; justify-content: center;
  word-break: break-all;
}
.stb-grid-cell.stb-color-sub  { background: #ede9fe; color: #4c1d95; }
.stb-grid-cell.stb-color-act  { background: #fef3c7; color: #92400e; }
.stb-grid-cell.stb-color-lock { background: #f3f4f6; color: #6b7280; }
.stb-grid-cell.stb-empty-cell { background: #fafafa; }
</style>
