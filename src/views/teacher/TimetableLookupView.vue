<template>
  <AppLayout>
    <div class="lookup-page">
      <div class="header-card">
        <h1 class="title">🔍 ค้นหาตารางสอน</h1>
        <p class="subtitle">ดูตารางห้องเรียนหรือครูคนใดก็ได้ — อ่านอย่างเดียวจากตารางฉบับเผยแพร่ล่าสุด</p>
        <div v-if="publishAtLabel" class="meta-row">
          <span class="meta-chip">เผยแพร่เมื่อ {{ publishAtLabel }}</span>
        </div>
      </div>

      <el-card class="mb-4" shadow="never">
        <div class="filters">
          <div class="filter-item">
            <label>📅 ค้นหาตามห้องเรียน</label>
            <el-select v-model="selectedClass" placeholder="เลือกห้องเรียน" filterable clearable class="w-full">
              <el-option v-for="c in classes" :key="c.class_name" :label="c.class_name" :value="c.class_name" />
            </el-select>
          </div>
          <div class="filter-item">
            <label>👨‍🏫 ค้นหาตามชื่อครู</label>
            <el-select v-model="selectedTeacher" placeholder="เลือกชื่อครู" filterable clearable class="w-full">
              <el-option v-for="t in teachers" :key="t.teacher_code" :label="`${t.prefix||''}${t.first_name} ${t.last_name}`" :value="t.teacher_code" />
            </el-select>
          </div>
          <el-button :loading="loading" @click="loadPublished">รีเฟรช</el-button>
        </div>
      </el-card>

      <div v-if="loading" class="state-card">
        <el-icon class="is-loading text-3xl text-blue-500"><Loading /></el-icon>
        <p>กำลังโหลดตารางสอน...</p>
      </div>

      <div v-else-if="publishedMissing" class="state-card warning">
        <h2>📢 ยังไม่มีตารางที่เผยแพร่</h2>
        <p>Admin ยังไม่ได้เผยแพร่ตารางสอน — กรุณาติดต่อผู้ดูแลระบบโรงเรียน</p>
      </div>

      <div v-else-if="!selectedClass && !selectedTeacher" class="state-card">
        <h2>เลือกห้องเรียนหรือชื่อครู</h2>
        <p>เพื่อแสดงตารางสอนที่ต้องการค้นหา</p>
      </div>

      <div v-else class="table-wrap">
        <div class="table-doc-header">
          <h3 class="doc-title">
            {{ selectedClass ? `ตารางสอนห้อง ${selectedClass}` : `ตารางสอนครู ${selectedTeacherName}` }}
          </h3>
          <div class="doc-subtitle">ภาคเรียน {{ schoolStore.termLabel || currentTerm }}</div>
        </div>

        <table class="lookup-table">
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
            <tr v-for="day in displayDays" :key="day.value">
              <td class="day-col">{{ day.label }}</td>
              <td v-for="p in displayPeriods" :key="`${day.value}-${p}`" class="slot-cell">
                <div v-if="getSlot(day.value, p)" class="slot-content">
                  <div class="subject">{{ getSlot(day.value, p).subject_name }}</div>
                  <div class="sub-info">
                    <span v-if="selectedClass">{{ getSlot(day.value, p).teacher_name }}</span>
                    <span v-else>{{ getSlot(day.value, p).class_id }}</span>
                  </div>
                  <div v-if="getSlot(day.value, p).preferred_room" class="room">🏛 {{ getSlot(day.value, p).preferred_room }}</div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()

const loading = ref(false)
const classes = ref([])
const teachers = ref([])
const timetable = ref([])
const currentTerm = ref('')
const publishAtLabel = ref('')
const publishedMissing = ref(false)

const selectedClass = ref('')
const selectedTeacher = ref('')

const ALL_DAYS = [
  { label: 'จันทร์', short: 'จ.', value: 1 },
  { label: 'อังคาร', short: 'อ.', value: 2 },
  { label: 'พุธ', short: 'พ.', value: 3 },
  { label: 'พฤหัสบดี', short: 'พฤ.', value: 4 },
  { label: 'ศุกร์', short: 'ศ.', value: 5 },
  { label: 'เสาร์', short: 'ส.', value: 6 },
  { label: 'อาทิตย์', short: 'อา.', value: 7 },
]

const displayDays = computed(() => {
  const fromSchool = schoolStore.schoolInfo?.school_days
  if (Array.isArray(fromSchool) && fromSchool.length) {
    const mapped = ALL_DAYS.filter(d => fromSchool.includes(d.label))
    if (mapped.length) return mapped
  }
  return ALL_DAYS.slice(0, 5)
})

