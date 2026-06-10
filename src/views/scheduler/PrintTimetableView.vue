<template>
  <AppLayout>
    <div class="print-page">

      <!-- Header -->
      <div class="page-header mb-5">
        <div class="flex items-center gap-4">
          <div class="header-icon">🖨️</div>
          <div>
            <h1 class="text-2xl font-bold text-white">พิมพ์ตารางสอน</h1>
            <p class="text-white/75 text-sm mt-0.5">ดาวน์โหลด PDF หรือ Excel แยกรายการ</p>
          </div>
        </div>
      </div>

      <!-- Gate: ยังจัดตารางอยู่ (non-admin ไม่เห็น) -->
      <div v-if="!isLocked && !authStore.isAdmin" class="publish-source-banner publish-source-warn mb-5"
        style="text-align:center;padding:32px 20px;">
        <div style="font-size:40px;margin-bottom:8px;">🕐</div>
        <div class="publish-source-title" style="font-size:16px;">อยู่ระหว่างจัดตารางสอน</div>
        <div class="publish-source-text" style="margin-top:6px;">Admin กำลังดำเนินการจัดตาราง — จะพิมพ์ได้เมื่อจัดเสร็จแล้ว</div>
      </div>

      <template v-else>

      <!-- Preview banner when admin views while still editing -->
      <div v-if="!isLocked && authStore.isAdmin" class="publish-source-banner mb-5"
        style="border-color:#f59e0b;background:#fffbeb;">
        <div class="publish-source-title" style="color:#92400e;">⚠️ โหมด Preview — ตารางยังไม่ล็อค</div>
        <div class="publish-source-text" style="color:#78350f;">Admin ดู Preview ได้ แต่ครูยังมองไม่เห็น — ล็อคตารางเมื่อจัดเสร็จแล้ว</div>
      </div>

      <div v-if="!subjectSlotCount && !loading" class="publish-source-banner publish-source-warn mb-5">
        <div class="publish-source-title">⚠️ ยังไม่มีข้อมูลตารางสอน</div>
        <div class="publish-source-text">จัดตารางสอนในหน้า "จัดตารางสอน" ก่อนแล้วค่อยพิมพ์</div>
      </div>
      <div v-else-if="subjectSlotCount" class="publish-source-banner publish-source-ok mb-5">
        <div class="publish-source-title">✅ ข้อมูลจากตารางสอนปัจจุบัน</div>
        <div class="publish-source-text">
          <span class="publish-chip">ภาคเรียน: {{ term }}</span>
          <span class="publish-chip">{{ subjectSlotCount }} คาบ / {{ classes.length }} ห้อง / {{ teachers.length }} ครู</span>
        </div>
      </div>

      <!-- Options Bar -->
      <div class="options-bar mb-5">
        <div class="options-title mb-3">⚙️ ตัวเลือกการแสดงผล</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

          <!-- Col 1: ข้อมูลในช่องตาราง -->
          <div>
            <div class="opt-group-label mb-2">📋 ข้อมูลในช่องตาราง</div>
            <div class="flex flex-wrap gap-2">
              <label class="tog-label" :class="toggles.showCode    ? 'tog-blue'   : ''"><input type="checkbox" v-model="toggles.showCode"    class="tog-chk"> รหัสวิชา</label>
              <label class="tog-label" :class="toggles.showName    ? 'tog-blue'   : ''"><input type="checkbox" v-model="toggles.showName"    class="tog-chk"> ชื่อวิชา</label>
              <label class="tog-label" :class="toggles.showTeacher ? 'tog-indigo' : ''"><input type="checkbox" v-model="toggles.showTeacher" class="tog-chk"> ชื่อครู</label>
              <label class="tog-label" :class="toggles.showRoom    ? 'tog-green'  : ''"><input type="checkbox" v-model="toggles.showRoom"    class="tog-chk"> ห้อง/Lab</label>
              <label class="tog-label" :class="toggles.showClass   ? 'tog-purple' : ''"><input type="checkbox" v-model="toggles.showClass"   class="tog-chk"> ห้องเรียน</label>
            </div>
            <div class="flex items-center gap-3 mt-3">
              <span class="text-sm text-gray-500">ตัดชื่อวิชาที่</span>
              <el-input-number v-model="toggles.truncateAt" :min="8" :max="40" :step="2" size="small" style="width:100px" />
              <span class="text-sm text-gray-500">อักษร</span>
            </div>
          </div>

          <!-- Col 2: หัวตาราง + ลายเซ็น -->
          <div>
            <div class="opt-group-label mb-2">🖨️ หัวตาราง</div>
            <div class="flex flex-wrap gap-2 mb-3">
              <label class="tog-label" :class="toggles.showTime ? 'tog-sky'   : ''"><input type="checkbox" v-model="toggles.showTime" class="tog-chk"> 🕐 เวลาคาบ</label>
              <label class="tog-label" :class="toggles.showRef  ? 'tog-amber' : ''"><input type="checkbox" v-model="toggles.showRef"  class="tog-chk"> 📚 รายการวิชา</label>
            </div>
            <div class="opt-group-label mb-2">✍️ ลายเซ็น</div>
            <div class="flex flex-wrap gap-2 mb-3">
              <label class="tog-label" :class="toggles.showSignLine      ? 'tog-slate' : ''">
                <input type="checkbox" v-model="toggles.showSignLine" class="tog-chk"> ➖ เส้น+ชื่อ+ตำแหน่ง
              </label>
              <label class="tog-label" :class="toggles.showSignature ? 'tog-rose' : (toggles.showSignLine ? '' : 'tog-disabled')">
                <input type="checkbox" v-model="toggles.showSignature" :disabled="!toggles.showSignLine" class="tog-chk"> 🖊️ ภาพลายเซ็น
              </label>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-500">แนวกระดาษ:</span>
              <el-radio-group v-model="toggles.orientation" size="small">
                <el-radio-button value="portrait">แนวตั้ง A4</el-radio-button>
                <el-radio-button value="landscape">แนวนอน A4</el-radio-button>
              </el-radio-group>
            </div>
          </div>

        </div>
      </div>

      <!-- 3 Sections -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <!-- Section 1: นักเรียน -->
        <div class="section-card section-class">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon bg-purple-100 text-purple-700">🏫</span>
              <span class="font-bold text-purple-800">ตารางนักเรียน</span>
            </div>
            <div class="flex gap-1">
              <button class="btn-sm btn-outline-purple" @click="selectAll('class')">ทั้งหมด</button>
              <button class="btn-sm btn-ghost" @click="clearAll('class')">ยกเลิก</button>
            </div>
          </div>

          <!-- ปุ่มเลือกตามระดับชั้น -->
          <div v-if="classLevels.length > 1" class="level-bar">
            <span class="level-bar-label">เลือกระดับ:</span>
            <button
              v-for="lv in classLevels" :key="lv"
              class="btn-level"
              :class="isLevelSelected(lv) ? 'btn-level-active' : ''"
              @click="toggleLevel(lv)">
              {{ lv }}
            </button>
          </div>

          <div v-if="loading" class="loading-state">⏳ กำลังโหลด...</div>
          <div v-else class="item-list">
            <!-- จัดกลุ่มตามระดับชั้น -->
            <template v-for="lv in classLevels" :key="lv">
              <div class="level-group-label">{{ lv }}</div>
              <label v-for="c in classesByLevel(lv)" :key="c.class_id"
                class="item-row item-row-purple"
                :class="selectedClasses.includes(c.class_id) ? 'item-selected-purple' : ''">
                <input type="checkbox" :value="c.class_id" v-model="selectedClasses" class="mr-2" />
                <span>{{ c.class_id }}</span>
                <span class="item-sub ml-auto">{{ c.homeroom_teacher_name_snapshot || c.advisor_name || '' }}</span>
              </label>
            </template>
          </div>
          <div class="section-footer">
            <span class="count-badge count-purple">{{ selectedClasses.length }}/{{ classes.length }}</span>
            <button class="btn-export btn-pdf-purple" :disabled="!selectedClasses.length || !!generating" @click="exportPDF('class')">
              <span v-if="generating==='class_pdf'">⏳</span><span v-else>📄</span> PDF
            </button>
            <button class="btn-export btn-xlsx-purple" :disabled="!selectedClasses.length || !!generating" @click="exportExcel('class')">
              <span v-if="generating==='class_xlsx'">⏳</span><span v-else>📊</span> Excel
            </button>
            <button class="btn-export btn-data-purple" :disabled="!selectedClasses.length || !!generating" @click="exportExcel2('class')">
              <span v-if="generating==='class_xlsx2'">⏳</span><span v-else>📋</span> Data
            </button>
          </div>
        </div>

        <!-- Section 2: ครู -->
        <div class="section-card section-teacher">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon bg-blue-100 text-blue-700">👨‍🏫</span>
              <span class="font-bold text-blue-800">ตารางครู</span>
            </div>
            <div class="flex gap-1">
              <button class="btn-sm btn-outline-blue" @click="selectAll('teacher')">ทั้งหมด</button>
              <button class="btn-sm btn-ghost" @click="clearAll('teacher')">ยกเลิก</button>
            </div>
          </div>

          <!-- ปุ่มเลือกตามกลุ่มสาระ -->
          <div v-if="teacherDepts.length > 1" class="dept-bar">
            <span class="dept-bar-label">กลุ่มสาระ:</span>
            <button
              v-for="dept in teacherDepts" :key="dept"
              class="btn-dept"
              :class="isDeptSelected(dept) ? 'btn-dept-active' : ''"
              @click="toggleDept(dept)">
              {{ dept }}
            </button>
          </div>

          <div v-if="loading" class="loading-state">⏳ กำลังโหลด...</div>
          <div v-else class="item-list">
            <!-- จัดกลุ่มตามกลุ่มสาระ -->
            <template v-for="dept in teacherDepts" :key="dept">
              <div class="dept-group-label">{{ dept }}</div>
              <label v-for="t in teachersByDept(dept)" :key="t.teacher_id"
                class="item-row item-row-blue"
                :class="selectedTeachers.includes(t.teacher_id) ? 'item-selected-blue' : ''">
                <input type="checkbox" :value="t.teacher_id" v-model="selectedTeachers" class="mr-2" />
                <span>{{ t.prefix||'' }}{{ t.name }} {{ t.surname }}</span>
              </label>
            </template>
          </div>
          <div class="section-footer">
            <span class="count-badge count-blue">{{ selectedTeachers.length }}/{{ teachers.length }}</span>
            <button class="btn-export btn-pdf-blue" :disabled="!selectedTeachers.length || !!generating" @click="exportPDF('teacher')">
              <span v-if="generating==='teacher_pdf'">⏳</span><span v-else>📄</span> PDF
            </button>
            <button class="btn-export btn-xlsx-blue" :disabled="!selectedTeachers.length || !!generating" @click="exportExcel('teacher')">
              <span v-if="generating==='teacher_xlsx'">⏳</span><span v-else>📊</span> Excel
            </button>
            <button class="btn-export btn-data-blue" :disabled="!selectedTeachers.length || !!generating" @click="exportExcel2('teacher')">
              <span v-if="generating==='teacher_xlsx2'">⏳</span><span v-else>📋</span> Data
            </button>
          </div>
        </div>

        <!-- Section 3: ห้อง Lab -->
        <div class="section-card section-lab">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon bg-emerald-100 text-emerald-700">🏛</span>
              <span class="font-bold text-emerald-800">ตารางห้อง/Lab</span>
            </div>
            <div class="flex gap-1">
              <button class="btn-sm btn-outline-green" @click="selectAll('lab')">ทั้งหมด</button>
              <button class="btn-sm btn-ghost" @click="clearAll('lab')">ยกเลิก</button>
            </div>
          </div>
          <div v-if="loading" class="loading-state">⏳ กำลังโหลด...</div>
          <div v-else-if="!labs.length" class="loading-state text-amber-500">⚠️ ยังไม่มีห้อง Lab</div>
          <div v-else class="item-list">
            <label v-for="r in labs" :key="r"
              class="item-row item-row-green"
              :class="selectedLabs.includes(r) ? 'item-selected-green' : ''">
              <input type="checkbox" :value="r" v-model="selectedLabs" class="mr-2" />
              <span>{{ r }}</span>
            </label>
          </div>
          <div class="section-footer">
            <span class="count-badge count-green">{{ selectedLabs.length }}/{{ labs.length }}</span>
            <button class="btn-export btn-pdf-green" :disabled="!selectedLabs.length || !!generating" @click="exportPDF('lab')">
              <span v-if="generating==='lab_pdf'">⏳</span><span v-else>📄</span> PDF
            </button>
            <button class="btn-export btn-xlsx-green" :disabled="!selectedLabs.length || !!generating" @click="exportExcel('lab')">
              <span v-if="generating==='lab_xlsx'">⏳</span><span v-else>📊</span> Excel
            </button>
            <button class="btn-export btn-data-green" :disabled="!selectedLabs.length || !!generating" @click="exportExcel2('lab')">
              <span v-if="generating==='lab_xlsx2'">⏳</span><span v-else>📋</span> Data
            </button>
          </div>
        </div>

      </div>

      <!-- Summary bar -->
      <div class="summary-bar mt-5">
        <span class="text-gray-500 text-sm">รวม:</span>
        <span class="summary-chip chip-purple">🏫 {{ selectedClasses.length }} ห้อง</span>
        <span class="summary-chip chip-blue">👨‍🏫 {{ selectedTeachers.length }} คน</span>
        <span class="summary-chip chip-green">🏛 {{ selectedLabs.length }} Lab</span>
        <span class="text-gray-400 text-sm ml-2">= {{ totalPages }} หน้า</span>
      </div>

      </template><!-- end v-else (isLocked or admin) -->

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { supabase } from '@/supabase/client'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetable } from '@/composables/useTimetable'
import { useSignature } from '@/composables/useSignature'
import { useSchoolDb } from '@/composables/useSchoolDb'

