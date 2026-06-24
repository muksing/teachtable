<template>
  <AppLayout>
    <div class="att-page">
      <div class="att-title-bar">
        <div>
          <h1 class="att-title">📋 รายงานการมาเรียน</h1>
          <p class="att-sub">สรุปการมาเรียนรายคน · ข้อมูลจากบันทึกการสอน</p>
        </div>
      </div>

      <!-- Filters -->
      <el-card class="mb-6 no-print" shadow="never" style="border-radius:14px">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">🏫 ห้องเรียน *</div>
            <el-select
              v-model="filterClassId"
              placeholder="เลือกห้อง"
              clearable filterable style="min-width:180px"
              @change="onClassChange"
            >
              <el-option
                v-for="cls in availableClasses"
                :key="cls.class_id"
                :label="cls.class_name || cls.class_id"
                :value="cls.class_id"
              />
            </el-select>
          </div>
          <div v-show="filterClassId">
            <div class="text-xs text-gray-500 mb-1 font-medium">📚 วิชา</div>
            <el-select
              v-model="filterSubjectId"
              placeholder="ทุกวิชา"
              clearable filterable style="min-width:200px"
            >
              <el-option
                v-for="sub in availableSubjects"
                :key="sub.id"
                :label="sub.label"
                :value="sub.id"
              />
            </el-select>
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📅 วันเริ่มต้น</div>
            <el-date-picker v-model="startDate" type="date" placeholder="วันเริ่มต้น"
              format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:155px" />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📅 วันสิ้นสุด</div>
            <el-date-picker v-model="endDate" type="date" placeholder="วันสิ้นสุด"
              format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:155px" />
          </div>
          <div class="flex items-end">
            <el-button type="primary" :loading="loading" @click="loadReport">
              🔍 ดูรายงาน
            </el-button>
          </div>
        </div>
        <div v-if="!filterClassId" class="mt-3 text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 border border-amber-200">
          ⚡ เลือกห้องเรียนก่อนเพื่อประหยัดการใช้งานระบบ
        </div>
      </el-card>

      <!-- No data -->
      <el-empty v-if="!loading && !hasData" :image-size="80" class="no-print">
        <template #description>
          <span class="text-gray-500">{{ filterClassId ? "เลือกช่วงวันที่แล้วกด 'ดูรายงาน'" : 'เลือกห้องเรียนก่อน' }}</span>
        </template>
      </el-empty>

      <!-- Report area -->
      <div v-if="hasData" v-loading="loading">

        <!-- Tab switcher + action buttons -->
        <div class="att-tab-bar no-print">
          <el-tabs v-model="activeTab" class="att-tabs">
            <el-tab-pane label="📊 สรุปรวม" name="summary" />
            <el-tab-pane label="📅 ทุกคาบ (ปพ.5)" name="pp5" />
          </el-tabs>
          <div class="att-tab-actions">
            <el-button size="small" plain @click="printReport">🖨️ พิมพ์</el-button>
            <el-button v-if="activeTab === 'summary'" size="small" plain @click="exportExcelSummary">📥 Excel</el-button>
            <el-button v-if="activeTab === 'pp5'" size="small" plain @click="exportExcelPp5">📥 Excel ปพ.5</el-button>
          </div>
        </div>

        <!-- ───── สรุปรวม tab ───── -->
        <div v-show="activeTab === 'summary'" class="report-content" id="att-print-summary">

          <!-- Print header -->
          <div class="print-header print-only">
            <div class="print-school">{{ schoolName }}</div>
            <div class="print-report-title">รายงานการมาเรียน (สรุปรวม)</div>
            <div class="print-meta">ห้อง {{ filterClassLabel }} · {{ formatDateThai(startDate) }} ถึง {{ formatDateThai(endDate) }}</div>
          </div>

          <!-- Subject info banner -->
          <div v-if="subjectInfoList.length" class="subj-banner mb-3">
            <div v-for="s in subjectInfoList" :key="s.code || s.name" class="subj-row">
              <span v-if="s.code" class="subj-code">{{ s.code }}</span>
              <span class="subj-name">{{ s.name }}</span>
              <span v-if="s.teacher" class="subj-teacher">👤 {{ s.teacher }}</span>
            </div>
          </div>

          <!-- Info row -->
          <div class="flex flex-wrap justify-between items-center mb-3 gap-2 no-print">
            <div class="text-sm text-gray-500">
              {{ filterClassLabel }} · {{ startDate }} ถึง {{ endDate }}
              <span v-if="filterSubjectId"> · วิชา {{ filterSubjectId }}</span>
              · <b>{{ reportRows.length }}</b> คน · <b>{{ totalPeriods }}</b> คาบ
            </div>
          </div>

          <!-- Stats banner -->
          <div class="att-stats-bar mb-4">
            <div class="att-stat-card" style="background:#dcfce7;border-color:#bbf7d0">
              <div class="att-stat-num text-green-700">{{ avgPresent.toFixed(1) }}%</div>
              <div class="att-stat-lbl text-green-600">เฉลี่ยมาเรียน</div>
            </div>
            <div class="att-stat-card" style="background:#fef9c3;border-color:#fde68a">
              <div class="att-stat-num text-yellow-700">{{ totalLate }}</div>
              <div class="att-stat-lbl text-yellow-600">รวมมาสาย</div>
            </div>
            <div class="att-stat-card" style="background:#fee2e2;border-color:#fca5a5">
              <div class="att-stat-num text-red-700">{{ totalAbsent }}</div>
              <div class="att-stat-lbl text-red-600">รวมขาดเรียน</div>
            </div>
            <div class="att-stat-card" style="background:#f0f9ff;border-color:#bae6fd">
              <div class="att-stat-num text-blue-700">{{ riskCount }}</div>
              <div class="att-stat-lbl text-blue-600">ต่ำกว่า 80%</div>
            </div>
          </div>

          <el-table
            :data="reportRows"
            border
            stripe
            :header-cell-style="{ background:'#0891b2', color:'white', fontWeight:'700', fontSize:'14px' }"
            :default-sort="{ prop:'seat_number', order:'ascending' }"
          >
            <el-table-column prop="seat_number" label="เลขที่" width="65" align="center" sortable />
            <el-table-column prop="student_id" label="รหัสนักเรียน" width="110" align="center" />
            <el-table-column label="ชื่อ-นามสกุล" min-width="200">
              <template #default="{ row }">
                <span class="font-semibold">{{ studentNameFull(row) }}</span>
              </template>
            </el-table-column>
        <el-table-column label="มา" width="85" align="center" sortable prop="present">
              <template #default="{ row }">
                <span class="font-bold text-green-600 text-base">{{ row.present }}</span>
              </template>
            </el-table-column>
        <el-table-column label="ขาด" width="90" align="center" sortable prop="absent">
              <template #default="{ row }">
                <span :class="row.absent > 0 ? 'text-red-600 font-bold text-base' : 'text-gray-300'">{{ row.absent }}</span>
              </template>
            </el-table-column>
        <el-table-column label="ลา" width="80" align="center" sortable prop="leave">
              <template #default="{ row }">
            <span class="text-purple-500">{{ row.leave }}</span>
              </template>
            </el-table-column>
        <el-table-column label="ร.ก." width="75" align="center" sortable prop="official">
              <template #default="{ row }">
            <span class="text-gray-500">{{ row.official }}</span>
              </template>
            </el-table-column>
            <el-table-column label="คาบทั้งหมด" width="105" align="center" sortable prop="total" />
            <el-table-column label="% มาเรียน" width="115" align="center" sortable prop="pct">
              <template #default="{ row }">
                <el-tag
                  v-if="row.total > 0"
                  :type="row.pct >= 80 ? 'success' : row.pct >= 60 ? 'warning' : 'danger'"
                  size="small"
                  style="font-size:13px;font-weight:700"
                >{{ row.pct.toFixed(1) }}%</el-tag>
                <span v-else class="text-gray-400">-</span>
              </template>
            </el-table-column>
            <el-table-column label="ประเมิน" width="135" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.total > 0 && row.pct >= 80" type="success" size="small" style="font-weight:700">มีสิทธิสอบ</el-tag>
                <el-tag v-else-if="row.total > 0 && row.pct < 80" type="danger" size="small" style="font-weight:700">ไม่มีสิทธิสอบ</el-tag>
                <span v-else class="text-gray-400 text-xs">-</span>
              </template>
            </el-table-column>
          </el-table>

          <!-- Signature -->
          <div class="signature-block">
            <div class="sig-box">
              <div class="sig-line">ลงชื่อ ............................................</div>
              <div class="sig-name">( {{ myDisplayName }} )</div>
              <div class="sig-role">ผู้จัดทำรายงาน</div>
              <div class="sig-date">วันที่ {{ formatDateThai(todayStr) }}</div>
            </div>
          </div>
        </div>

        <!-- ───── ทุกคาบ (ปพ.5) tab ───── -->
        <div v-show="activeTab === 'pp5'" class="report-content" id="att-print-pp5">

          <!-- Print header -->
          <div class="print-header print-only">
            <div class="print-school">{{ schoolName }}</div>
            <div class="print-report-title">บันทึกการมาเรียน ปพ.5</div>
            <div class="print-meta">ห้อง {{ filterClassLabel }} · {{ formatDateThai(startDate) }} ถึง {{ formatDateThai(endDate) }}</div>
          </div>

          <!-- Subject info banner -->
          <div v-if="subjectInfoList.length" class="subj-banner mb-3">
            <div v-for="s in subjectInfoList" :key="s.code || s.name" class="subj-row">
              <span v-if="s.code" class="subj-code">{{ s.code }}</span>
              <span class="subj-name">{{ s.name }}</span>
              <span v-if="s.teacher" class="subj-teacher">👤 {{ s.teacher }}</span>
            </div>
          </div>

          <!-- Info row -->
          <div class="flex flex-wrap justify-between items-center mb-3 gap-2 no-print">
            <div class="text-sm text-gray-500">
              ห้อง {{ filterClassLabel }} · {{ allStudents.length }} คน · {{ periodsForTable.length }} คาบ
            </div>
          </div>

          <div v-if="periodsForTable.length === 0" class="text-center text-gray-400 py-8">
            ไม่มีข้อมูลคาบสอนในช่วงนี้
          </div>
          <div v-else class="pp5-table-wrap">
            <table class="pp5-table">
              <colgroup>
                <col style="width:50px" />
                <col style="width:88px" />
                <col style="min-width:170px" />
                <col v-for="ta in periodsForTable" :key="'col-'+ta.id" style="min-width:52px" />
                <col style="width:42px" />
                <col style="width:38px" />
                <col style="width:42px" />
                <col style="width:38px" />
                <col style="width:48px" />
                <col style="width:50px" />
              </colgroup>
              <thead>
                <!-- Row 1: sequential index numbers + fixed cols (rowspan) + summary cols (rowspan) -->
                <tr class="pp5-thead-r1">
                  <th class="pp5-th pp5-th-fix" rowspan="2">เลขที่</th>
                  <th class="pp5-th pp5-th-fix" rowspan="2">รหัส</th>
                  <th class="pp5-th pp5-th-fix" rowspan="2" style="min-width:170px;text-align:left;padding-left:8px">ชื่อ-นามสกุล</th>
                  <th
                    v-for="(ta, i) in periodsForTable"
                    :key="'h1-'+ta.id"
                    class="pp5-th pp5-th-seq"
                  >{{ i + 1 }}</th>
                  <th class="pp5-th pp5-th-sum" rowspan="2">มา</th>
                  <th class="pp5-th pp5-th-sum" rowspan="2">ขาด</th>
                  <th class="pp5-th pp5-th-sum" rowspan="2">ลา</th>
              <th class="pp5-th pp5-th-sum" rowspan="2">ร.ก.</th>
                  <th class="pp5-th pp5-th-sum" rowspan="2">%</th>
                  <th class="pp5-th pp5-th-sum" rowspan="2">มส</th>
                </tr>
                <!-- Row 2: Thai short date per period -->
                <tr class="pp5-thead-r2">
                  <th
                    v-for="ta in periodsForTable"
                    :key="'h2-'+ta.id"
                    class="pp5-th pp5-th-date"
                  >
                    {{ formatDateBuddhist(ta.date) }}
                    <div v-if="!ta.is_filled" style="font-size:8px;color:#fca5a5;margin-top:1px">ยังไม่บันทึก</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(stu, idx) in allStudents"
                  :key="stu.student_id"
                  :class="idx % 2 === 0 ? 'pp5-tr-even' : 'pp5-tr-odd'"
                >
                  <td class="pp5-td pp5-td-center">{{ stu.seat_number || '-' }}</td>
                  <td class="pp5-td pp5-td-center pp5-td-id">{{ stu.student_id }}</td>
                  <td class="pp5-td pp5-td-name">{{ studentNameFull(stu) }}</td>
                  <!-- Period cells -->
                  <td v-for="ta in periodsForTable" :key="ta.id" class="pp5-td pp5-td-center">
                    <span
                      v-if="ta.is_filled"
                      :class="pp5StatusClass(pp5CellStatus(stu.student_id, ta))"
                      class="pp5-badge"
                    >{{ pp5StatusLabel(pp5CellStatus(stu.student_id, ta)) }}</span>
                    <span v-else class="pp5-unfilled">ไม่บันทึก</span>
                  </td>
                  <!-- Summary columns per student -->
                  <td class="pp5-td pp5-td-center pp5-td-sum">
                    <span class="font-bold text-green-700">{{ pp5StudentSummaries[stu.student_id]?.present ?? 0 }}</span>
                  </td>
                  <td class="pp5-td pp5-td-center pp5-td-sum">
                    <span :class="(pp5StudentSummaries[stu.student_id]?.absent||0) > 0 ? 'text-red-600 font-bold' : 'text-gray-300'">
                      {{ pp5StudentSummaries[stu.student_id]?.absent ?? 0 }}
                    </span>
                  </td>
                  <td class="pp5-td pp5-td-center pp5-td-sum">
                    <span class="text-purple-500">{{ pp5StudentSummaries[stu.student_id]?.leave ?? 0 }}</span>
                  </td>
              <td class="pp5-td pp5-td-center pp5-td-sum">
                <span class="text-gray-500">{{ pp5StudentSummaries[stu.student_id]?.official ?? 0 }}</span>
              </td>
                  <td class="pp5-td pp5-td-center pp5-td-sum">
                    <span :class="(pp5StudentSummaries[stu.student_id]?.pct ?? 100) >= 80 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'" style="font-size:11px">
                      {{ (pp5StudentSummaries[stu.student_id]?.pct ?? 0).toFixed(0) }}%
                    </span>
                  </td>
                  <td class="pp5-td pp5-td-center pp5-td-sum">
                    <el-tag v-if="pp5StudentSummaries[stu.student_id]?.isMaeSo" type="danger" size="small" style="font-size:11px;padding:0 4px">มส</el-tag>
                    <span v-else class="text-gray-300 text-xs">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Signature -->
          <div class="signature-block">
            <div class="sig-box">
              <div class="sig-line">ลงชื่อ ............................................</div>
              <div class="sig-name">( {{ myDisplayName }} )</div>
              <div class="sig-role">ผู้จัดทำรายงาน</div>
              <div class="sig-date">วันที่ {{ formatDateThai(todayStr) }}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getClasses, getStudents, getTeachingAssignments, getTeachActualsRangeByClass, getSchoolSettings } = useSchoolDb()

