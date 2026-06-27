<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">

      <!-- Header -->
      <div class="lr-hero mb-6">
        <div class="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">
              {{ isAdmin ? '📋 จัดการการลาครู' : '📋 ยื่นคำขอลา' }}
            </h1>
            <p class="text-white/80 text-sm mt-1">
              {{ termLabel }}
              <span v-if="isAdmin"> — ดูและจัดการคำขอลาของครูทุกคน</span>
              <span v-else> — ระบบจะจัดครูสอนแทนอัตโนมัติ</span>
            </p>
          </div>
          <!-- ปุ่มยื่นลา: เฉพาะครู -->
          <el-button v-if="!isAdmin" @click="showForm = !showForm"
            style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
            {{ showForm ? '✕ ยกเลิก' : '+ ยื่นคำขอลาใหม่' }}
          </el-button>
        </div>
      </div>

      <!-- ─── FORM: เฉพาะครู ─────────────────────────────────────────── -->
      <el-card v-if="!isAdmin && showForm" class="mb-6 shadow-md" body-style="padding:24px">
        <div class="text-base font-bold text-gray-700 mb-4">📝 รายละเอียดการลา</div>

        <el-form :model="form" label-width="120px" class="max-w-2xl">
          <el-form-item label="ประเภทการลา" required>
            <el-radio-group v-model="form.leave_type">
              <el-radio-button value="sick">ลาป่วย</el-radio-button>
              <el-radio-button value="personal">ลากิจ</el-radio-button>
              <el-radio-button value="official">ไปราชการ</el-radio-button>
              <el-radio-button value="training">อบรม</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="วันที่ลา" required>
            <el-date-picker
              v-model="form.dates"
              type="dates"
              placeholder="เลือกวันที่ (วันนี้หรือล่วงหน้าเท่านั้น)"
              style="width:100%"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              :disabled-date="disablePastDates"
              @change="onDatesChange"
            />
            <div class="text-xs text-amber-600 mt-1">⚠️ เลือกได้เฉพาะวันนี้หรือวันในอนาคต</div>
          </el-form-item>

          <el-form-item label="หมายเหตุ">
            <el-input v-model="form.note" type="textarea" :rows="2" placeholder="เหตุผลการลา..." />
          </el-form-item>
        </el-form>

        <!-- Affected periods preview -->
        <div v-if="affectedSlots.length" class="mt-4">
          <div class="text-sm font-semibold text-gray-600 mb-3">
            📚 คาบสอนที่กระทบ ({{ affectedSlots.length }} คาบ) — ต้องจัดสอนแทน
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-indigo-600 text-white">
                  <th class="px-3 py-2 text-center">วันที่</th>
                  <th class="px-3 py-2 text-center">คาบ</th>
                  <th class="px-3 py-2 text-left">วิชา</th>
                  <th class="px-3 py-2 text-center">ห้อง</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in affectedSlots" :key="i"
                  class="border-b hover:bg-indigo-50" :class="i%2===0?'bg-white':'bg-gray-50'">
                  <td class="px-3 py-2 text-center text-gray-600">{{ formatDate(s.date) }}</td>
                  <td class="px-3 py-2 text-center font-bold text-indigo-700">{{ s.period }}</td>
                  <td class="px-3 py-2 text-gray-800">{{ s.subject_name || s.subject_name_snapshot }}</td>
                  <td class="px-3 py-2 text-center text-gray-600">{{ s.class_name || s.class_id }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="noSlotDates.length" class="mt-2 text-xs text-amber-600">
            ⚠️ วันที่ไม่มีคาบสอน: {{ noSlotDates.join(', ') }}
          </div>
        </div>
        <div v-else-if="form.dates?.length && !loadingSlots" class="mt-3 text-sm text-gray-400">
          ไม่พบคาบสอนในวันที่เลือก
        </div>

        <div class="mt-5 flex gap-3">
          <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="submitLeave">
            ยื่นคำขอลา
          </el-button>
          <el-button @click="resetForm">ล้างข้อมูล</el-button>
        </div>
      </el-card>

      <!-- ─── ADMIN FILTERS ──────────────────────────────────────────────── -->
      <div v-if="isAdmin" class="flex gap-3 mb-4 flex-wrap">
        <el-input v-model="adminSearch" placeholder="ค้นหาชื่อครู..." clearable style="width:220px">
          <template #prefix>🔍</template>
        </el-input>
        <el-select v-model="adminFilterType" placeholder="ทุกประเภท" clearable style="width:150px">
          <el-option label="ลาป่วย" value="sick" />
          <el-option label="ลากิจ" value="personal" />
          <el-option label="ไปราชการ" value="official" />
          <el-option label="อบรม" value="training" />
        </el-select>
        <el-select v-model="adminFilterStatus" placeholder="ทุกสถานะ" clearable style="width:160px">
          <el-option label="รอจัดสอนแทน" value="pending" />
          <el-option label="จัดครบแล้ว" value="fully_assigned" />
        </el-select>
      </div>

      <!-- ─── SUMMARY: เฉพาะครู ──────────────────────────────────────────── -->
      <div v-if="!isAdmin && leaveSummary.total > 0" class="mb-5">
        <div class="text-sm font-semibold text-gray-600 mb-2">📊 สรุปวันลาภาคเรียนนี้</div>
        <div class="flex gap-3 flex-wrap">
          <div class="summary-chip" style="background:#fee2e2;color:#b91c1c">
            ลาป่วย {{ leaveSummary.sick || 0 }} วัน
          </div>
          <div class="summary-chip" style="background:#fef3c7;color:#b45309">
            ลากิจ {{ leaveSummary.personal || 0 }} วัน
          </div>
          <div class="summary-chip" style="background:#dbeafe;color:#1d4ed8">
            ราชการ {{ leaveSummary.official || 0 }} วัน
          </div>
          <div class="summary-chip" style="background:#dcfce7;color:#166534">
            อบรม {{ leaveSummary.training || 0 }} วัน
          </div>
          <div class="summary-chip" style="background:#f3f4f6;color:#374151;font-weight:700">
            รวม {{ leaveSummary.total }} วัน
          </div>
        </div>
      </div>

      <!-- ─── HISTORY / MANAGE LIST ──────────────────────────────────────── -->
      <div class="font-semibold text-gray-700 mb-3">
        {{ isAdmin ? '📋 รายการคำขอลาทั้งหมด' : '📜 ประวัติการลา' }}
        <span class="text-sm text-gray-400 font-normal ml-2">({{ displayedRequests.length }} รายการ)</span>
      </div>

      <div v-if="displayedRequests.length === 0" class="text-center py-12 text-gray-400">
        <div class="text-4xl mb-3">📭</div>
        ไม่พบรายการคำขอลา
      </div>

      <div v-else class="space-y-4">
        <el-card v-for="req in displayedRequests" :key="req.leave_id"
          class="shadow-sm leave-card">

          <!-- Card header -->
          <div class="flex justify-between items-start flex-wrap gap-2 mb-3">
            <div class="flex items-center gap-2 flex-wrap">
              <span v-if="isAdmin" class="font-bold text-gray-800">👤 {{ req.teacher_name }}</span>
              <el-tag :type="leaveTypeColor(req.leave_type)" size="small">{{ leaveTypeLabel(req.leave_type) }}</el-tag>
              <el-tag :type="overallStatusColor(req)" size="small">{{ overallStatusLabel(req) }}</el-tag>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">ยื่น {{ formatTs(req.created_at) }}</span>
              <el-button
                v-if="canCancel(req)"
                size="small" type="danger" plain
                @click="cancelRequest(req)">
                🗑️ ลบ
              </el-button>
            </div>
          </div>

          <!-- Dates summary -->
          <div class="text-sm text-gray-600 mb-3">
            📅 {{ req.dates?.map(d => formatDate(d)).join(' · ') }}
            <span v-if="req.note" class="ml-3 text-gray-400 italic">| {{ req.note }}</span>
          </div>

          <!-- Per-date assignment details -->
          <div v-if="assignmentsByDate(req).length" class="space-y-3">
            <div v-for="group in assignmentsByDate(req)" :key="group.date"
              class="date-group rounded-lg border border-gray-100 overflow-hidden">
              <!-- Date header -->
              <div class="date-group-header px-3 py-1.5 flex items-center justify-between">
                <span class="text-sm font-semibold text-indigo-700">📅 {{ formatDate(group.date) }}</span>
                <span class="text-xs text-gray-500">{{ group.items.length }} คาบ</span>
              </div>
              <!-- Period rows -->
              <table class="w-full text-xs">
                <tbody>
                  <tr v-for="a in group.items" :key="a.key"
                    class="border-t border-gray-100"
                    :class="a.status === 'assigned' ? 'bg-green-50' : 'bg-yellow-50'">
                    <td class="px-3 py-2 text-center w-12 font-bold text-indigo-600">
                      คาบ {{ a.period_no }}
                    </td>
                    <td class="px-3 py-2 text-gray-700">{{ a.subject_name }}</td>
                    <td class="px-3 py-2 text-center text-gray-500 w-16">{{ a.class_name }}</td>
                    <td class="px-3 py-2 w-44">
                      <span v-if="a.status === 'assigned'" class="text-green-700 font-medium">
                        ✅ {{ a.sub_teacher_name }}
                      </span>
                      <span v-else class="text-amber-600">⏳ รอจัดสอนแทน</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="text-xs text-gray-400 mt-2">ไม่มีคาบสอนที่กระทบ</div>
        </el-card>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { useSchoolDb } from '@/composables/useSchoolDb'

const schoolStore = useSchoolStore()
const authStore   = useAuthStore()
const {
  getTimetable, filterSlotsForTeacherOnDate,
  createLeaveRequest, getLeaveRequests, cancelLeaveRequest,
} = useSchoolDb()

const term        = computed(() => schoolStore.currentTerm || '2568_1')
const termLabel   = computed(() => schoolStore.termLabel || term.value)
const teacherId   = computed(() => authStore.profile?.teacher_id || authStore.profile?.uid || '')
const teacherName = computed(() => authStore.profile?.displayName || authStore.profile?.email || '')
const isAdmin     = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))