const schoolStore = useSchoolStore()
const authStore = useAuthStore()
const { buildSignatureHTML, getModuleSignatures } = useSignature()
const { getRooms, getTeachers, getClasses } = useSchoolDb()
const term = computed(() => schoolStore.currentTerm || '2568_1')
const isLocked = computed(() => schoolStore.isTimetableLocked)
const { DAYS, PERIODS, PERIOD_TIMES } = useTimetable()

const loading         = ref(false)
const generating      = ref('')
const classes    = ref([])
const teachers   = ref([])
const labs       = ref([])
const slots      = ref([])

const selectedClasses  = ref([])
const selectedTeachers = ref([])
const selectedLabs     = ref([])

const toggles = reactive({
  showCode: true,
  showName: true,
  showTeacher: true,
  showRoom: true,
  showClass: true,
  showTime: true,
  showRef: true,
  showSignature: true,
  showSignLine: true,
  truncateAt: 20,
  orientation: 'portrait',
})

const totalPages = computed(() =>
  selectedClasses.value.length + selectedTeachers.value.length + selectedLabs.value.length
)

const subjectSlotCount = computed(() => slots.value.filter(s => s.type === 'subject').length)

// ── ระดับชั้น ──────────────────────────────────────────────────────────
// ดึง level จาก c.level (field จากระบบ) หรือ fallback parse จาก class_id
function getClassLevel(c) {
  if (c.level) return c.level
  // fallback: ตัด trailing /x เช่น "ม.1/1" → "ม.1", "ป.3/2" → "ป.3"
  const m = (c.class_id || '').match(/^(.+?)\/\d+$/)
  return m ? m[1] : (c.class_id || '').slice(0, 3)
}

const classLevels = computed(() => {
  const lvSet = new Set(classes.value.map(c => getClassLevel(c)))
  return [...lvSet].sort((a, b) => a.localeCompare(b, 'th'))
})

function classesByLevel(lv) {
  return classes.value.filter(c => getClassLevel(c) === lv)
}

function isLevelSelected(lv) {
  const ids = classesByLevel(lv).map(c => c.class_id)
  return ids.length > 0 && ids.every(id => selectedClasses.value.includes(id))
}

function toggleLevel(lv) {
  const ids = classesByLevel(lv).map(c => c.class_id)
  if (isLevelSelected(lv)) {
    // ยกเลิกเฉพาะระดับนี้
    selectedClasses.value = selectedClasses.value.filter(id => !ids.includes(id))
  } else {
    // เพิ่มระดับนี้ (ไม่ลบที่เลือกไว้แล้ว)
    const merged = new Set([...selectedClasses.value, ...ids])
    selectedClasses.value = [...merged]
  }
}
// ──────────────────────────────────────────────────────────────────────

