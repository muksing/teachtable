<template>
  <AppLayout>
    <div class="my-timetable-page">
      <div class="header-card">
        <h1 class="title">ตารางสอนของฉัน</h1>
        <p class="subtitle">ตารางสอนสำหรับภาคเรียนปัจจุบัน</p>
        <div class="meta-row">
          <span v-if="currentTerm" class="meta-chip">ภาคเรียน: {{ currentTerm }}</span>
          <span v-if="isLocked" class="meta-chip" style="background:#d1fae5;color:#065f46;">✅ จัดตารางเสร็จแล้ว</span>
        </div>
      </div>

      <el-card class="mb-4" shadow="never">
        <div class="filters">
          <el-button :loading="loading" @click="loadMyTimetable">รีเฟรช</el-button>
          <el-button type="primary" plain @click="saveAsImage">บันทึกเป็นรูปภาพ</el-button>
        </div>
      </el-card>

      <div v-if="loading" class="state-card">
        <el-icon class="is-loading text-3xl text-blue-500"><Loading /></el-icon>
        <p>กำลังโหลดตารางสอน...</p>
      </div>

      <div v-else-if="!isLocked" class="state-card warning">
        <h2>🕐 อยู่ระหว่างจัดตารางสอน</h2>
        <p>Admin กำลังดำเนินการจัดตารางสอน — จะแสดงตารางของคุณเมื่อจัดเสร็จแล้ว</p>
      </div>

      <div v-else-if="slots.length === 0" class="state-card">
        <h2>ไม่พบตารางสอนของบัญชีนี้</h2>
        <p>กรุณาตรวจสอบการผูก teacher_id หรือแจ้งผู้ดูแลระบบโรงเรียน</p>
      </div>

      <div v-else class="table-wrap" ref="captureRef">
        <div class="table-doc-header">
          <div v-if="schoolLogoUrl" class="doc-logo-wrap">
            <img :src="schoolLogoUrl" alt="school-logo" class="doc-logo" />
          </div>
          <h2 class="doc-title">ตารางสอนครู</h2>
          <div v-if="schoolName" class="doc-subtitle">{{ schoolName }}</div>
          <div class="doc-meta-grid">
            <div v-if="teacherDisplayName" class="doc-meta-item">
              <span class="label">ตารางสอนของ</span>
              <span class="value">{{ teacherDisplayName }}</span>
            </div>
            <div v-if="termAcademicLabel" class="doc-meta-item">
              <span class="label">ภาคเรียน/ปีการศึกษา</span>
              <span class="value">{{ termAcademicLabel }}</span>
            </div>
            <div v-if="printedAtLabel" class="doc-meta-item">
              <span class="label">วันที่พิมพ์</span>
              <span class="value">{{ printedAtLabel }}</span>
            </div>
          </div>
        </div>

        <table class="my-table teacher-table">
          <thead>
            <tr>
              <th class="day-col">วัน</th>
              <th v-for="p in displayPeriods" :key="p" class="period-head">
                <div class="period-title">คาบ {{ p }}</div>
                <div v-if="periodTimes[p]" class="period-time">{{ periodTimes[p] }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="day in displayDays" :key="day.value" :class="`day-row day-${day.value}`">
              <td class="day-col">{{ day.label }}</td>
              <td v-for="p in displayPeriods" :key="`${day.value}-${p}`" class="slot-cell">
                <div v-if="getSlot(day.value, p)" class="slot-content">
                  <template v-if="isLockOrActivity(getSlot(day.value, p))">
                    <div class="lock-icon">🔒</div>
                    <div class="lock-name">{{ getSlot(day.value, p).act_name || getSlot(day.value, p).name || 'กิจกรรม/คาบล็อก' }}</div>
                    <div v-if="getSlot(day.value, p).lock_type" class="lock-type">{{ getSlot(day.value, p).lock_type }}</div>
                  </template>
                  <template v-else>
                    <div v-if="getSlot(day.value, p).subject_code" class="subject-code">{{ getSlot(day.value, p).subject_code }}</div>
                    <div v-if="getSlot(day.value, p).subject_name" class="subject">{{ getSlot(day.value, p).subject_name }}</div>
                    <div v-if="getSlot(day.value, p).class_id" class="class">{{ getSlot(day.value, p).class_id }}</div>
                    <div v-if="getSlot(day.value, p).preferred_room" class="room">{{ getSlot(day.value, p).preferred_room }}</div>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { supabase } from '@/supabase/client'
import html2canvas from 'html2canvas'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { slotTable } = useTimetableSource()

const loading = ref(false)
const slots = ref([])
const captureRef = ref(null)
const currentTerm = ref('')

const isLocked = computed(() => !!schoolStore.settingsObj?.timetable_published_at)

const ALL_DAYS = [
  { label: 'จันทร์', short: 'จ.', value: 1 },
  { label: 'อังคาร', short: 'อ.', value: 2 },
  { label: 'พุธ', short: 'พ.', value: 3 },
  { label: 'พฤหัสบดี', short: 'พฤ.', value: 4 },
  { label: 'ศุกร์', short: 'ศ.', value: 5 },
  { label: 'เสาร์', short: 'ส.', value: 6 },
  { label: 'อาทิตย์', short: 'อา.', value: 7 },
]

const teacherId = computed(() => String(authStore.profile?.teacher_id || authStore.profile?.uid || ''))
const schoolId = computed(() => authStore.schoolId)
const schoolName = computed(() => schoolStore.schoolInfo?.name || '')
const schoolLogoUrl = computed(() => schoolStore.schoolInfo?.logo_url || '')

const teacherDisplayName = computed(() => {
  const p = authStore.profile || {}
  const fullName = `${p.prefix || ''}${p.name || ''} ${p.surname || ''}`.trim()
  return fullName || p.displayName || p.email || p.uid || ''
})

const semesterLabel = computed(() => {
  const term = String(currentTerm.value || '')
  if (!term.includes('_')) return ''
  const [, semester] = term.split('_')
  return semester || ''
})

const academicYearLabel = computed(() => {
  const term = String(currentTerm.value || '')
  if (!term.includes('_')) return term
  const [year] = term.split('_')
  return year || ''
})

const termAcademicLabel = computed(() => {
  if (!semesterLabel.value && !academicYearLabel.value) return ''
  return `ภาคเรียนที่ ${semesterLabel.value} ปีการศึกษา ${academicYearLabel.value}`.trim()
})

const printedAtLabel = computed(() => {
  return new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const slotMap = computed(() => {
  const map = new Map()
  for (const s of slots.value) {
    const d = Number(s.day)
    const p = Number(s.period)
    if (!Number.isNaN(d) && !Number.isNaN(p)) {
      map.set(`${d}_${p}`, s)
    }
  }
  return map
})

function getSlot(day, period) {
  return slotMap.value.get(`${Number(day)}_${Number(period)}`) || null
}

function isLockOrActivity(slot) {
  return slot?.type === 'activity' || slot?.type === 'manual_lock'
}

function buildPeriodTimesMap(times) {
  if (!Array.isArray(times)) return {}
  const map = {}
  for (const t of times) {
    const p = Number(t?.period)
    const start = String(t?.start || '').trim()
    const end = String(t?.end || '').trim()
    if (!Number.isNaN(p) && p > 0 && start && end) {
      map[p] = `${start}–${end}`
    }
  }
  return map
}


const displayDays = computed(() => {
  const fromSchool = schoolStore.schoolInfo?.school_days
  if (Array.isArray(fromSchool) && fromSchool.length) {
    const mapped = ALL_DAYS.filter(d => fromSchool.includes(d.label))
    if (mapped.length) return mapped
  }

  return ALL_DAYS.slice(0, 5)
})

const displayPeriods = computed(() => {
  const n = Number(schoolStore.schoolInfo?.periods_per_day
    || schoolStore.schoolInfo?.settings?.school_info?.periods_per_day || 8)
  return Array.from({ length: n }, (_, i) => i + 1)
})

const periodTimes = computed(() => buildPeriodTimesMap(schoolStore.schoolInfo?.period_times))

async function loadMyTimetable() {
  if (!isLocked.value) { slots.value = []; return }
  const sId = schoolId.value
  if (!sId) { slots.value = []; return }

  loading.value = true
  slots.value = []
  try {
    const t = schoolStore.currentTerm || '2568_1'
    currentTerm.value = t

    const { data, error } = await supabase
      .from(slotTable.value)
      .select('*')
      .eq('school_id', sId)
      .eq('term_id', t)
      .eq('teacher_id', teacherId.value)
    if (error) throw error

    slots.value = (data || []).map(row => ({
      ...row,
      day:            row.day_of_week,
      period:         row.period_number,
      subject_code:   row.subject_id || '',
      preferred_room: row.room_id || '',
      type:           row.slot_type,
    }))
  } catch (e) {
    ElMessage.error('โหลดตารางสอนไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// โหลดใหม่อัตโนมัติเมื่อ admin publish ตาราง
watch(() => schoolStore.settingsObj?.timetable_published_at, val => { if (val) loadMyTimetable() })

async function saveAsImage() {
  if (!captureRef.value) return
  try {
    const canvas = await html2canvas(captureRef.value, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    const termSafe = (currentTerm.value || 'timetable').replace(/[^\w-]/g, '_')
    a.href = url
    a.download = `my_timetable_${termSafe}.png`
    a.click()
    ElMessage.success('บันทึกรูปภาพตารางสอนเรียบร้อย')
  } catch (e) {
    console.error(e)
    ElMessage.error('บันทึกรูปภาพไม่สำเร็จ')
  }
}

onMounted(loadMyTimetable)
</script>

<style scoped>
.my-timetable-page {
  max-width: 1200px;
  margin: 0 auto;
}

.header-card {
  background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
  color: #fff;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  margin: 4px 0 0;
  opacity: 0.9;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.meta-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 12px;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
}

.state-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 28px;
  text-align: center;
  color: #374151;
}

.state-card.warning {
  border-color: #fed7aa;
  background: #fffbeb;
}

.table-wrap {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  overflow-x: auto;
}

.table-doc-header {
  padding: 16px;
  border-bottom: 2px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  text-align: center;
}

.doc-logo-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.doc-logo {
  width: 76px;
  height: 76px;
  object-fit: contain;
}

.doc-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  color: #0f172a;
  font-weight: 800;
  text-align: center;
}

.doc-subtitle {
  text-align: center;
  color: #475569;
  font-weight: 600;
  margin-top: 4px;
}

.doc-meta-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 8px 14px;
}

.doc-meta-item {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px dashed #cbd5e1;
}

.doc-meta-item .label {
  min-width: 88px;
  color: #64748b;
  font-size: 12px;
}

.doc-meta-item .value {
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
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
  background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
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

.teacher-table .period-head {
  min-width: 112px;
  text-align: center;
}

.period-title {
  font-weight: 700;
}

.period-time {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.day-col {
  width: 72px;
  text-align: center;
  font-weight: 700;
  background: #e2e8f0;
}

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

.lock-type {
  color: #7c2d12;
  font-size: 11px;
  text-transform: uppercase;
}

@media (max-width: 900px) {
  .doc-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
