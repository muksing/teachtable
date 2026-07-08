<template>
  <AppLayout>
    <div class="p-6 checklist-surface" v-loading="loading">

      <!-- Hero Header -->
      <div class="hero-card mb-6 no-print">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">✅ ตรวจสอบการออกข้อสอบ</h1>
            <p class="text-white/80 text-sm mt-1">เทียบภาระงานสอน vs ข้อสอบที่มีอยู่ · ครบทุกวิชา · ทุกห้อง</p>
          </div>
          <el-button
            @click="() => window.print()"
            style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white"
          >
            🖨️ พิมพ์รายงาน
          </el-button>
        </div>
      </div>

      <!-- Print header -->
      <div class="print-header print-only">
        <div class="print-school">{{ schoolStore.schoolName || 'โรงเรียน' }}</div>
        <div class="print-title">รายงานตรวจสอบการออกข้อสอบ</div>
        <div class="print-date">พิมพ์เมื่อ {{ printDate }}</div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-4 gap-4 mb-5 no-print">
        <div class="sum-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="sum-val" style="color:#1d4ed8">{{ rows.length }}</div>
          <div class="sum-lbl">รายการทั้งหมด</div>
        </div>
        <div class="sum-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="sum-val" style="color:#15803d">{{ doneCount }}</div>
          <div class="sum-lbl">มีข้อสอบแล้ว</div>
        </div>
        <div class="sum-card" style="background:linear-gradient(135deg,#fef2f2,#fecaca)">
          <div class="sum-val" style="color:#dc2626">{{ missingCount }}</div>
          <div class="sum-lbl">ยังไม่มีข้อสอบ</div>
        </div>
        <div class="sum-card" style="background:linear-gradient(135deg,#fdf4ff,#fae8ff)">
          <div class="sum-val" style="color:#a21caf">{{ Math.round(doneCount / (rows.length || 1) * 100) }}%</div>
          <div class="sum-lbl">ความคืบหน้า</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <el-card class="filter-card mb-4 no-print">
        <div class="flex flex-wrap gap-3 items-center">
          <el-input
            v-model="searchText"
            placeholder="🔍 ค้นหาวิชา / รหัส"
            clearable
            style="max-width:220px"
          />
          <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable style="max-width:130px">
            <el-option v-for="c in classOptions" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="filterTeacher" placeholder="ทุกครู" clearable filterable style="max-width:210px">
            <el-option v-for="t in teacherOptions" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="ทุกสถานะ" clearable style="max-width:170px">
            <el-option label="✅ มีข้อสอบแล้ว" value="done" />
            <el-option label="❌ ยังไม่มีข้อสอบ" value="missing" />
          </el-select>
          <el-button plain @click="clearFilters">ล้างตัวกรอง</el-button>
          <span class="text-sm text-gray-400 ml-auto">
            แสดง {{ filteredRows.length }} / {{ rows.length }} รายการ
          </span>
        </div>
      </el-card>

      <!-- Table -->
      <el-card class="table-card">
        <el-empty v-if="!loading && filteredRows.length === 0" description="ไม่พบข้อมูลที่ตรงกับตัวกรอง" />
        <el-table
          v-else
          :data="filteredRows"
          border
          stripe
          :header-cell-style="{ background:'#7c3aed', color:'white', fontWeight:'700', fontSize:'13px' }"
          :row-class-name="rowClass"
          style="width:100%"
        >
          <el-table-column label="ห้องเรียน" prop="class_id" width="90" align="center" sortable>
            <template #default="{ row }">
              <span class="font-bold text-purple-700">{{ row.class_id }}</span>
            </template>
          </el-table-column>

          <el-table-column label="รหัสวิชา" prop="subject_code" width="110" sortable>
            <template #default="{ row }">
              <span class="text-xs font-mono text-gray-600">{{ row.subject_code }}</span>
            </template>
          </el-table-column>

          <el-table-column label="ชื่อวิชา" min-width="160" prop="subject_name" show-overflow-tooltip />

          <el-table-column label="ครูผู้สอน" min-width="140" prop="teacher_name" />

          <el-table-column label="สถานะ" width="150" align="center" sortable prop="status">
            <template #default="{ row }">
              <el-tag v-if="row.examCount > 0" type="success" size="small">
                ✅ มีข้อสอบ {{ row.examCount }} ชุด
              </el-tag>
              <el-tag v-else type="danger" size="small">❌ ยังไม่มี</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="จำนวนข้อ" width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.totalQ > 0" class="font-semibold text-blue-700">{{ row.totalQ }}</span>
              <span v-else class="text-gray-300">—</span>
            </template>
          </el-table-column>

          <el-table-column label="คะแนนรวม" width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.totalPoints > 0" class="font-semibold text-purple-700">{{ row.totalPoints }}</span>
              <span v-else class="text-gray-300">—</span>
            </template>
          </el-table-column>

          <el-table-column label="ชื่อข้อสอบ" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-if="row.exams.length">
                <div v-for="e in row.exams" :key="e.id" class="text-xs text-gray-600 leading-5">
                  {{ e.title }}
                  <el-tag v-if="e.is_active" type="success" size="small" class="ml-1">เปิด</el-tag>
                  <el-tag v-else type="info" size="small" class="ml-1">ปิด</el-tag>
                </div>
              </div>
              <span v-else class="text-gray-300 text-xs">—</span>
            </template>
          </el-table-column>

          <el-table-column label="วันที่สอบ" width="110" align="center">
            <template #default="{ row }">
              <div v-if="row.exams.length">
                <div v-for="e in row.exams" :key="e.id" class="text-xs text-gray-500">
                  {{ e.exam_date ? formatDate(e.exam_date) : '—' }}
                </div>
              </div>
              <span v-else class="text-gray-300">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()