const todayStr = new Date().toISOString().slice(0, 10)

const loading      = ref(false)
const submitting   = ref(false)
const loadingSlots = ref(false)
const showForm     = ref(false)
const allRequests  = ref([])   // all requests (admin) or own (teacher)
const timetable    = ref([])
const affectedSlots = ref([])
const noSlotDates   = ref([])

// Admin filters
const adminSearch       = ref('')
const adminFilterType   = ref('')
const adminFilterStatus = ref('')

const form = reactive({ leave_type: 'sick', dates: [], note: '' })

const canSubmit = computed(() =>
  form.dates?.length > 0 && affectedSlots.value.length > 0
)

// Disable past dates in date picker
function disablePastDates(date) {
  const today = new Date(todayStr + 'T00:00:00')
  return date < today
}

const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' }) +
    ` (${THAI_DAYS[d.getDay()]})`
}
function formatTs(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })
}

function leaveTypeLabel(t) { return { sick:'ลาป่วย', personal:'ลากิจ', official:'ไปราชการ', training:'อบรม' }[t] || t }
function leaveTypeColor(t) { return { sick:'danger', personal:'warning', official:'info', training:'success' }[t] || '' }

function overallStatusLabel(req) {
  if (req.status === 'cancelled') return 'ยกเลิกแล้ว'
  const all  = Object.values(req.assignments || {})
  if (!all.length) return 'ไม่มีคาบ'
  const done = all.filter(a => a.status === 'assigned').length
  if (done === 0)          return 'รอจัดสอนแทน'
  if (done === all.length) return 'จัดครบแล้ว'
  return `จัดแล้ว ${done}/${all.length}`
}
function overallStatusColor(req) {
  if (req.status === 'cancelled') return 'danger'
  const all  = Object.values(req.assignments || {})
  if (!all.length) return 'info'
  const done = all.filter(a => a.status === 'assigned').length
  if (done === 0)          return 'warning'
  if (done === all.length) return 'success'
  return 'info'
}