const displayPeriods = computed(() => {
  const n = Number(schoolStore.schoolInfo?.periods_per_day || 8)
  return Array.from({ length: n }, (_, i) => i + 1)
})

function buildPeriodTimesMap(times) {
  if (!Array.isArray(times)) return {}
  const map = {}
  for (const t of times) {
    const p = Number(t?.period)
    const start = String(t?.start || '').trim()
    const end = String(t?.end || '').trim()
    if (!Number.isNaN(p) && p > 0 && start && end) map[p] = `${start}–${end}`
  }
  return map
}
const periodTimes = computed(() => buildPeriodTimesMap(schoolStore.schoolInfo?.period_times))

const selectedTeacherName = computed(() => {
  const t = teachers.value.find(x => x.teacher_code === selectedTeacher.value)
  return t ? `${t.prefix || ''}${t.first_name} ${t.last_name}` : selectedTeacher.value
})

function getSlot(day, period) {
  if (selectedClass.value) {
    return timetable.value.find(s => Number(s.day_of_week) === day && Number(s.period_number) === period && s.class_id === selectedClass.value)
  }
  if (selectedTeacher.value) {
    return timetable.value.find(s => Number(s.day_of_week) === day && Number(s.period_number) === period && String(s.teacher_id) === String(selectedTeacher.value))
  }
  return null
}

async function loadPublished() {
  const sid = authStore.schoolId
  if (!sid) return
  loading.value = true
  publishedMissing.value = false
  try {
    currentTerm.value = schoolStore.currentTerm || '2568_1'

    const [classesRes, teachersRes, publishedRes, schoolRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', sid).order('class_name'),
      supabase.from('teachers').select('*').eq('school_id', sid).eq('term_id', currentTerm.value).order('first_name'),
      supabase.from('timetable_slots_published').select('*').eq('school_id', sid).eq('term_id', currentTerm.value).limit(10000),
      supabase.from('schools').select('settings').eq('id', sid).maybeSingle(),
    ])
    if (classesRes.error) throw classesRes.error
    if (teachersRes.error) throw teachersRes.error
    if (publishedRes.error) throw publishedRes.error

    classes.value = classesRes.data || []
    teachers.value = teachersRes.data || []
    timetable.value = publishedRes.data || []

    const settings = schoolRes.data?.settings || {}
    publishAtLabel.value = settings.timetable_published_at
      ? new Date(settings.timetable_published_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
      : ''
    if (!timetable.value.length) publishedMissing.value = true
  } catch (e) {
    console.error(e)
    ElMessage.error('โหลดตารางสอนไม่สำเร็จ: ' + e.message)
    publishedMissing.value = true
  } finally {
    loading.value = false
  }
}

watch(selectedClass, val => { if (val) selectedTeacher.value = '' })
watch(selectedTeacher, val => { if (val) selectedClass.value = '' })

onMounted(loadPublished)
</script>

<style scoped>
.lookup-page { padding: 0; }
.header-card {
  background: linear-gradient(135deg, #1e293b, #334155);
  border-radius: 16px; padding: 20px 24px; color: white; margin-bottom: 16px;
}
.title { font-size: 20px; font-weight: 800; margin: 0; }
.subtitle { font-size: 13px; opacity: .85; margin: 6px 0 0; }
.meta-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.meta-chip { background: rgba(255,255,255,.15); border-radius: 99px; padding: 3px 12px; font-size: 12px; }

.filters { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 4px; min-width: 220px; flex: 1; }
.filter-item label { font-size: 13px; font-weight: 600; color: #374151; }

.state-card {
  background: white; border-radius: 16px; padding: 40px 20px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.06); color: #6b7280;
}
.state-card.warning { background: #fffbeb; color: #92400e; }
.state-card h2 { font-size: 16px; margin: 8px 0 4px; }

.table-wrap { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,.06); overflow-x: auto; }
.table-doc-header { margin-bottom: 14px; }
.doc-title { font-size: 17px; font-weight: 800; margin: 0; color: #1e293b; }
.doc-subtitle { font-size: 13px; color: #6b7280; margin-top: 2px; }

.lookup-table { width: 100%; border-collapse: collapse; min-width: 720px; }
.lookup-table th, .lookup-table td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; }
.day-col { font-weight: 700; background: #f8fafc; white-space: nowrap; width: 70px; }
.period-title { font-size: 12px; font-weight: 700; }
.period-time { font-size: 10px; color: #9ca3af; }
.slot-cell { min-width: 90px; height: 56px; vertical-align: middle; }
.slot-content { font-size: 11px; line-height: 1.3; }
.subject { font-weight: 700; color: #1e293b; }
.sub-info { color: #6366f1; }
.room { color: #9ca3af; font-size: 10px; }
</style>