// ─── Role ────────────────────────────────────────────────────────
const isTeacherOnly = computed(() =>
  !authStore.hasAnyRole(['school_admin', 'admin', 'superadmin'])
)
const myDisplayName = computed(() =>
  authStore.profile?.displayName || authStore.profile?.name || 'ผู้ทำรายการ'
)
const schoolName = computed(() => schoolStore.schoolInfo?.school_name || '')
const todayStr = new Date().toISOString().split('T')[0]

// ─── Tab ─────────────────────────────────────────────────────────
const activeTab = ref('summary')

// ─── Filter state ────────────────────────────────────────────────
const classes         = ref([])
const assignments     = ref([])
const homeroomPeriods = ref([])   // จาก teaching_log_settings.homeroom_special_periods
const filterClassId   = ref('')
const filterSubjectId = ref('')
const startDate       = ref('')
const endDate         = ref('')
const loading         = ref(false)
const reportRows      = ref([])

// ─── PP5 data ────────────────────────────────────────────────────
const allStudents = ref([])
const allActuals  = ref([])

const hasData = computed(() => reportRows.value.length > 0)

// ─── Available classes / subjects ────────────────────────────────
const availableClasses = computed(() => {
  if (!isTeacherOnly.value) return classes.value
  const teacherId = authStore.profile?.teacher_id || authStore.profile?.uid
  const myClassIds = new Set(
    assignments.value
      .filter(a => a.teacher_id === teacherId || a.teacher_id_snapshot === teacherId)
      .map(a => a.class_id)
  )
  // รวมห้องที่ครูเป็นครูที่ปรึกษา (homeroom teacher)
  for (const cls of classes.value) {
    const ids = Array.isArray(cls.homeroom_teacher_ids) ? cls.homeroom_teacher_ids
      : (cls.homeroom_teacher_id ? [cls.homeroom_teacher_id] : [])
    if (ids.includes(teacherId)) myClassIds.add(cls.class_id)
  }
  return classes.value.filter(c => myClassIds.has(c.class_id))
})

