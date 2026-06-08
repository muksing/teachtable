<template>
  <AppLayout>
    <div class="tl-page">

      <!-- ── Header ─────────────────────────────────────────────── -->
      <div class="tl-header">
        <div>
          <h1 class="tl-title">📝 บันทึกการสอน</h1>
          <p class="tl-sub">เลือกวันที่ → เลือกคาบ → กรอกข้อมูล</p>
        </div>
        <div class="tl-header-meta">
          <span class="tl-term-badge">📅 {{ schoolStore.currentTerm || '-' }}</span>
        </div>
      </div>

      <!-- ── Filter Bar ─────────────────────────────────────────── -->
      <el-card class="mb-5" shadow="never" style="border-radius:14px;border-top:4px solid #ff7a00;box-shadow:0 4px 16px rgba(255,122,0,0.10)">
        <div class="flex flex-wrap gap-4 items-center">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📆 วันที่</div>
            <el-date-picker
              v-model="selectedDate"
              type="date"
              placeholder="เลือกวันที่"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              :disabled-date="isDateDisabled"
              @change="onDateChange"
              style="width:180px"
            />
          </div>
          <div class="flex items-end pb-1">
            <el-tag type="info" size="large" style="font-size:14px;padding:0 14px;height:36px;line-height:34px;background:linear-gradient(135deg,#ff7a00,#ff3d81);color:#fff;border:none;font-weight:700">
              วัน{{ thaiDayName }}
            </el-tag>
          </div>
          <div class="flex items-end pb-1 ml-auto gap-2">
            <el-tooltip content="รีเฟรชข้อมูล" placement="top">
              <el-button :loading="loading" plain size="small" @click="loadData">🔄</el-button>
            </el-tooltip>
            <!-- ปุ่มสอนแทน -->
            <el-button v-if="!subTeacherId" size="small" type="warning" plain @click="openSubDialog">
              👤 สอนแทน
            </el-button>
            <el-tag v-else closable size="large" type="warning" @close="clearSubMode"
              style="cursor:default;font-weight:700">
              👤 สอนแทน: {{ subTeacherName }}
            </el-tag>
          </div>

          <!-- Dialog เลือกครู -->
          <el-dialog v-model="showSubDialog" title="👤 เลือกครูที่สอนแทน" width="360px" align-center>
            <div v-loading="loadingTeachers" class="max-h-80 overflow-y-auto">
              <el-empty v-if="!loadingTeachers && teacherList.length === 0"
                description="ไม่พบข้อมูลครู" :image-size="60" />
              <div
                v-for="t in teacherList" :key="t.teacher_id"
                class="px-4 py-3 cursor-pointer hover:bg-orange-50 border-b flex items-center gap-3"
                @click="selectSubTeacher(t)"
              >
                <span class="text-xl">👤</span>
                <div>
                  <div class="font-semibold text-sm">{{ t.prefix }}{{ t.name }} {{ t.surname }}</div>
                  <div class="text-xs text-gray-400">{{ t.teacher_id }}</div>
                </div>
              </div>
            </div>
          </el-dialog>
        </div>
        <!-- backdating notice -->
        <div v-if="backdatingInfo" class="mt-3 text-xs rounded-lg px-3 py-2"
          :style="backdatingInfo.type === 'warn'
            ? 'background:#fff7ed;color:#c2410c;border:1px solid #fed7aa'
            : 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0'">
          {{ backdatingInfo.msg }}
        </div>
      </el-card>

      <!-- ── Slot Cards ─────────────────────────────────────────── -->
      <div v-loading="loading" element-loading-text="กำลังโหลด...">

        <!-- No school day -->
        <el-empty
          v-if="!loading && !isSchoolDay"
          :image-size="80"
          description="วันนี้ไม่ใช่วันเรียน"
        />

        <!-- No slots or not published -->
        <el-empty
          v-else-if="!loading && mySlots.length === 0 && isSchoolDay"
          :image-size="80"
          :description="noSlotMessage"
        />

        <!-- Cards grid -->
        <div v-else class="tl-grid">
          <div
            v-for="slot in mySlots"
            :key="slot.id"
            class="tl-card"
            :class="slot.is_filled ? 'tl-card-filled' : 'tl-card-empty'"
            @click="openDialog(slot)"
          >
            <!-- Card Header -->
            <div class="tl-card-header" :style="cardHeaderStyle(slot)">
              <div class="tl-card-header-left">
                <span class="tl-period-badge">คาบ {{ slot.period }}</span>
                <span class="tl-period-time-h">{{ getPeriodTime(slot.period) }}</span>
              </div>
              <span class="tl-status-badge" :class="slot.is_filled ? 'tl-badge-ok' : 'tl-badge-no'">
                {{ slot.is_filled ? '✓ บันทึกแล้ว' : '● รอบันทึก' }}
              </span>
            </div>

            <!-- Mandatory substitute badge -->
            <div v-if="slot.is_substitute_mandatory" class="tl-sub-banner">
              🔄 สอนแทน (บังคับ) — แทน {{ slot.teacher_plan_name }}
            </div>

            <!-- Card Body -->
            <div class="tl-card-body">
              <!-- Subject -->
              <div class="tl-subject">{{ slot.subject_name || slot.subject_plan_id || '—' }}</div>

              <!-- Class -->
              <div class="tl-class">🏫 {{ slot.class_name || slot.class_id }}</div>

              <!-- Filled preview -->
              <div v-if="slot.is_filled" class="tl-preview">
                <div v-if="slot.topic" class="tl-preview-row">
                  <span class="tl-lbl">หัวข้อ</span>
                  <span class="tl-val">{{ slot.topic }}</span>
                </div>
                <div v-if="slot.inclass?.length" class="tl-preview-row">
                  <span class="tl-lbl">มาเรียน</span>
                  <span class="tl-val">{{ slot.inclass.length }} คน</span>
                </div>
                <div v-if="slot.img1 || slot.img2" class="tl-preview-row">
                  <span class="tl-lbl">ภาพ</span>
                  <span class="tl-val text-blue-500">มีภาพแนบ</span>
                </div>
              </div>

              <!-- Action hint -->
              <div class="tl-action-hint">
                {{ slot.is_filled ? '✏️ แก้ไขบันทึก' : '📝 กรอกบันทึก' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Summary bar -->
        <div v-if="mySlots.length > 0" class="tl-summary">
          <span>รวม {{ mySlots.length }} คาบ</span>
          <span class="text-green-600 font-semibold">✓ บันทึกแล้ว {{ filledCount }} คาบ</span>
          <span v-if="unfilledCount > 0" class="text-red-500 font-semibold">⚠ ยังไม่บันทึก {{ unfilledCount }} คาบ</span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════
           Stepper Dialog
      ══════════════════════════════════════════════════ -->
      <el-dialog
        v-model="dialogVisible"
        :title="dialogTitle"
        width="620px"
        destroy-on-close
        @close="onDialogClose"
      >
        <!-- Steps indicator -->
        <el-steps :active="step" finish-status="success" align-center class="mb-6" style="--el-steps-finish-icon-color:#10b981">
          <el-step title="เนื้อหา" icon="Edit" />
          <el-step title="เช็คชื่อ" icon="User" />
          <el-step title="พฤติกรรม" icon="Star" />
          <el-step title="ภาพ" icon="Picture" />
        </el-steps>

        <!-- ─ Step 0: เนื้อหา ──────────────────────────── -->
        <div v-if="step === 0" class="step-body">
          <el-form :model="form" label-position="top" class="tl-form">

            <el-form-item label="หัวข้อที่สอน *">
              <el-input v-model="form.topic" placeholder="กรอกหัวข้อที่สอนในคาบนี้" clearable />
            </el-form-item>

            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="วิชาที่สอนจริง">
                <el-input
                  v-model="form.subject_actual_id"
                  :placeholder="activeSlot?.subject_plan_id || 'รหัสวิชา'"
                  clearable
                />
                <div class="text-xs text-gray-400 mt-1">ตามแผน: {{ activeSlot?.subject_plan_id || '—' }}</div>
              </el-form-item>

              <el-form-item label="ประเภทกิจกรรม">
                <el-select v-model="form.activity_type" class="w-full">
                  <el-option label="บรรยาย" value="บรรยาย" />
                  <el-option label="อภิปราย" value="อภิปราย" />
                  <el-option label="ปฏิบัติ" value="ปฏิบัติ" />
                  <el-option label="ทดสอบ" value="ทดสอบ" />
                  <el-option label="โครงงาน" value="โครงงาน" />
                  <el-option label="กิจกรรม" value="กิจกรรม" />
                  <el-option label="อื่นๆ" value="อื่นๆ" />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item label="ครูที่สอนจริง (ถ้าต่างจากแผน)">
              <el-input
                v-model="form.teacher_actual_name"
                :placeholder="activeSlot?.teacher_plan_name || 'ชื่อครูที่สอน'"
                clearable
              />
            </el-form-item>

            <el-form-item label="หมายเหตุ">
              <el-input
                v-model="form.note"
                type="textarea"
                :rows="2"
                placeholder="หมายเหตุ / สิ่งที่ต้องติดตาม (ถ้ามี)"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- ─ Step 1: เช็คชื่อ ─────────────────────────── -->
        <div v-if="step === 1" class="step-body">
          <div v-loading="loadingStudents">
            <div v-if="students.length === 0 && !loadingStudents" class="text-center text-gray-400 py-4">
              ไม่พบข้อมูลนักเรียน
            </div>
            <div v-else>
              <!-- Summary bar -->
              <div class="att-summary">
                <span class="att-tag att-present">มาเรียน: {{ presentCount }}</span>
                <span class="att-tag att-absent">ขาด: {{ absentCount }}</span>
                <span class="att-tag att-total">รวม: {{ students.length }} คน</span>
                <el-button size="small" plain type="success" @click="markAll(true)" class="ml-auto">ทั้งหมดมา</el-button>
                <el-button size="small" plain type="danger" @click="markAll(false)">ทั้งหมดขาด</el-button>
              </div>
              <!-- Student list -->
              <div class="att-list">
                <div
                  v-for="stu in students"
                  :key="stu.student_id"
                  class="att-row"
                  :class="attendance[stu.student_id] ? 'att-row-present' : 'att-row-absent'"
                  @click="toggleAttendance(stu.student_id)"
                >
                  <span class="att-num">{{ stu.student_id }}</span>
                  <span class="att-name">{{ stu.name }} {{ stu.surname }}</span>
                  <span class="att-status-icon">{{ attendance[stu.student_id] ? '✓' : '✗' }}</span>
                </div>
              </div>
              <div class="text-xs text-gray-400 mt-2 text-center">แตะเพื่อสลับสถานะ มา ↔ ขาด</div>
            </div>
          </div>
        </div>

        <!-- ─ Step 2: พฤติกรรม ────────────────────────── -->
        <div v-if="step === 2" class="step-body">
          <el-alert type="info" :closable="false" class="mb-4" style="font-size:12px">
            บันทึกหมายเหตุพฤติกรรมรวมของห้องเรียนในคาบนี้ได้ที่นี่<br>
            สำหรับบันทึกพฤติกรรมรายคนนักเรียน ใช้เมนู <b>บันทึกพฤติกรรม</b>
          </el-alert>
          <el-form :model="form" label-position="top" class="tl-form">
            <el-form-item label="หมายเหตุพฤติกรรมห้องเรียน">
              <el-input
                v-model="form.behavior_note"
                type="textarea"
                :rows="4"
                placeholder="เช่น นักเรียนให้ความร่วมมือดี มีนักเรียน 3 คนไม่ส่งงาน ฯลฯ"
              />
            </el-form-item>
            <el-form-item label="ปัญหา/สิ่งที่ต้องแก้ไข">
              <el-input
                v-model="form.issues"
                type="textarea"
                :rows="2"
                placeholder="ปัญหาที่พบ หรือสิ่งที่ต้องติดตาม"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- ─ Step 3: ภาพ ─────────────────────────────── -->
        <div v-if="step === 3" class="step-body">
          <el-alert type="success" :closable="false" class="mb-4" style="font-size:12px">
            วางลิงก์รูปภาพจาก <b>Google Drive</b> — อัปโหลดรูปใน Drive แล้วคัดลอกลิงก์แชร์มาวางที่นี่
          </el-alert>
          <el-form :model="form" label-position="top" class="tl-form">
            <el-form-item label="ภาพที่ 1 (Google Drive Link)">
              <el-input
                v-model="form.img1"
                placeholder="https://drive.google.com/file/d/..."
                clearable
              >
                <template #prefix>🖼</template>
              </el-input>
              <div v-if="form.img1" class="mt-2">
                <a :href="form.img1" target="_blank" class="text-blue-500 text-xs hover:underline">🔗 ดูภาพที่ 1 →</a>
              </div>
            </el-form-item>
            <el-form-item label="ภาพที่ 2 (Google Drive Link)">
              <el-input
                v-model="form.img2"
                placeholder="https://drive.google.com/file/d/..."
                clearable
              >
                <template #prefix>🖼</template>
              </el-input>
              <div v-if="form.img2" class="mt-2">
                <a :href="form.img2" target="_blank" class="text-blue-500 text-xs hover:underline">🔗 ดูภาพที่ 2 →</a>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- Dialog footer -->
        <template #footer>
          <div class="flex justify-between items-center">
            <el-button v-if="step > 0" @click="step--" plain>← ก่อนหน้า</el-button>
            <div v-else></div>
            <div class="flex gap-2">
              <el-button @click="dialogVisible = false" plain>ยกเลิก</el-button>
              <el-button
                v-if="step < 3"
                type="primary"
                :disabled="step === 0 && !form.topic.trim()"
                @click="nextStep"
              >
                ถัดไป →
              </el-button>
              <el-button
                v-else
                type="success"
                :loading="saving"
                @click="saveRecord"
              >
                💾 บันทึก
              </el-button>
            </div>
          </div>
        </template>
      </el-dialog>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { getSchoolDb } from '@/firebase/db'

const router     = useRouter()
const authStore  = useAuthStore()
const schoolStore = useSchoolStore()

const {
  getPublishedTimetableSlots,
  getTeachActuals,
  generateTeachActualsForDate,
  saveTeachActual,
  getStudents,
  encodeTeachActualId,
  getTeachers,
} = useSchoolDb()

// ─── โหมดสอนแทน ───────────────────────────────────────────────
const subTeacherId    = ref(null)
const subTeacherName  = ref('')
const showSubDialog   = ref(false)
const teacherList     = ref([])
const loadingTeachers = ref(false)

async function openSubDialog() {
  showSubDialog.value = true
  if (teacherList.value.length === 0) {
    loadingTeachers.value = true
    try { teacherList.value = await getTeachers() } catch(e) {}
    loadingTeachers.value = false
  }
}
function selectSubTeacher(t) {
  subTeacherId.value   = t.teacher_id
  subTeacherName.value = `${t.prefix || ''}${t.name || ''} ${t.surname || ''}`.trim() || t.teacher_id
  showSubDialog.value  = false
  loadData()
}
function clearSubMode() {
  subTeacherId.value   = null
  subTeacherName.value = ''
  loadData()
}

// ─── สีตามวิชา ───────────────────────────────────────────────
const SUBJECT_COLOR_PAIRS = [
  ['#6366f1','#4f46e5'], // indigo
  ['#0ea5e9','#0284c7'], // sky
  ['#10b981','#059669'], // emerald
  ['#f59e0b','#d97706'], // amber
  ['#ec4899','#db2777'], // pink
  ['#8b5cf6','#7c3aed'], // violet
  ['#14b8a6','#0d9488'], // teal
  ['#ef4444','#dc2626'], // red
]
function subjectColorPair(subjectId) {
  if (!subjectId) return ['#ff7a00','#ff3d81']
  let h = 0
  for (let i = 0; i < subjectId.length; i++) h = ((h * 31) + subjectId.charCodeAt(i)) & 0xffff
  return SUBJECT_COLOR_PAIRS[h % SUBJECT_COLOR_PAIRS.length]
}
function cardHeaderStyle(slot) {
  if (slot.is_filled) return 'background:linear-gradient(120deg,#22c55e 0%,#16a34a 100%)'
  const [c1, c2] = subjectColorPair(slot.subject_plan_id)
  return `background:linear-gradient(120deg,${c1} 0%,${c2} 100%)`
}

// ─── Period times (ดึงจาก schoolInfo ถ้ามี ไม่งั้นใช้ default) ──────────
const DEFAULT_PERIOD_TIMES = {
  1: '08:30–09:20', 2: '09:20–10:10', 3: '10:10–11:00', 4: '11:00–11:50',
  5: '12:40–13:30', 6: '13:30–14:20', 7: '14:20–15:10', 8: '15:10–16:00'
}
function getPeriodTime(period) {
  const times = schoolStore.schoolInfo?.period_times
  if (times) {
    const t = Object.values(times).find(t => t.period === period)
    if (t?.start && t?.end) return `${t.start}–${t.end}`
  }
  return DEFAULT_PERIOD_TIMES[period] || `คาบ ${period}`
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

// ─── Date ───────────────────────────────────────────────────────────────
const selectedDate = ref(new Date().toISOString().split('T')[0])

const thaiDayName = computed(() => {
  if (!selectedDate.value) return ''
  const d = new Date(selectedDate.value + 'T00:00:00')
  return THAI_DAYS[d.getDay()]
})

const holidaySet = computed(() => {
  const raw = schoolStore.schoolInfo?.holidays
  if (!Array.isArray(raw)) return new Set()
  const dates = raw
    .map(item => typeof item === 'string' ? item : item?.date)
    .filter(Boolean)
  return new Set(dates)
})

const isHoliday = computed(() => holidaySet.value.has(selectedDate.value))

const isSchoolDay = computed(() => {
  if (isHoliday.value) return false
  const schoolDays = schoolStore.schoolInfo?.school_days || ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']
  return schoolDays.includes(thaiDayName.value)
})

// ─── Backdating control ─────────────────────────────────────────────────
const backdatingEnabled = computed(() => schoolStore.schoolInfo?.backdating_enabled !== false)
const backdatingDays    = computed(() => schoolStore.schoolInfo?.backdating_days ?? 3)

function isDateDisabled(date) {
  const today = new Date(); today.setHours(0,0,0,0)
  if (date > today) return true  // ไม่อนุญาตวันอนาคต
  if (backdatingEnabled.value) {
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() - backdatingDays.value)
    return date < minDate
  }
  // ถ้าไม่เปิด backdating — อนุญาตเฉพาะวันนี้
  return date < today
}

const backdatingInfo = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  if (selectedDate.value !== today) {
    if (backdatingEnabled.value) {
      return { type: 'info', msg: `📅 กรอกย้อนหลังได้ภายใน ${backdatingDays.value} วัน` }
    }
    return { type: 'warn', msg: '⚠️ ไม่สามารถกรอกย้อนหลังได้ — กรุณาติดต่อผู้ดูแลระบบ' }
  }
  return null
})

