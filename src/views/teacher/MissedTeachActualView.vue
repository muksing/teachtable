<template>
  <AppLayout>
    <div :class="['mta-page', isAdmin && 'mta-page--wide']">

      <!-- ══ Header ══ -->
      <div class="mta-header">
        <div class="mta-title-row">
          <div>
            <h1 class="mta-title">⚠️ รายวิชาที่ลืมบันทึก</h1>
            <p class="mta-sub">
              {{ isAdmin ? 'สรุปคาบที่ครูยังไม่ได้บันทึกในช่วงย้อนหลัง' : 'คาบของฉันที่ยังไม่ได้กรอกข้อมูล' }}
            </p>
          </div>
          <el-tag v-if="!loading" :type="displayCount ? 'danger' : 'success'" size="large" class="mta-badge">
            {{ displayCount ? `ค้างอยู่ ${displayCount} คาบ` : '✅ ครบทุกคาบ' }}
          </el-tag>
        </div>

        <!-- Controls row -->
        <div class="mta-controls">
          <el-select v-model="dayRange" size="small" style="min-width:145px" @change="loadData">
            <el-option v-for="d in dayOptions" :key="d" :value="d" :label="`${d} วันล่าสุด`" />
          </el-select>
          <el-button size="small" :loading="loading" @click="loadData">🔄 รีเฟรช</el-button>
        </div>
      </div>

      <!-- ══ ADMIN: summary stats + filter bar + table ══ -->
      <template v-if="isAdmin">

        <!-- Summary stats -->
        <div class="mta-stats">
          <div class="mta-stat-card mta-stat-danger">
            <div class="mta-stat-num">{{ adminUnfilled.length }}</div>
            <div class="mta-stat-label">คาบค้างทั้งหมด</div>
          </div>
          <div class="mta-stat-card mta-stat-warning">
            <div class="mta-stat-num">{{ uniqueTeacherCount }}</div>
            <div class="mta-stat-label">ครูที่มีค้าง</div>
          </div>
          <div class="mta-stat-card mta-stat-info">
            <div class="mta-stat-num">{{ uniqueDateCount }}</div>
            <div class="mta-stat-label">วันที่มีค้าง</div>
          </div>
          <div class="mta-stat-card mta-stat-neutral">
            <div class="mta-stat-num">{{ filteredRows.length }}</div>
            <div class="mta-stat-label">แสดงอยู่ (หลังกรอง)</div>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="mta-filter-bar">
          <el-select
            v-model="filterTeacher"
            clearable
            filterable
            placeholder="ครูทั้งหมด"
            size="small"
            style="min-width:200px"
          >
            <el-option
              v-for="t in teacherOptions"
              :key="t.id"
              :value="t.id"
              :label="t.name"
            />
          </el-select>

          <el-date-picker
            v-model="filterDate"
            type="date"
            placeholder="เลือกวันที่"
            size="small"
            clearable
            style="width:160px"
            value-format="YYYY-MM-DD"
          />

          <el-button
            v-if="filterTeacher || filterDate"
            size="small"
            plain
            @click="filterTeacher = ''; filterDate = ''"
          >✕ ล้างตัวกรอง</el-button>

          <span class="mta-filter-result" v-if="filterTeacher || filterDate">
            แสดง {{ filteredRows.length }} รายการ
          </span>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="mta-loading"><el-skeleton :rows="6" animated /></div>

        <!-- Empty -->
        <div v-else-if="!filteredRows.length" class="mta-empty">
          <div class="mta-empty-icon">🎉</div>
          <div class="mta-empty-title">ไม่พบรายการค้างบันทึก</div>
          <div class="mta-empty-sub">{{ filterTeacher || filterDate ? 'ไม่มีข้อมูลตามเงื่อนไขที่เลือก' : `ทุกคาบใน ${dayRange} วันที่ผ่านมาบันทึกครบแล้ว` }}</div>
        </div>

        <!-- Table -->
        <div v-else class="mta-table-wrap">
          <el-table
            :data="filteredRows"
            stripe
            border
            size="small"
            row-class-name="mta-trow"
            class="mta-table"
          >
            <el-table-column label="วันที่" width="160" sortable prop="date">
              <template #default="{ row }">
                <div class="tbl-date">{{ thaiDateLabel(row.date) }}</div>
                <div class="tbl-relative">{{ relativeLabel(row.date) }}</div>
              </template>
            </el-table-column>

            <el-table-column label="คาบ" width="60" sortable prop="period" align="center">
              <template #default="{ row }">
                <el-tag type="danger" size="small" effect="dark">{{ row.period }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="ครูผู้สอน (ตามแผน)" min-width="150" sortable prop="teacher_plan_name">
              <template #default="{ row }">
                <div class="tbl-teacher">{{ row.teacher_plan_name || row.teacher_plan_id || '—' }}</div>
              </template>
            </el-table-column>

            <el-table-column label="วิชา" min-width="160">
              <template #default="{ row }">
                <div class="tbl-subject">{{ row.subject_name || '—' }}</div>
                <div class="tbl-code" v-if="row.subject_plan_id">{{ row.subject_plan_id }}</div>
              </template>
            </el-table-column>

            <el-table-column label="ห้องเรียน" width="100" sortable prop="class_id">
              <template #default="{ row }">
                <span class="tbl-class">{{ row.class_name || row.class_id || '—' }}</span>
              </template>
            </el-table-column>

            <el-table-column label="" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="goToDetail(row)">📋 กรอก</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

      </template>

      <!-- ══ TEACHER: card view ══ -->
      <template v-else>

        <!-- Loading -->
        <div v-if="loading" class="mta-loading"><el-skeleton :rows="4" animated /></div>

        <!-- Empty -->
        <div v-else-if="!groups.length" class="mta-empty">
          <div class="mta-empty-icon">🎉</div>
          <div class="mta-empty-title">ไม่มีรายวิชาที่ค้างบันทึก</div>
          <div class="mta-empty-sub">ทุกคาบใน {{ dayRange }} วันที่ผ่านมาบันทึกครบแล้ว</div>
        </div>

        <!-- Groups -->
        <div v-else class="mta-groups">
          <div v-for="group in groups" :key="group.dateKey" class="mta-group">

            <div class="mta-date-header">
              <span class="mta-date-label">{{ group.dateLabel }}</span>
              <el-tag size="small" :type="group.daysAgo <= 1 ? 'warning' : 'danger'" effect="dark" class="mta-relative-tag">
                {{ group.relativeLabel }}
              </el-tag>
              <span class="mta-count-chip">{{ group.items.length }} คาบ</span>
            </div>

            <div class="mta-cards">
              <div v-for="item in group.items" :key="item.id" class="mta-card">
                <div class="mta-card-left">
                  <div class="mta-period-badge">
                    <div class="mta-period-num">{{ item.period }}</div>
                    <div class="mta-period-lbl">คาบ</div>
                  </div>
                  <div class="mta-card-info">
                    <div class="mta-subject">{{ item.subject_name || item.subject_plan_id || '—' }}</div>
                    <div class="mta-meta">
                      <span class="mta-class-chip">{{ item.class_name || item.class_id }}</span>
                      <span v-if="item.subject_plan_id" class="mta-code">{{ item.subject_plan_id }}</span>
                    </div>
                  </div>
                </div>
                <el-button type="danger" size="small" class="mta-fill-btn" @click="goToDetail(item)">
                  กรอก
                </el-button>
              </div>
            </div>

          </div>
        </div>

      </template>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { supabase } from '@/supabase/client'

const router      = useRouter()
const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getTeachActualsRange } = useSchoolDb()