const availableSubjects = computed(() => {
  if (!filterClassId.value) return []
  const teacherId = authStore.profile?.teacher_id || authStore.profile?.uid
  const myAssign = isTeacherOnly.value
    ? assignments.value.filter(a =>
        (a.teacher_id === teacherId || a.teacher_id_snapshot === teacherId) &&
        a.class_id === filterClassId.value
      )
    : assignments.value.filter(a => a.class_id === filterClassId.value)

  const seen = new Set()
  const regularSubjects = myAssign
    .filter(a => {
      if (!a.subject_code) return false  // กรอง null/empty subject ออก
      if (seen.has(a.subject_code)) return false
      seen.add(a.subject_code)
      return true
    })
    .map(a => ({ id: a.subject_code, label: `${a.subject_code} ${a.subject_name || ''}`.trim() }))
    .sort((a, b) => a.id.localeCompare(b.id))

  // วิชาพิเศษครูที่ปรึกษา จาก admin settings
  const hpSubjects = homeroomPeriods.value.map(hp => ({
    id: `__homeroom__${hp.period}`,
    label: `คาบ${hp.period}: ${hp.name} (ครูที่ปรึกษา)`,
  }))

  return [...regularSubjects, ...hpSubjects]
})

const filterClassLabel = computed(() => {
  const cls = classes.value.find(c => c.class_id === filterClassId.value)
  return cls?.class_name || filterClassId.value
})

