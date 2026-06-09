<template>
  <AppLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">🏠 ห้องเรียนและห้อง Lab</h1>
            <p class="text-white/80 text-sm mt-1">จัดการห้องเรียน ห้องปฏิบัติการ และห้องพิเศษทั้งหมด</p>
          </div>
          <div class="flex gap-2 flex-wrap items-center">
            <el-button @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก
            </el-button>
            <el-button v-if="!isLocked" @click="handleImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า
            </el-button>
            <el-button @click="handlePrint" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🖨️ พิมพ์รายงาน
            </el-button>
            <el-button v-if="!isLocked"
              type="primary"
              @click="openDialog()"
              style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600"
            >
              + เพิ่มห้อง
            </el-button>
            <span v-if="isLocked" class="text-xs text-white/80 bg-red-500/40 px-2 py-1 rounded-lg font-semibold">🔒 ล็อคแล้ว</span>
            <input ref="importFileRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onImportFile" />
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
          <div class="stat-value text-white">{{ rooms.length }}</div>
          <div class="stat-label text-white/80">ทั้งหมด</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
          <div class="stat-value text-white">{{ countByType('classroom') }}</div>
          <div class="stat-label text-white/80">ห้องเรียนทั่วไป</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
          <div class="stat-value text-white">{{ countByType('lab') }}</div>
          <div class="stat-label text-white/80">ห้อง Lab</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)">
          <div class="stat-value text-white">{{ countByType('special') }}</div>
          <div class="stat-label text-white/80">ห้องพิเศษ</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <el-input
          v-model="searchText"
          placeholder="ค้นหา รหัสห้อง, ชื่อห้อง, อาคาร..."
          clearable
          style="width: 280px"
        >
          <template #prefix><span class="text-gray-400">🔍</span></template>
        </el-input>
        <el-select v-model="filterType" placeholder="ประเภทห้องทั้งหมด" clearable style="width: 180px">
          <el-option
            v-for="t in ROOM_TYPES"
            :key="t.value"
            :label="t.label"
            :value="t.value"
          />
        </el-select>
      </div>

      <!-- Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <!-- Bulk Actions Bar -->
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <el-button size="small" @click="tableRef?.toggleAllSelection()">เลือกทั้งหมด</el-button>
          <el-button size="small" @click="tableRef?.clearSelection()">ยกเลิกเลือก</el-button>
          <el-button v-if="!isLocked && !isTeacherOrScheduler" size="small" type="danger"
            :disabled="!selectedRows.length"
            @click="deleteSelected">
            🗑️ ลบที่เลือก ({{ selectedRows.length }})
          </el-button>
          <el-button v-if="!isLocked && !isTeacherOrScheduler" size="small" type="danger" plain @click="deleteAll">
            ❌ ลบทั้งหมด
          </el-button>
        </div>
        <el-table
          ref="tableRef"
          :data="filteredRooms"
          border
          stripe
          v-loading="loading"
          @selection-change="onSelectionChange"
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }"
          style="width:100%"
          row-key="room_id"
        >
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="room_id" label="รหัสห้อง" width="120" align="center">
            <template #default="{ row }">
              <span class="font-semibold text-purple-700">{{ row.room_id }}</span>
            </template>
          </el-table-column>

          <el-table-column label="ชื่อห้อง" min-width="180">
            <template #default="{ row }">
              <span class="font-medium">{{ row.room_name }}</span>
            </template>
          </el-table-column>

          <el-table-column label="ประเภท" width="140" align="center">
            <template #default="{ row }">
              <el-tag :type="getRoomTypeTag(row.room_type)" size="small">
                {{ getRoomTypeLabel(row.room_type) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="capacity" label="ความจุ (คน)" width="110" align="center" />

          <el-table-column label="อาคาร / ชั้น" width="130" align="center">
            <template #default="{ row }">
              <span v-if="row.building || row.floor">
                {{ [row.building, row.floor ? `ชั้น ${row.floor}` : ''].filter(Boolean).join(' / ') }}
              </span>
              <span v-else class="text-gray-400 text-sm">-</span>
            </template>
          </el-table-column>

          <el-table-column label="หมายเหตุ" min-width="160">
            <template #default="{ row }">
              <span v-if="row.note" class="text-gray-600 text-sm">{{ row.note }}</span>
              <span v-else class="text-gray-400 text-sm">-</span>
            </template>
          </el-table-column>

          <el-table-column label="สถานะ" width="90" align="center">
            <template #default="{ row }">
              <el-switch
                v-model="row.is_active"
                @change="(val) => handleToggleActive(row, val)"
                :loading="row._toggling"
              />
            </template>
          </el-table-column>

          <el-table-column label="จัดการ" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <template v-if="!isLocked || isTeacherOrScheduler">
                <el-button size="small" type="primary" plain @click="openDialog(row)">แก้ไข</el-button>
                <el-button v-if="!isTeacherOrScheduler && !isLocked" size="small" type="danger" plain @click="confirmDelete(row)">ลบ</el-button>
              </template>
              <span v-else class="text-xs text-gray-400">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Import Preview Dialog -->
      <el-dialog v-model="importPreviewVisible" title="📥 ตรวจสอบข้อมูลก่อนนำเข้า" width="720px">
        <div class="mb-3 text-sm text-gray-500">
          พบ <strong>{{ importRows.length }}</strong> รายการ —
          <span class="text-red-500">{{ importRows.filter(r => r._error).length }} ผิดพลาด</span> /
          <span class="text-green-600">{{ importRows.filter(r => !r._error).length }} พร้อมนำเข้า</span>
        </div>
        <el-table :data="importRows" border size="small" max-height="380">
          <el-table-column label="รหัสห้อง" prop="room_id" width="110" align="center" />
          <el-table-column label="ชื่อห้อง" prop="room_name" min-width="160" />
          <el-table-column label="ประเภท" width="130" align="center">
            <template #default="{ row }">
              <el-tag :type="getRoomTypeTag(row.room_type)" size="small">{{ getRoomTypeLabel(row.room_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="ความจุ" prop="capacity" width="80" align="center" />
          <el-table-column label="อาคาร" prop="building" width="90" align="center" />
          <el-table-column label="ชั้น" prop="floor" width="70" align="center" />
          <el-table-column label="สถานะ" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row._error ? 'danger' : 'success'" size="small">
                {{ row._error || 'ตรวจสอบแล้ว' }}
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

      <!-- Add/Edit Dialog -->
      <el-dialog
        v-model="dialogVisible"
        :title="editingRoom ? '✏️ แก้ไขข้อมูลห้อง' : '➕ เพิ่มห้องใหม่'"
        width="560px"
        destroy-on-close
      >
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <!-- Room ID -->
          <el-form-item label="รหัสห้อง (Room ID)" prop="room_id">
            <el-input
              v-model="form.room_id"
              placeholder="เช่น A101, LAB-BIO-1, HALL-01"
              :disabled="!!editingRoom"
            >
              <template #prefix><span class="text-purple-600 font-bold">🏷</span></template>
            </el-input>
            <div class="text-xs text-gray-400 mt-1">
              กรอกรหัสห้องด้วยตนเอง เช่น A101, LAB-1, COMP-LAB-2 (ไม่สามารถแก้ไขได้ภายหลัง)
            </div>
          </el-form-item>

          <!-- Room Name -->
          <el-form-item label="ชื่อห้อง" prop="room_name">
            <el-input v-model="form.room_name" placeholder="เช่น ห้อง 101 อาคาร A, ห้องปฏิบัติการชีววิทยา" />
          </el-form-item>

          <!-- Room Type + Capacity -->
          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="ประเภทห้อง" prop="room_type">
              <el-select v-model="form.room_type" class="w-full" placeholder="เลือกประเภท">
                <el-option
                  v-for="t in ROOM_TYPES"
                  :key="t.value"
                  :label="t.label"
                  :value="t.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="ความจุ (คน)" prop="capacity">
              <el-input-number
                v-model="form.capacity"
                :min="1"
                :max="500"
                class="w-full"
              />
            </el-form-item>
          </div>

          <!-- Building + Floor -->
          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="อาคาร">
              <el-input v-model="form.building" placeholder="เช่น อาคาร A, อาคาร 1" />
            </el-form-item>
            <el-form-item label="ชั้น">
              <el-input v-model="form.floor" placeholder="เช่น 1, 2, G" />
            </el-form-item>
          </div>

          <!-- Note -->
          <el-form-item label="หมายเหตุ">
            <el-input
              v-model="form.note"
              type="textarea"
              :rows="2"
              placeholder="รายละเอียดเพิ่มเติม เช่น มีโปรเจคเตอร์, แอร์ 2 เครื่อง"
            />
          </el-form-item>

          <!-- Active -->
          <el-form-item label="สถานะการใช้งาน">
            <el-switch
              v-model="form.is_active"
              active-text="เปิดใช้งาน"
              inactive-text="ปิดใช้งาน"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">บันทึก</el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { usePrintReport } from '@/composables/usePrintReport'
import { useScheduleGuard } from '@/composables/useScheduleGuard'
import { useAuthStore } from '@/stores/auth'

const { getRooms, saveRoom, deleteRoom } = useSchoolDb()
const { printReport } = usePrintReport()
const { isLocked } = useScheduleGuard()
const authStore = useAuthStore()
const isTeacherOrScheduler = computed(() => {
  if (authStore.hasAnyRole(['school_admin', 'admin', 'superadmin'])) return false
  return authStore.hasAnyRole(['school_teacher', 'teacher', 'school_scheduler', 'scheduler'])
})

// ===== Constants =====
const ROOM_TYPES = [
  { value: 'classroom', label: 'ห้องเรียนทั่วไป' },
  { value: 'lab',       label: 'ห้อง Lab' },
  { value: 'special',   label: 'ห้องพิเศษ' },
  { value: 'other',     label: 'อื่นๆ' },
]

const TYPE_TAG_MAP = {
  classroom: 'primary',   // blue
  lab:       'success',   // green
  special:   '',          // purple (el-tag default / custom)
  other:     'info',      // gray
}

function getRoomTypeTag(type) {
  return TYPE_TAG_MAP[type] ?? 'info'
}

function getRoomTypeLabel(type) {
  return ROOM_TYPES.find(t => t.value === type)?.label ?? type ?? '-'
}

// ===== State =====
const rooms = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingRoom = ref(null)
const formRef = ref()
const searchText = ref('')
const filterType = ref('')
const importFileRef = ref(null)
const importPreviewVisible = ref(false)
const importRows = ref([])
const importSaving = ref(false)
const tableRef = ref()
const selectedRows = ref([])

const form = reactive({
  room_id: '',
  room_name: '',
  room_type: 'classroom',
  capacity: 40,
  building: '',
  floor: '',
  note: '',
  is_active: true,
})

const rules = {
  room_id: [
    { required: true, message: 'กรุณากรอกรหัสห้อง', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9\-_]+$/,
      message: 'รหัสห้องใช้ได้เฉพาะ A-Z, 0-9, -, _',
      trigger: 'blur',
    },
  ],
  room_name: [{ required: true, message: 'กรุณากรอกชื่อห้อง', trigger: 'blur' }],
  room_type: [{ required: true, message: 'กรุณาเลือกประเภทห้อง', trigger: 'change' }],
  capacity: [{ required: true, message: 'กรุณากรอกความจุ', trigger: 'blur' }],
}

// ===== Computed =====
const filteredRooms = computed(() => {
  return rooms.value.filter(r => {
    const q = searchText.value.toLowerCase()
    const matchSearch = !q ||
      (r.room_id || '').toLowerCase().includes(q) ||
      (r.room_name || '').toLowerCase().includes(q) ||
      (r.building || '').toLowerCase().includes(q) ||
      (r.note || '').toLowerCase().includes(q)
    const matchType = !filterType.value || r.room_type === filterType.value
    return matchSearch && matchType
  })
})

function countByType(type) {
  return rooms.value.filter(r => r.room_type === type).length
}

// ===== Load =====
async function loadRooms() {
  loading.value = true
  try {
    rooms.value = await getRooms()
  } catch (e) {
    ElMessage.error('โหลดข้อมูลห้องล้มเหลว: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(loadRooms)

// ===== Dialog =====
function openDialog(room = null) {
  editingRoom.value = room
  if (room) {
    Object.assign(form, {
      room_id:   room.room_id   || '',
      room_name: room.room_name || '',
      room_type: room.room_type || 'classroom',
      capacity:  room.capacity  ?? 40,
      building:  room.building  || '',
      floor:     room.floor     || '',
      note:      room.note      || '',
      is_active: room.is_active !== false,
    })
  } else {
    Object.assign(form, {
      room_id:   '',
      room_name: '',
      room_type: 'classroom',
      capacity:  40,
      building:  '',
      floor:     '',
      note:      '',
      is_active: true,
    })
  }
  dialogVisible.value = true
}

// ===== Save =====
async function handleSave() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return

    // Duplicate check on add
    if (!editingRoom.value) {
      const exists = rooms.value.find(r => r.room_id === form.room_id.trim())
      if (exists) {
        ElMessage.error(`รหัสห้อง "${form.room_id}" มีอยู่ในระบบแล้ว`)
        return
      }
    }

    saving.value = true
    try {
      await saveRoom({
        room_id:   form.room_id.trim(),
        room_name: form.room_name.trim(),
        room_type: form.room_type,
        capacity:  form.capacity,
        building:  form.building.trim(),
        floor:     form.floor.trim(),
        note:      form.note.trim(),
        is_active: form.is_active,
      })
      ElMessage.success('บันทึกข้อมูลห้องเรียบร้อย')
      rooms.value = await getRooms()
      dialogVisible.value = false
    } catch (e) {
      ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      saving.value = false
    }
  })
}

// ===== Toggle Active =====
async function handleToggleActive(row, val) {
  row._toggling = true
  try {
    await saveRoom({ ...row, is_active: val })
    ElMessage.success(val ? 'เปิดใช้งานห้องแล้ว' : 'ปิดใช้งานห้องแล้ว')
  } catch (e) {
    row.is_active = !val // revert
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    row._toggling = false
  }
}

// ===== Export =====
function handleExport() {
  const rows = rooms.value.map(r => ({
    'รหัสห้อง': r.room_id || '',
    'ชื่อห้อง': r.room_name || '',
    'ประเภท': getRoomTypeLabel(r.room_type),
    'ความจุ (คน)': r.capacity || 0,
    'อาคาร': r.building || '',
    'ชั้น': r.floor || '',
    'หมายเหตุ': r.note || '',
    'ใช้งาน': r.is_active !== false ? 'ใช้งาน' : 'ปิดใช้',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [14, 24, 16, 12, 12, 8, 24, 10].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ห้องเรียนและLab')
  const tpl = [
    { 'รหัสห้อง': 'A101', 'ชื่อห้อง': 'ห้อง 101 อาคาร A', 'ประเภท': 'ห้องเรียนทั่วไป', 'ความจุ (คน)': 40, 'อาคาร': 'อาคาร A', 'ชั้น': '1', 'หมายเหตุ': '', 'ใช้งาน': 'ใช้งาน' },
    { 'รหัสห้อง': 'LAB-SCI-1', 'ชื่อห้อง': 'ห้องปฏิบัติการวิทยาศาสตร์ 1', 'ประเภท': 'ห้อง Lab', 'ความจุ (คน)': 30, 'อาคาร': 'อาคาร B', 'ชั้น': '2', 'หมายเหตุ': '', 'ใช้งาน': 'ใช้งาน' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tpl), 'Template')
  XLSX.writeFile(wb, 'rooms_export.xlsx')
  ElMessage.success('ส่งออกข้อมูลห้องสำเร็จ')
}

// ===== Import =====
function handleImport() { importFileRef.value?.click() }

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws)
    const VALID_TYPES = { 'ห้องเรียนทั่วไป': 'classroom', 'ห้อง Lab': 'lab', 'ห้องพิเศษ': 'special', 'อื่นๆ': 'other', 'classroom': 'classroom', 'lab': 'lab', 'special': 'special', 'other': 'other' }
    importRows.value = rows.map(row => {
      const room_id = String(row['รหัสห้อง'] || '').trim()
      const room_name = String(row['ชื่อห้อง'] || '').trim()
      const typeRaw = String(row['ประเภท'] || 'classroom').trim()
      const room_type = VALID_TYPES[typeRaw] || 'classroom'
      let _error = null
      if (!room_id) _error = 'ไม่มีรหัสห้อง'
      else if (!/^[A-Za-z0-9\-_]+$/.test(room_id)) _error = 'รหัสห้องมีอักขระไม่ถูกต้อง'
      else if (!room_name) _error = 'ไม่มีชื่อห้อง'
      return {
        room_id, room_name, room_type,
        capacity: Number(row['ความจุ (คน)']) || 40,
        building: String(row['อาคาร'] || '').trim(),
        floor: String(row['ชั้น'] || '').trim(),
        note: String(row['หมายเหตุ'] || '').trim(),
        is_active: String(row['ใช้งาน'] || '').trim() !== 'ปิดใช้',
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
  const valid = importRows.value.filter(r => !r._error)
  if (!valid.length) return
  importSaving.value = true
  try {
    for (const row of valid) {
      await saveRoom({ room_id: row.room_id, room_name: row.room_name, room_type: row.room_type, capacity: row.capacity, building: row.building, floor: row.floor, note: row.note, is_active: row.is_active })
    }
    rooms.value = await getRooms()
    ElMessage.success(`นำเข้า ${valid.length} ห้องเรียบร้อย`)
    importPreviewVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    importSaving.value = false
  }
}

// ===== Delete =====
async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบห้อง "${row.room_id} — ${row.room_name}"?`,
      'ยืนยันการลบ',
      {
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    )
    loading.value = true
    await deleteRoom(row.room_id)
    ElMessage.success('ลบห้องเรียบร้อย')
    rooms.value = await getRooms()
  } catch {
    // cancelled — do nothing
  } finally {
    loading.value = false
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
      await deleteRoom(row.room_id)
    }
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
    rooms.value = await getRooms()
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = filteredRooms.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) {
      await deleteRoom(row.room_id)
    }
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
    rooms.value = await getRooms()
  } catch { /* cancelled */ } finally { loading.value = false }
}

function handlePrint() {
  printReport({
    title: 'รายงานข้อมูลห้องและ Lab',
    columns: [
      { label: 'รหัสห้อง', key: 'room_id', width: '100px' },
      { label: 'ชื่อห้อง', key: 'room_name' },
      { label: 'ประเภท', key: 'room_type', width: '100px' },
      { label: 'ความจุ', key: 'capacity', width: '80px' },
      { label: 'อาคาร', key: 'building' },
      { label: 'ชั้น', key: 'floor', width: '60px' },
      { label: 'สถานะ', render: row => row.is_active !== false ? 'เปิดใช้' : 'ปิดใช้', width: '80px' },
    ],
    rows: filteredRooms.value,
  })
}
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(102, 126, 234, 0.3);
}
.stat-card {
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.stat-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}
.stat-label {
  font-size: 0.85rem;
  margin-top: 4px;
}
</style>