const loading      = ref(false)
const allData      = ref([])
const slotMap      = ref({})   // key: 'class_id_period' → { teacher_id, teacher_name, subject_id, subject_name }
const dayRange     = ref(7)
const filterTeacher = ref('')
const filterDate    = ref('')

// ── Role ──────────────────────────────────────────────────────────────────
const isAdmin = computed(() =>
  authStore.hasAnyRole(['school_admin', 'admin', 'superadmin'])
)

const myTeacherId = computed(() =>
  String(authStore.profile?.teacher_id || authStore.profile?.uid || '')
)

// ── Config ────────────────────────────────────────────────────────────────
const maxDays = computed(() => Number(schoolStore.schoolInfo?.backdating_days || 14))

const dayOptions = computed(() => {
  const opts = [3, 7, 14, 30].filter(d => d <= maxDays.value)
  if (maxDays.value > 0 && !opts.includes(maxDays.value)) opts.push(maxDays.value)
  return opts.sort((a, b) => a - b)
})

// ── Helpers ───────────────────────────────────────────────────────────────
function toDateKey(d) {
  return d.toISOString().split('T')[0]
}

function thaiDateLabel(dateKey) {
  const [y, m, day] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, day)
    .toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function relativeLabel(dateKey) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const daysAgo = Math.round((today - dt) / 86400000)
  if (daysAgo === 0) return 'วันนี้'
  if (daysAgo === 1) return 'เมื่อวาน'
  return `${daysAgo} วันที่แล้ว`
}

