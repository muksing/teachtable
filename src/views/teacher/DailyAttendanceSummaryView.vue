<template>
  <AppLayout>
    <div class="das-page">

      <!-- ── Header ──────────────────────────────────────────────── -->
      <div class="das-header">
        <div>
          <h1 class="das-title">📋 รายงานการมาเรียนรายวัน</h1>
          <p class="das-sub">สรุปยอดการเข้าเรียนรายคาบ · ส่งรายงานผู้ปกครอง</p>
        </div>
        <div v-if="activeClassLabel">
          <el-tag type="primary" size="large" style="font-size:13px;padding:0 14px;height:32px;line-height:30px">
            🏫 {{ activeClassLabel }}
          </el-tag>
        </div>
      </div>

      <!-- ── Filter Bar ──────────────────────────────────────────── -->
      <el-card class="mb-4" shadow="never" style="border-radius:14px">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📆 วันที่</div>
            <el-date-picker
              v-model="selectedDate"
              type="date"
              placeholder="เลือกวันที่"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              @change="onDateChange"
              style="width:180px"
            />
          </div>
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">🏫 ห้องเรียน</div>
            <el-select
              v-model="selectedClassId"
              placeholder="เลือกห้อง"
              @change="loadData"
              clearable filterable style="width:200px"
            >
              <el-option
                v-for="cls in displayClasses"
                :key="cls.class_id"
                :label="cls.class_name || cls.class_id"
                :value="cls.class_id"
              />
            </el-select>
          </div>
          <div v-if="!isAdmin">
            <div class="text-xs text-gray-500 mb-1 font-medium">แสดง</div>
            <el-radio-group v-model="viewMode" size="small" @change="onViewModeChange">
              <el-radio-button value="all">ทั้งหมด</el-radio-button>
              <el-radio-button value="own">วิชาของฉัน</el-radio-button>
            </el-radio-group>
          </div>
        <div class="flex items-end pb-0.5 gap-2 w-full sm:w-auto ml-auto mt-2 sm:mt-0">
          <el-button :loading="loading" plain size="small" @click="loadData" class="w-full sm:w-auto">🔄 รีเฟรช</el-button>
          </div>
        </div>
      </el-card>

      <!-- ── No class selected ──────────────────────────────────── -->
      <el-empty
        v-if="!selectedClassId"
        :image-size="70"
        description="เลือกห้องเรียนเพื่อดูรายงาน"
      />

      <!-- ── Content ────────────────────────────────────────────── -->
      <div v-else v-loading="loading">

        <!-- ── Summary bar ─────────────────────────────────────── -->
        <div v-if="students.length" class="das-summary-bar mb-4">
          <span class="das-sum-tag das-sum-total">👥 {{ students.length }} คน</span>
          <span class="das-sum-tag" style="background:#f0fdf4; color:#15803d">มา เฉลี่ย {{ overallAverages.present || 0 }}</span>
          <span class="das-sum-tag" style="background:#fef2f2; color:#b91c1c">ขาด เฉลี่ย {{ overallAverages.absent || 0 }}</span>
          <span class="das-sum-tag" style="background:#faf5ff; color:#7e22ce">ลา เฉลี่ย {{ overallAverages.leave || 0 }}</span>
          <span class="das-sum-tag" style="background:#f8fafc; color:#475569">ร.ก. เฉลี่ย {{ overallAverages.official || 0 }}</span>
          <span class="ml-auto flex gap-2">
            <el-button size="small" type="primary" plain :loading="capturing" @click="downloadImage">
              📸 บันทึกภาพ
            </el-button>
            <el-button
              size="small" type="success" plain
              :loading="sending"
              :disabled="!gasUploadUrl"
              :title="!gasUploadUrl ? 'ยังไม่ตั้งค่า GAS URL' : ''"
              @click="sendReport"
            >
              📤 ส่งรายงาน
            </el-button>
            <el-button size="small" plain @click="copyLineMessage">📋 คัดลอก LINE</el-button>
          </span>
        </div>

        <!-- ── Main cross table ───────────────────────────────── -->
        <el-empty
          v-if="!loading && !students.length"
          :image-size="60"
          description="ไม่พบนักเรียนในห้องนี้"
        />
        <el-empty
          v-else-if="!loading && !visiblePeriods.length"
          :image-size="60"
          description="ยังไม่มีคาบสอนในวันนี้ หรือยังไม่ได้สร้างบันทึกล่วงหน้า"
        />

        <div v-else-if="students.length && visiblePeriods.length" class="das-table-wrap">
          <div ref="captureArea" class="das-capture-wrap">

            <!-- Report header (visible in capture) -->
            <div class="das-rep-header">
              <div class="das-rep-title">บันทึกการสอน ห้อง {{ activeClassLabel }}</div>
              <div class="das-rep-meta">วันที่ {{ formatDateThai(selectedDate) }}</div>
            </div>

            <!-- Cross table -->
            <div class="das-table-scroll">
              <table class="das-cross-table">
                <colgroup>
                  <col style="width:55px" />
                  <col style="width:90px" />
                  <col style="min-width:160px" />
                  <col v-for="p in visiblePeriods" :key="p.id" style="min-width:80px" />
                  <col style="width:38px" />
                  <col style="width:38px" />
                  <col style="width:38px" />
                  <col style="width:38px" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="das-th" colspan="3">นักเรียน</th>
                    <th
                      v-for="p in visiblePeriods"
                      :key="p.id"
                      class="das-th das-th-period cursor-pointer hover:bg-blue-800 transition-colors"
                      @click="$router.push(`/teacher/teach-actual/${p.id}`)"
                      title="คลิกเพื่อเข้าสู่หน้าบันทึกเข้าสอนของคาบนี้"
                    >
                      <div class="das-period-num">คาบที่ {{ p.period }}</div>
                      <div class="das-period-sub">{{ shortSubject(p.subject_name) }}</div>
                      <div class="das-period-teacher">{{ shortName(p.teacher_plan_name) }}</div>
                      <el-tag
                        v-if="!p.is_filled"
                        type="info"
                        size="small"
                        style="font-size:9px;padding:0 4px;height:16px;line-height:14px;margin-top:2px"
                      >ยังไม่บันทึก</el-tag>
                    </th>
                    <th class="das-th" style="background:#16a34a; width:38px">มา</th>
                    <th class="das-th" style="background:#dc2626; width:38px">ขาด</th>
                    <th class="das-th" style="background:#9333ea; width:38px">ลา</th>
                    <th class="das-th" style="background:#64748b; width:38px">ร.ก.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(stu, idx) in students"
                    :key="stu.student_id"
                    :class="idx % 2 === 0 ? 'das-tr-even' : 'das-tr-odd'"
                  >
                    <td class="das-td das-td-center">{{ stu.seat_number || stu.student_no || '-' }}</td>
                    <td class="das-td das-td-center das-td-id">{{ stu.student_id }}</td>
                    <td class="das-td das-td-name">{{ studentName(stu) }}</td>
                    <td
                      v-for="p in visiblePeriods"
                      :key="p.id"
                      class="das-td das-td-center"
                    >
                      <span
                        v-if="p.is_filled"
                        :class="statusClass(getCellStatus(stu.student_id, p.id))"
                        class="das-status-badge"
                      >
                        {{ statusLabel(getCellStatus(stu.student_id, p.id)) }}
                      </span>
                      <span v-else class="das-status-unfilled">ไม่บันทึก</span>
                    </td>
                    <td class="das-td das-td-center font-bold" style="background:#f0fdf4; color:#15803d">
                    {{ studentDailySummaries[stu.student_id]?.present || 0 }}
                    </td>
                    <td class="das-td das-td-center font-bold" style="background:#fef2f2; color:#b91c1c">
                    {{ studentDailySummaries[stu.student_id]?.absent || 0 }}
                    </td>
                    <td class="das-td das-td-center font-bold" style="background:#faf5ff; color:#7e22ce">
                    {{ studentDailySummaries[stu.student_id]?.leave || 0 }}
                    </td>
                    <td class="das-td das-td-center font-bold" style="background:#f8fafc; color:#475569">
                    {{ studentDailySummaries[stu.student_id]?.official || 0 }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="das-tr-tfoot">
                    <td class="das-td das-tfoot-label" colspan="3">📊 สรุปรวม</td>
                    <td
                      v-for="p in visiblePeriods"
                      :key="'sum-' + p.id"
                      class="das-td das-td-center das-tfoot-cell"
                    >
                      <div class="das-tally">
                        <span v-if="periodSummary[p.id]?.present" style="color:#15803d">มา: {{ periodSummary[p.id].present }}</span>
                        <span v-if="periodSummary[p.id]?.absent" style="color:#991b1b">ขาด: {{ periodSummary[p.id].absent }}</span>
                        <span v-if="periodSummary[p.id]?.leave" style="color:#6b21a8">ลา: {{ periodSummary[p.id].leave }}</span>
                        <span v-if="periodSummary[p.id]?.official" style="color:#475569">ร.ก.: {{ periodSummary[p.id].official }}</span>
                      </div>
                    </td>
                    <td class="das-td das-td-center" style="background:#f1f5f9" colspan="4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Summary footer inside capture -->
            <div class="das-rep-footer">
              <span>รวม {{ students.length }} คน</span>
            </div>
          </div>
        </div>

        <!-- ── Absent summary for parents ─────────────────────── -->
        <el-card v-if="absentStudents.length" class="mt-4 das-notify-card" shadow="never">
          <template #header>
            <span class="font-bold text-gray-700">📣 แจ้งเตือนการมาเรียน (สถานะที่โดนหักคะแนน หรือมาสาย/ขาด)</span>
          </template>
          <div class="das-notify-list">
            <div v-for="row in absentStudents" :key="row.student_id + row.period" class="das-notify-row">
              <div class="das-notify-left">
                <span class="das-period-badge">คาบ {{ row?.period }}</span>
                <span class="das-status-badge ml-2" :style="getStatusCellStyle(row?.color)">
                  {{ statusLabel(row?.status) }}
                </span>
                <span class="ml-2 font-medium text-sm">{{ studentName(row || {}) }}</span>
              </div>
              <div class="das-notify-right">
                <a v-if="row?.parent_phone" :href="`tel:${row?.parent_phone}`" class="das-phone-link ml-1">
                  ☎ {{ row?.parent_phone }}
                </a>
                <span v-else class="text-xs text-gray-400">ไม่มีเบอร์</span>
              </div>
            </div>
          </div>
        </el-card>

      </div>
    </div>
  </AppLayout>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getClasses, getStudents, getHomeroomClass, getTeachActualsRangeByClass, getTeachActuals, getAttendanceStatuses } = useSchoolDb()