function categorizeStatus(st) {
  if (!st || st === 'ไม่บันทึก') return 'absent'
  if (st.includes('ขาด') || ['โดดเรียน', 'หนีเรียน', 'absent'].includes(st)) return 'absent'
  if (['ลากิจ', 'ลาป่วย', 'leave', 'sick'].includes(st)) return 'leave'
  if (['ไปราชการ', 'official'].includes(st)) return 'official'
  return 'present'
}

// ─── Subject info from actuals ────────────────────────────────────
const subjectInfoList = computed(() => {
  const map = new Map()
  for (const ta of allActuals.value) {
    const code = ta.subject_plan_id || ta.subject_actual_id || ''
    const name = ta.subject_name || ''
    const teacher = ta.teacher_plan_name || ''
    const key = code || name
    if (key && !map.has(key)) map.set(key, { code, name, teacher })
  }
  return [...map.values()]
})

// ─── Aggregated stats ─────────────────────────────────────────────
const totalPeriods = computed(() => reportRows.value[0]?.total || 0)
const totalLate    = computed(() => reportRows.value.reduce((s, r) => s + r.late, 0))
const totalAbsent  = computed(() => reportRows.value.reduce((s, r) => s + r.absent, 0))
const avgPresent   = computed(() => {
  const rows = reportRows.value.filter(r => r.total > 0)
  if (!rows.length) return 100
  return rows.reduce((s, r) => s + r.pct, 0) / rows.length
})
const riskCount = computed(() => reportRows.value.filter(r => r.total > 0 && r.pct < 80).length)