// Assignments grouped by date within a request
function assignmentsByDate(req) {
  const groups = {}
  Object.entries(req.assignments || {}).forEach(([key, a]) => {
    if (!groups[a.date]) groups[a.date] = []
    groups[a.date].push({ key, ...a })
  })
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (a.period_no || 0) - (b.period_no || 0)),
    }))
}

// Own leave summary
const myRequests = computed(() =>
  allRequests.value.filter(r => r.teacher_id === teacherId.value)
)

const leaveSummary = computed(() => {
  const s = { sick: 0, personal: 0, official: 0, training: 0, total: 0 }
  myRequests.value.filter(r => r.status !== 'cancelled').forEach(r => {
    const days = r.dates?.length || 0
    s[r.leave_type] = (s[r.leave_type] || 0) + days
    s.total += days
  })
  return s
})

// Requests shown in the list
const displayedRequests = computed(() => {
  let list = isAdmin.value ? allRequests.value : myRequests.value
  if (isAdmin.value) {
    if (adminSearch.value) {
      const q = adminSearch.value.toLowerCase()
      list = list.filter(r => (r.teacher_name || '').toLowerCase().includes(q))
    }
    if (adminFilterType.value) list = list.filter(r => r.leave_type === adminFilterType.value)
    if (adminFilterStatus.value === 'pending')
      list = list.filter(r => {
        const all  = Object.values(r.assignments || {})
        return all.some(a => a.status !== 'assigned')
      })
    if (adminFilterStatus.value === 'fully_assigned')
      list = list.filter(r => {
        const all  = Object.values(r.assignments || {})
        return all.length && all.every(a => a.status === 'assigned')
      })
  }
  return list
})