// ─── Roles ─────────────────────────────────────────────────────
const isAdmin = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))
const myTeacherId = computed(() => authStore.profile?.teacher_id || authStore.profile?.uid || '')

// ─── State ─────────────────────────────────────────────────────
const selectedDate    = ref(new Date().toISOString().split('T')[0])
const selectedClassId = ref('')
const viewMode        = ref('all')
const classes         = ref([])
const homeroomClass   = ref(null)
const loading         = ref(false)
const capturing       = ref(false)
const sending         = ref(false)
const captureArea     = ref(null)
const ownClassIds     = ref(new Set())

const students     = ref([])
const teachActuals = ref([])
const attendanceStatuses = ref([])

const gasUploadUrl = computed(() => schoolStore.schoolInfo?.gas_upload_web_app_url || '')

// ─── Active class label ──────────────────────────────────────────
const activeClassLabel = computed(() => {
  if (!selectedClassId.value) return ''
  const cls = classes.value.find(c => c.class_id === selectedClassId.value)
  return cls?.class_name || cls?.class_id || selectedClassId.value
})

// ─── displayClasses — filtered when in "own" mode ────────────────
const displayClasses = computed(() => {
  if (viewMode.value === 'own' && !isAdmin.value && ownClassIds.value.size > 0) {
    return classes.value.filter(c => ownClassIds.value.has(c.class_id))
  }
  return classes.value
})

