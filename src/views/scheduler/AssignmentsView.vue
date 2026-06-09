<template>
  <AppLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">📋 มอบหมายภาระงานสอน</h1>
            <p class="text-white/80 text-sm mt-1">กำหนดครู + วิชา + ห้องเรียน + จำนวนคาบ/สัปดาห์</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <el-button @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก
            </el-button>
            <el-button v-if="!isLocked" @click="handleImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า
            </el-button>
            <el-button @click="handlePrint" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🖨️ พิมพ์รายงาน
            </el-button>
            <el-button v-if="!isLocked" type="primary" @click="openDialog()"
              style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
              + เพิ่มรายการ
            </el-button>
            <span v-if="isLocked" class="text-xs text-white/80 bg-red-500/40 px-3 py-1.5 rounded-lg font-semibold">🔒 ล็อคแล้ว</span>
            <input ref="importFileRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onImportFile" />
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="stat-value" style="color:#1d4ed8">{{ filteredAssignments.length }}</div>
          <div class="stat-label">รายการตามตัวกรอง</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ filteredDoneCount }}</div>
          <div class="stat-label">จัดตารางครบแล้ว (กรอง)</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fff7ed,#fed7aa)">
          <div class="stat-value" style="color:#c2410c">{{ filteredPendingCount }}</div>
          <div class="stat-label">ยังไม่ครบ (กรอง)</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fdf4ff,#fae8ff)">
          <div class="stat-value" style="color:#a21caf">{{ filteredTotalPeriods }}</div>
          <div class="stat-label">คาบรวม/สัปดาห์ (กรอง)</div>
        </div>
      </div>

      <!-- Summary Section -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06);margin-bottom:6px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb)">
        <div class="grid grid-cols-4 gap-3 text-xs">
          <div class="p-2 rounded-lg bg-white/80 text-center">
            <div class="font-semibold text-gray-700">{{ uniqueClasses.length }}</div>
            <div class="text-gray-500 text-xs">ห้องเรียน</div>
          </div>
          <div class="p-2 rounded-lg bg-white/80 text-center">
            <div class="font-semibold text-gray-700">{{ uniqueTeachers.length }}</div>
            <div class="text-gray-500 text-xs">ครูผู้สอน</div>
          </div>
          <div class="p-2 rounded-lg bg-white/80 text-center">
            <div class="font-semibold text-gray-700">{{ uniqueSubjects.length }}</div>
            <div class="text-gray-500 text-xs">วิชาสอน</div>
          </div>
          <div class="p-2 rounded-lg bg-white/80 text-center">
            <div class="font-semibold text-gray-700">{{ placedCount }}/{{ totalPeriods }}</div>
            <div class="text-gray-500 text-xs">คาบจัดแล้ว</div>
          </div>
        </div>
      </el-card>
      <!-- Filters -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <el-select v-model="filterClass" placeholder="ทุกห้อง" clearable class="w-36">
          <el-option v-for="c in classes" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
        </el-select>
        <el-select v-model="filterTeacher" placeholder="ทุกครู" clearable class="w-48">
          <el-option v-for="t in teachers" :key="t.teacher_id"
            :label="`${t.prefix || ''}${t.name} ${t.surname}`" :value="t.teacher_id" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="ทุกสถานะ" clearable class="w-36">
          <el-option label="ครบแล้ว" value="done" />
          <el-option label="ยังไม่ครบ" value="pending" />
        </el-select>
        <el-input v-model="filterText" placeholder="ค้นหาวิชา..." class="w-44" clearable />
      </div>

      <!-- Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <!-- Lock Banner -->
        <div v-if="isLocked" class="flex items-center gap-2 mb-3 px-4 py-2 rounded-lg text-sm font-semibold"
          style="background:#fef2f2;border:1.5px solid #fca5a5;color:#b91c1c">
          🔒 ระบบล็อคแล้ว — ดูและส่งออกได้ แต่เพิ่ม/ลบ/แก้ไขไม่ได้
        </div>
        <!-- Bulk Actions Bar -->
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <el-button size="small" @click="tableRef?.toggleAllSelection()">เลือกทั้งหมด</el-button>
          <el-button size="small" @click="tableRef?.clearSelection()">ยกเลิกเลือก</el-button>
          <el-button v-if="!isLocked" size="small" type="danger"
            :disabled="!selectedRows.length"
            @click="deleteSelected">
            🗑️ ลบที่เลือก ({{ selectedRows.length }})
          </el-button>
          <el-button v-if="!isLocked" size="small" type="danger" plain @click="deleteAll">
            ❌ ลบทั้งหมด
          </el-button>
          <el-button size="small" type="warning" plain @click="validatePeriods">
            🔍 ตรวจสอบความถูกต้อง
          </el-button>
        </div>
        <el-table ref="tableRef" :data="filteredAssignments" border stripe v-loading="loading"
          @selection-change="onSelectionChange"
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }">
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column type="index" width="50" />
          <el-table-column label="ห้องเรียน" prop="class_id" width="90" sortable align="center">
            <template #default="{ row }">
              <span class="font-semibold text-purple-700">{{ row.class_id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="วิชา" min-width="160">
            <template #default="{ row }">
              <div class="font-medium">{{ row.subject_name }}</div>
              <div class="text-xs text-gray-400">{{ row.subject_code }}</div>
            </template>
          </el-table-column>
          <el-table-column label="ครูผู้สอน" min-width="130" prop="teacher_name" />
          <el-table-column label="ห้อง/Lab" width="120">
            <template #default="{ row }">
              <span v-if="row.preferred_room" class="text-blue-600 text-sm">🏛 {{ row.preferred_room }}</span>
              <span v-else class="text-gray-300 text-xs">ห้องเรียนปกติ</span>
            </template>
          </el-table-column>
          <el-table-column label="คาบ/สัปดาห์" width="110" align="center">
            <template #default="{ row }">
              <el-tag type="info">{{ row.periods_per_week }} คาบ</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="คาบติดกัน" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.consecutive_periods > 1" type="warning">{{ row.consecutive_periods }} คาบ</el-tag>
              <span v-else class="text-gray-400 text-sm">-</span>
            </template>
          </el-table-column>
          <el-table-column label="ความคืบหน้า" width="180">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <el-progress
                  :percentage="Math.min(100, Math.round(((row.placed||0) / row.periods_per_week) * 100))"
                  :status="row.done ? 'success' : (row.placed||0) > 0 ? '' : 'exception'"
                  :stroke-width="10" class="flex-1"
                />
                <span class="text-xs text-gray-500 w-12 text-right">{{ row.placed||0 }}/{{ row.periods_per_week }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="สถานะ" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.done ? 'success' : (row.placed||0) > 0 ? 'warning' : 'danger'" size="small">
                {{ row.done ? 'ครบแล้ว' : (row.placed||0) > 0 ? 'บางส่วน' : 'ยังไม่จัด' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="จัดการ" width="130" align="center" fixed="right">
            <template #default="{ row }">
              <template v-if="!isLocked">
                <el-button size="small" type="primary" plain @click="openDialog(row)">แก้ไข</el-button>
                <el-button size="small" type="danger" plain @click="deleteAssignment(row)">ลบ</el-button>
              </template>
              <span v-else class="text-xs text-gray-400">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Add/Edit Dialog -->
      <el-dialog v-model="dialogVisible" :title="editing ? 'แก้ไขภาระงานสอน' : 'เพิ่มภาระงานสอน'" width="560px" destroy-on-close>
        <el-form :model="form" :rules="rules" ref="formRef" label-width="130px">
          <el-form-item label="ห้องเรียน" prop="class_id">
            <el-select v-model="form.class_id" class="w-full" placeholder="เลือกห้องเรียน" filterable>
              <el-option v-for="c in classes" :key="c.class_id" :label="c.class_id" :value="c.class_id" />
            </el-select>
          </el-form-item>
          <el-form-item label="วิชา" prop="subject_code">
            <el-select v-model="form.subject_code" class="w-full" placeholder="เลือกวิชา" @change="onSubjectChange" filterable>
              <el-option v-for="s in subjects" :key="s.subject_code"
                :label="s.subject_code + ' — ' + s.name" :value="s.subject_code" />
            </el-select>
          </el-form-item>
          <el-form-item label="ครูผู้สอน" prop="teacher_id">
            <el-select v-model="form.teacher_id" class="w-full" placeholder="เลือกครู" @change="onTeacherChange" filterable>
              <el-option v-for="t in teachers" :key="t.teacher_id"
                :label="`${t.prefix || ''}${t.name} ${t.surname}`" :value="t.teacher_id" />
            </el-select>
          </el-form-item>

          <!-- 3D Scheduling: Room/Lab -->
          <el-form-item label="ห้อง/Lab (3D)">
            <el-select v-model="form.preferred_room" class="w-full" clearable filterable
              placeholder="เลือกห้องเรียน/Lab หรือพิมพ์ชื่อ" allow-create>
              <el-option label="— ไม่ระบุ —" value="" />
              <el-option-group v-if="rooms.filter(r => r.room_type === 'lab').length > 0" label="🔬 ห้อง Lab">
                <el-option v-for="r in rooms.filter(x => x.room_type === 'lab')"
                  :key="r.room_id" :label="`${r.room_id} — ${r.room_name}`" :value="r.room_id" />
              </el-option-group>
              <el-option-group v-if="rooms.filter(r => r.room_type === 'special').length > 0" label="✨ ห้องพิเศษ">
                <el-option v-for="r in rooms.filter(x => x.room_type === 'special')"
                  :key="r.room_id" :label="`${r.room_id} — ${r.room_name}`" :value="r.room_id" />
              </el-option-group>
              <el-option-group label="🏠 ห้องเรียนทั่วไป">
                <el-option v-for="r in rooms.filter(x => x.room_type === 'classroom' || x.room_type === 'other')"
                  :key="r.room_id" :label="`${r.room_id} — ${r.room_name}`" :value="r.room_id" />
              </el-option-group>
            </el-select>
            <div class="text-xs text-gray-400 mt-1">เลือกจากรายการ หรือพิมพ์ชื่อห้องเองได้</div>
          </el-form-item>

          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="คาบ/สัปดาห์" prop="periods_per_week">
              <el-input-number v-model="form.periods_per_week" :min="1" :max="15" />
              <span class="ml-2 text-gray-500 text-sm">คาบ</span>
            </el-form-item>
            <el-form-item label="คาบติดกัน">
              <el-input-number v-model="form.consecutive_periods" :min="1" :max="4" />
              <span class="ml-2 text-gray-500 text-sm">คาบ/ครั้ง</span>
            </el-form-item>
          </div>
          <el-alert v-if="form.consecutive_periods > 1 && form.periods_per_week > 0" type="info" :closable="false" class="mt-2">
            จะจัด {{ Math.floor(form.periods_per_week / form.consecutive_periods) }} ครั้ง ×
            {{ form.consecutive_periods }} คาบติดกัน
            <span v-if="form.periods_per_week % form.consecutive_periods !== 0" class="text-orange-600">
              (เหลือ {{ form.periods_per_week % form.consecutive_periods }} คาบไม่ตรง)
            </span>
          </el-alert>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="saveAssignment">บันทึก</el-button>
        </template>
      </el-dialog>

      <!-- Validate Dialog -->
      <el-dialog v-model="validateVisible" title="🔍 ผลการตรวจสอบความถูกต้อง" width="700px" destroy-on-close>
        <div v-if="!validateIssues.length" class="text-center py-8">
          <div class="text-4xl mb-3">✅</div>
          <div class="text-green-600 font-semibold text-lg">ข้อมูลถูกต้องทั้งหมด!</div>
          <div class="text-gray-400 text-sm mt-1">คาบ/สัปดาห์ของทุกวิชาสอดคล้องกับตารางวิชาเรียน</div>
        </div>
        <div v-else>
          <el-alert type="warning" :closable="false" class="mb-3">
            พบ {{ validateIssues.length }} รายการที่มีคาบ/สัปดาห์ไม่ตรงกับข้อมูลวิชา
          </el-alert>
          <el-table :data="validateIssues" border stripe size="small" max-height="400"
            :header-cell-style="{ background:'#f59e0b',color:'white',fontWeight:'600' }">
            <el-table-column label="ห้อง" prop="class_id" width="80" align="center" />
            <el-table-column label="วิชา" min-width="150">
              <template #default="{ row }">
                <div class="font-medium">{{ row.subject_name }}</div>
                <div class="text-xs text-gray-400">{{ row.subject_code }}</div>
              </template>
            </el-table-column>
            <el-table-column label="ครู" prop="teacher_name" min-width="120" />
            <el-table-column label="ตั้งไว้" width="80" align="center">
              <template #default="{ row }">
                <el-tag type="danger">{{ row.assigned_periods }} คาบ</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="ในตารางวิชา" width="100" align="center">
              <template #default="{ row }">
                <el-tag type="success">{{ row.subject_periods }} คาบ</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="ต่างกัน" width="80" align="center">
              <template #default="{ row }">
                <span class="font-bold" :class="row.diff > 0 ? 'text-orange-500' : 'text-blue-500'">
                  {{ row.diff > 0 ? '+' : '' }}{{ row.diff }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <template #footer>
          <el-button @click="validateVisible = false">ปิด</el-button>
          <el-button v-if="validateIssues.length" type="warning" :loading="autoFixing" @click="autoFixPeriods">
            🔧 ปรับให้ตรงตารางวิชา ({{ validateIssues.length }} รายการ)
          </el-button>
        </template>
      </el-dialog>

      <!-- Import Preview Dialog -->
      <el-dialog v-model="importPreviewVisible" title="📥 ตรวจสอบข้อมูลก่อนนำเข้า" width="800px">
        <div class="mb-3 text-sm text-gray-500">
          พบ <strong>{{ importRows.length }}</strong> รายการ —
          <span class="text-red-500">{{ importRows.filter(r => r._error).length }} ผิดพลาด</span> /
          <span class="text-green-600">{{ importRows.filter(r => !r._error).length }} พร้อมนำเข้า</span>
        </div>
        <el-table :data="importRows" border size="small" max-height="360">
          <el-table-column label="ห้อง" prop="class_id" width="80" align="center" />
          <el-table-column label="วิชา" width="130">
            <template #default="{ row }">
              <div>{{ row.subject_code }}</div>
              <div class="text-xs text-gray-400">{{ row.subject_name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="ครู" width="120">
            <template #default="{ row }">
              <div>{{ row.teacher_id }}</div>
              <div class="text-xs text-gray-400">{{ row.teacher_name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="ห้อง/Lab" prop="preferred_room" width="120" />
          <el-table-column label="คาบ/สัปดาห์" prop="periods_per_week" width="100" align="center" />
          <el-table-column label="คาบติดกัน" prop="consecutive_periods" width="90" align="center" />
          <el-table-column label="สถานะ" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="row._error ? 'danger' : 'success'" size="small">
                {{ row._error ? row._error : 'ตรวจสอบแล้ว' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <template #footer>
          <el-button @click="importPreviewVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="importSaving"
            :disabled="importRows.filter(r => !r._error).length === 0"
            @click="confirmImport">
            นำเข้า {{ importRows.filter(r => !r._error).length }} รายการ
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp, writeBatch, query, where } from '@/supabase/firestore'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { getSchoolDb } from '@/supabase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { usePrintReport } from '@/composables/usePrintReport'
import { useScheduleGuard } from '@/composables/useScheduleGuard'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { isLocked } = useScheduleGuard()
const { getTeachers, getSubjects, getClasses, getRooms, getRoomCatalog } = useSchoolDb()
const { printReport } = usePrintReport()
const term = () => schoolStore.currentTerm || '2568_1'
const db = () => getSchoolDb()

const loading = ref(false), saving = ref(false), dialogVisible = ref(false)
const editing = ref(null), formRef = ref()
const teachers = ref([]), subjects = ref([]), classes = ref([]), rooms = ref([])
const assignments = ref([])
const filterClass = ref(''), filterTeacher = ref(''), filterStatus = ref(''), filterText = ref('')
const importFileRef = ref(null)
const importPreviewVisible = ref(false)
const importRows = ref([])
const importSaving = ref(false)
const tableRef = ref()
const selectedRows = ref([])
const validateVisible = ref(false)
const validateIssues = ref([])
const autoFixing = ref(false)

const form = reactive({
  class_id: '',
  subject_code: '',
  subject_name: '',
  teacher_id: '',
  teacher_name: '',
  preferred_room: '',
  periods_per_week: 3,
  consecutive_periods: 1
})

const rules = {
  class_id: [{ required: true, message: 'กรุณาเลือกห้องเรียน', trigger: 'change' }],
  subject_code: [{ required: true, message: 'กรุณาเลือกวิชา', trigger: 'change' }],
  teacher_id: [{ required: true, message: 'กรุณาเลือกครู', trigger: 'change' }],
  periods_per_week: [{ required: true, type: 'number', min: 1 }],
}

const filteredAssignments = computed(() => assignments.value.filter(a => {
  if (filterClass.value && a.class_id !== filterClass.value) return false
  if (filterTeacher.value && a.teacher_id !== filterTeacher.value) return false
  if (filterStatus.value === 'done' && !a.done) return false
  if (filterStatus.value === 'pending' && a.done) return false
  if (filterText.value && !a.subject_name?.includes(filterText.value) && !a.subject_code?.includes(filterText.value)) return false
  return true
}))

const doneCount = computed(() => assignments.value.filter(a => a.done).length)
const pendingCount = computed(() => assignments.value.filter(a => !a.done).length)
const totalPeriods = computed(() => assignments.value.reduce((s, a) => s + (a.periods_per_week || 0), 0))
const filteredDoneCount = computed(() => filteredAssignments.value.filter(a => a.done).length)
const filteredPendingCount = computed(() => filteredAssignments.value.filter(a => !a.done).length)
const filteredTotalPeriods = computed(() => filteredAssignments.value.reduce((s, a) => s + (a.periods_per_week || 0), 0))

const uniqueClasses = computed(() => {
  const classIds = new Set(filteredAssignments.value.map(a => a.class_id))
  return Array.from(classIds)
})

const uniqueTeachers = computed(() => {
  const teacherIds = new Set(filteredAssignments.value.map(a => a.teacher_id))
  return Array.from(teacherIds)
})

const uniqueSubjects = computed(() => {
  const subjectCodes = new Set(filteredAssignments.value.map(a => a.subject_code))
  return Array.from(subjectCodes)
})

const placedCount = computed(() => {
  return filteredAssignments.value.reduce((s, a) => s + (a.placed || 0), 0)
})

function mapCatalogRooms(catalog) {
  const activeRooms = Array.isArray(catalog?.active_rooms) ? catalog.active_rooms : []
  return activeRooms.map(r => ({
    room_id: r.room_id,
    room_name: r.room_name || '',
    room_type: r.room_type || 'other',
    is_active: r.is_active !== false,
  }))
}

async function loadRoomOptions() {
  try {
    const catalog = await getRoomCatalog()
    const roomsFromCatalog = mapCatalogRooms(catalog)
    if (roomsFromCatalog.length) return roomsFromCatalog
  } catch {
    // fallback to direct collection read when catalog is unavailable
  }
  const allRooms = await getRooms()
  return allRooms.filter(r => r.is_active !== false)
}

onMounted(async () => {
  loading.value = true
  try {
    const [t, s, c, r] = await Promise.all([getTeachers(), getSubjects(), getClasses(), loadRoomOptions()])
    teachers.value = t
    subjects.value = s
    classes.value = c
    rooms.value = r
    await reload()
  } finally {
    loading.value = false
  }
})

async function reload() {
  const [aSnap, gSnap] = await Promise.all([
    getDocs(collection(db(), `terms/${term()}/teaching_assignments`)),
    getDocs(collection(db(), `terms/${term()}/timetable_grid`)),
  ])
  const grid = {}
  gSnap.docs.forEach(d => { grid[d.id] = d.data() })
  assignments.value = aSnap.docs.map(d => {
    const a = { id: d.id, ...d.data() }
    const placed = Object.values(grid).filter(s => s.assign_id === a.assign_id && s.type === 'subject').length
    return { ...a, placed, done: placed >= a.periods_per_week }
  })
}

function openDialog(a = null) {
  editing.value = a
  Object.assign(form, a
    ? {
        class_id: a.class_id,
        subject_code: a.subject_code,
        subject_name: a.subject_name,
        teacher_id: a.teacher_id,
        teacher_name: a.teacher_name,
        preferred_room: a.preferred_room || '',
        periods_per_week: a.periods_per_week,
        consecutive_periods: a.consecutive_periods || 1
      }
    : {
        class_id: '',
        subject_code: '',
        subject_name: '',
        teacher_id: '',
        teacher_name: '',
        preferred_room: '',
        periods_per_week: 3,
        consecutive_periods: 1
      }
  )
  dialogVisible.value = true
}

function onSubjectChange(code) {
  const s = subjects.value.find(s => s.subject_code === code)
  if (s) {
    form.subject_name = s.name
    form.consecutive_periods = s.consecutive_periods || 1
    form.periods_per_week = s.periods_per_week || form.periods_per_week
  }
}

function onTeacherChange(id) {
  const t = teachers.value.find(t => t.teacher_id === id)
  if (t) form.teacher_name = `${t.prefix || ''}${t.name} ${t.surname}`
}

async function saveAssignment() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return

    // ตรวจสอบวิชาซ้ำในห้องเดียวกัน (เฉพาะเพิ่มใหม่)
    if (!editing.value) {
      const dup = assignments.value.find(a =>
        a.class_id === form.class_id && a.subject_code === form.subject_code
      )
      if (dup) {
        ElMessage.error(`วิชา "${form.subject_name || form.subject_code}" มีอยู่ในห้อง ${form.class_id} แล้ว (ครู: ${dup.teacher_name})`)
        return
      }
    }

    saving.value = true
    try {
      const id = editing.value?.assign_id || `${form.class_id}_${form.subject_code}_${Date.now()}`.replace(/\//g, '_')
      await setDoc(doc(db(), `terms/${term()}/teaching_assignments`, id), {
        assign_id: id,
        ...form,
        updated_by: authStore.profile?.uid,
        updated_by_name: authStore.profile?.displayName,
        updated_at: serverTimestamp()
      }, { merge: true })
      ElMessage.success('บันทึกเรียบร้อย')
      dialogVisible.value = false
      await reload()
    } catch (e) {
      ElMessage.error(e.message)
    } finally {
      saving.value = false
    }
  })
}

// ===== ปรับอัตโนมัติ: ตั้ง periods_per_week ให้ตรงกับตารางวิชา =====
async function autoFixPeriods() {
  if (!validateIssues.value.length) return
  autoFixing.value = true
  try {
    let fixed = 0
    for (const issue of validateIssues.value) {
      const a = assignments.value.find(x => x.class_id === issue.class_id && x.subject_code === issue.subject_code)
      if (!a) continue
      const id = a.assign_id || a.id
      await setDoc(doc(db(), `terms/${term()}/teaching_assignments`, id), {
        ...a,
        periods_per_week: issue.subject_periods,
        updated_by: authStore.profile?.uid,
        updated_at: serverTimestamp()
      }, { merge: true })
      fixed++
    }
    await reload()
    validateIssues.value = []
    ElMessage.success(`ปรับ ${fixed} รายการให้ตรงกับตารางวิชาเรียบร้อย`)
    validateVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    autoFixing.value = false
  }
}

// ===== ตรวจสอบความถูกต้อง: เทียบ periods_per_week กับตารางวิชา =====
function validatePeriods() {
  const issues = []
  assignments.value.forEach(a => {
    const subj = subjects.value.find(s => s.subject_code === a.subject_code)
    if (!subj) return  // ไม่พบวิชา ข้ามไป
    const subjectPeriods = subj.periods_per_week
    if (!subjectPeriods) return  // วิชาไม่ได้กำหนด periods_per_week
    const diff = a.periods_per_week - subjectPeriods
    if (diff !== 0) {
      issues.push({
        class_id: a.class_id,
        subject_code: a.subject_code,
        subject_name: a.subject_name,
        teacher_name: a.teacher_name,
        assigned_periods: a.periods_per_week,
        subject_periods: subjectPeriods,
        diff,
      })
    }
  })
  validateIssues.value = issues
  validateVisible.value = true
}

async function deleteAssignment(a) {
  try {
    await ElMessageBox.confirm(
      `ลบ "${a.subject_name}" ห้อง ${a.class_id}?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    await deleteDoc(doc(db(), `terms/${term()}/teaching_assignments`, a.assign_id || a.id))
    ElMessage.success('ลบเรียบร้อย')
    await reload()
  } catch {
    // cancelled
  }
}

function onSelectionChange(rows) { selectedRows.value = rows }

async function deleteSelected() {
  if (!selectedRows.value.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบ ${selectedRows.value.length} รายการที่เลือก?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    for (const row of selectedRows.value) {
      await deleteDoc(doc(db(), `terms/${term()}/teaching_assignments`, row.assign_id || row.id))
    }
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
    await reload()
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = filteredAssignments.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) {
      await deleteDoc(doc(db(), `terms/${term()}/teaching_assignments`, row.assign_id || row.id))
    }
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
    await reload()
  } catch { /* cancelled */ } finally { loading.value = false }
}

// ===== Export =====
function handleExport() {
  const rows = assignments.value.map(a => ({
    'ห้องเรียน': a.class_id || '',
    'รหัสวิชา': a.subject_code || '',
    'ชื่อวิชา': a.subject_name || '',
    'รหัสครู': a.teacher_id || '',
    'ชื่อครู': a.teacher_name || '',
    'ห้อง/Lab': a.preferred_room || '',
    'คาบ/สัปดาห์': a.periods_per_week || 0,
    'คาบติดกัน': a.consecutive_periods || 1,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'มอบหมายภาระงาน')
  // Template
  const tplRows = [
    { 'ห้องเรียน': 'ม.1/1', 'รหัสวิชา': 'T11101', 'รหัสครู': 'T001', 'ห้อง/Lab': '', 'คาบ/สัปดาห์': 3, 'คาบติดกัน': 1 },
    { 'ห้องเรียน': 'ม.1/1', 'รหัสวิชา': 'S21101', 'รหัสครู': 'T002', 'ห้อง/Lab': 'ห้องวิทยาศาสตร์', 'คาบ/สัปดาห์': 4, 'คาบติดกัน': 2 },
  ]
  const wsTpl = XLSX.utils.json_to_sheet(tplRows)
  XLSX.utils.book_append_sheet(wb, wsTpl, 'Template')
  XLSX.writeFile(wb, `assignments_${term()}.xlsx`)
  ElMessage.success('ส่งออกข้อมูลสำเร็จ')
}

// ===== Import =====
function handleImport() {
  importFileRef.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws)
    importRows.value = rows.map(row => {
      const class_id = String(row['ห้องเรียน'] || '').trim()
      const subject_code = String(row['รหัสวิชา'] || '').trim()
      const teacher_id = String(row['รหัสครู'] || '').trim()
      let _error = null

      // Cross-reference validation
      if (!class_id) _error = 'ไม่มีห้องเรียน'
      else if (!subject_code) _error = 'ไม่มีรหัสวิชา'
      else if (!teacher_id) _error = 'ไม่มีรหัสครู'
      else if (!classes.value.find(c => c.class_id === class_id)) _error = `ไม่พบห้อง "${class_id}"`
      else if (!subjects.value.find(s => s.subject_code === subject_code)) _error = `ไม่พบวิชา "${subject_code}"`
      else if (!teachers.value.find(t => t.teacher_id === teacher_id)) _error = `ไม่พบครู "${teacher_id}"`

      const subject = subjects.value.find(s => s.subject_code === subject_code)
      const teacher = teachers.value.find(t => t.teacher_id === teacher_id)

      return {
        class_id,
        subject_code,
        subject_name: subject?.name || String(row['ชื่อวิชา'] || '').trim(),
        teacher_id,
        teacher_name: teacher ? `${teacher.prefix || ''}${teacher.name} ${teacher.surname}` : String(row['ชื่อครู'] || '').trim(),
        preferred_room: String(row['ห้อง/Lab'] || '').trim(),
        periods_per_week: Number(row['คาบ/สัปดาห์']) || 3,
        consecutive_periods: Number(row['คาบติดกัน']) || 1,
        _error
      }
    })
    importPreviewVisible.value = true
  } catch (err) {
    ElMessage.error('อ่านไฟล์ไม่สำเร็จ: ' + err.message)
  }
  e.target.value = ''
}

async function confirmImport() {
  const validRows = importRows.value.filter(r => !r._error)
  if (!validRows.length) return
  importSaving.value = true
  let imported = 0
  try {
    for (const row of validRows) {
      const id = `${row.class_id}_${row.subject_code}_${row.teacher_id}`.replace(/\//g, '_')
      await setDoc(doc(db(), `terms/${term()}/teaching_assignments`, id), {
        assign_id: id,
        class_id: row.class_id,
        subject_code: row.subject_code,
        subject_name: row.subject_name,
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        preferred_room: row.preferred_room,
        periods_per_week: row.periods_per_week,
        consecutive_periods: row.consecutive_periods,
        updated_by: authStore.profile?.uid,
        updated_by_name: authStore.profile?.displayName,
        updated_at: serverTimestamp()
      }, { merge: true })
      imported++
    }
    await reload()
    ElMessage.success(`นำเข้า ${imported} รายการเรียบร้อย`)
    importPreviewVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    importSaving.value = false
  }
}

function handlePrint() {
  printReport({
    title: 'รายงานการมอบหมายการสอน',
    columns: [
      { label: 'รหัส', key: 'assign_id', width: '90px' },
      { label: 'วิชา', render: row => `${row.subject_code || ''} ${row.subject_name || ''}` },
      { label: 'ครู', render: row => `${row.teacher_name || row.teacher_id || ''}` },
      { label: 'ห้องเรียน', key: 'class_id', width: '100px' },
      { label: 'ชั่วโมง/สัปดาห์', key: 'periods_per_week', width: '110px' },
      { label: 'ห้องที่ต้องการ', key: 'preferred_room' },
    ],
    rows: filteredAssignments.value,
  })
}
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(102,126,234,0.25);
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
</style>