// ─── Data ────────────────────────────────────────────────────────────────
const loading    = ref(false)
const generating = ref(false)
const mySlots    = ref([])

const filledCount   = computed(() => mySlots.value.filter(s => s.is_filled).length)
const unfilledCount = computed(() => mySlots.value.filter(s => !s.is_filled).length)

// ตรวจสอบว่าตารางสอนได้สนับสนุนชั้นเรียนได้หรือไม่
const isTimetablePublished = computed(() => {
  const publishStatus = schoolStore.schoolInfo?.timetable_publish?.status
  return publishStatus === 'published'
})

const noSlotMessage = computed(() => {
  if (isHoliday.value) return 'วันนี้เป็นวันหยุด'
  if (!isSchoolDay.value) return 'วันนี้ไม่ใช่วันเรียน'
  if (!isTimetablePublished.value) return 'ยังไม่พร้อมใช้งาน กรุณารอผู้ดูแลเผยแพร่ตารางสอน'
  return 'ไม่มีคาบสอนในวันนี้'
})

async function loadData() {
  if (!isSchoolDay.value || !isTimetablePublished.value) { mySlots.value = []; return }
  loading.value = true
  try {
    // ถ้าอยู่ในโหมดสอนแทน ใช้ teacher_id ของครูที่เราสอนแทน มิฉะนั้นใช้ของตัวเอง
    const effectiveTeacherId = subTeacherId.value || authStore.profile?.teacher_id || authStore.profile?.uid
    const records = await getTeachActuals(selectedDate.value, effectiveTeacherId)
    mySlots.value = records
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function generateRecords() {
  generating.value = true
  try {
    // Use published timetable only (no fallback to live timetable_grid)
    const timetable = await getPublishedTimetableSlots()
    const count     = await generateTeachActualsForDate(
      selectedDate.value, thaiDayName.value, timetable
    )
    if (count === 0) {
      ElMessage.warning('ไม่พบคาบสอนในตารางสำหรับวัน' + thaiDayName.value)
    } else {
      ElMessage.success(`สร้างบันทึกล่วงหน้า ${count} คาบ เรียบร้อย`)
      await loadData()
    }
  } catch (e) {
    ElMessage.error('สร้างบันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    generating.value = false
  }
}

async function ensureRecordsForSelectedDate() {
  if (!isTimetablePublished.value || !isSchoolDay.value || generating.value) return

  generating.value = true
  try {
    const existing = await getTeachActuals(selectedDate.value)
    // Force regen ถ้า records มี teacher_plan_id ว่าง (สร้างเมื่อ field mapping ยังผิดอยู่)
    const needsRegen = existing.length === 0 || existing.some(r => !r.teacher_plan_id)
    if (!needsRegen) return

    const timetable = await getPublishedTimetableSlots()
    await generateTeachActualsForDate(selectedDate.value, thaiDayName.value, timetable)
  } catch (e) {
    ElMessage.error('สร้างบันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    generating.value = false
  }
}

async function onDateChange() {
  await ensureRecordsForSelectedDate()
  await loadData()
}

// ─── Auto-generate วันนี้ (ครั้งแรกที่ใครเปิดแอปในวันนั้น) ─────────────
async function autoGenerateToday() {
  const today = new Date().toISOString().split('T')[0]
  const info  = schoolStore.schoolInfo

  // 1. ต้องคุณภาค timetable ได้รับอนุมัติแล้ว
  if (!isTimetablePublished.value) return

  // 2. ต้องมี term_start / term_end ก่อน
  if (!info?.term_start || !info?.term_end) return

  // 3. วันนี้ต้องอยู่ในช่วงภาคเรียน
  if (today < info.term_start || today > info.term_end) return

  // 4. ต้องเป็นวันเรียน
  const dayName   = THAI_DAYS[new Date(today + 'T00:00:00').getDay()]
  const schoolDays = info.school_days || ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์']
  if (!schoolDays.includes(dayName)) return

  // 4.1 ถ้าเป็นวันหยุดที่ตั้งค่าไว้ ให้ข้าม
  const holidays = Array.isArray(info.holidays) ? info.holidays : []
  const holidaySetToday = new Set(
    holidays.map(item => typeof item === 'string' ? item : item?.date).filter(Boolean)
  )
  if (holidaySetToday.has(today)) return

  // 5. ถ้า generate วันนี้ไปแล้ว → ข้าม
  if (info.last_generated_date === today) return

  // 6. Generate ทุก slot จาก published timetable แบบ publish-only (silent — ไม่แสดง toast)
  try {
    const timetable = await getPublishedTimetableSlots()
    const count     = await generateTeachActualsForDate(today, dayName, timetable)

    if (count > 0) {
      // บันทึก last_generated_date เพื่อไม่ให้ generate ซ้ำ
      await setDoc(
        doc(getSchoolDb(), 'school_info', 'main'),
        { last_generated_date: today },
        { merge: true }
      )
      schoolStore.setSchool({ ...info, last_generated_date: today })
    }
  } catch (e) {
    // Silent fail — ไม่รบกวนผู้ใช้
    console.warn('[AutoGenerate]', e.message)
  }
}

onMounted(async () => {
  await autoGenerateToday()
  await ensureRecordsForSelectedDate()
  await loadData()
})
watch(() => schoolStore.currentTerm, async () => {
  await ensureRecordsForSelectedDate()
  await loadData()
})

// ─── Dialog ────────────────────────────────────────────────────────────
const dialogVisible    = ref(false)
const saving           = ref(false)
const activeSlot       = ref(null)
const step             = ref(0)
const loadingStudents  = ref(false)
const students         = ref([])
const attendance       = ref({})   // { student_id: true/false }

const form = ref({
  topic:               '',
  subject_actual_id:   '',
  activity_type:       'บรรยาย',
  teacher_actual_name: '',
  note:                '',
  behavior_note:       '',
  issues:              '',
  img1:                '',
  img2:                '',
})

const dialogTitle = computed(() => {
  if (!activeSlot.value) return 'บันทึกการสอน'
  const stepTitles = ['เนื้อหา', 'เช็คชื่อ', 'พฤติกรรม', 'ภาพ']
  return `📝 คาบ ${activeSlot.value.period} · ${activeSlot.value.subject_name || activeSlot.value.subject_plan_id} [${stepTitles[step.value]}]`
})

const presentCount = computed(() => Object.values(attendance.value).filter(v => v).length)
const absentCount  = computed(() => Object.values(attendance.value).filter(v => !v).length)

async function openDialog(slot) {
  // Navigate to full-page detail view
  const id = slot.teach_actual_id || slot.id
  if (id) {
    router.push(`/teacher/teach-actual/${id}`)
    return
  }
  // Fallback: generate first then navigate
  await generateRecords()
  await loadData()
  const fresh = mySlots.value.find(s => s.period === slot.period && s.class_id === slot.class_id)
  if (fresh?.teach_actual_id || fresh?.id) {
    router.push(`/teacher/teach-actual/${fresh.teach_actual_id || fresh.id}`)
  }
  return

  // Legacy dialog code below (unreachable, kept for reference)
  activeSlot.value = slot
  step.value       = 0

  // Pre-fill form from existing data
  form.value = {
    topic:               slot.topic || '',
    subject_actual_id:   slot.subject_actual_id || slot.subject_plan_id || '',
    activity_type:       slot.activity_type || 'บรรยาย',
    teacher_actual_name: slot.teacher_actual_name || slot.teacher_plan_name || '',
    note:                slot.note || '',
    behavior_note:       slot.behavior_note || '',
    issues:              slot.issues || '',
    img1:                slot.img1 || '',
    img2:                slot.img2 || '',
  }

  // Pre-fill attendance
  const existingInclass = slot.inclass || []
  attendance.value = {}
  students.value   = []

  dialogVisible.value = true

  // Load students for the class (lazy)
  loadStudentsForClass(slot.class_id, existingInclass)
}

async function loadStudentsForClass(classId, existingInclass) {
  loadingStudents.value = true
  try {
    const studs = await getStudents(classId)
    students.value = studs
    // Initialize attendance map
    const map = {}
    studs.forEach(s => {
      map[s.student_id] = existingInclass.length > 0
        ? existingInclass.includes(s.student_id)
        : true  // ค่า default = มาเรียน
    })
    attendance.value = map
  } catch (e) {
    console.error('Load students error:', e)
  } finally {
    loadingStudents.value = false
  }
}

function toggleAttendance(studentId) {
  attendance.value[studentId] = !attendance.value[studentId]
}

function markAll(present) {
  students.value.forEach(s => {
    attendance.value[s.student_id] = present
  })
}

function nextStep() {
  if (step.value === 0 && !form.value.topic.trim()) {
    ElMessage.warning('กรุณากรอกหัวข้อที่สอนก่อน')
    return
  }
  step.value++
}

async function saveRecord() {
  if (!form.value.topic.trim()) {
    step.value = 0
    ElMessage.warning('กรุณากรอกหัวข้อที่สอน')
    return
  }
  saving.value = true
  try {
    const slot = activeSlot.value
    const uid  = authStore.profile?.uid
    const displayName = authStore.profile?.displayName || ''

    // inclass = student IDs who are present
    const inclassIds = Object.entries(attendance.value)
      .filter(([, v]) => v)
      .map(([k]) => k)

    const data = {
      teach_actual_id:     slot.teach_actual_id || slot.id,
      date:                selectedDate.value,
      class_id:            slot.class_id,
      class_name:          slot.class_name || slot.class_id,
      day_of_week:         thaiDayName.value,
      period:              slot.period,
      subject_plan_id:     slot.subject_plan_id || '',
      subject_actual_id:   form.value.subject_actual_id || slot.subject_plan_id || '',
      subject_name:        slot.subject_name || '',
      teacher_plan_id:     slot.teacher_plan_id || '',
      teacher_plan_name:   slot.teacher_plan_name || '',
      teacher_actual_id:   uid,
      teacher_actual_name: form.value.teacher_actual_name || displayName,
      topic:               form.value.topic.trim(),
      activity_type:       form.value.activity_type,
      note:                form.value.note,
      behavior_note:       form.value.behavior_note,
      issues:              form.value.issues,
      inclass:             inclassIds,
      img1:                form.value.img1,
      img2:                form.value.img2,
      record_by:           uid,
      record_by_name:      displayName,
      timestamp:           serverTimestamp(),
      is_filled:           true,
    }

    await saveTeachActual(data)
    ElMessage.success('✅ บันทึกการสอนเรียบร้อยแล้ว')
    dialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

function onDialogClose() {
  step.value = 0
  students.value = []
  attendance.value = {}
}
</script>

<style scoped>
/* ── Page layout ──────────────────────────────────────── */
.tl-page { padding: 24px; max-width: 1100px; margin: 0 auto; }

/* ── Header ────────────────────────────────────────────── */
.tl-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 20px;
  background: linear-gradient(120deg, #ff7a00 0%, #ff3d81 55%, #00d4ff 100%);
  border-radius: 16px; padding: 18px 22px;
  box-shadow: 0 14px 32px rgba(255,61,129,0.28);
}
.tl-title { font-size: 22px; font-weight: 800; color: #fff; }
.tl-sub   { font-size: 12px; color: rgba(255,255,255,0.82); margin-top: 2px; }
.tl-term-badge {
  background: rgba(255,255,255,0.22);
  color: #fff; border-radius: 20px; padding: 5px 16px;
  font-size: 13px; font-weight: 700; border: 1.5px solid rgba(255,255,255,0.45);
  backdrop-filter: blur(6px);
}

/* ── Cards grid ────────────────────────────────────────── */
.tl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.tl-card {
  border-radius: 16px; overflow: hidden;
  cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  border: 2px solid transparent;
}
.tl-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(255,61,129,0.18); }

.tl-card-filled {
  border-color: #4ade80;
  box-shadow: 0 4px 14px rgba(34,197,94,0.15);
}
.tl-card-empty {
  border-color: #fdba74;
  box-shadow: 0 4px 14px rgba(255,122,0,0.12);
}
.tl-card-empty:hover { border-color: #ff7a00; }

/* ── Card Header ─────────────────────────────────────── */
.tl-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
}
.tl-card-header-ok { background: linear-gradient(120deg, #22c55e 0%, #16a34a 100%); }
.tl-card-header-no { background: linear-gradient(120deg, #ff7a00 0%, #ff3d81 100%); }
.tl-card-header-left { display: flex; align-items: baseline; gap: 8px; }
.tl-period-badge {
  font-size: 18px; font-weight: 900; color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.tl-period-time-h { font-size: 11px; color: rgba(255,255,255,0.85); font-weight: 500; }
.tl-status-badge {
  font-size: 10px; font-weight: 700; padding: 2px 9px;
  border-radius: 99px;
}
.tl-badge-ok { background: rgba(255,255,255,0.28); color: #fff; border: 1px solid rgba(255,255,255,0.5); }
.tl-badge-no { background: rgba(255,255,255,0.22); color: #fff; border: 1px solid rgba(255,255,255,0.45); }

/* ── Card Body ────────────────────────────────────────── */
.tl-sub-banner {
  background:linear-gradient(90deg,#f59e0b,#d97706); color:#fff;
  font-size:11.5px; font-weight:700; padding:4px 12px; text-align:center;
}
.tl-card-body { padding: 12px 14px 10px; background: #fff; }

/* ── Ribbon (legacy — kept for fallback) ─────────────── */
.tl-ribbon { display: none; }
.tl-ribbon-ok, .tl-ribbon-no { display: none; }

/* ── Card content ───────────────────────────────────────── */
.tl-period-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
.tl-period-num { font-size: 20px; font-weight: 800; color: #ff5a00; }
.tl-period-time { font-size: 11px; color: #94a3b8; }

.tl-subject { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px; line-height: 1.3; }
.tl-class   { font-size: 12px; color: #64748b; margin-bottom: 8px; }

.tl-preview { background: rgba(255,255,255,0.6); border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; }
.tl-preview-row { display: flex; gap: 6px; font-size: 11px; margin-bottom: 2px; }
.tl-lbl { color: #94a3b8; flex-shrink: 0; }
.tl-val { color: #374151; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tl-action-hint {
  font-size: 11px; color: #ff5a00; font-weight: 700;
  border-top: 1px solid rgba(255,90,0,0.15); padding-top: 8px; margin-top: 4px;
}

/* ── Summary bar ─────────────────────────────────────────── */
.tl-summary {
  display: flex; gap: 16px; align-items: center;
  padding: 12px 18px;
  background: linear-gradient(135deg,#fff7f0,#fff0f8);
  border-radius: 12px; font-size: 13px; color: #64748b;
  border: 1px solid rgba(255,122,0,0.2);
  box-shadow: 0 4px 12px rgba(255,61,129,0.08);
}

/* ── Dialog form ─────────────────────────────────────────── */
.step-body { min-height: 200px; }
.tl-form :deep(.el-form-item) { margin-bottom: 16px; }
.tl-form :deep(.el-form-item__label) { font-size: 12px; font-weight: 600; color: #374151; padding-bottom: 4px; }

/* ── Attendance ──────────────────────────────────────────── */
.att-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px;
  flex-wrap: wrap;
}
.att-tag {
  padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 700;
}
.att-present { background: #dcfce7; color: #166534; }
.att-absent  { background: #fee2e2; color: #991b1b; }
.att-total   { background: #e0e7ff; color: #3730a3; }

.att-list { max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.att-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; cursor: pointer; transition: background 0.1s;
  border-bottom: 1px solid #f1f5f9;
  user-select: none;
}
.att-row:last-child { border-bottom: none; }
.att-row-present { background: #f0fdf4; }
.att-row-absent  { background: #fff5f5; }
.att-row:hover   { filter: brightness(0.96); }

.att-num  { font-size: 11px; color: #94a3b8; width: 54px; flex-shrink: 0; }
.att-name { flex: 1; font-size: 13px; font-weight: 500; color: #1e293b; }
.att-status-icon {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.att-row-present .att-status-icon { background: #22c55e; color: white; }
.att-row-absent  .att-status-icon { background: #ef4444; color: white; }

@media (max-width: 640px) {
  .tl-page { padding: 12px; }
  .tl-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
}
</style>