// ─── PP5 computed ────────────────────────────────────────────────
const periodsForTable = computed(() =>
  [...allActuals.value].sort((a, b) => {
    const dc = (a.date || '').localeCompare(b.date || '')
    return dc !== 0 ? dc : (a.period || 0) - (b.period || 0)
  })
)

function pp5CellStatus(studentId, ta) {
  if (!ta.is_filled) return null
  const rec = ta.student_records?.[String(studentId)]
  return rec?.status || 'มาเรียน'
}

const PP5_STATUS = {
  'มาเรียน':   { label: 'มา',  cls: 'pp5-p' },
  'มาสาย':    { label: 'สาย', cls: 'pp5-l' },
  'โดดเรียน': { label: 'โดด', cls: 'pp5-a' },
  'ขาดเรียน': { label: 'ขาด', cls: 'pp5-a' },
  'ลาป่วย':   { label: 'ป่วย', cls: 'pp5-v' },
  'ลากิจ':    { label: 'กิจ',  cls: 'pp5-v' },
  'ไปราชการ': { label: 'รก',   cls: 'pp5-v' },
}
function pp5StatusLabel(st) { return PP5_STATUS[st]?.label || st || 'มา' }
function pp5StatusClass(st) { return PP5_STATUS[st]?.cls   || 'pp5-p' }

