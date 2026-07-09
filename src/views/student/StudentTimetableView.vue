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
      <div class="table-wrap">
        <table class="my-table teacher-table">
          <thead>
            <tr>
              <th class="day-col">วัน</th>
              <th v-for="p in periodNums" :key="p" class="period-head">คาบ {{ p }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in activeDays" :key="d.num" :class="`day-row day-${d.num}`">
              <td class="day-col">{{ d.full }}</td>
              <td v-for="p in periodNums" :key="`${d.num}-${p}`" class="slot-cell">
                <div v-if="slotAt(d.num, p)" class="slot-content">
                  <template v-if="slotAt(d.num, p).slot_type === 'subject'">
                    <div v-if="slotAt(d.num, p).subject_id" class="subject-code">{{ slotAt(d.num, p).subject_id }}</div>
                    <div class="subject">{{ slotAt(d.num, p).subject_name || 'ไม่มีชื่อวิชา' }}</div>
                    <div v-if="slotAt(d.num, p).teacher_name?.trim()" class="class">{{ slotAt(d.num, p).teacher_name }}</div>
                    <div v-if="slotAt(d.num, p).room_id" class="room">{{ slotAt(d.num, p).room_id }}</div>
                  </template>
                  <template v-else-if="slotAt(d.num, p).slot_type === 'activity'">
                    <div class="lock-icon">🔒</div>
                    <div class="lock-name">{{ slotAt(d.num, p).act_name || 'กิจกรรม' }}</div>
                  </template>
                  <template v-else>
                    <div class="lock-icon">🔒</div>
                    <div class="lock-name">{{ slotAt(d.num, p).lock_label || 'ล็อก' }}</div>
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

/* ── ตารางแบบเดียวกับ "ตารางสอนของฉัน" ฝั่งครู (MyTimetableView) ── */
/* หลุดออกจากกรอบ max-width:600px ของ .student-content (ออกแบบมาสำหรับการ์ดมือถือ)
   เพื่อให้จอคอมฯ กว้างเต็มที่ — บนมือถือ 96vw ยังพอดีจอ ตารางเลื่อนซ้ายขวาได้ตามปกติ */
.table-wrap {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  overflow-x: auto;
  width: 96vw;
  max-width: 1400px;
  margin-left: 50%;
  transform: translateX(-50%);
}

.my-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.my-table th,
.my-table td {
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  padding: 10px;
  vertical-align: top;
  text-align: center;
}

.my-table th {
  background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}

.teacher-table .period-head {
  min-width: 112px;
  text-align: center;
}

.day-col {
  width: 72px;
  text-align: center;
  font-weight: 700;
  background: #e2e8f0;
}

.day-1 .day-col { background: #eab308; color: #fff; }
.day-2 .day-col { background: #ec4899; color: #fff; }
.day-3 .day-col { background: #22c55e; color: #fff; }
.day-4 .day-col { background: #f97316; color: #fff; }
.day-5 .day-col { background: #3b82f6; color: #fff; }
.day-6 .day-col { background: #a855f7; color: #fff; }
.day-7 .day-col { background: #ef4444; color: #fff; }

.day-row .slot-cell { background: #ffffff; }
.day-1 .slot-cell { background: #fefce8; }
.day-2 .slot-cell { background: #fdf2f8; }
.day-3 .slot-cell { background: #f0fdf4; }
.day-4 .slot-cell { background: #fff7ed; }
.day-5 .slot-cell { background: #eff6ff; }
.day-6 .slot-cell { background: #faf5ff; }
.day-7 .slot-cell { background: #fef2f2; }

.slot-cell {
  min-height: 86px;
}

.slot-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  border: none;
  border-left: 3px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  padding: 6px;
}
.day-1 .slot-content { border-left: 3px solid #eab308; background: linear-gradient(180deg,#fff 0%,#fefce8 100%); }
.day-2 .slot-content { border-left: 3px solid #ec4899; background: linear-gradient(180deg,#fff 0%,#fdf2f8 100%); }
.day-3 .slot-content { border-left: 3px solid #22c55e; background: linear-gradient(180deg,#fff 0%,#f0fdf4 100%); }
.day-4 .slot-content { border-left: 3px solid #f97316; background: linear-gradient(180deg,#fff 0%,#fff7ed 100%); }
.day-5 .slot-content { border-left: 3px solid #3b82f6; background: linear-gradient(180deg,#fff 0%,#eff6ff 100%); }
.day-6 .slot-content { border-left: 3px solid #a855f7; background: linear-gradient(180deg,#fff 0%,#faf5ff 100%); }
.day-7 .slot-content { border-left: 3px solid #ef4444; background: linear-gradient(180deg,#fff 0%,#fef2f2 100%); }

.subject-code {
  font-weight: 700;
  color: #1d4ed8;
  font-size: 12px;
}

.subject {
  font-weight: 700;
  color: #0f172a;
  font-size: 13px;
}

.class {
  color: #475569;
  font-size: 12px;
}

.room {
  color: #0369a1;
  font-size: 12px;
}

.lock-icon {
  font-size: 18px;
  line-height: 1;
}

.lock-name {
  font-weight: 700;
  color: #92400e;
  font-size: 12px;
  text-align: center;
}
</style>