// ── กลุ่มสาระ ──────────────────────────────────────────────────────────
const teacherDepts = computed(() => {
  const deptSet = new Set(teachers.value.map(t => t.dept || 'ไม่ระบุกลุ่มสาระ'))
  return [...deptSet].sort((a, b) => a.localeCompare(b, 'th'))
})

function teachersByDept(dept) {
  return teachers.value.filter(t => (t.dept || 'ไม่ระบุกลุ่มสาระ') === dept)
}

function isDeptSelected(dept) {
  const ids = teachersByDept(dept).map(t => t.teacher_id)
  return ids.length > 0 && ids.every(id => selectedTeachers.value.includes(id))
}

function toggleDept(dept) {
  const ids = teachersByDept(dept).map(t => t.teacher_id)
  if (isDeptSelected(dept)) {
    selectedTeachers.value = selectedTeachers.value.filter(id => !ids.includes(id))
  } else {
    const merged = new Set([...selectedTeachers.value, ...ids])
    selectedTeachers.value = [...merged]
  }
}
// ──────────────────────────────────────────────────────────────────────

function selectAll(type) {
  if (type === 'class')   selectedClasses.value  = classes.value.map(c => c.class_id)
  if (type === 'teacher') selectedTeachers.value = teachers.value.map(t => t.teacher_id)
  if (type === 'lab')     selectedLabs.value     = [...labs.value]
}
function clearAll(type) {
  if (type === 'class')   selectedClasses.value  = []
  if (type === 'teacher') selectedTeachers.value = []
  if (type === 'lab')     selectedLabs.value     = []
}

onMounted(loadData)
async function loadData() {
  loading.value = true
  try {
    const schoolId = authStore.schoolId
    const t = term.value

    // โหลดพร้อมกัน: ห้องเรียน, ครู, timetable_slots
    const [classData, teacherData, { data: slotData, error: slotErr }] = await Promise.all([
      getClasses(),
      getTeachers(),
      supabase.from('timetable_slots')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term_id', t)
        .not('class_id', 'is', null),  // ดึงทุก slot_type (subject + activity + manual_lock)
    ])
    if (slotErr) throw slotErr

    classes.value = classData.sort((a, b) => (a.class_id || '').localeCompare(b.class_id || '', 'th'))
    teachers.value = teacherData.sort((a, b) => (a.teacher_id || '').localeCompare(b.teacher_id || ''))

    // กรองออก synthetic supervisor slots (__teacher_xxx, __room_xxx)
    const rawSlots = (slotData || []).filter(row => !String(row.class_id || '').startsWith('__'))
    slots.value = rawSlots.map(row => ({
      ...row,
      day:            row.day_of_week,
      period:         row.period_number,
      preferred_room: row.room_id || '',
      type:           row.slot_type,
      subject_code:   row.subject_id || '',
      is_coteach:     false,
    }))

    // Labs = room IDs จาก subject slots เท่านั้น
    const occupiedRoomIds = new Set(
      slots.value.filter(s => s.type === 'subject').map(s => s.preferred_room).filter(Boolean)
    )
    labs.value = [...occupiedRoomIds].sort((a, b) => a.localeCompare(b, 'th'))

    // banner: นับเฉพาะ subject slots
    const subjectCount = slots.value.filter(s => s.type === 'subject').length
    if (!subjectCount) ElMessage.warning('ยังไม่มีคาบวิชา — จัดตารางสอนก่อนแล้วค่อยพิมพ์')
  } catch (e) {
    ElMessage.error('โหลดข้อมูลล้มเหลว: ' + e.message)
  } finally {
    loading.value = false
  }
}

function truncate(str, n) {
  const limit = n || toggles.truncateAt
  if (!str) return ''
  return str.length > limit ? str.substring(0, limit - 1) + '…' : str
}

// ดึง slots สำหรับ entity นั้น
function getEntitySlots(entityId, entityType) {
  return slots.value.filter(s => {
    if (entityType === 'class')   return s.class_id === entityId && !s.is_coteach
    if (entityType === 'teacher') return s.teacher_id === entityId && !s.is_coteach
    if (entityType === 'lab')     return s.preferred_room === entityId
    return false
  })
}

function getSlot(entityId, entityType, day, period) {
  return getEntitySlots(entityId, entityType).find(s => s.day === day && s.period === period) || null
}

// สร้าง reference list พร้อมจำนวนคาบ
function buildRefList(entityId, entityType) {
  const subjectSlots = getEntitySlots(entityId, entityType).filter(s => s.type === 'subject')

  // key ต่างกันตามประเภท
  const refMap = {}
  subjectSlots.forEach(s => {
    let key = ''
    if (entityType === 'class')   key = s.subject_code || s.subject_name || '?'
    if (entityType === 'teacher') key = `${s.class_id}||${s.subject_code}`
    if (entityType === 'lab')     key = `${s.class_id}||${s.subject_code}`

    if (!refMap[key]) {
      refMap[key] = {
        code:    s.subject_code || '',
        name:    s.subject_name || '',
        teacher: s.teacher_name || '',
        class_id: s.class_id || '',
        room:    s.preferred_room || '',
        count:   0,
      }
    }
    refMap[key].count++
  })

  return Object.values(refMap).sort((a, b) => {
    if (entityType === 'class') return (a.code || '').localeCompare(b.code || '')
    return (a.class_id || '').localeCompare(b.class_id || '', 'th') || (a.code || '').localeCompare(b.code || '')
  })
}

// สี header ตามประเภท
const COLORS = {
  class:   { bg: '#4f46e5', border: '#3730a3', light: '#ede9fe', text: '#4f46e5' },
  teacher: { bg: '#1d4ed8', border: '#1e40af', light: '#dbeafe', text: '#1d4ed8' },
  lab:     { bg: '#059669', border: '#047857', light: '#d1fae5', text: '#059669' },
}

const DAY_PALETTES = [
  { strong: '#eab308', soft: '#fefce8', line: '#ca8a04', text: '#713f12' },
  { strong: '#ec4899', soft: '#fdf2f8', line: '#db2777', text: '#831843' },
  { strong: '#22c55e', soft: '#f0fdf4', line: '#16a34a', text: '#14532d' },
  { strong: '#f97316', soft: '#fff7ed', line: '#ea580c', text: '#7c2d12' },
  { strong: '#3b82f6', soft: '#eff6ff', line: '#2563eb', text: '#1e3a8a' },
  { strong: '#a855f7', soft: '#faf5ff', line: '#9333ea', text: '#581c87' },
  { strong: '#ef4444', soft: '#fef2f2', line: '#dc2626', text: '#7f1d1d' },
]

function getDayPalette(dayValue, index) {
  const idx = Number(dayValue) - 1
  return DAY_PALETTES[idx] || DAY_PALETTES[index % DAY_PALETTES.length]
}