// ── Slot enrichment ───────────────────────────────────────────────────────
async function loadSlots() {
  const termId = schoolStore.currentTerm || '2568_1'
  const schoolId = authStore.schoolId
  const { data } = await supabase
    .from('timetable_slots')
    .select('class_id, period_number, teacher_id, teacher_name, subject_id, subject_name')
    .eq('school_id', schoolId)
    .eq('term_id', termId)
  if (data) {
    const map = {}
    for (const s of data) {
      const key = `${s.class_id}_${s.period_number}`
      if (!map[key]) map[key] = s  // keep first match (same class+period, any day)
    }
    slotMap.value = map
  }
}

// Enrich teach_actuals records with timetable slot data
const enrichedData = computed(() => {
  const map = slotMap.value
  return allData.value.map(r => {
    const key = `${r.class_id}_${r.period}`
    const slot = map[key]
    return {
      ...r,
      teacher_plan_id:   slot?.teacher_id   || r.teacher_plan_id   || null,
      teacher_plan_name: slot?.teacher_name || r.teacher_plan_name || '',
      subject_name:      slot?.subject_name || r.subject_name      || '',
      subject_plan_id:   slot?.subject_id   || r.subject_plan_id   || '',
    }
  })
})

// ── Teacher view data ─────────────────────────────────────────────────────
const unfilled = computed(() => {
  const myId = myTeacherId.value
  return enrichedData.value.filter(r => {
    if (r.is_filled) return false
    return r.teacher_plan_id === myId
  })
})

const groups = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const byDate = {}
  for (const item of unfilled.value) {
    if (!byDate[item.date]) byDate[item.date] = []
    byDate[item.date].push(item)
  }
  return Object.keys(byDate)
    .sort((a, b) => b.localeCompare(a))
    .map(dateKey => {
      const [y, m, d] = dateKey.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      const daysAgo = Math.round((today - dt) / 86400000)
      const rel = daysAgo === 0 ? 'วันนี้' : daysAgo === 1 ? 'เมื่อวาน' : `${daysAgo} วันที่แล้ว`
      const items = byDate[dateKey].slice().sort((a, b) => (a.period || 0) - (b.period || 0))
      return { dateKey, dateLabel: thaiDateLabel(dateKey), daysAgo, relativeLabel: rel, items }
    })
})

// ── Admin view data ───────────────────────────────────────────────────────
const adminUnfilled = computed(() =>
  enrichedData.value.filter(r => !r.is_filled)
)

const teacherOptions = computed(() => {
  const map = {}
  for (const r of adminUnfilled.value) {
    const id = r.teacher_plan_id
    if (id && !map[id]) map[id] = r.teacher_plan_name || id
  }
  return Object.entries(map)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
})

const filteredRows = computed(() => {
  let rows = adminUnfilled.value
  if (filterTeacher.value) {
    rows = rows.filter(r => r.teacher_plan_id === filterTeacher.value)
  }
  if (filterDate.value) {
    rows = rows.filter(r => r.date === filterDate.value)
  }
  return rows.slice().sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    if (a.teacher_plan_id !== b.teacher_plan_id) return (a.teacher_plan_name || '').localeCompare(b.teacher_plan_name || '', 'th')
    return (a.period || 0) - (b.period || 0)
  })
})

const uniqueTeacherCount = computed(() =>
  new Set(adminUnfilled.value.map(r => r.teacher_plan_id).filter(Boolean)).size
)
const uniqueDateCount = computed(() =>
  new Set(adminUnfilled.value.map(r => r.date).filter(Boolean)).size
)

const displayCount = computed(() =>
  isAdmin.value ? filteredRows.value.length : unfilled.value.length
)

// ── Data loading ──────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() - 1)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - dayRange.value)
    allData.value = await getTeachActualsRange(toDateKey(startDate), toDateKey(endDate))
  } catch (e) {
    console.error('loadData error', e)
    allData.value = []
  } finally {
    loading.value = false
  }
}

function goToDetail(item) {
  router.push({ name: 'TeachActualDetail', params: { id: item.teach_actual_id || item.id } })
}

onMounted(async () => {
  if (maxDays.value > 0) dayRange.value = Math.min(7, maxDays.value)
  await Promise.all([loadSlots(), loadData()])
})
</script>