// ─── Per-student summary for ปพ.5 ────────────────────────────────
const pp5StudentSummaries = computed(() => {
  const result = {}
  for (const stu of allStudents.value) {
    let present = 0, late = 0, absent = 0, leave = 0, total = 0
    for (const ta of periodsForTable.value) {
      total++
      if (!ta.is_filled) {
        absent++ // ไม่บันทึก = ขาด
      } else {
        const st = pp5CellStatus(stu.student_id, ta)
          const cat = categorizeStatus(st)
          if (cat === 'present') present++
          else if (cat === 'absent') absent++
          else if (cat === 'leave') leave++
          // official ไม่หักจากการมา — ไม่นับแยก
      }
    }
    const pct = total > 0 ? (present / total) * 100 : 100
    result[stu.student_id] = {
      present, late, absent, leave, total, pct,
      isMaeSo: total > 0 && pct < 80
    }
  }
  return result
})

// ─── Load ─────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [cls, asgn, settings] = await Promise.all([getClasses(), getTeachingAssignments(), getSchoolSettings()])
    classes.value       = cls
    assignments.value   = asgn
    homeroomPeriods.value = settings?.teaching_log_settings?.homeroom_special_periods || []
    const now = new Date()
    const y   = now.getFullYear()
    const m   = String(now.getMonth() + 1).padStart(2, '0')
    startDate.value = `${y}-${m}-01`
    endDate.value   = now.toISOString().split('T')[0]
  } catch (e) {
    ElMessage.error('โหลดข้อมูลเริ่มต้นไม่สำเร็จ: ' + e.message)
  }
})

function onClassChange() {
  filterSubjectId.value = ''
  reportRows.value = []
  allStudents.value = []
  allActuals.value = []
}

