<template>
  <AppLayout>
    <div class="hd-page" v-loading="loading">

      <!-- ── Header ────────────────────────────────────────────── -->
      <div class="hd-header">
        <div class="hd-header-left">
          <div class="hd-class-badge">{{ homeroomClass }}</div>
          <div>
            <h1 class="hd-title">📋 Dashboard ห้องประจำชั้น</h1>
            <p class="hd-sub">ครูที่ปรึกษา: {{ myName }} · {{ schoolStore.termLabel }}</p>
          </div>
        </div>
        <div class="hd-header-right">
          <el-button size="small" plain @click="loadData">🔄 รีเฟรช</el-button>
          <el-button size="small" plain @click="$router.push('/reports/attendance')">📊 รายงานเต็ม</el-button>
        </div>
      </div>

      <!-- ── Period tabs ─────────────────────────────────────── -->
      <div class="hd-period-tabs mb-5">
        <button v-for="p in PERIODS" :key="p.key"
          class="hd-period-btn" :class="{ 'hd-period-btn--active': period === p.key }"
          @click="period = p.key; loadData()">{{ p.label }}</button>
      </div>

      <!-- ── Summary cards ──────────────────────────────────── -->
      <div class="hd-cards mb-5">
        <div class="hd-card hd-card--green">
          <div class="hd-card-num">{{ avgPct.toFixed(1) }}%</div>
          <div class="hd-card-lbl">เฉลี่ยมาเรียน</div>
        </div>
        <div class="hd-card hd-card--red">
          <div class="hd-card-num">{{ atRiskCount }}</div>
          <div class="hd-card-lbl">เสี่ยงหมดสิทธิ์ (&lt;{{ wSettings.attendance_pct }}%)</div>
        </div>
        <div class="hd-card hd-card--orange">
          <div class="hd-card-num">{{ todayAbsentCount }}</div>
          <div class="hd-card-lbl">ขาด/ลา วันนี้</div>
        </div>
        <div class="hd-card hd-card--yellow">
          <div class="hd-card-num">{{ todayLateCount }}</div>
          <div class="hd-card-lbl">มาสายวันนี้</div>
        </div>
        <div class="hd-card hd-card--purple">
          <div class="hd-card-num">{{ watchList.length }}</div>
          <div class="hd-card-lbl">เฝ้าระวัง</div>
        </div>
      </div>

      <!-- ── Watch list ─────────────────────────────────────── -->
      <div v-if="watchList.length" class="hd-watchlist mb-5">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div class="hd-section-title">⚠️ เฝ้าระวัง ({{ watchList.length }} คน)</div>
          <el-button
            type="warning" size="small"
            :disabled="watchlistSelected.size === 0"
            @click="startNotify"
          >
            📣 ส่งแจ้งเตือนผู้ปกครอง ({{ watchlistSelected.size }} คน)
          </el-button>
        </div>
        <div class="hd-watch-table">
          <el-table
            :data="watchList" size="small" border
            @selection-change="rows => { watchlistSelected.clear(); rows.forEach(r => watchlistSelected.add(r.student_id)) }"
            :header-cell-style="{ background:'#fff7ed', color:'#c2410c', fontWeight:'700', fontSize:'12px' }"
          >
            <el-table-column type="selection" width="42" align="center" />
            <el-table-column label="ที่" width="46" align="center" prop="seat_number" />
            <el-table-column label="ชื่อ-สกุล" min-width="150">
              <template #default="{ row }">
                <span class="font-semibold">{{ row.prefix }}{{ row.name }} {{ row.surname }}</span>
              </template>
            </el-table-column>
            <el-table-column label="เหตุเฝ้าระวัง" min-width="200">
              <template #default="{ row }">
                <div class="flex flex-wrap gap-1">
                  <el-tag v-if="row.consAbsent >= wSettings.absent_streak" type="danger" size="small">
                    🔴 ขาด {{ row.consAbsent }} วันติด
                  </el-tag>
                  <el-tag v-if="row.consLate >= wSettings.late_streak" type="warning" size="small">
                    🟡 สาย {{ row.consLate }} วันติด
                  </el-tag>
                  <el-tag v-if="row.skipCount >= wSettings.skip_count" type="danger" size="small">
                    ⚫ โดด {{ row.skipCount }} คาบ
                  </el-tag>
                  <el-tag v-if="row.totalDays >= 5 && row.attendancePct < wSettings.attendance_pct" type="danger" size="small">
                    📉 {{ row.attendancePct.toFixed(0) }}% เสี่ยง มส.
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="ขาด" width="55" align="center">
              <template #default="{ row }"><span class="text-red-600 font-bold">{{ row.absentDays }}</span></template>
            </el-table-column>
            <el-table-column label="ลา" width="50" align="center">
              <template #default="{ row }"><span class="text-purple-500">{{ row.leaveDays }}</span></template>
            </el-table-column>
            <el-table-column label="สาย" width="50" align="center">
              <template #default="{ row }"><span class="text-yellow-600 font-bold">{{ row.lateDays }}</span></template>
            </el-table-column>
            <el-table-column label="โดด" width="55" align="center">
              <template #default="{ row }"><span class="text-rose-700 font-bold">{{ row.skipCount }}</span></template>
            </el-table-column>
            <el-table-column label="% มา" width="72" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.totalDays > 0"
                  :type="row.attendancePct >= wSettings.attendance_pct ? 'success' : 'danger'"
                  size="small" style="font-weight:700">
                  {{ row.attendancePct.toFixed(0) }}%
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- ── Student table ──────────────────────────────────── -->
      <div class="hd-table-wrap">
        <div class="hd-section-title mb-2">👥 รายชื่อนักเรียน ({{ students.length }} คน)</div>
        <el-table
          :data="studentStats" border stripe size="small"
          :header-cell-style="{ background:'#1e3a5f', color:'white', fontWeight:'700', fontSize:'12px' }"
          :default-sort="{ prop:'seat_number', order:'ascending' }"
        >
          <el-table-column prop="seat_number" label="ที่" width="52" align="center" sortable />
          <el-table-column label="ชื่อ-สกุล" min-width="160" prop="name">
            <template #default="{ row }">
              <span class="font-semibold text-gray-800">{{ row.prefix }}{{ row.name }} {{ row.surname }}</span>
            </template>
          </el-table-column>
          <el-table-column label="มา" width="55" align="center" sortable prop="presentDays">
            <template #default="{ row }">
              <span class="text-green-600 font-bold">{{ row.presentDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="สาย" width="55" align="center" sortable prop="lateDays">
            <template #default="{ row }">
              <span :class="row.lateDays > 0 ? 'text-yellow-600 font-bold' : 'text-gray-300'">{{ row.lateDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ขาด" width="55" align="center" sortable prop="absentDays">
            <template #default="{ row }">
              <span :class="row.absentDays > 0 ? 'text-red-600 font-bold' : 'text-gray-300'">{{ row.absentDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ลา" width="52" align="center" sortable prop="leaveDays">
            <template #default="{ row }">
              <span :class="row.leaveDays > 0 ? 'text-purple-500' : 'text-gray-300'">{{ row.leaveDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ขาดลา" width="62" align="center" sortable prop="absentLeaveDays">
            <template #default="{ row }">
              <span :class="row.absentLeaveDays > 0 ? 'text-red-500 font-bold' : 'text-gray-300'">{{ row.absentLeaveDays }}</span>
            </template>
          </el-table-column>
          <el-table-column label="โดด" width="55" align="center" sortable prop="skipCount">
            <template #default="{ row }">
              <span :class="row.skipCount > 0 ? 'text-rose-700 font-bold' : 'text-gray-300'">{{ row.skipCount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="% มา" width="80" align="center" sortable prop="attendancePct">
            <template #default="{ row }">
              <el-tag v-if="row.totalDays > 0"
                :type="row.attendancePct >= wSettings.attendance_pct ? 'success' : row.attendancePct >= wSettings.attendance_pct - 10 ? 'warning' : 'danger'"
                size="small" style="font-weight:700;font-size:11px">
                {{ row.attendancePct.toFixed(0) }}%
              </el-tag>
              <span v-else class="text-gray-300 text-xs">-</span>
            </template>
          </el-table-column>
          <el-table-column label="ขาดติด" width="70" align="center" sortable prop="consAbsent">
            <template #default="{ row }">
              <span v-if="row.consAbsent > 0" class="font-bold"
                :class="row.consAbsent >= wSettings.absent_streak ? 'text-red-600' : 'text-orange-500'">
                {{ row.consAbsent }} วัน
              </span>
              <span v-else class="text-gray-300 text-xs">-</span>
            </template>
          </el-table-column>
          <el-table-column label="สายติด" width="70" align="center" sortable prop="consLate">
            <template #default="{ row }">
              <span v-if="row.consLate > 0" class="font-bold"
                :class="row.consLate >= wSettings.late_streak ? 'text-yellow-600' : 'text-gray-500'">
                {{ row.consLate }} วัน
              </span>
              <span v-else class="text-gray-300 text-xs">-</span>
            </template>
          </el-table-column>
          <el-table-column label="ประเมิน" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.totalDays >= 5 && row.attendancePct >= wSettings.attendance_pct" type="success" size="small" style="font-weight:700;font-size:11px">มีสิทธิ์สอบ</el-tag>
              <el-tag v-else-if="row.totalDays >= 5 && row.attendancePct < wSettings.attendance_pct" type="danger" size="small" style="font-weight:700;font-size:11px">เสี่ยง</el-tag>
              <span v-else class="text-gray-400 text-xs">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- ══ Notification Dialog ══════════════════════════════════ -->
    <el-dialog
      v-model="notifyDialog.visible"
      :title="`📣 แจ้งเตือนผู้ปกครอง (${notifyDialog.index + 1} / ${notifyDialog.queue.length})`"
      width="560px"
      :close-on-click-modal="false"
    >
      <div v-if="notifyDialog.current" class="notify-body">

        <!-- student info -->
        <div class="notify-student-header">
          <div class="notify-student-name">{{ notifyDialog.current.prefix }}{{ notifyDialog.current.name }} {{ notifyDialog.current.surname }}</div>
          <div class="flex flex-wrap gap-1 mt-1">
            <el-tag v-if="notifyDialog.current.consAbsent >= wSettings.absent_streak" type="danger" size="small">ขาด {{ notifyDialog.current.consAbsent }} วันติด</el-tag>
            <el-tag v-if="notifyDialog.current.consLate >= wSettings.late_streak" type="warning" size="small">สาย {{ notifyDialog.current.consLate }} วันติด</el-tag>
            <el-tag v-if="notifyDialog.current.skipCount >= wSettings.skip_count" type="danger" size="small">โดด {{ notifyDialog.current.skipCount }} คาบ</el-tag>
            <el-tag v-if="notifyDialog.current.totalDays >= 5 && notifyDialog.current.attendancePct < wSettings.attendance_pct" type="danger" size="small">มาเรียน {{ notifyDialog.current.attendancePct.toFixed(0) }}%</el-tag>
          </div>
        </div>

        <!-- message editor -->
        <div class="mt-3 mb-1 text-xs font-bold text-gray-600">ข้อความแจ้งเตือน (แก้ไขได้)</div>
        <el-input
          v-model="notifyDialog.message"
          type="textarea" :rows="5"
          style="font-size:13px"
        />
        <el-button size="small" plain class="mt-1" @click="copyMessage">📋 คัดลอกข้อความ</el-button>

        <!-- contacts -->
        <div class="notify-contacts mt-4">
          <div class="text-xs font-bold text-gray-600 mb-2">📞 ข้อมูลผู้ปกครอง</div>

          <!-- Primary guardian -->
          <div v-if="notifyDialog.current.guardian_primary" class="notify-guardian">
            <div class="notify-guardian-label">ผู้ปกครองหลัก: {{ notifyDialog.current.guardian_primary.name || '' }}</div>
            <div class="notify-contact-btns">
              <a v-if="notifyDialog.current.guardian_primary.phone"
                :href="`tel:${notifyDialog.current.guardian_primary.phone}`"
                class="notify-btn notify-btn--phone">
                📞 {{ notifyDialog.current.guardian_primary.phone }}
              </a>
              <button v-if="notifyDialog.current.guardian_primary.line_id"
                class="notify-btn notify-btn--line"
                @click="openLine(notifyDialog.current.guardian_primary.line_id, notifyDialog.message)">
                💬 LINE ({{ notifyDialog.current.guardian_primary.line_id }})
              </button>
              <a v-if="notifyDialog.current.guardian_primary.email"
                :href="mailtoLink(notifyDialog.current.guardian_primary.email, notifyDialog.current)"
                class="notify-btn notify-btn--email">
                ✉️ {{ notifyDialog.current.guardian_primary.email }}
              </a>
              <button v-if="notifyDialog.current.guardian_primary.telegram"
                class="notify-btn notify-btn--telegram"
                @click="openTelegram(notifyDialog.current.guardian_primary.telegram, notifyDialog.message)">
                ✈️ Telegram
              </button>
            </div>
          </div>

          <!-- Secondary guardian -->
          <div v-if="notifyDialog.current.guardian_secondary" class="notify-guardian mt-2">
            <div class="notify-guardian-label">ผู้ปกครองสำรอง: {{ notifyDialog.current.guardian_secondary.name || '' }}</div>
            <div class="notify-contact-btns">
              <a v-if="notifyDialog.current.guardian_secondary.phone"
                :href="`tel:${notifyDialog.current.guardian_secondary.phone}`"
                class="notify-btn notify-btn--phone">
                📞 {{ notifyDialog.current.guardian_secondary.phone }}
              </a>
              <button v-if="notifyDialog.current.guardian_secondary.line_id"
                class="notify-btn notify-btn--line"
                @click="openLine(notifyDialog.current.guardian_secondary.line_id, notifyDialog.message)">
                💬 LINE
              </button>
              <a v-if="notifyDialog.current.guardian_secondary.email"
                :href="mailtoLink(notifyDialog.current.guardian_secondary.email, notifyDialog.current)"
                class="notify-btn notify-btn--email">
                ✉️ Email
              </a>
              <button v-if="notifyDialog.current.guardian_secondary.telegram"
                class="notify-btn notify-btn--telegram"
                @click="openTelegram(notifyDialog.current.guardian_secondary.telegram, notifyDialog.message)">
                ✈️ Telegram
              </button>
            </div>
          </div>

          <!-- Fallback: parent_name/parent_phone -->
          <div v-if="!notifyDialog.current.guardian_primary && notifyDialog.current.parent_phone" class="notify-guardian">
            <div class="notify-guardian-label">{{ notifyDialog.current.parent_name || 'ผู้ปกครอง' }}</div>
            <div class="notify-contact-btns">
              <a :href="`tel:${notifyDialog.current.parent_phone}`" class="notify-btn notify-btn--phone">
                📞 {{ notifyDialog.current.parent_phone }}
              </a>
            </div>
          </div>

          <div v-if="!notifyDialog.current.guardian_primary && !notifyDialog.current.parent_phone"
            class="text-sm text-gray-400 italic py-2">ไม่มีข้อมูลผู้ปกครองในระบบ</div>
        </div>

        <!-- progress indicator -->
        <el-progress
          :percentage="Math.round(notifyDialog.doneCount / notifyDialog.queue.length * 100)"
          :format="() => `${notifyDialog.doneCount}/${notifyDialog.queue.length}`"
          class="mt-4"
          :stroke-width="10"
          status="success"
        />
      </div>

      <template #footer>
        <div class="flex justify-between w-full">
          <el-button @click="notifyDialog.visible = false">❌ ปิด</el-button>
          <div class="flex gap-2">
            <el-button @click="notifySkip">⏭️ ข้ามคนนี้</el-button>
            <el-button type="success" @click="notifyDone">✅ แจ้งแล้ว → ถัดไป</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()

// ─── Constants ────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: '📅 วันนี้' },
  { key: 'week',  label: '📆 สัปดาห์นี้' },
  { key: 'month', label: '🗓️ เดือนนี้' },
  { key: 'term',  label: '📚 ภาคเรียนนี้' },
]

// ─── State ────────────────────────────────────────────────────
const loading       = ref(false)
const period        = ref('week')
const homeroomClass = ref('')
const myName        = ref('')
const students      = ref([])
const actuals       = ref([])
const homeroomPeriods = ref([])   // [{period, name, days}]
const wSettings = reactive({ absent_streak: 3, late_streak: 3, skip_count: 5, attendance_pct: 80 })

// ─── Notify dialog ────────────────────────────────────────────
const watchlistSelected = reactive(new Set())
const notifyDialog = reactive({
  visible: false,
  queue: [],
  index: 0,
  current: null,
  message: '',
  doneCount: 0,
})

// ─── Date helpers ─────────────────────────────────────────────
function toLocalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDateRange(p) {
  const today = new Date(); today.setHours(0,0,0,0)
  const ts = toLocalStr(today)
  if (p === 'today') return { start: ts, end: ts }
  if (p === 'week') {
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((today.getDay()+6)%7))
    return { start: toLocalStr(mon), end: ts }
  }
  if (p === 'month') {
    return { start: toLocalStr(new Date(today.getFullYear(), today.getMonth(), 1)), end: ts }
  }
  // ภาคเรียน: ใช้ term start จาก school store หรือ default
  const term = schoolStore.currentTerm || '2568_1'
  const year = parseInt(term.split('_')[0] || '2568') - 543
  const sem  = parseInt(term.split('_')[1] || '1')
  const termStart = sem === 1 ? new Date(year, 4, 1) : new Date(year, 9, 1)
  return { start: toLocalStr(termStart), end: ts }
}

// ─── Stats computation ────────────────────────────────────────
const TODAY_STR = toLocalStr(new Date())

function computeMode(arr) {
  if (!arr.length) return null
  const counts = {}
  for (const v of arr) counts[v] = (counts[v] || 0) + 1
  let best = null; let max = 0
  for (const [v, c] of Object.entries(counts)) { if (c > max) { max = c; best = v } }
  return best
}

const homeroomPeriodNums = computed(() => new Set(homeroomPeriods.value.map(hp => Number(hp.period))))

const studentStats = computed(() => {
  if (!students.value.length) return []

  // Build per-student data: dayData[sid][date] = { hmStatus, regularStatuses: [] }
  const dayData = {}

  for (const ta of actuals.value) {
    if (!ta.is_filled || !ta.student_records) continue
    const date   = ta.date
    const isHm   = homeroomPeriodNums.value.has(Number(ta.period_number)) || ta.slot_type === 'homeroom'

    for (const [sid, rec] of Object.entries(ta.student_records)) {
      if (!dayData[sid]) dayData[sid] = {}
      if (!dayData[sid][date]) dayData[sid][date] = { hmStatus: null, regularStatuses: [], skipCount: 0 }

      const st = rec.status || 'มาเรียน'
      if (isHm) {
        dayData[sid][date].hmStatus = st
      } else {
        dayData[sid][date].regularStatuses.push(st)
        if (st === 'โดดเรียน') dayData[sid][date].skipCount++
      }
    }
  }

  // Compute today's late/absent from dayData
  // (for header cards, done in separate computed below)

  return students.value.map(stu => {
    const sid  = String(stu.student_id)
    const days = dayData[sid] || {}
    const sortedDates = Object.keys(days).sort()

    let presentDays = 0, absentDays = 0, leaveDays = 0, lateDays = 0, skipCount = 0

    for (const date of sortedDates) {
      const { hmStatus, regularStatuses, skipCount: sc } = days[date]

      // โดดเรียน: นับรายคาบ (ไม่ใช่รายวัน)
      skipCount += sc

      // ฐานนิยมของทุกคาบปกติ → สถานะของวัน
      const allStatuses = [...regularStatuses]
      if (hmStatus) allStatuses.push(hmStatus)
      const mode = allStatuses.length ? computeMode(allStatuses) : null

      if (mode === 'ขาดเรียน') {
        absentDays++
      } else if (mode === 'ลาป่วย' || mode === 'ลากิจ' || mode === 'ไปราชการ') {
        leaveDays++
      } else {
        presentDays++
        // มาสาย: ตรวจจากคาบ homeroom เท่านั้น
        if (hmStatus === 'มาสาย') lateDays++
      }
    }

    const totalDays = presentDays + absentDays + leaveDays
    const attendancePct = totalDays > 0 ? (presentDays / totalDays) * 100 : 100
    const absentLeaveDays = absentDays + leaveDays

    // Consecutive streaks (จากวันล่าสุด)
    let consAbsent = 0
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const { hmStatus, regularStatuses } = days[sortedDates[i]]
      const allSt = [...regularStatuses, ...(hmStatus ? [hmStatus] : [])]
      const m = allSt.length ? computeMode(allSt) : null
      if (m === 'ขาดเรียน') consAbsent++
      else break
    }

    let consLate = 0
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const { hmStatus } = days[sortedDates[i]]
      if (hmStatus === 'มาสาย') consLate++
      else break
    }

    return {
      ...stu,
      presentDays, absentDays, leaveDays, lateDays, skipCount,
      totalDays, attendancePct, absentLeaveDays,
      consAbsent, consLate,
    }
  }).sort((a, b) => Number(a.seat_number) - Number(b.seat_number))
})

const avgPct = computed(() => {
  const rows = studentStats.value.filter(r => r.totalDays > 0)
  return rows.length ? rows.reduce((s, r) => s + r.attendancePct, 0) / rows.length : 100
})

const atRiskCount = computed(() =>
  studentStats.value.filter(r => r.totalDays >= 5 && r.attendancePct < wSettings.attendance_pct).length
)

// Today's stats: ตรวจจาก actuals วันนี้
const todayAbsentCount = computed(() => {
  const sidSet = new Set()
  for (const ta of actuals.value) {
    if (!ta.is_filled || ta.date !== TODAY_STR || !ta.student_records) continue
    for (const [sid, rec] of Object.entries(ta.student_records)) {
      if (['ขาดเรียน','ลาป่วย','ลากิจ'].includes(rec.status)) sidSet.add(sid)
    }
  }
  return sidSet.size
})
const todayLateCount = computed(() => {
  const sidSet = new Set()
  for (const ta of actuals.value) {
    if (!ta.is_filled || ta.date !== TODAY_STR || !ta.student_records) continue
    const isHm = homeroomPeriodNums.value.has(Number(ta.period_number)) || ta.slot_type === 'homeroom'
    if (!isHm) continue
    for (const [sid, rec] of Object.entries(ta.student_records)) {
      if (rec.status === 'มาสาย') sidSet.add(sid)
    }
  }
  return sidSet.size
})

const watchList = computed(() =>
  studentStats.value.filter(r =>
    r.consAbsent >= wSettings.absent_streak ||
    r.consLate >= wSettings.late_streak ||
    r.skipCount >= wSettings.skip_count ||
    (r.totalDays >= 5 && r.attendancePct < wSettings.attendance_pct)
  )
)

// ─── Notification ─────────────────────────────────────────────
function buildMessage(stu) {
  const school = schoolStore.schoolInfo?.name || 'โรงเรียน'
  const lines = [
    `🏫 ${school}`,
    `เรียน ผู้ปกครองนักเรียน ${stu.prefix}${stu.name} ${stu.surname} ชั้น ${homeroomClass.value}`,
    '',
    `ขอแจ้งให้ทราบว่าบุตรหลานของท่านมีพฤติกรรมการมาเรียนที่ต้องติดตาม:`,
  ]
  if (stu.consAbsent >= wSettings.absent_streak)
    lines.push(`• ขาดเรียนติดต่อกัน ${stu.consAbsent} วัน`)
  if (stu.consLate >= wSettings.late_streak)
    lines.push(`• มาสายติดต่อกัน ${stu.consLate} วัน`)
  if (stu.skipCount >= wSettings.skip_count)
    lines.push(`• โดดเรียนสะสม ${stu.skipCount} คาบ`)
  if (stu.totalDays >= 5 && stu.attendancePct < wSettings.attendance_pct)
    lines.push(`• เวลาเรียนสะสม ${stu.attendancePct.toFixed(0)}% (ต่ำกว่า ${wSettings.attendance_pct}% เสี่ยงหมดสิทธิ์สอบ)`)
  lines.push('', 'กรุณาติดต่อครูที่ปรึกษาเพื่อหาแนวทางแก้ไขร่วมกัน')
  lines.push(`ครูที่ปรึกษา: ${myName.value}`)
  return lines.join('\n')
}

function startNotify() {
  const selected = watchList.value.filter(r => watchlistSelected.has(r.student_id))
  if (!selected.length) return
  notifyDialog.queue = [...selected]
  notifyDialog.index = 0
  notifyDialog.doneCount = 0
  notifyDialog.current = selected[0]
  notifyDialog.message = buildMessage(selected[0])
  notifyDialog.visible = true
}

function advanceNotify() {
  const next = notifyDialog.index + 1
  if (next >= notifyDialog.queue.length) {
    notifyDialog.visible = false
    ElMessage.success(`แจ้งเตือนผู้ปกครองครบ ${notifyDialog.doneCount} คนแล้ว`)
    return
  }
  notifyDialog.index = next
  notifyDialog.current = notifyDialog.queue[next]
  notifyDialog.message = buildMessage(notifyDialog.current)
}

function notifyDone() { notifyDialog.doneCount++; advanceNotify() }
function notifySkip()  { advanceNotify() }

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(notifyDialog.message)
    ElMessage.success('คัดลอกข้อความแล้ว')
  } catch {
    ElMessage.warning('ไม่สามารถคัดลอกได้ กรุณาคัดลอกด้วยตนเอง')
  }
}

function openLine(lineId, msg) {
  const encoded = encodeURIComponent(msg)
  window.open(`https://line.me/R/oaMessage/?${encoded}`, '_blank')
}

function openTelegram(handle, msg) {
  const username = handle.replace(/^@/, '')
  window.open(`https://t.me/${username}?text=${encodeURIComponent(msg)}`, '_blank')
}

function mailtoLink(email, stu) {
  const subject = encodeURIComponent(`แจ้งเตือนการมาเรียน: ${stu.prefix}${stu.name} ${stu.surname}`)
  const body = encodeURIComponent(notifyDialog.message)
  return `mailto:${email}?subject=${subject}&body=${body}`
}

// ─── Load ─────────────────────────────────────────────────────
async function findHomeroomClass() {
  const teacherId = authStore.profile?.teacher_id
  if (!teacherId) return null
  const { data } = await supabase
    .from('classes')
    .select('class_name')
    .eq('school_id', authStore.schoolId)
    .filter('homeroom_teacher_ids', 'cs', `{"${teacherId}"}`)
    .limit(1)
    .maybeSingle()
  return data?.class_name || null
}

async function loadData() {
  if (!homeroomClass.value) return
  loading.value = true
  try {
    const { start, end } = getDateRange(period.value)
    const schoolId = authStore.schoolId
    const termId   = schoolStore.currentTerm || '2568_1'

    const [stuRes, actRes] = await Promise.all([
      supabase
        .from('students')
        .select('student_code, prefix, first_name, last_name, seat_number, status, guardian_primary, guardian_secondary, parent_name, parent_phone')
        .eq('school_id', schoolId)
        .eq('class_id', homeroomClass.value)
        .order('seat_number'),
      supabase
        .from('teach_actuals')
        .select('date, period_number, slot_type, is_filled, student_records')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .eq('class_id', homeroomClass.value)
        .eq('is_filled', true)
        .gte('date', start)
        .lte('date', end)
        .order('date'),
    ])

    if (stuRes.error) throw stuRes.error
    if (actRes.error) throw actRes.error

    students.value = (stuRes.data || [])
      .filter(s => !s.status || s.status === 'เรียนอยู่')
      .map(s => ({
        student_id:        s.student_code,
        prefix:            s.prefix || '',
        name:              s.first_name || '',
        surname:           s.last_name || '',
        seat_number:       s.seat_number,
        guardian_primary:  s.guardian_primary || null,
        guardian_secondary: s.guardian_secondary || null,
        parent_name:       s.parent_name || '',
        parent_phone:      s.parent_phone || '',
      }))
    actuals.value = actRes.data || []
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    // โหลด school settings (homeroom periods + watchlist settings)
    const { data: schoolRow } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', authStore.schoolId)
      .maybeSingle()
    const tl = schoolRow?.settings?.teaching_log_settings || {}
    homeroomPeriods.value = Array.isArray(tl.homeroom_special_periods) ? tl.homeroom_special_periods : []
    const ws = tl.watchlist_settings || {}
    wSettings.absent_streak   = Number(ws.absent_streak ?? 3)
    wSettings.late_streak     = Number(ws.late_streak ?? 3)
    wSettings.skip_count      = Number(ws.skip_count ?? 5)
    wSettings.attendance_pct  = Number(ws.attendance_pct ?? 80)

    // ชื่อครู
    const p = authStore.profile
    const teacherCode = p?.teacher_id || p?.teacherId
    if (teacherCode) {
      const { data: tRow } = await supabase
        .from('teachers')
        .select('prefix, name, surname')
        .eq('school_id', authStore.schoolId)
        .eq('teacher_code', teacherCode)
        .maybeSingle()
      if (tRow) myName.value = `${tRow.prefix || ''}${tRow.name || ''} ${tRow.surname || ''}`.trim()
    }
    if (!myName.value) myName.value = p?.displayName || p?.display_name || ''

    const cls = await findHomeroomClass()
    if (!cls) { ElMessage.warning('ไม่พบห้องประจำชั้นของคุณ'); loading.value = false; return }
    homeroomClass.value = cls
    await loadData()
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
    loading.value = false
  }
})
</script>

<style scoped>
.hd-page {
  padding: 20px 24px 40px;
  max-width: 1300px;
  margin: 0 auto;
}

/* Header */
.hd-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%);
  border-radius: 18px; padding: 20px 24px; margin-bottom: 20px;
  box-shadow: 0 6px 24px rgba(30,58,95,0.25);
}
.hd-header-left  { display: flex; align-items: center; gap: 16px; }
.hd-header-right { display: flex; gap: 8px; align-items: center; }
.hd-class-badge {
  background: rgba(255,255,255,0.2); color: white;
  font-size: 28px; font-weight: 900;
  padding: 10px 18px; border-radius: 14px;
  border: 2px solid rgba(255,255,255,0.3); white-space: nowrap;
}
.hd-title { font-size: 20px; font-weight: 800; color: white; }
.hd-sub   { font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 3px; }

/* Period tabs */
.hd-period-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.hd-period-btn {
  padding: 7px 18px; border-radius: 99px; font-size: 13px; font-weight: 600;
  border: 2px solid #e2e8f0; background: white; color: #64748b; cursor: pointer;
  transition: all 0.15s;
}
.hd-period-btn:hover { border-color: #0f766e; color: #0f766e; }
.hd-period-btn--active {
  background: linear-gradient(135deg,#1e3a5f,#0f766e); color: white;
  border-color: transparent; box-shadow: 0 3px 10px rgba(15,118,110,0.35);
}

/* Summary cards */
.hd-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
@media (max-width: 900px) { .hd-cards { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 600px) { .hd-cards { grid-template-columns: repeat(2,1fr); } }

.hd-card { border-radius: 14px; padding: 16px; text-align: center; border: 2px solid transparent; }
.hd-card--green  { background: #dcfce7; border-color: #86efac; }
.hd-card--red    { background: #fee2e2; border-color: #fca5a5; }
.hd-card--orange { background: #ffedd5; border-color: #fdba74; }
.hd-card--yellow { background: #fef9c3; border-color: #fde047; }
.hd-card--purple { background: #ede9fe; border-color: #c4b5fd; }

.hd-card-num { font-size: 28px; font-weight: 900; line-height: 1.1; }
.hd-card-lbl { font-size: 11px; font-weight: 600; margin-top: 4px; color: #475569; }
.hd-card--green  .hd-card-num { color: #15803d; }
.hd-card--red    .hd-card-num { color: #dc2626; }
.hd-card--orange .hd-card-num { color: #c2410c; }
.hd-card--yellow .hd-card-num { color: #854d0e; }
.hd-card--purple .hd-card-num { color: #6d28d9; }

/* Watch list */
.hd-watchlist {
  background: #fff7ed; border: 2px solid #fed7aa;
  border-radius: 14px; padding: 14px 18px;
}
.hd-section-title { font-size: 13px; font-weight: 800; color: #1e3a5f; }
.hd-watch-table :deep(.el-table) { border-radius: 10px; overflow: hidden; }

/* Main table */
.hd-table-wrap {
  background: white; border-radius: 14px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

/* Notify dialog */
.notify-body { font-size: 13px; }
.notify-student-header {
  background: linear-gradient(135deg,#1e3a5f,#0f766e);
  border-radius: 12px; padding: 12px 16px;
}
.notify-student-name { font-size: 17px; font-weight: 800; color: white; }
.notify-guardian { padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.notify-guardian-label { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 6px; }
.notify-contact-btns { display: flex; flex-wrap: wrap; gap: 6px; }
.notify-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
  border: none; cursor: pointer; text-decoration: none; transition: opacity 0.15s;
}
.notify-btn:hover { opacity: 0.85; }
.notify-btn--phone    { background: #dcfce7; color: #15803d; }
.notify-btn--line     { background: #bbf7d0; color: #065f46; }
.notify-btn--email    { background: #dbeafe; color: #1e40af; }
.notify-btn--telegram { background: #e0f2fe; color: #0369a1; }
</style>