// ─── Refresh own class IDs from teacher's teach_actuals ──────────
async function refreshOwnClasses() {
  if (viewMode.value === 'own' && !isAdmin.value && selectedDate.value && myTeacherId.value) {
    try {
      const acts = await getTeachActuals(selectedDate.value, myTeacherId.value)
      ownClassIds.value = new Set(acts.map(a => a.class_id).filter(Boolean))
      if (selectedClassId.value && !ownClassIds.value.has(selectedClassId.value)) {
        const first = [...ownClassIds.value][0] || ''
        selectedClassId.value = first
        if (first) loadData()
      }
    } catch {
      ownClassIds.value = new Set()
    }
  } else {
    ownClassIds.value = new Set()
  }
}

function onViewModeChange() { refreshOwnClasses() }
function onDateChange() { refreshOwnClasses(); loadData() }

// ─── Periods to show ────────────────────────────────────────────
const allPeriods = computed(() =>
  teachActuals.value
    .slice()
    .sort((a, b) => (a.period || 0) - (b.period || 0))
)

const visiblePeriods = computed(() => {
  if (viewMode.value === 'own' && !isAdmin.value) {
    return allPeriods.value.filter(ta =>
      ta.teacher_plan_id === myTeacherId.value ||
      ta.subject_actual_teacher_id === myTeacherId.value ||
      (ta.slot_type === 'homeroom' && ta.class_id === homeroomClass.value?.class_id)
    )
  }
  return allPeriods.value
})

