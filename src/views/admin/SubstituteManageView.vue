<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">

      <!-- Header -->
      <div class="sm-hero mb-6">
        <div class="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">🔄 จัดสอนแทน</h1>
            <p class="text-white/80 text-sm mt-1">
              ภาคเรียน {{ term }}
              <span v-if="isSubjectHead && !isCoordinator"> — กลุ่มสาระ {{ myDept }}</span>
              <span v-else> — ทุกกลุ่มสาระ</span>
              <span class="ml-2 text-xs opacity-75">● อัปเดตแบบเรียลไทม์</span>
            </p>
          </div>
          <el-button plain @click="loadAll"
            style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white">
            🔄 รีเฟรช
          </el-button>
        </div>
      </div>

      <!-- Date picker -->
      <div class="flex items-center gap-3 mb-5 flex-wrap">
        <div class="text-sm font-semibold text-gray-600">📅 เลือกวัน:</div>
        <el-date-picker
          v-model="selectedDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="DD/MM/YYYY (ddd)"
          placeholder="เลือกวันที่"
          style="width:220px"
          clearable
        />
        <el-button size="small" @click="selectedDate = todayStr" type="primary" plain>วันนี้</el-button>
        <el-tag v-if="selectedDate === todayStr" type="success" effect="dark" size="small">● วันนี้</el-tag>
        <span class="text-sm text-gray-400 ml-2">{{ dateFilteredRequests.length }} คำขอลา</span>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#fef9c3,#fde68a)">
          <div class="stat-value" style="color:#b45309">{{ pendingCount }}</div>
          <div class="stat-label">คาบรอจัดสอนแทน</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ assignedCount }}</div>
          <div class="stat-label">จัดแล้ว</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="stat-value" style="color:#1d4ed8">{{ dateFilteredRequests.length }}</div>
          <div class="stat-label">คำขอลา</div>
        </div>
      </div>

      <!-- No requests -->
      <div v-if="dateFilteredRequests.length === 0" class="text-center py-16 text-gray-400">
        <div class="text-5xl mb-4">✅</div>
        <div class="text-lg">ไม่มีคำขอลาสำหรับวันที่เลือก</div>
        <div v-if="selectedDate" class="text-sm mt-2">{{ formatDate(selectedDate) }}</div>
      </div>

      <!-- Request cards -->
      <el-card v-for="req in dateFilteredRequests" :key="req.leave_id" class="mb-5 shadow-sm">

        <!-- Request header -->
        <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="font-bold text-gray-800 text-base">👤 {{ req.teacher_name }}</div>
            <el-tag v-if="req.teacher_dept || teacherMap[req.teacher_id]?.dept" type="info" size="small">
              {{ teacherMap[req.teacher_id]?.dept || req.teacher_dept }}
            </el-tag>
            <el-tag :type="leaveTypeColor(req.leave_type)" size="small">{{ leaveTypeLabel(req.leave_type) }}</el-tag>
            <el-tag :type="reqStatusColor(req)" size="small">{{ reqStatusLabel(req) }}</el-tag>
          </div>
          <div class="text-sm text-gray-400">ยื่นเมื่อ {{ formatTs(req.created_at) }}</div>
        </div>
        <div class="text-sm text-gray-600 mb-3">
          📅 วันที่ลา: {{ req.dates?.map(d => formatDate(d)).join(' · ') }}
          <span v-if="req.note" class="ml-3 text-gray-400">| {{ req.note }}</span>
        </div>

        <!-- Assignments for selected date -->
        <div v-if="Object.keys(assignmentsForDate(req)).length">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-indigo-50 text-indigo-700 text-xs">
                <th class="px-3 py-2 text-center border border-indigo-100 w-14">คาบ</th>
                <th class="px-3 py-2 text-left border border-indigo-100">วิชา</th>
                <th class="px-3 py-2 text-center border border-indigo-100 w-20">ห้อง</th>
                <th class="px-3 py-2 text-left border border-indigo-100" style="min-width:300px">ครูสอนแทน</th>
                <th class="px-3 py-2 text-center border border-indigo-100 w-20">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, key) in assignmentsForDate(req)" :key="key"
                :class="a.status==='assigned'?'bg-green-50':'bg-yellow-50'">
                <td class="px-3 py-2 text-center border border-gray-100 font-bold text-indigo-700">
                  {{ a.period_no }}
                </td>
                <td class="px-3 py-2 border border-gray-100 text-gray-800">{{ a.subject_name }}</td>
                <td class="px-3 py-2 text-center border border-gray-100 text-gray-600">{{ a.class_name }}</td>
                <td class="px-3 py-2 border border-gray-100">
                  <!-- Already assigned -->
                  <div v-if="a.status === 'assigned'" class="flex items-center gap-2">
                    <span class="text-green-700 font-medium">✅ {{ a.sub_teacher_name }}</span>
                    <span class="text-xs text-gray-400">{{ teacherMap[a.sub_teacher_id]?.dept }}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                      📚 {{ subPeriodCount(a.sub_teacher_id, a.date) }} คาบ/วัน
                    </span>
                  </div>
                  <!-- Picker -->
                  <el-select v-else
                    v-model="picked[req.leave_id + '_' + key]"
                    placeholder="เลือกครูสอนแทน..."
                    filterable size="small" style="width:100%"
                    :loading="!timetableLoaded">
                    <el-option-group
                      v-if="candidatesFor(req, a, 'same_free').length"
                      label="✅ กลุ่มสาระเดียวกัน — ว่างคาบนี้">
                      <el-option
                        v-for="t in candidatesFor(req, a, 'same_free')" :key="t.teacher_id"
                        :value="t.teacher_id" :label="t.fullName">
                        <TeacherOption :t="t" />
                      </el-option>
                    </el-option-group>
                    <el-option-group
                      v-if="(isCoordinator || isAdmin) && candidatesFor(req, a, 'other_free').length"
                      label="🔵 กลุ่มสาระอื่น — ว่างคาบนี้">
                      <el-option
                        v-for="t in candidatesFor(req, a, 'other_free')" :key="t.teacher_id"
                        :value="t.teacher_id" :label="t.fullName">
                        <TeacherOption :t="t" />
                      </el-option>
                    </el-option-group>
                    <el-option
                      v-if="!candidatesFor(req, a, 'same_free').length &&
                            !((isCoordinator || isAdmin) && candidatesFor(req, a, 'other_free').length)"
                      value="" label="— ไม่มีครูว่างในคาบนี้ —" disabled />
                  </el-select>
                </td>
                <td class="px-3 py-2 text-center border border-gray-100">
                  <el-button v-if="a.status !== 'assigned'" type="primary" size="small"
                    :disabled="!picked[req.leave_id + '_' + key]"
                    :loading="assigning[req.leave_id + '_' + key]"
                    @click="doAssign(req, key, a)">จัด</el-button>
                  <el-button v-else size="small" type="warning" plain
                    :loading="assigning[req.leave_id + '_' + key]"
                    @click="doUnassign(req, key, a)">เปลี่ยน</el-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-sm text-gray-400 py-2 text-center">ไม่มีคาบสอนในวันที่เลือก</div>
      </el-card>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, defineComponent, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { useSchoolDb } from '@/composables/useSchoolDb'

