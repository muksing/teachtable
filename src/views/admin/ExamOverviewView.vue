<template>
  <AppLayout>
    <div class="p-6 exam-overview-surface" v-loading="loading">

      <!-- Hero Header -->
      <div class="hero-card mb-6 no-print">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">📊 ภาพรวมข้อสอบ</h1>
            <p class="text-white/80 text-sm mt-1">ทุกวิชา · ทุกครู · ทุกห้อง</p>
          </div>
          <el-button
            @click="() => window.print()"
            style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white"
          >
            🖨️ พิมพ์สรุป
          </el-button>
        </div>
      </div>

      <!-- Print header (only visible when printing) -->
      <div class="print-header print-only">
        <div class="print-school-name">{{ schoolStore.schoolName || 'โรงเรียน' }}</div>
        <div class="print-title">ภาพรวมข้อสอบ · ทุกวิชา · ทุกครู · ทุกห้อง</div>
      </div>

      <!-- Filter Bar -->
      <el-card class="filter-card mb-5 no-print">
        <div class="flex flex-wrap gap-3 items-center">
          <el-input
            v-model="searchText"
            placeholder="🔍 ค้นหาวิชา / รหัสวิชา"
            clearable
            style="max-width:240px"
          />
          <el-select
            v-model="filterTerm"
            placeholder="ภาคเรียน"
            clearable
            style="max-width:200px"
          >
            <el-option
              v-for="t in termOptions"
              :key="t"
              :label="t"
              :value="t"
            />
          </el-select>
          <el-select
            v-model="filterTeacher"
            placeholder="ครูผู้สอน"
            clearable
            filterable
            style="max-width:220px"
          >
            <el-option
              v-for="t in teacherOptions"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
          <el-button plain @click="clearFilters">ล้างตัวกรอง</el-button>
          <span class="text-sm text-gray-500 ml-auto">
            {{ filteredGroups.length }} กลุ่มวิชา · {{ totalExamCount }} ข้อสอบ
          </span>
        </div>
      </el-card>

      <!-- Empty State -->
      <el-empty v-if="!loading && filteredGroups.length === 0" description="ไม่พบข้อสอบที่ตรงกับตัวกรอง" />

      <!-- Groups Table -->
      <div
        v-for="(group, gi) in filteredGroups"
        :key="group.key"
        class="group-block mb-4"
      >
        <!-- Group Header -->
        <div class="group-header">
          <div class="gh-subject">
            <span class="gh-code">{{ group.subjectCode }}</span>
            <span class="gh-name">{{ group.subjectName }}</span>
          </div>
          <div class="gh-teacher">{{ group.teacherName || '-' }}</div>
          <div class="gh-classes">{{ group.allClasses }}</div>
          <div class="gh-stat">{{ group.exams.length }} ชุด</div>
          <div class="gh-stat">{{ group.totalQ }} ข้อ</div>
          <div class="gh-stat">{{ group.totalPoints }} คะแนน</div>
        </div>

        <!-- Exam Rows -->
        <el-table
          :data="group.exams"
          size="small"
          border
          stripe
          :header-cell-style="{ background:'#f1f5f9', color:'#334155', fontWeight:'600', fontSize:'12px' }"
          :cell-style="{ fontSize:'12px' }"
          style="width:100%"
        >
          <el-table-column label="ชื่อข้อสอบ" min-width="200" prop="title" show-overflow-tooltip />
          <el-table-column label="วันที่สอบ" width="110" align="center">
            <template #default="{ row }">
              {{ row.exam_date ? formatDate(row.exam_date) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="ห้องเรียน" width="140" align="center">
            <template #default="{ row }">
              {{ parseClassIds(row.class_ids) }}
            </template>
          </el-table-column>
          <el-table-column label="จำนวนข้อ" width="90" align="center">
            <template #default="{ row }">
              {{ questionStatsMap[row.id]?.count ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column label="คะแนนรวม" width="90" align="center">
            <template #default="{ row }">
              {{ questionStatsMap[row.id]?.totalPoints ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column label="สถานะ" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.is_active" type="success" size="small">เปิด</el-tag>
              <el-tag v-else type="info" size="small">ปิด</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

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

const loading = ref(false)
const exams = ref([])
const questionStatsMap = ref({})   // { examId: { count, totalPoints } }
const teacherMap = ref({})         // { userId: displayName }
const groups = ref([])

// Filters
const searchText  = ref('')
const filterTerm  = ref('')
const filterTeacher = ref('')

// ─── Helpers ──────────────────────────────────────────────
function parseClassIds(raw) {
  if (!raw) return '-'
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw)
    return arr.join(', ')
  } catch {
    return String(raw)
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

function examTerm(exam) {
  if (!exam.exam_date) return ''
  const d = new Date(exam.exam_date)
  return `${d.getFullYear() + 543}`
}

// ─── Load data ────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const schoolId = authStore.schoolId
    if (!schoolId) throw new Error('ไม่พบ schoolId')

    // 1. Load all exams
    const { data: examRows, error: examErr } = await supabase
      .from('exams')
      .select('*')
      .eq('school_id', schoolId)
      .order('subject_code')
      .order('exam_date', { ascending: false })
    if (examErr) throw examErr
    exams.value = examRows || []

    if (exams.value.length === 0) return

    // 2. Load question stats per exam
    const examIds = exams.value.map(e => e.id)
    const { data: qRows, error: qErr } = await supabase
      .from('exam_questions')
      .select('exam_id, points')
      .in('exam_id', examIds)
    if (!qErr && qRows) {
      const statsMap = {}
      qRows.forEach(q => {
        if (!statsMap[q.exam_id]) statsMap[q.exam_id] = { count: 0, totalPoints: 0 }
        statsMap[q.exam_id].count++
        statsMap[q.exam_id].totalPoints += Number(q.points) || 0
      })
      questionStatsMap.value = statsMap
    }

    // 3. Load teacher names
    const teacherIds = [...new Set(exams.value.map(e => e.created_by).filter(Boolean))]
    if (teacherIds.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, first_name, last_name, displayName, display_name')
        .in('id', teacherIds)
      const tMap = {}
      ;(userRows || []).forEach(u => {
        tMap[u.id] = u.displayName || u.display_name ||
          [u.first_name, u.last_name].filter(Boolean).join(' ') || u.id
      })
      teacherMap.value = tMap
    }

    // 4. Build groups
    const groupMap = {}
    exams.value.forEach(exam => {
      const key = `${exam.subject_code || ''}__${exam.created_by || ''}`
      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          subjectCode: exam.subject_code || '-',
          subjectName: exam.subject_name || exam.subject_code || '-',
          teacherId:   exam.created_by || '',
          teacherName: teacherMap.value[exam.created_by] || exam.created_by || '-',
          exams: [],
        }
      }
      groupMap[key].exams.push(exam)
    })

    // Compute group-level aggregates
    const builtGroups = Object.values(groupMap).map(g => {
      const classSet = new Set()
      let totalQ = 0, totalPoints = 0
      g.exams.forEach(exam => {
        const arr = exam.class_ids
          ? (Array.isArray(exam.class_ids) ? exam.class_ids : (() => { try { return JSON.parse(exam.class_ids) } catch { return [] } })())
          : []
        arr.forEach(c => classSet.add(c))
        const stats = questionStatsMap.value[exam.id]
        if (stats) { totalQ += stats.count; totalPoints += stats.totalPoints }
      })
      return {
        ...g,
        allClasses: classSet.size > 0 ? [...classSet].join(', ') : '-',
        totalQ,
        totalPoints,
      }
    })

    // Sort: subjectCode → teacherName
    builtGroups.sort((a, b) => {
      const sc = a.subjectCode.localeCompare(b.subjectCode, 'th')
      if (sc !== 0) return sc
      return a.teacherName.localeCompare(b.teacherName, 'th')
    })

    groups.value = builtGroups

  } catch (e) {
    console.error(e)
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ─── Filter options ───────────────────────────────────────
const termOptions = computed(() => {
  const set = new Set()
  exams.value.forEach(e => { if (e.exam_date) set.add(examTerm(e)) })
  return [...set].sort().reverse()
})

const teacherOptions = computed(() => {
  const seen = new Set()
  const opts = []
  exams.value.forEach(e => {
    if (e.created_by && !seen.has(e.created_by)) {
      seen.add(e.created_by)
      opts.push({ id: e.created_by, name: teacherMap.value[e.created_by] || e.created_by })
    }
  })
  return opts.sort((a, b) => a.name.localeCompare(b.name, 'th'))
})

// ─── Filtered groups ──────────────────────────────────────
const filteredGroups = computed(() => {
  let result = groups.value

  if (filterTeacher.value) {
    result = result.filter(g => g.teacherId === filterTeacher.value)
  }

  if (filterTerm.value) {
    result = result.map(g => ({
      ...g,
      exams: g.exams.filter(e => examTerm(e) === filterTerm.value)
    })).filter(g => g.exams.length > 0)
  }

  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase()
    result = result.filter(g =>
      g.subjectCode.toLowerCase().includes(q) ||
      g.subjectName.toLowerCase().includes(q)
    )
  }

  return result
})

const totalExamCount = computed(() =>
  filteredGroups.value.reduce((s, g) => s + g.exams.length, 0)
)

function clearFilters() {
  searchText.value = ''
  filterTerm.value = ''
  filterTeacher.value = ''
}

// expose window for template
const window = globalThis

onMounted(loadData)
</script>

<style scoped>
.hero-card {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(124,58,237,0.18);
}

.filter-card {
  border-radius: 12px;
  border: 1px solid #e0e7ff;
}

:deep(.filter-card .el-card__body) {
  padding: 14px 20px;
}

.group-block {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(15,23,42,0.06);
}

.group-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr 80px 80px 90px;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  color: white;
  font-size: 13px;
  align-items: center;
}

.gh-subject { display: flex; flex-direction: column; gap: 2px; }
.gh-code { font-size: 11px; opacity: 0.8; }
.gh-name { font-weight: 700; font-size: 13px; }
.gh-teacher { font-size: 12px; }
.gh-classes { font-size: 12px; opacity: 0.9; }
.gh-stat { font-weight: 700; font-size: 13px; text-align: center; }

/* ── Print ─────────────────────────────────── */
.print-only { display: none; }

@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }

  .exam-overview-surface { padding: 8px !important; }

  /* hide AppLayout shell */
  nav, aside, header, footer,
  [class*="sidebar"], [class*="app-layout__nav"],
  [class*="layout-aside"] { display: none !important; }

  .print-header { text-align: center; margin-bottom: 16px; }
  .print-school-name { font-size: 18px; font-weight: 800; }
  .print-title { font-size: 14px; color: #475569; margin-top: 4px; }

  .group-header {
    background: #e2e8f0 !important;
    color: #1e293b !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .group-block { break-inside: avoid; }

  .hero-card, .filter-card { display: none !important; }
}
</style>