// ─── Cross-table cell lookup ─────────────────────────────────────
function getCellStatus(studentId, teachActualId) {
  const ta = teachActuals.value.find(t => t.id === teachActualId)
  if (!ta || !ta.is_filled) return 'ไม่บันทึก'
  const rec = ta.student_records?.[String(studentId)]
  return rec?.status || 'มาเรียน'
}

function categorizeStatus(st) {
  if (!st || st === 'ไม่บันทึก') return 'absent'
  if (st.includes('ขาด') || ['โดดเรียน', 'หนีเรียน', 'absent'].includes(st)) return 'absent'
  if (['ลากิจ', 'ลาป่วย', 'leave', 'sick'].includes(st)) return 'leave'
  if (['ไปราชการ', 'official'].includes(st)) return 'official'
  return 'present'
}

// ─── Per-period summary counts (for tfoot row) ────────────────────
const periodSummary = computed(() => {
  const map = {}
  for (const p of visiblePeriods.value) {
    const counts = { present: 0, absent: 0, leave: 0, official: 0 }
    for (const stu of students.value) {
      const st = getCellStatus(stu.student_id, p.id)
      const cat = categorizeStatus(st)
      counts[cat]++
    }
    map[p.id] = counts
  }
  return map
})

// ─── Per-student daily summary counts (for right-side columns) ────
const studentDailySummaries = computed(() => {
  const map = {}
  for (const stu of students.value) {
    map[stu.student_id] = { present: 0, absent: 0, leave: 0, official: 0 }
    for (const p of visiblePeriods.value) {
      const st = getCellStatus(stu.student_id, p.id)
      const cat = categorizeStatus(st)
      map[stu.student_id][cat]++
    }
  }
  return map
})