// ── Rich teacher option ───────────────────────────────────────────
const TeacherOption = defineComponent({
  props: { t: Object },
  setup(props) {
    return () => h('div', { style: 'display:flex;align-items:center;gap:8px;padding:1px 0;min-width:0' }, [
      h('span', { style: 'font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, props.t.fullName),
      h('span', { style: 'font-size:10px;padding:1px 7px;border-radius:99px;font-weight:700;background:#dcfce7;color:#166534;white-space:nowrap;flex-shrink:0' }, '● ว่าง'),
      h('span', { style: 'font-size:11px;color:#6b7280;white-space:nowrap;flex-shrink:0' },
        props.t.periodCountDay > 0 ? `📚 ${props.t.periodCountDay} คาบ` : '📚 ว่างทั้งวัน'),
    ])
  },
})

// ─────────────────────────────────────────────────────────────────
const schoolStore = useSchoolStore()
const authStore   = useAuthStore()
const {
  getTeachers, getTimetable,
  assignSubstituteTeacher, unassignSubstituteTeacher,
  subscribeLeaveRequests, getThaiDayFromDate,
} = useSchoolDb()

const term          = computed(() => schoolStore.currentTerm || '2568_1')
const isAdmin       = computed(() => authStore.isAdmin)
const isCoordinator = computed(() => authStore.hasAnyRole(['sub_coordinator']))
const isSubjectHead = computed(() => authStore.hasAnyRole(['subject_head']))

const todayStr = new Date().toISOString().slice(0, 10)

const loading         = ref(false)
const timetableLoaded = ref(false)
const requests        = ref([])
const teachers        = ref([])
const timetable       = ref([])
const picked          = reactive({})
const assigning       = reactive({})
const selectedDate    = ref(todayStr)

let unsubscribeSnapshot = null

const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

const myDept = computed(() => {
  const tid = authStore.profile?.teacher_id || ''
  const t   = teachers.value.find(t => (t.teacher_id || t.id) === tid)
  return t?.dept || ''
})

const teacherMap = computed(() => {
  const m = {}
  teachers.value.forEach(t => { m[t.teacher_id || t.id] = t })
  return m
})

// จำนวนคาบในวันนั้น รวมคาบสอนแทนที่รับไปแล้ว
function subPeriodCount(tid, dateStr) {
  if (!tid || !dateStr) return 0
  const thaiDay = getThaiDayFromDate(dateStr)
  const timetablePeriods = timetable.value.filter(s => {
    const sDay = s.day
    const dayMatch = sDay === thaiDay || String(sDay) === String(
      ['','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'].indexOf(thaiDay)
    )
    return dayMatch && (s.teacher_id === tid || s.teacher_id_snapshot === tid) && s.type !== 'activity'
  }).map(s => Number(s.period))

  const subPeriods = []
  requests.value.forEach(r => {
    Object.values(r.assignments || {}).forEach(a => {
      if (a.date === dateStr && a.status === 'assigned' && a.sub_teacher_id === tid) {
        subPeriods.push(Number(a.period_no))
      }
    })
  })
  return new Set([...timetablePeriods, ...subPeriods]).size
}

// Enrich candidates: รวมคาบสอนแทนที่รับไปแล้วในวันนั้น
function enrichedCandidates(absentTeacherId, dateStr, periodNo) {
  const thaiDay = getThaiDayFromDate(dateStr)

  // คาบสอนแทนที่ assign แล้วในวันนั้น (จาก requests ปัจจุบัน)
  const subPeriodsMap = {}
  requests.value.forEach(r => {
    Object.values(r.assignments || {}).forEach(a => {
      if (a.date === dateStr && a.status === 'assigned' && a.sub_teacher_id) {
        if (!subPeriodsMap[a.sub_teacher_id]) subPeriodsMap[a.sub_teacher_id] = new Set()
        subPeriodsMap[a.sub_teacher_id].add(Number(a.period_no))
      }
    })
  })

  return teachers.value
    .filter(t => (t.teacher_id || t.id) !== absentTeacherId)
    .map(t => {
      const tid = t.teacher_id || t.id
      const daySlots = timetable.value.filter(s => {
        const sDay = s.day
        const dayMatch = sDay === thaiDay || String(sDay) === String(
          ['','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'].indexOf(thaiDay)
        )
        return dayMatch && (s.teacher_id === tid || s.teacher_id_snapshot === tid) && s.type !== 'activity'
      })
      const timetablePeriods = daySlots.map(s => Number(s.period))
      const subPeriods = [...(subPeriodsMap[tid] || [])]
      const allBusy = [...new Set([...timetablePeriods, ...subPeriods])].sort((a,b) => a-b)
      const isFree  = !allBusy.includes(Number(periodNo))
      return {
        ...t,
        teacher_id:     tid,
        fullName:       `${t.prefix||''}${t.name||''} ${t.surname||''}`.trim() || tid,
        dept:           t.dept || '',
        periodCountDay: allBusy.length,
        busyPeriods:    allBusy,
        isFree,
      }
    })
}

function candidatesFor(req, slot, group) {
  const absent     = teacherMap.value[req.teacher_id]
  const absentDept = absent?.dept || req.teacher_dept || ''
  const all = enrichedCandidates(req.teacher_id, slot.date, slot.period_no)
  return all
    .filter(t => {
      const sameDept = t.dept && absentDept && t.dept === absentDept
      if (group === 'same_free')  return sameDept  &&  t.isFree
      if (group === 'same_busy')  return sameDept  && !t.isFree
      if (group === 'other_free') return !sameDept &&  t.isFree
      if (group === 'other_busy') return !sameDept && !t.isFree
      return true
    })
    .sort((a,b) => a.periodCountDay - b.periodCountDay || a.fullName.localeCompare(b.fullName))
}

const visibleRequests = computed(() => {
  if (isAdmin.value || isCoordinator.value) return requests.value
  if (isSubjectHead.value && myDept.value) {
    return requests.value.filter(r => {
      const t = teacherMap.value[r.teacher_id]
      return (t?.dept || r.teacher_dept) === myDept.value
    })
  }
  return requests.value
})

const dateFilteredRequests = computed(() => {
  if (!selectedDate.value) return visibleRequests.value
  return visibleRequests.value.filter(r =>
    Object.values(r.assignments || {}).some(a => a.date === selectedDate.value)
  )
})

function assignmentsForDate(req) {
  const entries = Object.entries(req.assignments || {})
  const filtered = selectedDate.value
    ? entries.filter(([, a]) => a.date === selectedDate.value)
    : entries
  return Object.fromEntries(
    filtered.sort(([, a], [, b]) => (a.period_no || 0) - (b.period_no || 0))
  )
}

const pendingCount = computed(() => {
  let n = 0
  dateFilteredRequests.value.forEach(r =>
    Object.values(assignmentsForDate(r)).forEach(a => { if (a.status !== 'assigned') n++ })
  )
  return n
})
const assignedCount = computed(() => {
  let n = 0
  dateFilteredRequests.value.forEach(r =>
    Object.values(assignmentsForDate(r)).forEach(a => { if (a.status === 'assigned') n++ })
  )
  return n
})

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('th-TH', { day:'numeric', month:'short' }) + ` (${THAI_DAYS[dt.getDay()]})`
}
function formatTs(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })
}
function leaveTypeLabel(t) { return { sick:'ลาป่วย', personal:'ลากิจ', official:'ไปราชการ', training:'อบรม' }[t] || t }
function leaveTypeColor(t) { return { sick:'danger', personal:'warning', official:'info', training:'success' }[t] || '' }
function reqStatusLabel(req) {
  const all = Object.values(req.assignments || {})
  if (!all.length) return 'ไม่มีคาบ'
  const done = all.filter(a => a.status === 'assigned').length
  if (done === 0)          return 'รอจัดสอนแทน'
  if (done === all.length) return 'จัดครบแล้ว'
  return `จัดแล้ว ${done}/${all.length}`
}
function reqStatusColor(req) {
  const all = Object.values(req.assignments || {})
  if (!all.length) return 'info'
  const done = all.filter(a => a.status === 'assigned').length
  if (done === 0)          return 'warning'
  if (done === all.length) return 'success'
  return 'info'
}

