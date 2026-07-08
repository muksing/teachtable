<template>
  <AppLayout>
    <div class="tlr-page">

      <!-- ── Header ─────────────────────────────────────────────── -->
      <div class="tlr-header">
        <div>
          <h1 class="tlr-title">📊 รายงานการบันทึกการสอน</h1>
          <p class="tlr-sub">
            {{ isAdmin ? 'ตรวจสอบครูทุกคนที่บันทึก/ยังไม่บันทึกรายคาบ' : 'บันทึกการสอนของฉัน' }}
          </p>
        </div>
        <el-button type="primary" plain @click="exportExcel" :disabled="filteredRows.length === 0">
          📥 ส่งออก Excel
        </el-button>
      </div>

      <!-- ── Filters ────────────────────────────────────────────── -->
      <el-card class="mb-4" shadow="never" style="border-radius:14px;border-top:4px solid #0891b2">
        <div class="tlr-filter-row">
          <div class="tlr-filter-item">
            <div class="tlr-filter-label">📅 ช่วงวันที่</div>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="–"
              start-placeholder="วันเริ่ม"
              end-placeholder="วันสิ้นสุด"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              style="width:280px"
            />
          </div>

          <div v-if="isAdmin" class="tlr-filter-item">
            <div class="tlr-filter-label">👤 กรองตามครู</div>
            <TeacherSelect
              v-model="filterTeacher"
              :teachers="teacherList"
              placeholder="ครูทั้งหมด"
              clearable
              style="width:210px"
            />
          </div>

          <div class="tlr-filter-item">
            <div class="tlr-filter-label">🏫 ห้องเรียน</div>
            <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable style="width:140px">
              <el-option v-for="c in classOptions" :key="c" :value="c" :label="c" />
            </el-select>
          </div>

          <div class="tlr-filter-item">
            <div class="tlr-filter-label">📚 วิชา</div>
            <el-select v-model="filterSubject" placeholder="ทุกวิชา" clearable filterable style="width:190px">
              <el-option v-for="s in subjectOptions" :key="s.id" :value="s.id" :label="s.label" />
            </el-select>
          </div>

          <div class="tlr-filter-item">
            <div class="tlr-filter-label">✅ สถานะ</div>
            <el-select v-model="filterStatus" style="width:145px">
              <el-option label="ทั้งหมด"      value="all" />
              <el-option label="บันทึกแล้ว"   value="filled" />
              <el-option label="ยังไม่บันทึก" value="unfilled" />
            </el-select>
          </div>

          <el-button type="primary" :loading="loading" @click="loadReport">🔄 รีเฟรช</el-button>
          <el-button v-if="hasActiveFilter" plain @click="clearFilters">✕ ล้างตัวกรอง</el-button>
        </div>
      </el-card>

      <!-- ── Summary Cards ──────────────────────────────────────── -->
      <div v-if="reportRows.length > 0" class="tlr-stats mb-4">
        <div class="tlr-stat" style="border-color:#6366f1">
          <div class="tlr-stat-n" style="color:#6366f1">{{ totalSlots }}</div>
          <div class="tlr-stat-l">คาบทั้งหมด</div>
        </div>
        <div class="tlr-stat" style="border-color:#22c55e">
          <div class="tlr-stat-n" style="color:#22c55e">{{ filledSlots }}</div>
          <div class="tlr-stat-l">บันทึกแล้ว</div>
        </div>
        <div class="tlr-stat" style="border-color:#ef4444">
          <div class="tlr-stat-n" style="color:#ef4444">{{ unfilledSlots }}</div>
          <div class="tlr-stat-l">ยังไม่บันทึก</div>
        </div>
        <div class="tlr-stat" style="border-color:#f59e0b">
          <div class="tlr-stat-n" style="color:#f59e0b">{{ filledPct }}%</div>
          <div class="tlr-stat-l">อัตราบันทึก</div>
        </div>
        <div v-if="isAdmin" class="tlr-stat" style="border-color:#8b5cf6">
          <div class="tlr-stat-n" style="color:#8b5cf6">{{ uniqueTeachers }}</div>
          <div class="tlr-stat-l">จำนวนครู</div>
        </div>
      </div>

      <!-- ── Admin: Teacher summary table ──────────────────────── -->
      <el-card v-if="isAdmin && teacherSummary.length > 0" class="mb-4" shadow="never" style="border-radius:14px;border-top:4px solid #8b5cf6">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-bold text-gray-700">สรุปรายครู ({{ teacherSummary.length }} คน)</span>
            <el-input v-model="teacherSummarySearch" placeholder="ค้นหาชื่อครู..." clearable size="small" style="width:180px" />
          </div>
        </template>
        <el-table
          :data="filteredTeacherSummary"
          border stripe size="small"
          :header-cell-style="{ background:'#8b5cf6', color:'white', fontWeight:'600' }"
          max-height="300"
        >
          <el-table-column type="index" width="46" align="center" label="#" />
          <el-table-column label="ชื่อครู" min-width="160" sortable prop="teacher_name">
            <template #default="{ row }">
              <span class="font-semibold text-sm">{{ row.teacher_name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="คาบทั้งหมด" width="100" align="center" sortable prop="total">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.total }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="บันทึกแล้ว" width="95" align="center" sortable prop="filled">
            <template #default="{ row }">
              <span class="font-bold text-green-600">{{ row.filled }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ยังไม่บันทึก" width="105" align="center" sortable prop="unfilled">
            <template #default="{ row }">
              <span class="font-bold" :class="row.unfilled > 0 ? 'text-red-500' : 'text-gray-400'">
                {{ row.unfilled }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="อัตราบันทึก" width="200">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <el-progress
                  :percentage="row.rate"
                  :color="row.rate >= 90 ? '#22c55e' : row.rate >= 60 ? '#f59e0b' : '#ef4444'"
                  :stroke-width="8"
                  :show-text="false"
                  style="flex:1"
                />
                <span class="text-xs font-bold w-10 text-right" :class="row.rate >= 90 ? 'text-green-600' : row.rate >= 60 ? 'text-amber-500' : 'text-red-500'">
                  {{ row.rate }}%
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="" width="80" align="center">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="filterTeacher = row.teacher_id; scrollToDetail()">
                ดูคาบ
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- ── Detail Table ───────────────────────────────────────── -->
      <el-card shadow="never" style="border-radius:14px;border-top:4px solid #0891b2" ref="detailCard">
        <template #header>
          <div class="flex justify-between items-center flex-wrap gap-2">
            <span class="font-bold text-gray-700">
              รายละเอียดรายคาบ
              <el-tag size="small" type="info" class="ml-2">{{ filteredRows.length }} รายการ</el-tag>
            </span>
            <div class="flex items-center gap-2">
              <el-input v-model="detailSearch" placeholder="ค้นหา..." clearable size="small" style="width:160px" />
            </div>
          </div>
        </template>

        <el-empty v-if="!loading && filteredRows.length === 0"
          description="ไม่มีข้อมูลในเงื่อนไขที่เลือก" :image-size="60" />

        <el-table
          v-else
          :data="pagedRows"
          v-loading="loading"
          border stripe size="small"
          :header-cell-style="{ background:'#0891b2', color:'white', fontWeight:'600' }"
          max-height="520"
        >
          <el-table-column label="วันที่" prop="date" width="105" sortable>
            <template #default="{ row }">
              <div class="text-xs font-semibold">{{ formatDate(row.date) }}</div>
              <div class="text-xs text-gray-400">{{ row.day_of_week }}</div>
            </template>
          </el-table-column>
          <el-table-column label="คาบ" prop="period" width="55" align="center" sortable>
            <template #default="{ row }">
              <el-tag size="small" type="warning" effect="dark">{{ row.period }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="ห้อง" prop="class_name" width="85" sortable>
            <template #default="{ row }">
              <span class="text-xs font-bold text-indigo-700">{{ row.class_name || row.class_id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="วิชา" prop="subject_name" min-width="130">
            <template #default="{ row }">
              <div class="text-xs font-semibold">{{ row.subject_name || '—' }}</div>
              <div class="text-xs text-gray-400">{{ row.subject_plan_id }}</div>
            </template>
          </el-table-column>
          <el-table-column v-if="isAdmin" label="ครูตามแผน" prop="teacher_plan_name" min-width="130">
            <template #default="{ row }">
              <span class="text-xs">{{ row.teacher_plan_name || row.teacher_plan_id || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="สถานะ" width="115" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_filled ? 'success' : 'danger'" size="small"
                :effect="row.is_filled ? 'light' : 'plain'">
                {{ row.is_filled ? '✓ บันทึกแล้ว' : '⚠ ยังไม่บันทึก' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="หัวข้อที่สอน" prop="topic" min-width="160">
            <template #default="{ row }">
              <span class="text-xs text-gray-700">{{ row.topic || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ผู้บันทึก" prop="record_by_name" min-width="110">
            <template #default="{ row }">
              <span class="text-xs text-gray-600">{{ row.record_by_name || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="เวลาบันทึก" width="115">
            <template #default="{ row }">
              <span class="text-xs text-gray-400">{{ formatTimestamp(row.timestamp) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <!-- Pagination -->
        <div v-if="filteredRows.length > pageSize" class="flex justify-center mt-3">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="filteredRows.length"
            layout="prev, pager, next"
            background
            small
          />
        </div>
      </el-card>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import * as XLSX from 'xlsx'

const authStore  = useAuthStore()
const schoolStore = useSchoolStore()
const { getTeachActualsRange, getTeachers } = useSchoolDb()

const isAdmin = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))
const myTeacherId = computed(() => String(authStore.profile?.teacher_id || authStore.profile?.uid || ''))

// ── Filter state ───────────────────────────────────────────────────
const today      = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
const termStart  = computed(() => schoolStore.settingsObj?.term_start || '')
const dateRange  = ref([termStart.value || today, today])
const filterTeacher = ref('')
const filterClass   = ref('')
const filterSubject = ref('')
const filterStatus  = ref('all')
const detailSearch  = ref('')
const teacherSummarySearch = ref('')
const currentPage = ref(1)
const pageSize    = 50

const hasActiveFilter = computed(() =>
  filterTeacher.value || filterClass.value || filterSubject.value || filterStatus.value !== 'all' || detailSearch.value
)
function clearFilters() {
  filterTeacher.value = ''
  filterClass.value   = ''
  filterSubject.value = ''
  filterStatus.value  = 'all'
  detailSearch.value  = ''
}

// reset page on client-side filter change
watch([filterTeacher, filterClass, filterSubject, filterStatus, detailSearch], () => { currentPage.value = 1 })

// auto-reload when date range changes (debounced)
let reloadTimer = null
watch(dateRange, (val) => {
  if (!val?.[0] || !val?.[1]) return
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => loadReport(), 300)
})

// ── Data ───────────────────────────────────────────────────────────
const loading     = ref(false)
const reportRows  = ref([])
const teacherList = ref([])

// ── Computed: filter options ──────────────────────────────────────
const classOptions = computed(() => {
  const s = new Set(reportRows.value.map(r => r.class_name || r.class_id).filter(Boolean))
  return [...s].sort()
})
const subjectOptions = computed(() => {
  const map = {}
  reportRows.value.forEach(r => {
    const id = r.subject_plan_id || ''
    if (!map[id]) map[id] = r.subject_name || id
  })
  return Object.entries(map)
    .map(([id, name]) => ({ id, label: id ? `${id} — ${name}` : name }))
    .sort((a, b) => a.id.localeCompare(b.id))
})

// ── Computed: summary ─────────────────────────────────────────────
const ownRows = computed(() => {
  // teacher sees only their own records
  if (isAdmin.value) return reportRows.value
  const myId = myTeacherId.value
  return reportRows.value.filter(r =>
    r.teacher_plan_id === myId || r.subject_actual_teacher_id === myId
  )
})

const totalSlots    = computed(() => ownRows.value.length)
const filledSlots   = computed(() => ownRows.value.filter(r => r.is_filled).length)
const unfilledSlots = computed(() => totalSlots.value - filledSlots.value)
const filledPct     = computed(() => totalSlots.value
  ? Math.round((filledSlots.value / totalSlots.value) * 100) : 0)
const uniqueTeachers = computed(() =>
  new Set(ownRows.value.map(r => r.teacher_plan_id).filter(Boolean)).size
)

// Per-teacher summary (admin only)
const teacherSummary = computed(() => {
  const map = {}
  ownRows.value.forEach(r => {
    const k = r.teacher_plan_id || 'unknown'
    if (!map[k]) map[k] = { teacher_id: k, teacher_name: r.teacher_plan_name || k, total: 0, filled: 0 }
    map[k].total++
    if (r.is_filled) map[k].filled++
  })
  return Object.values(map)
    .map(t => ({ ...t, unfilled: t.total - t.filled, rate: t.total ? Math.round((t.filled / t.total) * 100) : 0 }))
    .sort((a, b) => a.rate - b.rate)
})

const filteredTeacherSummary = computed(() => {
  const q = teacherSummarySearch.value.toLowerCase()
  if (!q) return teacherSummary.value
  return teacherSummary.value.filter(t => t.teacher_name.toLowerCase().includes(q))
})

// Filtered detail rows
const filteredRows = computed(() => {
  const q = detailSearch.value.toLowerCase()
  return ownRows.value.filter(r => {
    if (filterTeacher.value && r.teacher_plan_id !== filterTeacher.value) return false
    if (filterClass.value && (r.class_name || r.class_id) !== filterClass.value) return false
    if (filterSubject.value && r.subject_plan_id !== filterSubject.value) return false
    if (filterStatus.value === 'filled'   && !r.is_filled) return false
    if (filterStatus.value === 'unfilled' &&  r.is_filled) return false
    if (q) {
      const hay = [r.teacher_plan_name, r.subject_name, r.class_name, r.class_id, r.topic, r.record_by_name].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredRows.value.slice(start, start + pageSize)
})

// ── Load data ──────────────────────────────────────────────────────
async function loadReport() {
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) {
    ElMessage.warning('กรุณาเลือกช่วงวันที่')
    return
  }
  loading.value = true
  reportRows.value = []   // clear ก่อนเสมอ ไม่ให้ข้อมูลเก่าค้าง
  currentPage.value = 1
  try {
    reportRows.value = await getTeachActualsRange(dateRange.value[0], dateRange.value[1])
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function loadTeachers() {
  if (!isAdmin.value) return
  try {
    teacherList.value = await getTeachers()
  } catch { /* ignore */ }
}

const detailCard = ref(null)
function scrollToDetail() {
  detailCard.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // ตั้ง start date เป็นวันเปิดเรียน (ถ้ามี) ก่อน load
  if (termStart.value) dateRange.value = [termStart.value, today]
  loadTeachers()
  loadReport()
  if (!isAdmin.value) {
    filterTeacher.value = myTeacherId.value
  }
})

// ── Helpers ────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—'
  try {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${Number(y) + 543}`
  } catch { return d }
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mi = d.getMinutes().toString().padStart(2, '0')
  return `${dd}/${mm} ${hh}:${mi}`
}

// ── Export ─────────────────────────────────────────────────────────
function exportExcel() {
  const rows = filteredRows.value.map(r => ({
    'วันที่':           r.date,
    'วัน':              r.day_of_week,
    'คาบ':              r.period,
    'ห้อง':             r.class_name || r.class_id,
    'วิชา':             r.subject_name || '',
    'รหัสวิชา':         r.subject_plan_id || '',
    'ครูตามแผน':        r.teacher_plan_name || r.teacher_plan_id || '',
    'สถานะ':            r.is_filled ? 'บันทึกแล้ว' : 'ยังไม่บันทึก',
    'หัวข้อที่สอน':      r.topic || '',
    'จำนวนนักเรียนมา':  r.inclass?.length ?? '',
    'ผู้บันทึก':        r.record_by_name || '',
    'เวลาบันทึก':       formatTimestamp(r.timestamp),
    'หมายเหตุ':         r.note || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'TeachingLog')
  XLSX.writeFile(wb, `teaching_log_${dateRange.value[0]}_${dateRange.value[1]}.xlsx`)
}
</script>

<style scoped>
.tlr-page  { padding: 24px; max-width: 1240px; margin: 0 auto; }
.tlr-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 20px; gap: 12px;
}
.tlr-title { font-size: 22px; font-weight: 800; color: #1e293b; }
.tlr-sub   { font-size: 12px; color: #94a3b8; margin-top: 2px; }

/* Filter row */
.tlr-filter-row {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
}
.tlr-filter-item { display: flex; flex-direction: column; gap: 4px; }
.tlr-filter-label { font-size: 11px; font-weight: 600; color: #64748b; }

/* Summary stats */
.tlr-stats {
  display: flex; flex-wrap: wrap; gap: 12px;
}
.tlr-stat {
  flex: 1; min-width: 100px; max-width: 160px;
  background: white; border-radius: 12px; padding: 14px 16px;
  text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border-top: 4px solid;
}
.tlr-stat-n { font-size: 28px; font-weight: 900; line-height: 1.1; }
.tlr-stat-l { font-size: 11px; color: #94a3b8; margin-top: 3px; font-weight: 600; }

@media (max-width: 768px) {
  .tlr-page   { padding: 12px; }
  .tlr-filter-row { flex-direction: column; align-items: stretch; }
  .tlr-stats  { gap: 8px; }
  .tlr-stat   { min-width: calc(50% - 4px); max-width: none; }
}
</style>