// ลบได้: admin ลบได้ทุกรายการ, ครูลบได้เฉพาะของตัวเอง
// (guard จริงอยู่ใน cancelLeaveRequest — ถ้าบันทึกแล้วจะ throw error)
function canCancel(req) {
  if (isAdmin.value) return true
  return req.teacher_id === teacherId.value
}

async function onDatesChange(dates) {
  if (!dates?.length) { affectedSlots.value = []; noSlotDates.value = []; return }
  loadingSlots.value = true
  try {
    if (!timetable.value.length) {
      timetable.value = await getTimetable()
    }
    const found = []
    const empty = []
    for (const dateStr of dates) {
      const slots = filterSlotsForTeacherOnDate(timetable.value, teacherId.value, dateStr)
      if (slots.length) {
        slots.forEach(s => found.push({ ...s, date: dateStr }))
      } else {
        empty.push(formatDate(dateStr))
      }
    }
    affectedSlots.value = found.sort((a,b) => a.date.localeCompare(b.date) || (a.period||0)-(b.period||0))
    noSlotDates.value   = empty
  } catch (e) {
    ElMessage.error('โหลดตารางสอนไม่สำเร็จ: ' + e.message)
  } finally {
    loadingSlots.value = false
  }
}

function resetForm() {
  Object.assign(form, { leave_type:'sick', dates:[], note:'' })
  affectedSlots.value = []
  noSlotDates.value   = []
}

async function submitLeave() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await createLeaveRequest({
      teacher_id:   teacherId.value,
      teacher_name: teacherName.value,
      leave_type:   form.leave_type,
      dates:        form.dates,
      note:         form.note,
    }, timetable.value)
    ElMessage.success('ยื่นคำขอลาสำเร็จ — รอหัวหน้ากลุ่มสาระ/ผู้ดูแลจัดสอนแทน')
    showForm.value = false
    resetForm()
    await loadRequests()
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    submitting.value = false
  }
}

async function cancelRequest(req) {
  try {
    await ElMessageBox.confirm(
      isAdmin.value
        ? `ลบคำขอลาของ ${req.teacher_name}?`
        : 'ลบคำขอลานี้? (ไม่สามารถกู้คืนได้)',
      'ยืนยันลบ', { type:'warning', confirmButtonText:'ลบ', cancelButtonText:'ย้อนกลับ' }
    )
    await cancelLeaveRequest(req.id)
    ElMessage.success('ลบคำขอลาแล้ว')
    await loadRequests()
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  }
}

async function loadRequests() {
  loading.value = true
  try {
    // admin โหลดทั้งหมด, ครูโหลดของตัวเอง
    allRequests.value = isAdmin.value
      ? await getLeaveRequests()
      : await getLeaveRequests({ teacherId: teacherId.value })
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(loadRequests)
</script>

<style scoped>
.lr-hero {
  padding:24px; border-radius:18px; color:#fff;
  background:linear-gradient(135deg,#0d9488 0%,#0891b2 48%,#1d4ed8 100%);
  box-shadow:0 14px 32px rgba(8,145,178,0.22);
}
.summary-chip {
  padding:4px 12px; border-radius:20px; font-size:13px; font-weight:600;
}
.leave-card { border-radius:12px; }
.date-group-header {
  background: linear-gradient(90deg,#eef2ff,#f5f3ff);
  border-bottom: 1px solid #e0e7ff;
}
</style>