async function loadReport() {
  if (!filterClassId.value) { ElMessage.warning('กรุณาเลือกห้องเรียนก่อน'); return }
  if (!startDate.value || !endDate.value) { ElMessage.warning('กรุณาเลือกช่วงวันที่'); return }
  loading.value = true
  try {
    const teacherId = authStore.profile?.teacher_id || authStore.profile?.uid
    const students  = await getStudents(filterClassId.value, { activeOnly: true })
    let actuals = await getTeachActualsRangeByClass(startDate.value, endDate.value, filterClassId.value)

    if (filterSubjectId.value) {
      if (filterSubjectId.value.startsWith('__homeroom__')) {
        const period = Number(filterSubjectId.value.replace('__homeroom__', ''))
        actuals = actuals.filter(a => a.slot_type === 'homeroom' && a.period_number === period)
      } else {
        actuals = actuals.filter(a =>
          a.subject_plan_id === filterSubjectId.value || a.subject_actual_id === filterSubjectId.value
        )
      }
    }
    if (isTeacherOnly.value && teacherId) {
      actuals = actuals.filter(a =>
        a.teacher_plan_id === teacherId || a.teacher_actual_id === teacherId
      )
    }

    allStudents.value = students.map(s => ({
      ...s,
      student_name: s.student_name || `${s.prefix||''}${s.name||''} ${s.surname||''}`.trim(),
    })).sort((a, b) => (Number(a.seat_number) || 9999) - (Number(b.seat_number) || 9999))
    allActuals.value = actuals

    const statusMap = {}
    students.forEach(s => {
      statusMap[s.student_id] = { present:0, late:0, absent:0, sick:0, leave:0, official:0, total:0 }
    })
    actuals.forEach(ta => {
      if (!ta.is_filled) {
        // ไม่บันทึก → นับเป็นขาดสำหรับทุกคนในห้อง
        students.forEach(s => {
          if (!statusMap[s.student_id]) return
          statusMap[s.student_id].total++
          statusMap[s.student_id].absent++
        })
      } else {
        const recs = ta.student_records || {}
        Object.entries(recs).forEach(([sid, rec]) => {
          if (!statusMap[sid]) return
          const status = rec.status || 'มาเรียน'
          const cat = categorizeStatus(status)
          statusMap[sid].total++
          statusMap[sid][cat]++
        })
      }
    })
    reportRows.value = students.map(s => {
      const c   = statusMap[s.student_id] || { present:0, late:0, absent:0, sick:0, leave:0, official:0, total:0 }
      const pct = c.total > 0 ? (c.present / c.total) * 100 : 0
      return { ...s, ...c, pct }
    }).sort((a, b) => (Number(a.seat_number) || 9999) - (Number(b.seat_number) || 9999))

    if (reportRows.value.length === 0) {
      ElMessage.warning('ไม่พบข้อมูลในช่วงวันที่เลือก')
    }
  } catch (e) {
    ElMessage.error('โหลดรายงานไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

// ─── Print ────────────────────────────────────────────────────────
function printReport() {
  document.body.classList.add('att-printing', `att-print-${activeTab.value}`)
  window.print()
  document.body.classList.remove('att-printing', `att-print-${activeTab.value}`)
}

// ─── Helpers ─────────────────────────────────────────────────────
function studentNameFull(stu) {
  return stu.student_name || `${stu.prefix || ''}${stu.name || ''} ${stu.surname || ''}`.trim()
}

function formatDateBuddhist(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const buddhistYY = String(parseInt(y) + 543).slice(-2)
  return `${parseInt(d)} ${months[parseInt(m)-1]}${buddhistYY}`
}

function formatDateThai(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
}

// ─── Excel: summary ───────────────────────────────────────────────
function exportExcelSummary() {
  const hdrs = ['เลขที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'รหัสนักเรียน', 'มา', 'ขาด', 'ลา', 'ไปราชการ', 'คาบทั้งหมด', '% มาเรียน']
  const rows = reportRows.value.map((r) => [
    r.seat_number || '-', r.prefix || '', r.name || '', r.surname || '', r.student_id,
    r.present, r.absent, r.leave, r.official, r.total, r.pct.toFixed(1)
  ])
  const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'สรุปรวม')
  XLSX.writeFile(wb, `attendance_${filterClassId.value}_${startDate.value}_${endDate.value}.xlsx`)
}

// ─── Excel: PP5 (2 header rows) ───────────────────────────────────
function exportExcelPp5() {
  const cols     = periodsForTable.value
  const fixedL   = ['เลขที่', 'รหัส', 'ชื่อ-นามสกุล']
  const sumCols  = ['มา', 'ขาด', 'ลา', 'ร.ก.', '%', 'มส']

  // Row 1: sequential period index
  const row1 = [...fixedL, ...cols.map((_, i) => i + 1), ...sumCols]
  // Row 2: Thai Buddhist date (blank for fixed + sum cols)
  const row2 = ['', '', '', ...cols.map(ta => formatDateBuddhist(ta.date)), '', '', '', '', '', '']

  const dataRows = allStudents.value.map((stu) => {
    const sum = pp5StudentSummaries.value[stu.student_id] || {}
    return [
      stu.seat_number || '-',
      stu.student_id,
      studentNameFull(stu),
      ...cols.map(ta => {
        const st = pp5CellStatus(stu.student_id, ta)
        return st || (ta.is_filled ? 'มาเรียน' : '')
      }),
      sum.present ?? 0, sum.absent ?? 0, sum.leave ?? 0, sum.official ?? 0,
      `${(sum.pct ?? 0).toFixed(0)}%`,
      sum.isMaeSo ? 'มส' : ''
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([row1, row2, ...dataRows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ปพ.5')
  XLSX.writeFile(wb, `pp5_${filterClassId.value}_${startDate.value}_${endDate.value}.xlsx`)
}
</script>

<style scoped>
/* Page */
.att-page      { padding: 24px; max-width: 1400px; margin: 0 auto; }
.att-title-bar { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.att-title     { font-size: 22px; font-weight: 800; color: #1e293b; }
.att-sub       { font-size: 12px; color: #94a3b8; margin-top: 2px; }

/* Tab bar */
.att-tab-bar     { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
.att-tabs        { flex: 1; }
.att-tab-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* Subject banner */
.subj-banner { background: #f0f9ff; border-left: 4px solid #0891b2; border-radius: 8px; padding: 10px 16px; }
.subj-row    { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.subj-code   { font-size: 15px; font-weight: 800; color: #0e7490; font-family: monospace; }
.subj-name   { font-size: 16px; font-weight: 700; color: #1e293b; }
.subj-teacher{ font-size: 13px; color: #475569; }

/* Stats */
.att-stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.att-stat-card { border-radius: 12px; padding: 12px 16px; border: 1px solid transparent; text-align: center; }
.att-stat-num  { font-size: 22px; font-weight: 800; }
.att-stat-lbl  { font-size: 11px; margin-top: 2px; }
@media(max-width:640px) { .att-stats-bar { grid-template-columns: repeat(2,1fr); } }

/* PP5 table */
.pp5-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; }
.pp5-table {
  border-collapse: collapse; width: 100%;
  font-size: 11px; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

/* Sticky 2-row header */
.pp5-thead-r1 th { position: sticky; top: 0;    z-index: 3; }
.pp5-thead-r2 th { position: sticky; top: 29px; z-index: 3; }

.pp5-th {
  background: #0e7490; color: #fff;
  padding: 5px 4px; text-align: center;
  border: 1px solid #0891b2;
  font-weight: 700; font-size: 11px; white-space: nowrap;
}
.pp5-th-fix  { background: #0e7490; }
.pp5-th-seq  { background: #155e75; font-size: 14px; font-weight: 900; min-width: 52px; padding: 6px 3px; }
.pp5-th-date { background: #0e7490; font-size: 10px; color: #a5f3fc; white-space: nowrap; padding: 4px 3px; }
.pp5-th-sum  { background: #1e3a8a; font-size: 11px; min-width: 40px; }

.pp5-td        { padding: 4px 4px; border: 1px solid #e2e8f0; vertical-align: middle; font-size: 11px; }
.pp5-td-center { text-align: center; }
.pp5-td-name   { min-width: 160px; font-weight: 600; color: #1e293b; white-space: nowrap; padding-left: 6px; }
.pp5-td-id     { font-family: monospace; font-size: 10px; color: #64748b; }
.pp5-td-sum    { background: #f8fafc; border-left: 2px solid #cbd5e1 !important; }

.pp5-tr-even { background: #fff; }
.pp5-tr-odd  { background: #f8fafc; }
.pp5-tr-even:hover, .pp5-tr-odd:hover { background: #ecfeff; }

.pp5-badge  {
  display: inline-block; padding: 1px 5px; border-radius: 4px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
}
.pp5-p { background: #dcfce7; color: #15803d; }
.pp5-l { background: #fef9c3; color: #854d0e; }
.pp5-a { background: #fee2e2; color: #991b1b; }
.pp5-v { background: #ede9fe; color: #5b21b6; }
.pp5-unfilled { color: #cbd5e1; font-size: 11px; }

/* Signature */
.signature-block { display: flex; justify-content: flex-end; padding: 24px 16px 8px; }
.sig-box         { text-align: center; min-width: 240px; }
.sig-line        { font-size: 13px; margin-bottom: 6px; }
.sig-name        { font-size: 13px; font-weight: 700; }
.sig-role        { font-size: 11px; color: #64748b; margin-top: 2px; }
.sig-date        { font-size: 12px; color: #64748b; margin-top: 4px; }

/* Print-only elements */
.print-only    { display: none; }
.print-header  { text-align: center; padding: 12px 0 8px; margin-bottom: 12px; border-bottom: 2px solid #0e7490; }
.print-school  { font-size: 16px; font-weight: 800; }
.print-report-title { font-size: 14px; font-weight: 700; margin-top: 4px; }
.print-meta    { font-size: 12px; color: #475569; margin-top: 2px; }
.report-content { padding-bottom: 12px; }
</style>

<!-- Global print styles -->
<style>
@media print {
  .no-print,
  .el-tabs__header,
  .el-card,
  nav,
  aside { display: none !important; }

  .print-only { display: block !important; }

  .att-page { padding: 0 !important; max-width: 100% !important; }

  body.att-print-summary #att-print-pp5    { display: none !important; }
  body.att-print-pp5    #att-print-summary { display: none !important; }
  body.att-printing .report-content        { display: block !important; }

  @page { margin: 12mm; size: A4 landscape; }
}
</style>
