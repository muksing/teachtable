<template>
  <AppLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">📋 รายงานมอบหมายภาระงาน</h1>
            <p class="text-white/80 text-sm mt-1">ตรวจสอบภาระงานครู — ภาคเรียน {{ reportTermLabel }}</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <el-button :disabled="publishedMissing" @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก Excel
            </el-button>
            <el-button :disabled="publishedMissing" @click="handlePrint" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🖨️ พิมพ์ PDF
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="publishedMissing" class="publish-warning mb-6">
        ⚠️ ยังไม่ Publish ตารางสอน — หน้านี้แสดงเฉพาะข้อมูลที่ถูก Publish ล่าสุด
      </div>
      <div v-else class="publish-banner mb-6">
        <div class="font-semibold">📌 แหล่งข้อมูล: {{ publishSourceLabel }}</div>
        <div class="text-sm opacity-90">วันที่ Publish: {{ publishAtLabel || 'ไม่ระบุ' }} <span v-if="publishVersion">| เวอร์ชัน: {{ publishVersion }}</span></div>
      </div>

      <!-- Summary Cards -->
      <div v-if="!publishedMissing" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="stat-value" style="color:#1d4ed8">{{ summaryStats.totalTeachers }}</div>
          <div class="stat-label">ครูที่มีภาระงาน</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fdf4ff,#fae8ff)">
          <div class="stat-value" style="color:#7c3aed">{{ summaryStats.totalAssignments }}</div>
          <div class="stat-label">รายการทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ summaryStats.totalPeriods }}</div>
          <div class="stat-label">คาบรวม/สัปดาห์</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fff7ed,#fed7aa)">
          <div class="stat-value" style="color:#c2410c">{{ summaryStats.completionPct }}%</div>
          <div class="stat-label">จัดตารางแล้ว</div>
        </div>
      </div>

      <!-- Controls -->
      <div v-if="!publishedMissing" class="flex flex-wrap gap-3 mb-4 items-center">
        <!-- Group mode -->
        <div class="flex rounded-lg border overflow-hidden text-sm bg-white">
          <button v-for="m in GROUP_MODES" :key="m.value"
            @click="groupMode = m.value"
            :class="[
              'px-3 py-1.5 font-medium transition-all border-r last:border-r-0',
              groupMode === m.value ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            ]">{{ m.label }}</button>
        </div>

        <!-- Detail level toggle -->
        <div class="flex rounded-lg border overflow-hidden text-sm bg-white">
          <button @click="detailLevel='full'" :class="['px-3 py-1.5 font-medium transition-all border-r', detailLevel==='full'?'bg-indigo-600 text-white':'text-gray-500 hover:bg-gray-50']">📋 แสดงทุกรายการ</button>
          <button @click="detailLevel='summary'" :class="['px-3 py-1.5 font-medium transition-all', detailLevel==='summary'?'bg-indigo-600 text-white':'text-gray-500 hover:bg-gray-50']">📊 สรุปเท่านั้น</button>
        </div>
        <div class="text-xs text-gray-400 flex items-center gap-1">
          <span>มาตรฐาน สพฐ.:</span>
          <el-tag type="success" size="small">✅ 15-20 คาบ</el-tag>
          <el-tag type="warning" size="small">🟡 &lt;15 คาบ</el-tag>
          <el-tag type="danger" size="small">🔴 &gt;20 คาบ</el-tag>
        </div>

        <!-- Sort -->
        <el-select v-model="sortKey" size="small" style="width:160px">
          <el-option label="เรียงตามชื่อ" value="name" />
          <el-option label="เรียงตามคาบรวม" value="periods" />
          <el-option label="เรียงตามห้อง" value="class" />
          <el-option label="เรียงตามสถานะ" value="status" />
        </el-select>

        <!-- Filters -->
        <el-select v-model="filterTeacher" placeholder="ทุกครู" clearable size="small" style="width:180px" filterable>
          <el-option v-for="t in teacherList" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable size="small" style="width:110px">
          <el-option v-for="c in classList" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="ทุกสถานะ" clearable size="small" style="width:130px">
          <el-option label="ครบแล้ว" value="done" />
          <el-option label="บางส่วน" value="partial" />
          <el-option label="ยังไม่จัด" value="none" />
        </el-select>
        <el-input v-model="filterText" placeholder="ค้นหา..." clearable size="small" style="width:160px" />

        <span class="text-xs text-gray-400 ml-auto">{{ filteredRows.length }} รายการ</span>
      </div>

      <!-- ===== Grouped by Teacher ===== -->
      <div v-if="!publishedMissing && groupMode === 'teacher'" class="space-y-4">
        <div v-for="group in groupedByTeacher" :key="group.teacher_id"
          class="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-3 border-b"
            style="background:linear-gradient(135deg,#667eea10,#667eea05)">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style="background:linear-gradient(135deg,#667eea,#764ba2)">
              {{ group.teacher_name.charAt(0) }}
            </div>
            <div class="flex-1">
              <div class="font-bold text-gray-800">{{ group.teacher_name }}</div>
              <div class="text-xs text-gray-400">{{ group.teacher_id }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-purple-700 flex items-center gap-1 justify-end">
                {{ group.totalPeriods }} คาบ/สัปดาห์
                <el-tag v-if="group.workloadStatus==='over'" type="danger" size="small" style="margin-left:4px">🔴 เกินมาตรฐาน</el-tag>
                <el-tag v-else-if="group.workloadStatus==='under'" type="warning" size="small" style="margin-left:4px">🟡 น้อยกว่าปกติ</el-tag>
                <el-tag v-else type="success" size="small" style="margin-left:4px">✅ ปกติ</el-tag>
              </div>
              <div class="text-xs text-gray-400">{{ group.items.length }} รายวิชา</div>
            </div>
            <el-progress
              :percentage="group.completionPct"
              :status="group.completionPct >= 100 ? 'success' : group.completionPct > 0 ? '' : 'exception'"
              :stroke-width="8" style="width:100px"
            />
          </div>
          <div v-if="detailLevel==='full'">
            <el-table :data="group.items" size="small" :show-header="true" border :header-cell-style="{ background: '#7c3aed', color: 'white', fontWeight: '600' }">
              <el-table-column label="ห้องเรียน" prop="class_id" width="90" align="center">
                <template #default="{ row }">
                  <span class="font-semibold text-purple-700">{{ row.class_id }}</span>
                </template>
              </el-table-column>
              <el-table-column label="วิชา" min-width="160">
                <template #default="{ row }">
                  <div class="font-medium text-sm">{{ row.subject_name }}</div>
                  <div class="text-xs text-gray-400">{{ row.subject_code }}</div>
                </template>
              </el-table-column>
              <el-table-column label="ห้อง/Lab" width="130">
                <template #default="{ row }">
                  <span v-if="row.preferred_room" class="text-blue-600 text-xs">🏛 {{ row.preferred_room }}</span>
                  <span v-else class="text-gray-300 text-xs">—</span>
                </template>
              </el-table-column>
              <el-table-column label="คาบ/สัปดาห์" width="100" align="center">
                <template #default="{ row }"><el-tag type="info" size="small">{{ row.periods_per_week }}</el-tag></template>
              </el-table-column>
              <el-table-column label="คาบติดกัน" width="90" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.consecutive_periods > 1" type="warning" size="small">{{ row.consecutive_periods }}</el-tag>
                  <span v-else class="text-gray-300">—</span>
                </template>
              </el-table-column>
              <el-table-column label="จัดแล้ว" width="80" align="center">
                <template #default="{ row }">
                  <span :class="row.placed >= row.periods_per_week ? 'text-green-600 font-bold' : 'text-orange-500'">
                    {{ row.placed }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="เหลือ" width="70" align="center">
                <template #default="{ row }">
                  <span :class="row.remaining > 0 ? 'text-red-500 font-bold' : 'text-gray-300'">
                    {{ row.remaining }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="สถานะ" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.done ? 'success' : row.placed > 0 ? 'warning' : 'danger'" size="small">
                    {{ row.done ? '✅ ครบ' : row.placed > 0 ? '⏳ บางส่วน' : '❌ ยังไม่จัด' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="!groupedByTeacher.length" class="text-center py-12 text-gray-400">ไม่มีข้อมูล</div>
      </div>

      <!-- ===== Grouped by Class ===== -->
      <div v-else-if="!publishedMissing && groupMode === 'class'" class="space-y-4">
        <div v-for="group in groupedByClass" :key="group.class_id"
          class="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-3 border-b"
            style="background:linear-gradient(135deg,#06966910,#05966905)">
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
              {{ group.class_id.slice(-1) }}
            </div>
            <div class="flex-1">
              <div class="font-bold text-gray-800">ห้อง {{ group.class_id }}</div>
              <div class="text-xs text-gray-400">{{ group.items.length }} วิชา</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-emerald-700">{{ group.totalPeriods }} คาบ/สัปดาห์</div>
            </div>
            <el-progress
              :percentage="group.completionPct"
              :status="group.completionPct >= 100 ? 'success' : group.completionPct > 0 ? '' : 'exception'"
              :stroke-width="8" style="width:100px"
            />
          </div>
          <div v-if="detailLevel==='full'">
            <el-table :data="group.items" size="small" border :header-cell-style="{ background: '#1d4ed8', color: 'white', fontWeight: '600' }">
              <el-table-column label="วิชา" min-width="160">
                <template #default="{ row }">
                  <div class="font-medium text-sm">{{ row.subject_name }}</div>
                  <div class="text-xs text-gray-400">{{ row.subject_code }}</div>
                </template>
              </el-table-column>
              <el-table-column label="ครูผู้สอน" min-width="140" prop="teacher_name" />
              <el-table-column label="ห้อง/Lab" width="130">
                <template #default="{ row }">
                  <span v-if="row.preferred_room" class="text-blue-600 text-xs">🏛 {{ row.preferred_room }}</span>
                  <span v-else class="text-gray-300 text-xs">—</span>
                </template>
              </el-table-column>
              <el-table-column label="คาบ/สัปดาห์" width="100" align="center">
                <template #default="{ row }"><el-tag type="info" size="small">{{ row.periods_per_week }}</el-tag></template>
              </el-table-column>
              <el-table-column label="จัดแล้ว" width="80" align="center">
                <template #default="{ row }">
                  <span :class="row.placed >= row.periods_per_week ? 'text-green-600 font-bold' : 'text-orange-500'">{{ row.placed }}</span>
                </template>
              </el-table-column>
              <el-table-column label="เหลือ" width="70" align="center">
                <template #default="{ row }">
                  <span :class="row.remaining > 0 ? 'text-red-500 font-bold' : 'text-gray-300'">{{ row.remaining }}</span>
                </template>
              </el-table-column>
              <el-table-column label="สถานะ" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.done ? 'success' : row.placed > 0 ? 'warning' : 'danger'" size="small">
                    {{ row.done ? '✅ ครบ' : row.placed > 0 ? '⏳ บางส่วน' : '❌ ยังไม่จัด' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div v-if="!groupedByClass.length" class="text-center py-12 text-gray-400">ไม่มีข้อมูล</div>
      </div>

      <!-- ===== Flat Table ===== -->
      <div v-else-if="!publishedMissing">
        <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
          <el-table :data="filteredRows" border stripe v-loading="loading" @sort-change="onSortChange" :header-cell-style="{ background: '#0d9488', color: 'white', fontWeight: '600' }">
            <el-table-column label="ห้อง" prop="class_id" width="85" sortable="custom" align="center">
              <template #default="{ row }">
                <span class="font-semibold text-purple-700">{{ row.class_id }}</span>
              </template>
            </el-table-column>
            <el-table-column label="วิชา" min-width="160" sortable="custom" prop="subject_name">
              <template #default="{ row }">
                <div class="font-medium">{{ row.subject_name }}</div>
                <div class="text-xs text-gray-400">{{ row.subject_code }}</div>
              </template>
            </el-table-column>
            <el-table-column label="ครูผู้สอน" min-width="140" sortable="custom" prop="teacher_name" />
            <el-table-column label="ห้อง/Lab" width="130">
              <template #default="{ row }">
                <span v-if="row.preferred_room" class="text-blue-600 text-xs">🏛 {{ row.preferred_room }}</span>
                <span v-else class="text-gray-300 text-xs">—</span>
              </template>
            </el-table-column>
            <el-table-column label="คาบ/สัปดาห์" width="110" align="center" sortable="custom" prop="periods_per_week">
              <template #default="{ row }"><el-tag type="info" size="small">{{ row.periods_per_week }}</el-tag></template>
            </el-table-column>
            <el-table-column label="คาบติดกัน" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.consecutive_periods > 1" type="warning" size="small">{{ row.consecutive_periods }}</el-tag>
                <span v-else class="text-gray-300">—</span>
              </template>
            </el-table-column>
            <el-table-column label="ความคืบหน้า" width="180">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <el-progress
                    :percentage="Math.min(100, Math.round((row.placed / row.periods_per_week) * 100))"
                    :status="row.done ? 'success' : row.placed > 0 ? '' : 'exception'"
                    :stroke-width="10" class="flex-1"
                  />
                  <span class="text-xs text-gray-500 w-10 text-right">{{ row.placed }}/{{ row.periods_per_week }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="สถานะ" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="row.done ? 'success' : row.placed > 0 ? 'warning' : 'danger'" size="small">
                  {{ row.done ? '✅ ครบ' : row.placed > 0 ? '⏳ บางส่วน' : '❌ ยังไม่จัด' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { doc, getDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import html2pdf from 'html2pdf.js'
import AppLayout from '@/components/layout/AppLayout.vue'
import { getSchoolDb } from '@/firebase/db'
import { useSchoolStore } from '@/stores/school'

const schoolStore = useSchoolStore()
const db = () => getSchoolDb()
const term = computed(() => schoolStore.currentTerm || '2568_1')

const loading = ref(false)
const rows = ref([])   // enriched assignments
const publishVersion = ref('')
const publishAtLabel = ref('')
const publishSource = ref('')
const reportTerm = ref('')
const publishedMissing = ref(false)
const sortKey = ref('name')
const groupMode = ref('teacher')
const filterTeacher = ref('')
const filterClass = ref('')
const filterStatus = ref('')
const filterText = ref('')
const detailLevel = ref('full')

const GROUP_MODES = [
  { value: 'teacher', label: '👨‍🏫 แยกตามครู' },
  { value: 'class',   label: '🏫 แยกตามห้อง' },
  { value: 'flat',    label: '📊 ตารางรวม' },
]

// ===== Load =====
onMounted(loadData)

const publishSourceLabel = computed(() => {
  if (publishSource.value === 'firestore') return 'Firestore Snapshot'
  if (publishSource.value === 'storage') return 'Storage JSON'
  return 'Publish Snapshot'
})

async function loadData() {
  loading.value = true
  publishedMissing.value = false
  publishSource.value = ''
  try {
    const infoSnap = await getDoc(doc(db(), 'school_info', 'main'))
    const publishMeta = infoSnap.exists() ? (infoSnap.data()?.timetable_publish || null) : null

    publishVersion.value = publishMeta?.version || ''
    if (publishMeta?.published_at_iso) {
      publishAtLabel.value = new Date(publishMeta.published_at_iso).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } else {
      publishAtLabel.value = ''
    }

    let payload = null

    // Primary source: Firestore snapshot (stable, no CORS)
    const snapshotDoc = await getDoc(doc(db(), 'public_timetable_snapshots', 'current'))
    if (snapshotDoc.exists()) {
      payload = snapshotDoc.data()
      publishSource.value = 'firestore'
    }

    if (!payload) {
      rows.value = []
      publishedMissing.value = true
      return
    }

    const timetable = Array.isArray(payload.timetable) ? payload.timetable : []
    const teachers = Array.isArray(payload.teachers) ? payload.teachers : []
    reportTerm.value = payload.current_term || ''
    if (payload.published_at_iso && !publishAtLabel.value) {
      publishAtLabel.value = new Date(payload.published_at_iso).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    }

    const teacherNameMap = {}
    teachers.forEach(t => {
      teacherNameMap[t.teacher_id] = `${t.prefix || ''}${t.name || ''} ${t.surname || ''}`.trim()
    })

    const grouped = {}
    timetable
      .filter(s => s && (s.type === 'subject' || !s.type))
      .forEach(s => {
        const key = [
          s.class_id || '',
          s.subject_code || '',
          s.subject_name || '',
          s.teacher_id || '',
          s.preferred_room || '',
        ].join('|')
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            assign_id: key,
            class_id: s.class_id || '',
            subject_code: s.subject_code || '',
            subject_name: s.subject_name || '',
            teacher_id: s.teacher_id || '',
            teacher_name: s.teacher_name || teacherNameMap[s.teacher_id] || s.teacher_id || '',
            preferred_room: s.preferred_room || '',
            periods_per_week: 0,
            consecutive_periods: 1,
            placed: 0,
            remaining: 0,
            done: true,
          }
        }
        grouped[key].periods_per_week += 1
        grouped[key].placed += 1
      })

    rows.value = Object.values(grouped)
  } catch (e) {
    console.error('AssignmentReport loadData error:', e)
    rows.value = []
    publishedMissing.value = true
  } finally {
    loading.value = false
  }
}

const reportTermLabel = computed(() => reportTerm.value || term.value)

// ===== Computed lists =====
const teacherList = computed(() => {
  const map = {}
  rows.value.forEach(r => {
    if (r.teacher_id && !map[r.teacher_id]) {
      map[r.teacher_id] = { id: r.teacher_id, name: r.teacher_name || r.teacher_id }
    }
  })
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'th'))
})

const classList = computed(() => {
  return [...new Set(rows.value.map(r => r.class_id).filter(Boolean))].sort()
})

// ===== Filter =====
const filteredRows = computed(() => {
  let list = rows.value.filter(r => {
    if (filterTeacher.value && r.teacher_id !== filterTeacher.value) return false
    if (filterClass.value && r.class_id !== filterClass.value) return false
    if (filterStatus.value === 'done' && !r.done) return false
    if (filterStatus.value === 'partial' && (r.done || r.placed === 0)) return false
    if (filterStatus.value === 'none' && r.placed > 0) return false
    if (filterText.value) {
      const q = filterText.value.toLowerCase()
      if (!r.subject_name?.toLowerCase().includes(q) &&
          !r.teacher_name?.toLowerCase().includes(q) &&
          !r.class_id?.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sort
  list = [...list].sort((a, b) => {
    if (sortKey.value === 'name') return (a.teacher_name || '').localeCompare(b.teacher_name || '', 'th')
    if (sortKey.value === 'class') return (a.class_id || '').localeCompare(b.class_id || '', 'th')
    if (sortKey.value === 'periods') return (b.periods_per_week || 0) - (a.periods_per_week || 0)
    if (sortKey.value === 'status') return b.placed - a.placed
    return 0
  })
  return list
})

// ===== Group by teacher =====
const groupedByTeacher = computed(() => {
  const map = {}
  filteredRows.value.forEach(r => {
    const tid = r.teacher_id || 'unknown'
    if (!map[tid]) map[tid] = { teacher_id: tid, teacher_name: r.teacher_name || tid, items: [] }
    map[tid].items.push(r)
  })
  return Object.values(map).map(g => {
    const totalPeriods = g.items.reduce((s, i) => s + (i.periods_per_week || 0), 0)
    const placedPeriods = g.items.reduce((s, i) => s + (i.placed || 0), 0)
    const workloadStatus = totalPeriods > 20 ? 'over' : totalPeriods >= 15 ? 'ok' : 'under'
    return {
      ...g,
      totalPeriods,
      completionPct: totalPeriods > 0 ? Math.round((placedPeriods / totalPeriods) * 100) : 0,
      workloadStatus
    }
  }).sort((a, b) => a.teacher_name.localeCompare(b.teacher_name, 'th'))
})

// ===== Group by class =====
const groupedByClass = computed(() => {
  const map = {}
  filteredRows.value.forEach(r => {
    const cid = r.class_id || 'unknown'
    if (!map[cid]) map[cid] = { class_id: cid, items: [] }
    map[cid].items.push(r)
  })
  return Object.values(map).map(g => {
    const totalPeriods = g.items.reduce((s, i) => s + (i.periods_per_week || 0), 0)
    const placedPeriods = g.items.reduce((s, i) => s + (i.placed || 0), 0)
    return {
      ...g,
      totalPeriods,
      completionPct: totalPeriods > 0 ? Math.round((placedPeriods / totalPeriods) * 100) : 0
    }
  }).sort((a, b) => a.class_id.localeCompare(b.class_id, 'th'))
})

// ===== Summary stats =====
const summaryStats = computed(() => {
  const currentRows = filteredRows.value
  const teacherSet = new Set(currentRows.map(r => r.teacher_id).filter(Boolean))
  const totalPeriods = currentRows.reduce((s, r) => s + (r.periods_per_week || 0), 0)
  const placedPeriods = currentRows.reduce((s, r) => s + (r.placed || 0), 0)
  return {
    totalTeachers: teacherSet.size,
    totalAssignments: currentRows.length,
    totalPeriods,
    completionPct: totalPeriods > 0 ? Math.round((placedPeriods / totalPeriods) * 100) : 0
  }
})

// ===== Print PDF =====
async function handlePrint() {
  const info = schoolStore.schoolInfo || {}
  const today = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' })
  const term_label = `ภาคเรียนที่ ${info.semester || ''} ปีการศึกษา ${info.year || ''}`

  // Build report HTML
  let contentHtml = ''

  if (groupMode.value === 'teacher') {
    groupedByTeacher.value.forEach((g, gi) => {
      const statusColor = g.workloadStatus === 'over' ? '#dc2626' : g.workloadStatus === 'under' ? '#d97706' : '#16a34a'
      const statusText = g.workloadStatus === 'over' ? 'เกินมาตรฐาน' : g.workloadStatus === 'under' ? 'น้อยกว่ามาตรฐาน' : 'ปกติ'
      contentHtml += `<div style="margin-bottom:16px;">
        <div style="background:#4f46e5;color:white;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:bold;font-size:11pt;">${g.teacher_name}</div>
          <div style="font-size:9pt;">รวม ${g.totalPeriods} คาบ/สัปดาห์ &nbsp;<span style="background:${statusColor};padding:1px 6px;border-radius:4px;">${statusText}</span></div>
        </div>`
      if (detailLevel.value === 'full') {
        contentHtml += `<table style="width:100%;border-collapse:collapse;font-size:9pt;">
          <thead><tr style="background:#e0e7ff;">
            <th style="border:1px solid #c7d2fe;padding:5px;width:80px;">ห้อง</th>
            <th style="border:1px solid #c7d2fe;padding:5px;">วิชา</th>
            <th style="border:1px solid #c7d2fe;padding:5px;width:100px;">ห้อง/Lab</th>
            <th style="border:1px solid #c7d2fe;padding:5px;width:70px;text-align:center;">คาบ/สัปดาห์</th>
            <th style="border:1px solid #c7d2fe;padding:5px;width:80px;text-align:center;">สถานะ</th>
          </tr></thead><tbody>`
        g.items.forEach(r => {
          const st = r.done ? '✅ ครบ' : r.placed > 0 ? '⏳ บางส่วน' : '❌ ยังไม่จัด'
          const stColor = r.done ? '#15803d' : r.placed > 0 ? '#d97706' : '#dc2626'
          contentHtml += `<tr>
            <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;font-weight:600;color:#6d28d9;">${r.class_id}</td>
            <td style="border:1px solid #e5e7eb;padding:5px;"><b>${r.subject_name}</b><br><span style="font-size:8pt;color:#6b7280;">${r.subject_code}</span></td>
            <td style="border:1px solid #e5e7eb;padding:5px;color:#2563eb;">${r.preferred_room || '—'}</td>
            <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;">${r.periods_per_week}</td>
            <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;color:${stColor};">${st}</td>
          </tr>`
        })
        contentHtml += `</tbody></table>`
      }
      contentHtml += `</div>`
    })
  } else if (groupMode.value === 'class') {
    groupedByClass.value.forEach(g => {
      contentHtml += `<div style="margin-bottom:16px;">
        <div style="background:#1d4ed8;color:white;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:bold;font-size:11pt;">ห้อง ${g.class_id}</div>
          <div style="font-size:9pt;">รวม ${g.totalPeriods} คาบ/สัปดาห์</div>
        </div>`
      if (detailLevel.value === 'full') {
        contentHtml += `<table style="width:100%;border-collapse:collapse;font-size:9pt;">
          <thead><tr style="background:#dbeafe;">
            <th style="border:1px solid #bfdbfe;padding:5px;">วิชา</th>
            <th style="border:1px solid #bfdbfe;padding:5px;width:150px;">ครูผู้สอน</th>
            <th style="border:1px solid #bfdbfe;padding:5px;width:100px;">ห้อง/Lab</th>
            <th style="border:1px solid #bfdbfe;padding:5px;width:70px;text-align:center;">คาบ/สัปดาห์</th>
            <th style="border:1px solid #bfdbfe;padding:5px;width:80px;text-align:center;">สถานะ</th>
          </tr></thead><tbody>`
        g.items.forEach(r => {
          const st = r.done ? '✅ ครบ' : r.placed > 0 ? '⏳ บางส่วน' : '❌ ยังไม่จัด'
          const stColor = r.done ? '#15803d' : r.placed > 0 ? '#d97706' : '#dc2626'
          contentHtml += `<tr>
            <td style="border:1px solid #e5e7eb;padding:5px;"><b>${r.subject_name}</b><br><span style="font-size:8pt;color:#6b7280;">${r.subject_code}</span></td>
            <td style="border:1px solid #e5e7eb;padding:5px;">${r.teacher_name || '—'}</td>
            <td style="border:1px solid #e5e7eb;padding:5px;color:#2563eb;">${r.preferred_room || '—'}</td>
            <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;">${r.periods_per_week}</td>
            <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;color:${stColor};">${st}</td>
          </tr>`
        })
        contentHtml += `</tbody></table>`
      }
      contentHtml += `</div>`
    })
  } else {
    // flat
    contentHtml += `<table style="width:100%;border-collapse:collapse;font-size:9pt;">
      <thead><tr style="background:#0d9488;color:white;">
        <th style="border:1px solid #0f766e;padding:5px;width:80px;">ห้อง</th>
        <th style="border:1px solid #0f766e;padding:5px;">วิชา</th>
        <th style="border:1px solid #0f766e;padding:5px;width:150px;">ครูผู้สอน</th>
        <th style="border:1px solid #0f766e;padding:5px;width:70px;text-align:center;">คาบ/สัปดาห์</th>
        <th style="border:1px solid #0f766e;padding:5px;width:80px;text-align:center;">สถานะ</th>
      </tr></thead><tbody>`
    filteredRows.value.forEach((r, ri) => {
      const st = r.done ? '✅ ครบ' : r.placed > 0 ? '⏳ บางส่วน' : '❌ ยังไม่จัด'
      const stColor = r.done ? '#15803d' : r.placed > 0 ? '#d97706' : '#dc2626'
      contentHtml += `<tr style="background:${ri%2===0?'white':'#f8fafc'}">
        <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;font-weight:600;color:#6d28d9;">${r.class_id}</td>
        <td style="border:1px solid #e5e7eb;padding:5px;"><b>${r.subject_name}</b> <span style="color:#6b7280;font-size:8pt;">${r.subject_code}</span></td>
        <td style="border:1px solid #e5e7eb;padding:5px;">${r.teacher_name || '—'}</td>
        <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;">${r.periods_per_week}</td>
        <td style="border:1px solid #e5e7eb;padding:5px;text-align:center;color:${stColor};">${st}</td>
      </tr>`
    })
    contentHtml += `</tbody></table>`
  }

  // Grand total
  const grandTotal = filteredRows.value.reduce((s,r) => s + (r.periods_per_week||0), 0)
  const grandPlaced = filteredRows.value.reduce((s,r) => s + (r.placed||0), 0)
  contentHtml += `<div style="text-align:right;font-weight:600;font-size:10pt;margin-top:8px;padding:6px;background:#f3f4f6;border-radius:4px;">
    รวมทั้งสิ้น ${filteredRows.value.length} รายการ | คาบรวม ${grandTotal} คาบ/สัปดาห์ | จัดแล้ว ${grandPlaced} คาบ
  </div>`

  // Signature block
  const signerName = info.signer_name || info.principal_name || '................................'
  const signerPos = info.signer_position || info.principal_position || 'ผู้บริหาร'
  const reportMode = groupMode.value === 'teacher' ? 'แยกตามครู' : groupMode.value === 'class' ? 'แยกตามห้อง' : 'ตารางรวม'

  const fullHtml = `<div style="font-family:'Sarabun','Noto Sans Thai',sans-serif;padding:15mm;font-size:10pt;color:#1a1a1a;">
    <div style="text-align:center;margin-bottom:16px;">
      ${info.logo_url ? `<img src="${info.logo_url}" style="height:64px;object-fit:contain;margin-bottom:6px;">` : ''}
      <div style="font-size:14pt;font-weight:bold;">${info.name || 'โรงเรียน'}</div>
      <div style="font-size:12pt;font-weight:600;margin-top:4px;">รายงานภาระงานสอน — ${reportMode}</div>
      <div style="font-size:10pt;color:#555;margin-top:2px;">${term_label}</div>
      <div style="font-size:9pt;color:#888;">วันที่พิมพ์: ${today}</div>
    </div>
    <hr style="border:1.5px solid #4f46e5;margin-bottom:12px;">
    ${contentHtml}
    <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:12px;">
      <div style="text-align:center;width:42%;">
        <div style="border-bottom:1px solid #333;height:30px;"></div>
        <div style="font-size:9pt;margin-top:4px;">ผู้จัดทำ</div>
      </div>
      <div style="text-align:center;width:42%;">
        <div style="border-bottom:1px solid #333;height:30px;"></div>
        <div style="font-size:9pt;margin-top:4px;">(${signerName})</div>
        <div style="font-size:9pt;">${signerPos}</div>
      </div>
    </div>
  </div>`

  const container = document.createElement('div')
  container.innerHTML = fullHtml
  document.body.appendChild(container)

  try {
    await html2pdf().set({
      margin: 0,
      filename: `assignment_report_${term.value}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).from(container).save()
    ElMessage.success('ดาวน์โหลด PDF เรียบร้อย')
  } finally {
    document.body.removeChild(container)
  }
}

function onSortChange({ prop, order }) {
  if (!prop) return
  const map = { class_id: 'class', subject_name: 'name', teacher_name: 'name', periods_per_week: 'periods' }
  sortKey.value = map[prop] || 'name'
}

// ===== Export =====
function handleExport() {
  // Sheet 1: All assignments
  const flatRows = filteredRows.value.map(r => ({
    'ห้อง': r.class_id,
    'รหัสวิชา': r.subject_code,
    'ชื่อวิชา': r.subject_name,
    'รหัสครู': r.teacher_id,
    'ครูผู้สอน': r.teacher_name,
    'ห้อง/Lab': r.preferred_room || '',
    'คาบ/สัปดาห์': r.periods_per_week,
    'คาบติดกัน': r.consecutive_periods || 1,
    'จัดแล้ว': r.placed,
    'เหลือ': r.remaining,
    'สถานะ': r.done ? 'ครบแล้ว' : r.placed > 0 ? 'บางส่วน' : 'ยังไม่จัด',
  }))

  // Sheet 2: Summary by teacher
  const teacherSummary = groupedByTeacher.value.map(g => ({
    'ครูผู้สอน': g.teacher_name,
    'รหัสครู': g.teacher_id,
    'จำนวนวิชา': g.items.length,
    'คาบรวม/สัปดาห์': g.totalPeriods,
    'ความคืบหน้า': `${g.completionPct}%`,
  }))

  // Sheet 3: Summary by class
  const classSummary = groupedByClass.value.map(g => ({
    'ห้องเรียน': g.class_id,
    'จำนวนวิชา': g.items.length,
    'คาบรวม/สัปดาห์': g.totalPeriods,
    'ความคืบหน้า': `${g.completionPct}%`,
  }))

  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(flatRows)
  ws1['!cols'] = [10,14,24,12,22,16,12,10,8,8,10].map(w => ({ wch: w }))
  const ws2 = XLSX.utils.json_to_sheet(teacherSummary)
  const ws3 = XLSX.utils.json_to_sheet(classSummary)
  XLSX.utils.book_append_sheet(wb, ws1, 'รายการทั้งหมด')
  XLSX.utils.book_append_sheet(wb, ws2, 'สรุปตามครู')
  XLSX.utils.book_append_sheet(wb, ws3, 'สรุปตามห้อง')
  XLSX.writeFile(wb, `assignment_report_${term.value}.xlsx`)
  ElMessage.success('ส่งออกรายงานสำเร็จ')
}
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(79,70,229,0.2);
}
.publish-banner {
  border-radius: 12px;
  border: 1px solid #bfdbfe;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  color: #1e3a8a;
  padding: 12px 14px;
}
.publish-warning {
  border-radius: 12px;
  border: 1px solid #fed7aa;
  background: #fffbeb;
  color: #9a3412;
  padding: 12px 14px;
  font-weight: 700;
}
.stat-card {
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
}
.stat-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}
.stat-label {
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 4px;
}

/* ===== Print PDF styles ===== */
@media print {
  @page { size: A4 landscape; margin: 15mm; }
  .header-card { background: #4f46e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .el-button, .el-select, .el-input, nav, aside { display: none !important; }
  .stat-card { border: 1px solid #e5e7eb !important; background: #f9fafb !important; }
  * { box-shadow: none !important; }
}
</style>