// สร้าง HTML 1 หน้า
function buildPageHTML(entityId, entityType) {
  const info  = schoolStore.schoolInfo || {}
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const termLabel = `ภาคเรียนที่ ${info.semester || ''} ปีการศึกษา ${info.year || ''}`
  const hc = COLORS[entityType]
  const days  = DAYS.value
  const perds = PERIODS.value
  const times = PERIOD_TIMES.value
  const isPortrait = toggles.orientation === 'portrait'

  // Label
  let entityLabel = ''
  let subTitle = ''
  if (entityType === 'class') {
    entityLabel = `ตารางเรียน ห้อง ${entityId}`
    const cls = classes.value.find(c => c.class_id === entityId)
    const advisor = cls?.homeroom_teacher_name_snapshot || cls?.advisor_name || cls?.homeroom_teacher_name || ''
    if (advisor) subTitle = `ครูที่ปรึกษา: ${advisor}`
  } else if (entityType === 'teacher') {
    const t = teachers.value.find(x => x.teacher_id === entityId)
    entityLabel = `ตารางสอน ${t ? `${t.prefix||''}${t.name} ${t.surname}` : entityId}`
  } else {
    entityLabel = `ตารางการใช้ห้อง ${entityId}`
  }

  const refList = buildRefList(entityId, entityType)
  const totalPeriods = refList.reduce((s, r) => s + r.count, 0)

  // คำนวณ column width
  const pageW = isPortrait ? 175 : 257  // mm usable width
  const dayColW = 16  // mm
  const numP = perds.length
  const pColW = Math.max(12, Math.floor((pageW - dayColW) / numP))
  const pColPx = Math.round(pColW * 3.78)  // mm -> px approx

  // Header cols — line-height 1.8 แก้สระถูกตัด
  const headerCols = perds.map(p => `
    <th style="border:1px solid ${hc.border};padding:4px 2px;background:linear-gradient(135deg, ${hc.bg}, ${hc.border});color:white;
      text-align:center;width:${pColPx}px;font-size:8pt;font-weight:bold;line-height:1.8;">
      <div>คาบ ${p}</div>
      ${toggles.showTime && times[p] ? `<div style="font-size:6.5pt;font-weight:normal;opacity:0.85;line-height:1.6;">${times[p]}</div>` : ''}
    </th>`).join('')

  // Body rows — ความสูง cell คำนวณจาก lines ที่จะแสดง (line-height 1.8 = ~14px/line)
  const linesPerCell = (
    (toggles.showCode ? 1 : 0) +
    (toggles.showName ? 1 : 0) +
    (toggles.showTeacher ? 1 : 0) +
    (toggles.showRoom ? 1 : 0) +
    (toggles.showClass ? 1 : 0)
  ) || 1
  const cellH = Math.max(42, linesPerCell * 16 + 8)

  const bodyRows = days.map((day, di) => {
    const dayColor = getDayPalette(day.value, di)
    const cells = perds.map(p => {
      const slot = getSlot(entityId, entityType, day.value, p)
      let cellHtml = ''

      if (!slot) {
        cellHtml = `<div style="color:#cbd5e1;text-align:center;font-size:8pt;line-height:1.8;padding-top:2px;">-</div>`
      } else if (slot.type === 'activity' || slot.type === 'manual_lock') {
        cellHtml = `<div style="text-align:center;padding:2px 3px;font-size:7.2pt;color:#6b7280;line-height:1.7;
          border-left:3px solid ${dayColor.line};border-radius:7px;background:linear-gradient(180deg, #ffffff 0%, ${dayColor.soft} 100%);">
          🔒 ${truncate(slot.act_name || slot.name || 'กิจกรรม', 14)}</div>`
      } else {
        const parts = []
        if (entityType === 'class') {
          if (toggles.showCode && slot.subject_code)    parts.push(`<div style="font-weight:700;font-size:8pt;color:#1f2937;line-height:1.8;">${slot.subject_code}</div>`)
          if (toggles.showName && slot.subject_name)    parts.push(`<div style="font-size:7pt;color:#374151;line-height:1.8;">${truncate(slot.subject_name)}</div>`)
          if (toggles.showTeacher && slot.teacher_name) parts.push(`<div style="font-size:6.5pt;color:#6b7280;line-height:1.8;">${slot.teacher_name}</div>`)
          if (toggles.showRoom && slot.preferred_room)  parts.push(`<div style="font-size:6.5pt;color:#2563eb;line-height:1.8;">🏛 ${slot.preferred_room}</div>`)
        } else if (entityType === 'teacher') {
          if (toggles.showClass && slot.class_id)       parts.push(`<div style="font-weight:700;font-size:8pt;color:${hc.text};line-height:1.8;">${slot.class_id}</div>`)
          if (toggles.showCode && slot.subject_code)    parts.push(`<div style="font-size:7.5pt;font-weight:600;color:#1f2937;line-height:1.8;">${slot.subject_code}</div>`)
          if (toggles.showName && slot.subject_name)    parts.push(`<div style="font-size:7pt;color:#374151;line-height:1.8;">${truncate(slot.subject_name)}</div>`)
          if (toggles.showRoom && slot.preferred_room)  parts.push(`<div style="font-size:6.5pt;color:#059669;line-height:1.8;">🏛 ${slot.preferred_room}</div>`)
        } else {
          if (toggles.showClass && slot.class_id)       parts.push(`<div style="font-weight:700;font-size:8pt;color:${hc.text};line-height:1.8;">${slot.class_id}</div>`)
          if (toggles.showCode && slot.subject_code)    parts.push(`<div style="font-size:7.5pt;font-weight:600;color:#1f2937;line-height:1.8;">${slot.subject_code}</div>`)
          if (toggles.showName && slot.subject_name)    parts.push(`<div style="font-size:7pt;color:#374151;line-height:1.8;">${truncate(slot.subject_name)}</div>`)
          if (toggles.showTeacher && slot.teacher_name) parts.push(`<div style="font-size:6.5pt;color:#6b7280;line-height:1.8;">${slot.teacher_name}</div>`)
        }
        const lines = parts.join('') || '<div style="color:#cbd5e1;line-height:1.8;">-</div>'
        cellHtml = `<div style="border-left:3px solid ${dayColor.line};border-radius:7px;background:linear-gradient(180deg, #ffffff 0%, ${dayColor.soft} 100%);
          box-shadow:0 1px 2px rgba(15, 23, 42, 0.08);padding:2px 3px;">${lines}</div>`
      }

      return `<td style="border:1px solid #e5e7eb;padding:3px 3px;height:${cellH}px;vertical-align:middle;overflow:hidden;text-align:center;background:${dayColor.soft};">${cellHtml}</td>`
    }).join('')

    return `<tr>
      <td style="border:1px solid #e5e7eb;padding:4px;text-align:center;background:${dayColor.strong};
        font-weight:bold;font-size:8pt;color:#ffffff;vertical-align:middle;white-space:nowrap;line-height:1.8;">${day.label}</td>
      ${cells}
    </tr>`
  }).join('')

  // Reference list
  let refHtml = ''
  if (toggles.showRef && refList.length) {
    let refHead = ''
    let refRows = ''

    if (entityType === 'class') {
      refHead = `<th style="${thStyle(hc)}">รหัสวิชา</th><th style="${thStyle(hc)}">ชื่อวิชา</th><th style="${thStyle(hc)}">ครูผู้สอน</th><th style="${thStyle(hc)}">ห้อง/Lab</th><th style="${thStyle(hc)}">คาบ/สัปดาห์</th>`
      refRows = refList.map((r, i) => `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="${tdStyle}">${r.code}</td>
        <td style="${tdStyle}">${r.name}</td>
        <td style="${tdStyle}">${r.teacher}</td>
        <td style="${tdStyle}">${r.room}</td>
        <td style="${tdStyle};text-align:center;font-weight:700;">${r.count}</td>
      </tr>`).join('')
    } else if (entityType === 'teacher') {
      refHead = `<th style="${thStyle(hc)}">ห้องเรียน</th><th style="${thStyle(hc)}">รหัสวิชา</th><th style="${thStyle(hc)}">ชื่อวิชา</th><th style="${thStyle(hc)}">ห้อง/Lab</th><th style="${thStyle(hc)}">คาบ/สัปดาห์</th>`
      refRows = refList.map((r, i) => `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="${tdStyle};font-weight:700;">${r.class_id}</td>
        <td style="${tdStyle};font-weight:700;">${r.code}</td>
        <td style="${tdStyle}">${r.name}</td>
        <td style="${tdStyle}">${r.room}</td>
        <td style="${tdStyle};text-align:center;font-weight:700;">${r.count}</td>
      </tr>`).join('')
    } else {
      refHead = `<th style="${thStyle(hc)}">ห้องเรียน</th><th style="${thStyle(hc)}">รหัสวิชา</th><th style="${thStyle(hc)}">ชื่อวิชา</th><th style="${thStyle(hc)}">ครูผู้สอน</th><th style="${thStyle(hc)}">คาบ/สัปดาห์</th>`
      refRows = refList.map((r, i) => `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="${tdStyle};font-weight:700;">${r.class_id}</td>
        <td style="${tdStyle};font-weight:700;">${r.code}</td>
        <td style="${tdStyle}">${r.name}</td>
        <td style="${tdStyle}">${r.teacher}</td>
        <td style="${tdStyle};text-align:center;font-weight:700;">${r.count}</td>
      </tr>`).join('')
    }

    refHtml = `<div style="margin-top:8px;">
      <div style="font-size:7pt;font-weight:700;color:${hc.text};margin-bottom:3px;line-height:1.8;">📚 รายการวิชา (รวม ${totalPeriods} คาบ/สัปดาห์)</div>
      <table style="width:100%;border-collapse:collapse;font-size:7pt;">
        <thead><tr>${refHead}</tr></thead>
        <tbody>${refRows}</tbody>
      </table>
    </div>`
  }

  // ลายเซ็น:
  //   showSignLine = master switch → เปิด: แสดง เส้น+ชื่อ+ตำแหน่ง ครบ | ปิด: ซ่อนทั้ง block
  //   showSignature = ควบคุมเฉพาะภาพ (ใช้ได้เมื่อ showSignLine เปิด)
  const cls2 = entityType === 'class' ? classes.value.find(c => c.class_id === entityId) : null
  const t2   = entityType === 'teacher' ? teachers.value.find(x => x.teacher_id === entityId) : null
  const dynamicVals = {
    advisor:   cls2?.homeroom_teacher_name_snapshot || cls2?.advisor_name || cls2?.homeroom_teacher_name || '',
    teacher:   t2 ? `${t2.prefix||''}${t2.name} ${t2.surname}` : '',
    principal: info.principal_name || info.signer_name || '',
  }
  // สร้าง block ก็ต่อเมื่อ showSignLine เปิด; showSignature ควบคุมภาพ
  const sigBlock = toggles.showSignLine
    ? buildSignatureHTML('timetable', dynamicVals, true, hc.text, toggles.showSignature)
    : ''

  const pageW_mm = isPortrait ? 210 : 297
  const pageH_mm = isPortrait ? 297 : 210
  const PAD_MM   = 7
  const SIG_H_MM = toggles.showSignLine ? 28 : 0

  const fontBase = `font-family:'Sarabun','Noto Sans Thai',sans-serif;line-height:1.8;`

  const sigFooter = sigBlock
    ? `<div style="position:absolute;bottom:${PAD_MM}mm;left:${PAD_MM+1}mm;right:${PAD_MM+1}mm;">${sigBlock}</div>`
    : ''

  return `<div style="
      position:relative;
      padding:${PAD_MM}mm ${PAD_MM+1}mm ${PAD_MM + SIG_H_MM}mm;
      ${fontBase}font-size:9pt;
      background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      width:${pageW_mm}mm;
      min-height:${pageH_mm}mm;
      box-sizing:border-box;">
    <table style="width:100%;border:none;margin-bottom:5px;border-collapse:collapse;background:white;border-radius:10px;">
      <tr>
        <td style="width:52px;vertical-align:middle;">
          ${info.logo_url ? `<img src="${info.logo_url}" style="width:46px;height:46px;object-fit:contain;" crossorigin="anonymous">` : ''}
        </td>
        <td style="vertical-align:middle;padding-left:6px;">
          <div style="font-size:11pt;font-weight:bold;color:#111;line-height:1.8;">${info.name || 'โรงเรียน'}</div>
          <div style="font-size:10pt;font-weight:700;color:${hc.text};line-height:1.8;">${entityLabel}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;line-height:1.8;">
            <span style="font-size:8pt;color:#777;">${termLabel}</span>
            ${subTitle ? `<span style="font-size:8pt;color:${hc.text};font-weight:700;">${subTitle}</span>` : ''}
          </div>
        </td>
        <td style="text-align:right;vertical-align:top;font-size:7.5pt;color:#9ca3af;padding-top:4px;line-height:1.8;">
          วันที่พิมพ์: ${today}<br>
          รวม ${totalPeriods} คาบ/สัปดาห์
        </td>
      </tr>
    </table>
    <div style="height:3px;background:linear-gradient(90deg,${hc.bg},${hc.border});border-radius:999px;margin-bottom:6px;"></div>
    <table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <thead><tr>
        <th style="border:1px solid ${hc.border};padding:5px 3px;background:linear-gradient(135deg, ${hc.bg}, ${hc.border});color:white;
          text-align:center;width:${Math.round(dayColW*3.78)}px;font-size:8pt;line-height:1.8;">วัน</th>
        ${headerCols}
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${refHtml}
    ${sigFooter}
  </div>`
}