// ─── Summary bar counts (avg across all periods) ──────────────
const overallAverages = computed(() => {
  const periods = visiblePeriods.value
  const counts = { present: 0, absent: 0, leave: 0, official: 0 }
  if (!periods.length) return counts

  for (const stu of students.value) {
    for (const p of periods) {
      const st = getCellStatus(stu.student_id, p.id)
      const cat = categorizeStatus(st)
      counts[cat]++
    }
  }
  
  Object.keys(counts).forEach(k => {
    counts[k] = Math.round(counts[k] / periods.length)
  })
  return counts
})

// ─── Absent list for parent notification ───────────────────────
const absentStudents = computed(() => {
  const rows = []
  const periods = visiblePeriods.value || []
  const studs = students.value || []
  const statuses = attendanceStatuses.value || []

  for (const p of periods) {
    if (!p || !p.is_filled) continue
    for (const stu of studs) {
      if (!stu || !stu.student_id) continue
      const stLabel = getCellStatus(stu.student_id, p.id)
      const cat = categorizeStatus(stLabel)
      const stDef = statuses.find(s => s && s.label === stLabel) || {}
      
      const isAbsent = (cat === 'absent' && stLabel !== 'ไม่บันทึก')
      const isLeave  = (cat === 'leave')
      const isNegative = (typeof stDef.points_default === 'number' && stDef.points_default < 0)

      if (isAbsent || isLeave || isNegative) {
        rows.push({
          student_id: stu.student_id,
          student_name: stu.student_name || '',
          prefix: stu.prefix || '',
          name: stu.name || '',
          surname: stu.surname || '',
          seat_number: stu.seat_number || stu.student_no || 0,
          parent_phone: stu.parent_phone || stu.guardian_primary?.phone || '',
          period: p.period || '',
          status: stLabel || '',
          color: stDef.color || 'red'
        })
      }
    }
  }
  return rows.sort((a, b) => a.period - b.period || (parseInt(a.seat_number, 10) || 9999) - (parseInt(b.seat_number, 10) || 9999))
})

// ─── Helpers ─────────────────────────────────────────────────────
function studentName(stu) {
  return stu.student_name || `${stu.prefix || ''}${stu.name || ''} ${stu.surname || ''}`.trim()
}
function shortSubject(name) {
  if (!name) return '—'
  return name.length > 10 ? name.slice(0, 10) + '…' : name
}
function shortName(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? parts[0] + ' ' + parts[1].charAt(0) + '.' : parts[0]
}
function formatDateThai(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
}

function shortStatus(label) {
  if (!label) return ''
  return label.length > 5 ? label.substring(0, 4) + '.' : label
}
function statusLabel(st) { return st || '—' }

function getStatusCellStyle(color) {
  const defaultStyle = { background: '#f8fafc', color: '#475569' }
  if (!color) return defaultStyle
  const m = {
    green: { background: '#f0fdf4', color: '#15803d' },
    yellow: { background: '#fefce8', color: '#a16207' },
    red: { background: '#fef2f2', color: '#b91c1c' },
    purple: { background: '#faf5ff', color: '#7e22ce' },
    blue: { background: '#eff6ff', color: '#1d4ed8' },
    gray: { background: '#f8fafc', color: '#475569' },
  }
  return m[color] || defaultStyle
}

function statusClass(st) {
  if (!st) return 'das-s-present'
  const statuses = attendanceStatuses.value || []
  const stDef = statuses.find(s => s && s.label === st) || {}
  const c = stDef.color || null

  const m = { green:'das-s-present', yellow:'das-s-late', red:'das-s-absent', purple:'das-s-leave', blue:'das-s-leave', gray:'das-s-leave' }
  return c && m[c] ? m[c] : 'das-s-present'
}