const loading  = ref(false)
const rows     = ref([])   // one row per teaching_assignment

// Filters
const searchText   = ref('')
const filterClass  = ref('')
const filterTeacher = ref('')
const filterStatus  = ref('')

const window = globalThis

const printDate = new Date().toLocaleDateString('th-TH', {
  year: 'numeric', month: 'long', day: 'numeric',
})

// ─── Helpers ──────────────────────────────────────────────
function parseClassIds(raw) {
  if (!raw) return []
  try { return Array.isArray(raw) ? raw : JSON.parse(raw) } catch { return [] }
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return d }
}

// ─── Load ─────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const schoolId = authStore.schoolId
    const term     = schoolStore.currentTerm || '2568_1'
    if (!schoolId) throw new Error('ไม่พบ schoolId')

    // 1. Teaching assignments (source of truth for what SHOULD have exams)
    const { data: assigns, error: aErr } = await supabase
      .from('teaching_assignments')
      .select('id, class_id, subject_id, subject_name, teacher_id, teacher_name')
      .eq('school_id', schoolId)
      .eq('term_id', term)
      .order('class_id')
    if (aErr) throw aErr

    // 2. All exams for this school
    const { data: exams, error: eErr } = await supabase
      .from('exams')
      .select('id, title, subject_code, class_ids, created_by, exam_date, is_active')
      .eq('school_id', schoolId)
    if (eErr) throw eErr

    // 3. Question stats per exam
    const examIds = (exams || []).map(e => e.id)
    let questionStats = {}
    if (examIds.length > 0) {
      const { data: qRows } = await supabase
        .from('exam_questions')
        .select('exam_id, points')
        .in('exam_id', examIds)
      ;(qRows || []).forEach(q => {
        if (!questionStats[q.exam_id]) questionStats[q.exam_id] = { count: 0, totalPoints: 0 }
        questionStats[q.exam_id].count++
        questionStats[q.exam_id].totalPoints += Number(q.points) || 0
      })
    }

    // 4. Teacher name map from users table
    const teacherUids = [...new Set((exams || []).map(e => e.created_by).filter(Boolean))]
    const teacherMap  = {}
    if (teacherUids.length > 0) {
      const { data: uRows } = await supabase
        .from('users')
        .select('id, first_name, last_name, displayName, display_name')
        .in('id', teacherUids)
      ;(uRows || []).forEach(u => {
        teacherMap[u.id] = u.displayName || u.display_name ||
          [u.first_name, u.last_name].filter(Boolean).join(' ') || u.id
      })
    }

    // 5. Cross-reference: for each assignment, find matching exams
    rows.value = (assigns || []).map(a => {
      const matchingExams = (exams || []).filter(e => {
        if ((e.subject_code || '') !== (a.subject_id || '')) return false
        const classes = parseClassIds(e.class_ids)
        return classes.includes(a.class_id)
      })

      // Aggregate question stats across matched exams
      let totalQ = 0, totalPoints = 0
      matchingExams.forEach(e => {
        const s = questionStats[e.id]
        if (s) { totalQ += s.count; totalPoints += s.totalPoints }
      })

      return {
        id:           a.id,
        class_id:     a.class_id,
        subject_code: a.subject_id,
        subject_name: a.subject_name || a.subject_id,
        teacher_id:   a.teacher_id,
        teacher_name: a.teacher_name || a.teacher_id,
        exams:        matchingExams.map(e => ({
          id:         e.id,
          title:      e.title,
          exam_date:  e.exam_date,
          is_active:  e.is_active,
        })),
        examCount:    matchingExams.length,
        totalQ,
        totalPoints,
        status:       matchingExams.length > 0 ? 'done' : 'missing',
      }
    })

  } catch (e) {
    console.error(e)
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ─── Computed ─────────────────────────────────────────────
const doneCount    = computed(() => rows.value.filter(r => r.examCount > 0).length)
const missingCount = computed(() => rows.value.filter(r => r.examCount === 0).length)

const classOptions = computed(() => {
  const s = new Set(rows.value.map(r => r.class_id))
  return [...s].sort()
})

const teacherOptions = computed(() => {
  const seen = new Set()
  const opts = []
  rows.value.forEach(r => {
    if (r.teacher_id && !seen.has(r.teacher_id)) {
      seen.add(r.teacher_id)
      opts.push({ id: r.teacher_id, name: r.teacher_name })
    }
  })
  return opts.sort((a, b) => a.name.localeCompare(b.name, 'th'))
})

const filteredRows = computed(() => rows.value.filter(r => {
  if (filterClass.value && r.class_id !== filterClass.value) return false
  if (filterTeacher.value && r.teacher_id !== filterTeacher.value) return false
  if (filterStatus.value && r.status !== filterStatus.value) return false
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    if (!r.subject_name?.toLowerCase().includes(q) && !r.subject_code?.toLowerCase().includes(q)) return false
  }
  return true
}))