// ── Realtime listener (ใช้ subscribeLeaveRequests จาก useSchoolDb — same db()/term() กับ write) ──
function setupSnapshot() {
  if (unsubscribeSnapshot) unsubscribeSnapshot()
  unsubscribeSnapshot = subscribeLeaveRequests(
    docs => {
      requests.value = docs
        .filter(r => r.status !== 'cancelled')
        .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
    },
    err => ElMessage.error('ข้อผิดพลาด realtime: ' + err.message)
  )
}

onUnmounted(() => { if (unsubscribeSnapshot) unsubscribeSnapshot() })

// ── Actions ───────────────────────────────────────────────────────
async function doAssign(req, key, slot) {
  const tid = picked[req.leave_id + '_' + key]
  if (!tid) return
  const teacher = teacherMap.value[tid]
  if (!teacher) {
    ElMessage.error('ไม่พบข้อมูลครูที่เลือก กรุณารีเฟรชข้อมูลแล้วลองใหม่')
    return
  }
  assigning[req.leave_id + '_' + key] = true
  try {
    const fullName = `${teacher.prefix||''}${teacher.name||''} ${teacher.surname||''}`.trim() || tid
    await assignSubstituteTeacher(
      req.leave_id, key, slot,
      { teacher_id: tid, teacher_name: fullName },
      { teacher_id: req.teacher_id, teacher_name: req.teacher_name }
    )
    delete picked[req.leave_id + '_' + key]
    ElMessage.success(`จัด ${fullName} สอนแทนแล้ว`)
    // Optimistic local update — immediate feedback; onSnapshot will reconcile from Firestore
    const idx = requests.value.findIndex(r => r.leave_id === req.leave_id)
    if (idx !== -1) {
      const updatedAssignments = { ...requests.value[idx].assignments }
      updatedAssignments[key] = {
        ...updatedAssignments[key],
        sub_teacher_id: tid,
        sub_teacher_name: fullName,
        assigned_by: authStore.profile?.uid || '',
        assigned_by_name: authStore.profile?.displayName || '',
        status: 'assigned',
      }
      requests.value[idx] = { ...requests.value[idx], assignments: updatedAssignments }
    }
  } catch (e) {
    console.error('[doAssign]', e)
    ElMessage.error('บันทึกไม่สำเร็จ: ' + (e?.message || String(e)))
  } finally {
    assigning[req.leave_id + '_' + key] = false
  }
}