<style scoped>
.mta-page {
  max-width: 780px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.mta-page--wide {
  max-width: 1100px;
}

/* ── Header ── */
.mta-header {
  background: linear-gradient(135deg, #b91c1c 0%, #dc2626 30%, #ea580c 65%, #f97316 100%);
  border-radius: 18px;
  padding: 22px 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(185,28,28,0.35);
}
.mta-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.mta-title { font-size: 22px; font-weight: 900; color: #fff; margin: 0 0 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.mta-sub   { font-size: 13px; color: rgba(255,255,255,0.85); margin: 0; }
.mta-badge { font-weight: 800 !important; font-size: 13px !important; }
.mta-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ── Admin: Summary stats ── */
.mta-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.mta-stat-card {
  border-radius: 14px;
  padding: 16px;
  text-align: center;
  color: white;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
}
.mta-stat-danger  { background: linear-gradient(135deg, #dc2626, #ef4444); }
.mta-stat-warning { background: linear-gradient(135deg, #d97706, #f97316); }
.mta-stat-info    { background: linear-gradient(135deg, #2563eb, #3b82f6); }
.mta-stat-neutral { background: linear-gradient(135deg, #475569, #64748b); }
.mta-stat-num {
  font-size: 32px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 5px;
}
.mta-stat-label { font-size: 11px; font-weight: 700; opacity: 0.9; }

/* ── Admin: Filter bar ── */
.mta-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.mta-filter-result {
  font-size: 12px;
  color: #64748b;
  font-weight: 700;
}

/* ── Table ── */
.mta-table-wrap {
  background: white;
  border-radius: 14px;
  border: 2px solid #fecaca;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(239,68,68,0.1);
}
.mta-table { width: 100%; }
:deep(.mta-trow td) { font-size: 13px; }

.tbl-date     { font-weight: 700; color: #1e293b; font-size: 12px; }
.tbl-relative { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.tbl-teacher  { font-weight: 700; color: #1e293b; }
.tbl-subject  { font-weight: 700; color: #1e293b; }
.tbl-code     { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.tbl-class    { font-weight: 800; color: #7c3aed; }

/* ── Loading / Empty ── */
.mta-loading { padding: 24px 0; }
.mta-empty {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 18px;
  border: 2px dashed #86efac;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.mta-empty-icon  { font-size: 52px; margin-bottom: 14px; }
.mta-empty-title { font-size: 20px; font-weight: 800; color: #15803d; margin-bottom: 8px; }
.mta-empty-sub   { font-size: 14px; color: #6b7280; }

/* ── Teacher: Groups ── */
.mta-groups { display: flex; flex-direction: column; gap: 20px; }
.mta-group {
  background: white;
  border-radius: 16px;
  border: 2px solid #fecaca;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(239,68,68,0.1);
}
.mta-date-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
}
.mta-date-label  { font-size: 14px; font-weight: 800; color: #fff; flex: 1; }
.mta-relative-tag { font-weight: 700; }
.mta-count-chip {
  font-size: 11px; font-weight: 800; color: #7c3aed;
  background: rgba(255,255,255,0.95); border-radius: 99px; padding: 2px 10px;
}
.mta-cards { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.mta-card {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px; border-radius: 12px;
  border: 2px solid #fee2e2;
  background: linear-gradient(135deg, #fff5f5, #fff);
  transition: all 0.15s;
}
.mta-card:hover {
  border-color: #fca5a5;
  background: #fff5f5;
  box-shadow: 0 2px 8px rgba(239,68,68,0.12);
  transform: translateX(2px);
}
.mta-card-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.mta-period-badge {
  width: 54px; height: 54px; border-radius: 14px;
  background: linear-gradient(135deg, #dc2626, #ea580c);
  color: white;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 3px 8px rgba(220,38,38,0.4);
}
.mta-period-num { font-size: 20px; font-weight: 900; line-height: 1; }
.mta-period-lbl { font-size: 9px; font-weight: 700; opacity: 0.85; margin-top: 1px; }
.mta-card-info { min-width: 0; }
.mta-subject {
  font-size: 15px; font-weight: 800; color: #1e293b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mta-meta { font-size: 12px; color: #64748b; margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.mta-class-chip {
  font-weight: 800; color: white;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  border-radius: 6px; padding: 1px 8px; font-size: 11px;
}
.mta-code  { color: #94a3b8; font-size: 11px; }
.mta-fill-btn { flex-shrink: 0; font-weight: 800 !important; min-width: 68px; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .mta-stats { grid-template-columns: repeat(2, 1fr); }
  .mta-title-row { flex-direction: column; }
  .mta-badge { align-self: flex-start; }
}
@media (max-width: 480px) {
  .mta-stats { grid-template-columns: 1fr 1fr; }
}
</style>