function rowClass({ row }) {
  return row.examCount === 0 ? 'row-missing' : 'row-done'
}

function clearFilters() {
  searchText.value = ''
  filterClass.value = ''
  filterTeacher.value = ''
  filterStatus.value = ''
}

onMounted(loadData)
</script>

<style scoped>
.hero-card {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(124,58,237,0.18);
}

.sum-card {
  border-radius: 12px;
  padding: 18px 22px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
}
.sum-val  { font-size: 2rem; font-weight: 800; line-height: 1; }
.sum-lbl  { font-size: 0.82rem; color: #6b7280; margin-top: 4px; }

.filter-card { border-radius: 12px; border: 1px solid #e0e7ff; }
:deep(.filter-card .el-card__body) { padding: 14px 20px; }

.table-card { border-radius: 12px; overflow: hidden; }
:deep(.table-card .el-card__body) { padding: 0; }

:deep(.row-missing td) {
  background: #fef2f2 !important;
}
:deep(.row-done td) {
  background: #f0fdf4 !important;
}

/* ── Print ─────────────────────────────────── */
.print-only { display: none; }

@media print {
  .no-print   { display: none !important; }
  .print-only { display: block !important; }

  .checklist-surface { padding: 8px !important; }

  nav, aside, header, footer,
  [class*="sidebar"], [class*="app-layout__nav"],
  [class*="layout-aside"] { display: none !important; }

  .print-header { text-align: center; margin-bottom: 16px; }
  .print-school { font-size: 18px; font-weight: 800; }
  .print-title  { font-size: 14px; color: #475569; margin-top: 4px; }
  .print-date   { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  .table-card { box-shadow: none; border: none; }

  :deep(.row-missing td) { background: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :deep(.row-done td)    { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