async function doUnassign(req, key, slot) {
  try {
    await ElMessageBox.confirm('ยืนยันยกเลิกการมอบหมายนี้?', 'ยืนยัน',
      { type:'warning', confirmButtonText:'ยืนยัน', cancelButtonText:'ย้อนกลับ' })
    assigning[req.leave_id + '_' + key] = true
    await unassignSubstituteTeacher(req.leave_id, key, slot.teach_actual_id)
    ElMessage.success('ยกเลิกการมอบหมายแล้ว')
  } catch {} finally {
    assigning[req.leave_id + '_' + key] = false
  }
}

async function loadAll() {
  loading.value = true
  timetableLoaded.value = false
  try {
    // โหลดครูก่อน แล้ว setup realtime subscription ทันที (ไม่รอ timetable)
    teachers.value = await getTeachers()
    setupSnapshot()
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
  // โหลด timetable ใน background — ไม่บล็อก UI
  getTimetable()
    .then(tt => { timetable.value = Array.isArray(tt) ? tt : []; timetableLoaded.value = true })
    .catch(() => { timetableLoaded.value = true })
}

onMounted(loadAll)
</script>

<style scoped>
.sm-hero {
  padding:24px; border-radius:18px; color:#fff;
  background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 50%,#0891b2 100%);
  box-shadow:0 14px 32px rgba(79,70,229,0.25);
}
.stat-card  { border-radius:12px; padding:20px 24px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
.stat-value { font-size:2rem; font-weight:800; line-height:1; }
.stat-label { font-size:.85rem; color:#6b7280; margin-top:4px; }
</style>