// helper styles — ตารางรายวิชา: line-height 1.8 (Thai font ต้องการ), padding-top มากกว่า bottom เพื่อดัน text ขึ้น
// vertical-align:top + padding-top ให้ตำแหน่งแน่นอน (middle ไม่น่าเชื่อถือกับ Thai font ใน html2canvas)
// line-height:1.3 ลดความสูงแถว, padding:6px top ดันข้อความขึ้น
// padding เท่ากันทั้งบนล่าง = ข้อความอยู่กึ่งกลางแนวตั้ง
// top 1px, bottom 7px → ข้อความอยู่ค่อนไปทางบน
const thStyle = (hc) => `border:1px solid ${hc.border};padding:1px 6px 7px;background:${hc.light};color:${hc.text};font-weight:700;font-size:7.5pt;line-height:1.3;vertical-align:top;text-align:center;`
const tdStyle = `border:1px solid #e5e7eb;padding:1px 6px 7px;font-size:7.5pt;line-height:1.3;vertical-align:top;`

// Export PDF — render ทีละหน้า element ต้องอยู่ใน viewport จริง (browser ไม่ paint นอก viewport)
async function exportPDF(section) {
  const items = getItems(section)
  if (!items.length) return
  generating.value = `${section}_pdf`

  const isPortrait = toggles.orientation === 'portrait'
  const pW = isPortrait ? 210 : 297
  const pH = isPortrait ? 297 : 210
  const pageWidthPx = Math.round(pW * 3.7795)

  // ── Overlay ปิดหน้าจอระหว่าง render ──────────────────────────────────
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(255,255,255,0.97);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Sarabun',sans-serif;
  `
  const progressEl = document.createElement('div')
  progressEl.style.cssText = 'font-size:14px;color:#4f46e5;margin-top:12px;'
  overlay.innerHTML = `<div style="font-size:32px;">📄</div>
    <div style="font-size:16px;font-weight:700;color:#1f2937;margin-top:8px;">กำลังสร้าง PDF...</div>`
  overlay.appendChild(progressEl)
  document.body.appendChild(overlay)

  // ── Container อยู่ใน viewport (ถึงจะ render ได้) แต่อยู่หลัง overlay ──
  const container = document.createElement('div')
  container.style.cssText = `
    position:fixed;top:0;left:0;
    width:${pageWidthPx}px;
    background:white;
    z-index:99998;
    font-family:'Sarabun','Noto Sans Thai',sans-serif;
    overflow:visible;
  `
  document.body.appendChild(container)

  try {
    await document.fonts.ready

    // สร้าง PDF เดียว รวมทุกหน้า
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: isPortrait ? 'portrait' : 'landscape',
    })

    // Render ทีละ BATCH_SIZE เพื่อป้องกัน heap overflow แต่ใส่ใน PDF เดียว
    const BATCH_SIZE = 10
    let pageIndex = 0

    for (let b = 0; b < items.length; b += BATCH_SIZE) {
      const batch = items.slice(b, b + BATCH_SIZE)

      for (let i = 0; i < batch.length; i++) {
        const { id, type } = batch[i]
        pageIndex++

        progressEl.textContent = `หน้า ${pageIndex}/${items.length} (${id})`

        container.innerHTML = buildPageHTML(id, type)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

        const el = container.firstElementChild
        if (!el) continue

        const canvas = await html2canvas(el, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: pageWidthPx,
          x: 0, y: 0,
          scrollX: 0, scrollY: 0,
        })

        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        const imgH = Math.min((canvas.height / canvas.width) * pW, pH)

        // คืน memory canvas ทันทีหลัง encode
        canvas.width  = 0
        canvas.height = 0

        if (pageIndex > 1) pdf.addPage([pW, pH], isPortrait ? 'portrait' : 'landscape')
        pdf.addImage(imgData, 'JPEG', 0, 0, pW, imgH)
      }

      // หยุดสั้นๆ ระหว่าง batch ให้ browser GC ทำงาน
      if (b + BATCH_SIZE < items.length) await new Promise(r => setTimeout(r, 200))
    }

    const termLabel = term.value || 'timetable'
    pdf.save(`ตารางสอน_${section}_${termLabel}.pdf`)
    ElMessage.success(`✅ PDF รวม ${items.length} หน้า — ดาวน์โหลดเรียบร้อย`)

  } catch (e) {
    console.error(e)
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    if (container.parentNode) document.body.removeChild(container)
    if (overlay.parentNode)   document.body.removeChild(overlay)
    generating.value = ''
  }
}

// ── sanitize ชื่อ sheet ──────────────────────────────────────────────
function safeSheetName(name, idx) {
  return (name || '').replace(/[:\\\/\?\*\[\]]/g, '_').substring(0, 28) || `Sheet${idx + 1}`
}

// ── Color scheme per entity type (ARGB format สำหรับ ExcelJS) ────────
const XL_COLORS = {
  class:   { h: 'FF4F46E5', h2: 'FF7C3AED', alt: 'FFF5F3FF', day: 'FF6D28D9' },
  teacher: { h: 'FF1D4ED8', h2: 'FF2563EB', alt: 'FFEFF6FF', day: 'FF1E40AF' },
  lab:     { h: 'FF059669', h2: 'FF10B981', alt: 'FFF0FDF4', day: 'FF047857' },
}

// ── save Excel buffer เป็นไฟล์ ──────────────────────────────────────
async function saveExcelBuffer(wb, filename) {
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── fetch image URL → base64 data URL ────────────────────────────────
async function fetchImageBase64(url) {
  if (!url) return null
  try {
    if (url.startsWith('data:')) return url   // already base64
    const res  = await fetch(url, { mode: 'cors' })
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// ── apply style ทุก cell ในช่วง (row, colStart..colEnd) ─────────────
function styleRow(ws, rowNum, colStart, colEnd, style) {
  for (let c = colStart; c <= colEnd; c++) {
    const cell = ws.getCell(rowNum, c)
    if (style.fill)      cell.fill      = style.fill
    if (style.font)      cell.font      = style.font
    if (style.alignment) cell.alignment = style.alignment
    if (style.border)    cell.border    = style.border
  }
}

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
}
const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true }
const LEFT   = { horizontal: 'left',   vertical: 'middle', wrapText: true }

// ── สร้าง sheet styled 1 entity ──────────────────────────────────────
async function buildStyledSheet(wb, entityId, entityType, days, perds, sheetName, logoBase64) {
  const info = schoolStore.schoolInfo || {}
  const c    = XL_COLORS[entityType] || XL_COLORS.class
  const ws   = wb.addWorksheet(sheetName)

  const numCols = perds.length + 1

  // column widths — col 1 (วัน) เล็กกว่าถ้ามีโลโก้
  ws.getColumn(1).width = 12
  perds.forEach((_, i) => { ws.getColumn(i + 2).width = 18 })

  const termLabel = `ภาคเรียนที่ ${info.semester||''} ปีการศึกษา ${info.year||''}`

  // ── แถว 1-2: โลโก้ + ชื่อโรงเรียน + ชื่อตาราง ──────────────────
  // โลโก้ใน col A (rows 1-2), ชื่อใน cols B-N
  if (logoBase64) {
    try {
      const ext    = logoBase64.includes('image/png') ? 'png' : 'jpeg'
      const imgId  = wb.addImage({ base64: logoBase64.split(',')[1], extension: ext })
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } })
    } catch (e) { /* ignore logo error */ }
    // col A rows 1-2 = พื้นที่โลโก้
    ws.getColumn(1).width = 9
    // ชื่อโรงเรียน merge B1:last col
    ws.mergeCells(1, 2, 1, numCols)
    const r1 = ws.getRow(1)
    r1.height = 30
    r1.getCell(2).value     = info.name || 'โรงเรียน'
    r1.getCell(2).font      = { name: 'TH SarabunPSK', size: 14, bold: true, color: { argb: c.h } }
    r1.getCell(2).alignment = CENTER
    // ชื่อตาราง merge B2:last col
    ws.mergeCells(2, 2, 2, numCols)
    const r2 = ws.getRow(2)
    r2.height = 26
    let entityLabel2 = entityId
    if (entityType === 'class') entityLabel2 = `ตารางเรียน ห้อง ${entityId}`
    else if (entityType === 'teacher') {
      const t = teachers.value.find(x => x.teacher_id === entityId)
      entityLabel2 = `ตารางสอน ${t ? `${t.prefix||''}${t.name} ${t.surname}` : entityId}`
    } else entityLabel2 = `ตารางการใช้ห้อง ${entityId}`
    r2.getCell(2).value     = `${entityLabel2}  ${termLabel}`
    r2.getCell(2).font      = { name: 'TH SarabunPSK', size: 11, bold: true }
    r2.getCell(2).alignment = CENTER
  } else {
    // ไม่มีโลโก้ — merge ทั้งแถว
    ws.mergeCells(1, 1, 1, numCols)
    const r1 = ws.getRow(1)
    r1.height = 26
    r1.getCell(1).value     = info.name || 'โรงเรียน'
    r1.getCell(1).font      = { name: 'TH SarabunPSK', size: 14, bold: true, color: { argb: c.h } }
    r1.getCell(1).alignment = CENTER

    let entityLabel = entityId
    if (entityType === 'class') entityLabel = `ตารางเรียน ห้อง ${entityId}`
    else if (entityType === 'teacher') {
      const t = teachers.value.find(x => x.teacher_id === entityId)
      entityLabel = `ตารางสอน ${t ? `${t.prefix||''}${t.name} ${t.surname}` : entityId}`
    } else entityLabel = `ตารางการใช้ห้อง ${entityId}`

    ws.mergeCells(2, 1, 2, numCols)
    const r2 = ws.getRow(2)
    r2.height = 20
    r2.getCell(1).value     = `${entityLabel}  ${termLabel}`
    r2.getCell(1).font      = { name: 'TH SarabunPSK', size: 11, bold: true }
    r2.getCell(1).alignment = CENTER
  }

  // ── แถว 3: ว่าง ──────────────────────────────────────────────────
  ws.getRow(3).height = 6

  // ── แถว 4: Header คาบ ────────────────────────────────────────────
  const headerRow = ws.getRow(4)
  headerRow.height = 24
  headerRow.getCell(1).value = 'วัน'
  perds.forEach((p, i) => { headerRow.getCell(i + 2).value = `คาบ ${p}` })
  styleRow(ws, 4, 1, numCols, {
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: c.h } },
    font:      { name: 'TH SarabunPSK', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: CENTER,
    border:    THIN_BORDER,
  })

  // ── แถว 5..N+4: ข้อมูลแต่ละวัน ──────────────────────────────────
  const GRID_START_ROW = 5
  days.forEach((day, di) => {
    const rIdx = GRID_START_ROW + di
    const row  = ws.getRow(rIdx)
    row.height = 60

    // คอลัมน์วัน
    row.getCell(1).value = day.label
    row.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.day } }
    row.getCell(1).font  = { name: 'TH SarabunPSK', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    row.getCell(1).alignment = CENTER
    row.getCell(1).border    = THIN_BORDER

    const rowFg = di % 2 === 0 ? 'FFFFFFFF' : c.alt
    perds.forEach((p, i) => {
      const slot = getSlot(entityId, entityType, day.value, p)
      let val = ''
      if (slot) {
        if (slot.type === 'activity' || slot.type === 'manual_lock') {
          val = slot.act_name || slot.name || 'กิจกรรม'
        } else {
          const parts = []
          if (entityType === 'class') {
            if (slot.subject_code)   parts.push(slot.subject_code)
            if (slot.subject_name)   parts.push(slot.subject_name)
            if (slot.teacher_name)   parts.push(slot.teacher_name)
            if (slot.preferred_room) parts.push(slot.preferred_room)
          } else if (entityType === 'teacher') {
            if (slot.class_id)       parts.push(slot.class_id)
            if (slot.subject_code)   parts.push(slot.subject_code)
            if (slot.subject_name)   parts.push(slot.subject_name)
            if (slot.preferred_room) parts.push(slot.preferred_room)
          } else {
            if (slot.class_id)       parts.push(slot.class_id)
            if (slot.subject_code)   parts.push(slot.subject_code)
            if (slot.subject_name)   parts.push(slot.subject_name)
            if (slot.teacher_name)   parts.push(slot.teacher_name)
          }
          val = parts.join('\n')
        }
      }
      const cell = row.getCell(i + 2)
      cell.value     = val
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFg } }
      cell.font      = { name: 'TH SarabunPSK', size: 9 }
      cell.alignment = CENTER
      cell.border    = THIN_BORDER
    })
  })

  // ── แถวว่างคั่น ──────────────────────────────────────────────────
  const SEP_ROW = GRID_START_ROW + days.length
  ws.getRow(SEP_ROW).height = 8

  // ── Reference list ──────────────────────────────────────────────
  const refList      = buildRefList(entityId, entityType)
  const totalPeriods = refList.reduce((s, r) => s + r.count, 0)
  let R = SEP_ROW + 1

  // ref title
  ws.mergeCells(R, 1, R, numCols)
  const refTitle = ws.getRow(R)
  refTitle.height = 20
  refTitle.getCell(1).value = `รายการวิชา (รวม ${totalPeriods} คาบ/สัปดาห์)`
  refTitle.getCell(1).font  = { name: 'TH SarabunPSK', size: 10, bold: true, color: { argb: c.h } }
  refTitle.getCell(1).alignment = LEFT
  R++

  // ref header
  const refCols = {
    class:   ['รหัสวิชา', 'ชื่อวิชา', 'ครูผู้สอน', 'ห้อง/Lab', 'คาบ/สัปดาห์'],
    teacher: ['ห้องเรียน', 'รหัสวิชา', 'ชื่อวิชา', 'ห้อง/Lab', 'คาบ/สัปดาห์'],
    lab:     ['ห้องเรียน', 'รหัสวิชา', 'ชื่อวิชา', 'ครูผู้สอน', 'คาบ/สัปดาห์'],
  }
  const refHeaderRow = ws.getRow(R)
  refHeaderRow.height = 20
  refCols[entityType].forEach((h, i) => {
    const cell = refHeaderRow.getCell(i + 1)
    cell.value     = h
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.h2 } }
    cell.font      = { name: 'TH SarabunPSK', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = CENTER
    cell.border    = THIN_BORDER
  })
  R++

  // ref data rows
  refList.forEach((ref, ri) => {
    const rowData = entityType === 'class'
      ? [ref.code, ref.name, ref.teacher, ref.room, ref.count]
      : entityType === 'teacher'
      ? [ref.class_id, ref.code, ref.name, ref.room, ref.count]
      : [ref.class_id, ref.code, ref.name, ref.teacher, ref.count]

    const dataRow = ws.getRow(R)
    dataRow.height = 18
    const rowFg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
    rowData.forEach((v, i) => {
      const isCount = i === rowData.length - 1
      const cell = dataRow.getCell(i + 1)
      cell.value     = v
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFg } }
      cell.font      = { name: 'TH SarabunPSK', size: 9, bold: isCount }
      cell.alignment = isCount ? CENTER : LEFT
      cell.border    = THIN_BORDER
    })
    R++
  })

  // ── ลายเซ็น ──────────────────────────────────────────────────────
  const sigs = getModuleSignatures('timetable')
  if (sigs && sigs.length) {
    // resolve ชื่อ dynamic
    const cls2 = entityType === 'class'   ? classes.value.find(x => x.class_id   === entityId) : null
    const t2   = entityType === 'teacher' ? teachers.value.find(x => x.teacher_id === entityId) : null
    const dynVals = {
      advisor:   cls2?.homeroom_teacher_name_snapshot || cls2?.advisor_name || '',
      teacher:   t2 ? `${t2.prefix||''}${t2.name} ${t2.surname}` : '',
      principal: info.principal_name || info.signer_name || '',
    }

    // spacer 3 แถว (พื้นที่ลงนาม)
    R += 2; ws.getRow(R - 1).height = 8; ws.getRow(R).height = 8

    // แบ่ง numCols ให้แต่ละ signer เท่าๆ กัน
    const sigW = Math.floor(numCols / sigs.length)

    // แถวเส้น / พื้นที่ลงนาม (signature image ถ้ามี)
    sigs.forEach((sig, si) => {
      let name = sig.name || ''
      if (!name && sig.auto_from) name = dynVals[sig.role] || ''
      if (!name) name = dynVals[sig.role] || ''

      const colStart = si * sigW + 1
      const colEnd   = si === sigs.length - 1 ? numCols : (si + 1) * sigW

      // แถวพื้นที่ลงนาม (เส้นหรือรูป)
      if (sig.sig_img) {
        // ถ้ามีรูปลายเซ็น — ฝังรูป
        try {
          const imgExt = sig.sig_img.includes('image/png') ? 'png' : 'jpeg'
          const sigImgId = wb.addImage({ base64: sig.sig_img.split(',')[1], extension: imgExt })
          const sigColPx = sigW * 64  // ประมาณ pixel ต่อ column
          ws.addImage(sigImgId, {
            tl: { col: colStart - 1, row: R - 1 },
            ext: { width: Math.min(sigColPx * 0.6, 100), height: 36 },
          })
        } catch { /* ignore */ }
      }
      ws.mergeCells(R, colStart, R, colEnd)
      const lineCell = ws.getRow(R).getCell(colStart)
      lineCell.value     = sig.sig_img ? '' : '_ _ _ _ _ _ _ _ _ _ _ _ _ _'
      lineCell.font      = { name: 'TH SarabunPSK', size: 9, color: { argb: 'FFAAAAAA' } }
      lineCell.alignment = CENTER

      // แถวชื่อ (name)
      ws.mergeCells(R + 1, colStart, R + 1, colEnd)
      const nameCell = ws.getRow(R + 1).getCell(colStart)
      nameCell.value     = name ? `(${name})` : '(                              )'
      nameCell.font      = { name: 'TH SarabunPSK', size: 9 }
      nameCell.alignment = CENTER

      // แถว role label
      ws.mergeCells(R + 2, colStart, R + 2, colEnd)
      const roleCell = ws.getRow(R + 2).getCell(colStart)
      roleCell.value     = sig.label || ''
      roleCell.font      = { name: 'TH SarabunPSK', size: 9, bold: true, color: { argb: c.h } }
      roleCell.alignment = CENTER

      // แถว position
      if (sig.position) {
        ws.mergeCells(R + 3, colStart, R + 3, colEnd)
        const posCell = ws.getRow(R + 3).getCell(colStart)
        posCell.value     = sig.position
        posCell.font      = { name: 'TH SarabunPSK', size: 9, color: { argb: 'FF6B7280' } }
        posCell.alignment = CENTER
      }
    })

    ws.getRow(R).height     = 32  // พื้นที่ลงนาม
    ws.getRow(R + 1).height = 18
    ws.getRow(R + 2).height = 18
    ws.getRow(R + 3).height = 16
  }
}

// Export Excel (styled timetable)
async function exportExcel(section) {
  const items = getItems(section)
  if (!items.length) return
  generating.value = `${section}_xlsx`
  try {
    const wb   = new ExcelJS.Workbook()
    wb.creator = 'TeachTable'
    const days = DAYS.value
    const perds = PERIODS.value

    // โหลดโลโก้ครั้งเดียว แล้วใช้ทุก sheet
    const logoB64 = await fetchImageBase64(schoolStore.schoolInfo?.logo_url)

    for (let idx = 0; idx < items.length; idx++) {
      const { id, type } = items[idx]
      await buildStyledSheet(wb, id, type, days, perds, safeSheetName(id, idx), logoB64)
    }

    await saveExcelBuffer(wb, `timetable_${section}.xlsx`)
    ElMessage.success(`✅ Excel ${items.length} ชีต เรียบร้อย`)
  } catch (e) {
    console.error('exportExcel error:', e)
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    generating.value = ''
  }
}

// Export Excel2 (flat data)
async function exportExcel2(section) {
  const items = getItems(section)
  if (!items.length) return
  generating.value = `${section}_xlsx2`
  try {
    const wb   = new ExcelJS.Workbook()
    wb.creator = 'TeachTable'
    const ws   = wb.addWorksheet('data')
    const days = DAYS.value
    const perds = PERIODS.value
    const c    = XL_COLORS[items[0]?.type] || XL_COLORS.class

    // column widths
    ws.columns = [
      { width: 14 }, { width: 6 }, { width: 6 },
      { width: 16 }, { width: 22 }, { width: 12 },
    ]

    // header row
    const hRow = ws.addRow(['hong', 'day', 'kab', 'sub', 'teacher', 'lab'])
    hRow.height = 22
    hRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.h } }
      cell.font      = { name: 'TH SarabunPSK', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = CENTER
      cell.border    = THIN_BORDER
    })

    let rowIdx = 1
    items.forEach(({ id, type }) => {
      let hong = id
      if (type === 'teacher') {
        const t = teachers.value.find(x => x.teacher_id === id)
        hong = t ? `${t.prefix||''}${t.name} ${t.surname}` : id
      }
      days.forEach((day, di) => {
        perds.forEach(p => {
          const slot = getSlot(id, type, day.value, p)
          let sub = '-', teacher = '-', lab = '-'
          if (slot) {
            if (slot.type === 'activity' || slot.type === 'manual_lock') {
              sub = slot.act_name || slot.name || 'กิจกรรม'
            } else {
              sub     = slot.subject_code || '-'
              teacher = slot.teacher_name || '-'
              lab     = slot.preferred_room || '-'
            }
          }
          const rowFg = rowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5'
          const dRow = ws.addRow([hong, di + 1, p, sub, teacher, lab])
          dRow.height = 18
          dRow.eachCell((cell, col) => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFg } }
            cell.font      = { name: 'TH SarabunPSK', size: 9 }
            cell.alignment = col <= 3 ? CENTER : LEFT
            cell.border    = THIN_BORDER
          })
          rowIdx++
        })
      })
    })

    await saveExcelBuffer(wb, `timetable_${section}_data.xlsx`)
    ElMessage.success(`✅ Excel Data ${rowIdx} แถว เรียบร้อย`)
  } catch (e) {
    console.error('exportExcel2 error:', e)
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    generating.value = ''
  }
}

function getItems(section) {
  if (section === 'class')   return selectedClasses.value.map(id => ({ id, type: 'class' }))
  if (section === 'teacher') return selectedTeachers.value.map(id => ({ id, type: 'teacher' }))
  if (section === 'lab')     return selectedLabs.value.map(id => ({ id, type: 'lab' }))
  return []
}
</script>

<style scoped>
.print-page {
  padding: 24px;
  min-height: 100vh;
  background: #f1f5f9;
}
.page-header {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%);
  border-radius: 16px;
  padding: 22px 28px;
  box-shadow: 0 8px 32px rgba(79,70,229,0.25);
}
.header-icon {
  font-size: 2rem;
  background: rgba(255,255,255,0.2);
  border-radius: 12px;
  padding: 8px 12px;
}
.options-bar {
  background: white;
  border-radius: 14px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
}
.publish-source-banner {
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}
.publish-source-title {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 6px;
}
.publish-source-text {
  font-size: 13px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.publish-source-ok {
  background: #ecfeff;
  border-color: #a5f3fc;
  color: #155e75;
}
.publish-source-warn {
  background: #fffbeb;
  border-color: #fed7aa;
  color: #9a3412;
}
.publish-chip {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(21, 94, 117, 0.2);
  border-radius: 999px;
  padding: 2px 10px;
  font-weight: 700;
}
.options-title { font-size: 13px; font-weight: 700; color: #475569; }
.opt-group-label { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.4px; text-transform: uppercase; }

/* Toggle checkbox + badge */
.tog-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid #e2e8f0;
  color: #94a3b8;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  white-space: nowrap;
}
.tog-label:hover { border-color: #cbd5e1; color: #64748b; background: #f1f5f9; }
.tog-chk {
  width: 13px; height: 13px; margin: 0;
  cursor: pointer; accent-color: currentColor; flex-shrink: 0;
}
.tog-disabled { opacity: 0.38; cursor: not-allowed; pointer-events: none; }
/* active color variants */
.tog-blue   { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
.tog-indigo { background: #e0e7ff; color: #4338ca; border-color: #a5b4fc; }
.tog-purple { background: #ede9fe; color: #7c3aed; border-color: #c4b5fd; }
.tog-green  { background: #dcfce7; color: #15803d; border-color: #86efac; }
.tog-sky    { background: #e0f2fe; color: #0369a1; border-color: #7dd3fc; }
.tog-amber  { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
.tog-rose   { background: #ffe4e6; color: #be123c; border-color: #fda4af; }
.tog-slate  { background: #f1f5f9; color: #334155; border-color: #64748b; }

.section-card {
  background: white;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  display: flex;
  flex-direction: column;
}
.section-class   { border-top: 4px solid #7c3aed; }
.section-teacher { border-top: 4px solid #1d4ed8; }
.section-lab     { border-top: 4px solid #059669; }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #f1f5f9;
}
.section-title { display: flex; align-items: center; gap: 8px; }
.section-icon {
  width: 30px; height: 30px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
}
/* Level bar */
.level-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  padding: 8px 14px; background: #faf5ff; border-bottom: 1px solid #f1f5f9;
}
.level-bar-label { font-size: 11px; color: #9ca3af; font-weight: 600; margin-right: 2px; }
.btn-level {
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
  border: 1.5px solid #c4b5fd; color: #7c3aed; background: white;
  cursor: pointer; transition: all 0.15s;
}
.btn-level:hover { background: #ede9fe; }
.btn-level-active { background: #7c3aed !important; color: white !important; border-color: #7c3aed !important; }

.level-group-label {
  font-size: 11px; font-weight: 700; color: #7c3aed;
  padding: 4px 10px 2px; background: #f5f3ff;
  border-radius: 6px; margin: 4px 0 2px; letter-spacing: 0.5px;
}

.loading-state { padding: 20px; text-align: center; font-size: 13px; color: #94a3b8; }
.item-list { flex: 1; overflow-y: auto; max-height: 300px; padding: 8px; }
.item-row {
  display: flex; align-items: center;
  padding: 5px 10px; border-radius: 8px;
  font-size: 13px; cursor: pointer; margin-bottom: 2px; transition: background 0.15s;
}
.item-row-purple:hover { background: #f5f3ff; }
.item-row-blue:hover   { background: #eff6ff; }
.item-row-green:hover  { background: #f0fdf4; }
.item-selected-purple  { background: #ede9fe; }
.item-selected-blue    { background: #dbeafe; }
.item-selected-green   { background: #dcfce7; }
.item-sub { font-size: 11px; color: #94a3b8; }

.section-footer {
  padding: 10px 14px;
  border-top: 1px solid #f1f5f9;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.count-badge {
  font-size: 12px; font-weight: 600;
  padding: 2px 10px; border-radius: 20px; white-space: nowrap;
}
.count-purple { background: #ede9fe; color: #7c3aed; }
.count-blue   { background: #dbeafe; color: #1d4ed8; }
.count-green  { background: #dcfce7; color: #059669; }

.btn-export {
  flex: 1; padding: 7px 10px; border-radius: 8px;
  font-size: 12px; font-weight: 600; border: none; cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  min-width: 70px;
}
.btn-export:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
.btn-export:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-pdf-purple  { background: linear-gradient(135deg,#7c3aed,#6d28d9); color: white; }
.btn-xlsx-purple { background: linear-gradient(135deg,#a78bfa,#8b5cf6); color: white; }
.btn-pdf-blue    { background: linear-gradient(135deg,#1d4ed8,#1e40af); color: white; }
.btn-xlsx-blue   { background: linear-gradient(135deg,#60a5fa,#3b82f6); color: white; }
.btn-pdf-green   { background: linear-gradient(135deg,#059669,#047857); color: white; }
.btn-xlsx-green  { background: linear-gradient(135deg,#34d399,#10b981); color: white; }
.btn-data-purple { background: linear-gradient(135deg,#c4b5fd,#a78bfa); color: white; }
.btn-data-blue   { background: linear-gradient(135deg,#93c5fd,#60a5fa); color: white; }
.btn-data-green  { background: linear-gradient(135deg,#6ee7b7,#34d399); color: white; }

.btn-sm {
  padding: 3px 10px; border-radius: 6px; font-size: 11px;
  font-weight: 600; cursor: pointer; border: none; transition: background 0.15s;
}
.btn-outline-purple { background: #ede9fe; color: #7c3aed; }
.btn-outline-blue   { background: #dbeafe; color: #1d4ed8; }
.btn-outline-green  { background: #dcfce7; color: #059669; }
.btn-ghost { background: #f1f5f9; color: #64748b; }
.btn-sm:hover { opacity: 0.8; }

.summary-bar {
  background: white; border-radius: 12px;
  padding: 14px 20px; border: 1px solid #e2e8f0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.summary-chip {
  font-size: 13px; font-weight: 600;
  padding: 4px 12px; border-radius: 20px;
}
.chip-purple { background: #ede9fe; color: #7c3aed; }
.chip-blue   { background: #dbeafe; color: #1d4ed8; }
.chip-green  { background: #dcfce7; color: #059669; }

/* Dept bar — blue variant เหมือน level-bar แต่สำหรับกลุ่มสาระครู */
.dept-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  padding: 8px 14px; background: #eff6ff; border-bottom: 1px solid #f1f5f9;
}
.dept-bar-label { font-size: 11px; color: #9ca3af; font-weight: 600; margin-right: 2px; }
.btn-dept {
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
  border: 1.5px solid #93c5fd; color: #1d4ed8; background: white;
  cursor: pointer; transition: all 0.15s;
}
.btn-dept:hover { background: #dbeafe; }
.btn-dept-active { background: #1d4ed8 !important; color: white !important; border-color: #1d4ed8 !important; }

.dept-group-label {
  font-size: 11px; font-weight: 700; color: #1d4ed8;
  padding: 4px 10px 2px; background: #eff6ff;
  border-radius: 6px; margin: 4px 0 2px; letter-spacing: 0.5px;
}
</style>