// ─── Load ─────────────────────────────────────────────────────────
async function loadData() {
  if (!selectedClassId.value) return
  loading.value = true
  try {
    const [studs, actuals] = await Promise.all([
      getStudents(selectedClassId.value, { activeOnly: true }),
      getTeachActualsRangeByClass(selectedDate.value, selectedDate.value, selectedClassId.value),
    ])
    students.value = studs
      .map(s => ({
        ...s,
        student_name: s.student_name || `${s.prefix||''}${s.name||''} ${s.surname||''}`.trim(),
      })).sort((a, b) => {
        const numA = parseInt(a.seat_number || a.student_no, 10); const valA = isNaN(numA) ? 999 : numA
        const numB = parseInt(b.seat_number || b.student_no, 10); const valB = isNaN(numB) ? 999 : numB
        return valA - valB
      })
    teachActuals.value = actuals
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function buildCanvas() {
  if (!captureArea.value) return null
  return await html2canvas(captureArea.value, { scale: 2, useCORS: true })
}

async function downloadImage() {
  capturing.value = true
  try {
    const canvas = await buildCanvas()
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `attendance_${selectedDate.value}_${activeClassLabel.value}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    ElMessage.error('บันทึกภาพไม่สำเร็จ: ' + e.message)
  } finally {
    capturing.value = false
  }
}

async function sendReport() {
  if (!gasUploadUrl.value) { ElMessage.warning('ยังไม่ได้ตั้งค่า GAS URL'); return }
  sending.value = true
  try {
    const canvas = await buildCanvas()
    if (!canvas) return
    const base64 = canvas.toDataURL('image/png').split(',')[1]
    const resp = await fetch(gasUploadUrl.value, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendAttendanceSummary',
        image: base64,
        date: selectedDate.value,
        classId: selectedClassId.value,
      }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    ElMessage.success('✅ ส่งรายงานเรียบร้อยแล้ว')
  } catch (e) {
    ElMessage.error('ส่งรายงานไม่สำเร็จ: ' + e.message)
  } finally {
    sending.value = false
  }
}

// ─── Copy LINE message ─────────────────────────────────────────────
function copyLineMessage() {
  const lines = [
    `📋 รายงานการมาเรียน`,
    `ห้อง ${activeClassLabel.value}  วันที่ ${formatDateThai(selectedDate.value)}`,
    `นักเรียน ${students.value.length} คน`,
    '',
  ]
  const absRows = absentStudents.value
  if (absRows.length) {
    lines.push('นักเรียนขาด/ลา/สาย:')
    absRows.forEach(r => {
      lines.push(`  คาบ${r.period} ${statusLabel(r.status)} ${studentName(r)}${r.parent_phone ? '  ☎ ' + r.parent_phone : ''}`)
    })
  } else {
    lines.push('🎉 นักเรียนทุกคนมาเรียนครบ')
  }
  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => ElMessage.success('📋 คัดลอกข้อความแล้ว'))
    .catch(() => ElMessage.warning('คัดลอกไม่สำเร็จ'))
}

// ─── Mount ────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    attendanceStatuses.value = await getAttendanceStatuses()
    classes.value = (await getClasses()).filter(c => !c.is_schedule_only)
    if (!isAdmin.value) {
      const teacherId = myTeacherId.value
      if (teacherId) {
        homeroomClass.value = await getHomeroomClass(teacherId)
        if (homeroomClass.value) {
          selectedClassId.value = homeroomClass.value.class_id
          await loadData()
        }
      }
    }
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ')
  }
})
</script>

<style scoped>
.das-page   { padding: 24px; max-width: 1400px; margin: 0 auto; }
.das-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.das-title  { font-size: 22px; font-weight: 800; color: #1e293b; }
.das-sub    { font-size: 12px; color: #94a3b8; margin-top: 2px; }

/* Summary bar */
.das-summary-bar {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  background: #f8fafc; border-radius: 12px; padding: 10px 16px;
  border: 1px solid #e2e8f0;
}
.das-sum-tag { padding: 3px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.das-sum-total   { background: #e2e8f0; color: #475569; }
.das-sum-present { background: #dcfce7; color: #166534; }
.das-sum-late    { background: #fef9c3; color: #854d0e; }
.das-sum-absent  { background: #fee2e2; color: #991b1b; }
.das-sum-leave   { background: #ede9fe; color: #5b21b6; }
.das-sum-gray    { background: #f1f5f9; color: #475569; }

/* Table wrapper */
.das-table-wrap   { overflow: hidden; border-radius: 14px; border: 1px solid #e2e8f0; }
.das-capture-wrap { background: #fff; }

/* Report header */
.das-rep-header {
  text-align: center; padding: 10px 16px 6px;
  border-bottom: 2px solid #1d4ed8; background: #1d4ed8;
}
.das-rep-title { font-size: 15px; font-weight: 800; color: #fff; }
.das-rep-meta  { font-size: 12px; color: rgba(255,255,255,0.85); margin-top: 2px; }

/* Scrollable table */
.das-table-scroll { overflow-x: auto; }

/* Cross table */
.das-cross-table {
  border-collapse: collapse; width: 100%;
  font-size: 12px; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

.das-th {
  background: #1d4ed8; color: #fff;
  padding: 6px 8px; text-align: center;
  border: 1px solid #3b82f6;
  font-weight: 700; font-size: 11px; white-space: nowrap;
  position: sticky; top: 0; z-index: 2;
}
.das-th-period { background: #1e40af; min-width: 80px; vertical-align: top; }

.das-period-num     { font-size: 13px; font-weight: 900; color: #fff; }
.das-period-sub     { font-size: 10px; color: #bfdbfe; margin-top: 2px; }
.das-period-teacher { font-size: 9px; color: #93c5fd; }

.das-td {
  padding: 5px 8px; border: 1px solid #e2e8f0;
  vertical-align: middle; font-size: 12px;
}
.das-td-center { text-align: center; }
.das-td-name   { min-width: 160px; font-weight: 600; color: #1e293b; white-space: nowrap; }
.das-td-id     { font-family: monospace; font-size: 11px; color: #64748b; }

.das-tr-even { background: #fff; }
.das-tr-odd  { background: #f8fafc; }
.das-tr-even:hover, .das-tr-odd:hover { background: #eff6ff; }

/* Status badges */
.das-status-badge {
  display: inline-block; padding: 2px 6px; border-radius: 6px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
}
.das-s-present { background: #dcfce7; color: #15803d; }
.das-s-late    { background: #fef9c3; color: #854d0e; }
.das-s-absent  { background: #fee2e2; color: #991b1b; }
.das-s-leave   { background: #ede9fe; color: #5b21b6; }
.das-status-unfilled { color: #94a3b8; font-size: 11px; font-style: italic; }

/* Tfoot summary row */
.das-tr-tfoot td  { background: #f1f5f9; }
.das-tfoot-label  {
  font-weight: 700; color: #1e293b; font-size: 12px; text-align: center;
  background: #e2e8f0 !important;
}
.das-tfoot-cell   { padding: 4px 6px !important; }
.das-tally        { display: flex; flex-direction: column; gap: 2px; font-size: 11px; font-weight: 700; }
.das-tally-p      { color: #15803d; }
.das-tally-l      { color: #854d0e; }
.das-tally-a      { color: #991b1b; }
.das-tally-v      { color: #5b21b6; }

/* Footer */
.das-rep-footer {
  padding: 8px 16px; font-size: 12px; color: #475569;
  border-top: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;
}

/* Absent notification */
.das-notify-card { border-radius: 14px; }
.das-notify-list { display: flex; flex-direction: column; gap: 6px; }
.das-notify-row  {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;
}
.das-notify-left  { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.das-notify-right { display: flex; align-items: center; gap: 4px; font-size: 13px; }
.das-period-badge {
  background: #dbeafe; color: #1d4ed8;
  padding: 1px 7px; border-radius: 6px; font-size: 11px; font-weight: 700;
}
.das-phone-link { color: #2563eb; font-size: 13px; font-weight: 600; text-decoration: none; }
.das-phone-link:hover { text-decoration: underline; }

@media print {
  .das-summary-bar { display: none; }
}
</style>
