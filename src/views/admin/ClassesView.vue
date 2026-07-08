<template>
  <AppLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">🏫 ห้องเรียน</h1>
            <p class="text-white/80 text-sm mt-1">จัดการห้องเรียนทุกระดับชั้น</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <el-button @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก
            </el-button>
            <el-button @click="handleImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า
            </el-button>
            <el-button @click="handlePrint" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              🖨️ พิมพ์รายงาน
            </el-button>
            <el-button type="primary" @click="openDialog()"
              style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
              + เพิ่มห้องเรียน
            </el-button>
            <input ref="importFileRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onImportFile" />
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%)">
          <div class="stat-value text-white">{{ classes.length }}</div>
          <div class="stat-label text-white/80">ห้องทั้งหมด</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)">
          <div class="stat-value text-white">{{ countByLevelGroup('ประถม') }}</div>
          <div class="stat-label text-white/80">ระดับประถมศึกษา (ป.)</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)">
          <div class="stat-value text-white">{{ countByLevelGroup('มัธยม') }}</div>
          <div class="stat-label text-white/80">ระดับมัธยมศึกษา (ม.)</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="flex gap-3 mb-4">
        <el-input v-model="searchText" placeholder="ค้นหาห้อง, ครูที่ปรึกษา..." clearable style="width: 280px">
          <template #prefix><span class="text-gray-400">🔍</span></template>
        </el-input>
        <el-select v-model="filterLevel" placeholder="ระดับชั้นทั้งหมด" clearable style="width: 160px">
          <el-option v-for="l in LEVELS" :key="l" :label="l" :value="l" />
        </el-select>
      </div>

      <!-- Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <!-- Bulk Actions Bar -->
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <el-button size="small" @click="tableRef?.toggleAllSelection()">เลือกทั้งหมด</el-button>
          <el-button size="small" @click="tableRef?.clearSelection()">ยกเลิกเลือก</el-button>
          <el-button size="small" type="danger"
            :disabled="!selectedRows.length"
            @click="deleteSelected">
            🗑️ ลบที่เลือก ({{ selectedRows.length }})
          </el-button>
          <el-button size="small" type="danger" plain @click="deleteAll">
            ❌ ลบทั้งหมด
          </el-button>
        </div>
        <el-table ref="tableRef" :data="filteredClasses" border stripe v-loading="loading"
          @selection-change="onSelectionChange"
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }"
          style="width:100%" row-key="class_id">
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="level" label="ระดับชั้น" width="100" align="center" />
          <el-table-column prop="room" label="ห้อง" width="80" align="center" />
          <el-table-column label="ชื่อห้อง/ID" width="180">
            <template #default="{ row }">
              <div class="flex items-center gap-1 flex-wrap">
                <span class="font-semibold text-purple-700">{{ row.class_id }}</span>
                <el-tag v-if="row.is_schedule_only" type="warning" size="small" effect="light">ล็อกตาราง</el-tag>
              </div>
              <div v-if="row.class_name" class="text-xs text-gray-400">{{ row.class_name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="ครูที่ปรึกษา" min-width="200">
            <template #default="{ row }">
              <div v-if="resolveHomeroomNames(row).length > 0" class="flex flex-wrap gap-1">
                <el-tag
                  v-for="(name, idx) in resolveHomeroomNames(row)"
                  :key="idx"
                  size="small"
                  :type="idx === 0 ? 'warning' : 'info'"
                  :title="idx === 0 ? 'ครูหลัก — รับผิดชอบคาบพิเศษ' : ''"
                >{{ idx === 0 ? '★ ' : '' }}{{ name }}</el-tag>
              </div>
              <span v-else class="text-gray-400 text-sm">ยังไม่ได้กำหนด</span>
            </template>
          </el-table-column>
          <el-table-column prop="room_number" label="หมายเลขห้อง" width="120" align="center" />
          <el-table-column prop="max_students" label="นักเรียนสูงสุด" width="120" align="center" />
          <el-table-column label="จัดการ" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" plain @click="openDialog(row)">แก้ไข</el-button>
              <el-button size="small" type="danger" plain @click="confirmDelete(row)">ลบ</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Add/Edit Dialog -->
      <el-dialog
        v-model="dialogVisible"
        :title="editingClass ? 'แก้ไขข้อมูลห้องเรียน' : 'เพิ่มห้องเรียนใหม่'"
        width="540px"
        destroy-on-close
      >
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="ระดับชั้น" prop="level">
              <el-select v-model="form.level" class="w-full">
                <el-option v-for="l in LEVELS" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
            <el-form-item label="ห้อง (เลข)" prop="room">
              <el-input-number
                v-model="form.room" :min="1" :max="20" class="w-full"
                :disabled="!!editingClass"
              />
            </el-form-item>
          </div>
          <el-form-item label="รหัสห้องเรียน (Class ID)" v-if="form.level && form.room">
            <el-input :value="computedClassId" disabled>
              <template #prefix><span class="text-purple-600 font-bold">🏷</span></template>
            </el-input>
          </el-form-item>
          <el-form-item label="ชื่อห้อง (ไม่บังคับ)">
            <el-input v-model="form.class_name" placeholder="เช่น ห้องเรียนพิเศษวิทยาศาสตร์" />
          </el-form-item>
          <el-form-item label="ครูที่ปรึกษา">
            <TeacherSelect v-model="form.homeroom_teacher_ids" :teachers="teachers" multiple class="w-full"
              placeholder="เลือกครูที่ปรึกษา (เลือกได้หลายคน)" @change="onTeacherChange" />
            <div class="text-xs text-amber-600 mt-1">★ ครูที่เลือกเป็นคนแรก = ครูหลัก (รับผิดชอบคาบพิเศษ/ที่ปรึกษา)</div>
          </el-form-item>
          <el-form-item label="ห้องเรียนประจำ">
            <el-select v-model="form.home_room_id" class="w-full" clearable filterable placeholder="เลือกห้อง หรือ ไม่ระบุ">
              <el-option label="— ไม่ระบุ —" value="" />
              <el-option v-for="r in rooms.filter(x => x.is_active !== false)"
                :key="r.room_id"
                :label="`${r.room_id} — ${r.room_name}${r.room_type === 'lab' ? ' 🔬' : ''}`"
                :value="r.room_id" />
            </el-select>
            <div class="text-xs text-gray-400 mt-1">ห้องที่ชั้นเรียนนี้ใช้เป็นหลัก (บางโรงเรียนอาจไม่มี)</div>
          </el-form-item>
          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="หมายเลขห้องเรียน">
              <el-input v-model="form.room_number" placeholder="เช่น 101, อาคาร 2 ชั้น 1" />
            </el-form-item>
            <el-form-item label="จำนวนนักเรียนสูงสุด">
              <el-input-number v-model="form.max_students" :min="1" :max="60" class="w-full" />
            </el-form-item>
          </div>
          <div class="mt-1 p-3 rounded-xl" style="background:#fefce8;border:1px solid #fde68a">
            <el-checkbox v-model="form.is_schedule_only">
              <span class="font-semibold text-amber-700">ห้องล็อกตารางเท่านั้น (ไม่มีนักเรียน)</span>
            </el-checkbox>
            <div class="text-xs text-amber-600 mt-1">ใช้เทคนิคล็อกเวลาครู — ไม่ปรากฏใน Dashboard, รายงาน และสถิติการมาเรียน</div>
          </div>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">บันทึก</el-button>
        </template>
      </el-dialog>

      <!-- Import Preview Dialog -->
      <el-dialog v-model="importPreviewVisible" title="📥 ตรวจสอบข้อมูลก่อนนำเข้า" width="700px">
        <div class="mb-3 text-sm text-gray-500">
          พบ <strong>{{ importRows.length }}</strong> รายการ —
          <span class="text-red-500">{{ importRows.filter(r => r._error).length }} ผิดพลาด</span> /
          <span class="text-green-600">{{ importRows.filter(r => !r._error).length }} พร้อมนำเข้า</span>
        </div>
        <el-table :data="importRows" border size="small" max-height="360">
          <el-table-column label="ระดับชั้น" prop="level" width="90" align="center" />
          <el-table-column label="ห้อง" prop="room" width="70" align="center" />
          <el-table-column label="Class ID" width="110" align="center">
            <template #default="{ row }">{{ row.level }}/{{ row.room }}</template>
          </el-table-column>
          <el-table-column label="ชื่อห้อง" prop="class_name" min-width="120" />
          <el-table-column label="ครูที่ปรึกษา" min-width="160">
            <template #default="{ row }">
              <span v-if="row.homeroom_teacher_id" class="text-sm">
                {{ getTeacherDisplayName(row.homeroom_teacher_id) }}
              </span>
              <span v-else class="text-gray-400 text-xs">—</span>
            </template>
          </el-table-column>
          <el-table-column label="หมายเลขห้อง" prop="room_number" width="110" align="center" />
          <el-table-column label="นักเรียนสูงสุด" prop="max_students" width="110" align="center" />
          <el-table-column label="สถานะ" width="100" align="center">
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
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { LEVELS } from '@/utils/constants'
import { usePrintReport } from '@/composables/usePrintReport'

const { getClasses, saveClass, deleteClass, getTeachers, getRooms, getRoomCatalog } = useSchoolDb()
const { printReport } = usePrintReport()

const classes = ref([])
const teachers = ref([])
const rooms = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingClass = ref(null)
const formRef = ref()
const searchText = ref('')
const filterLevel = ref('')
const importFileRef = ref(null)
const importPreviewVisible = ref(false)
const importRows = ref([])
const importSaving = ref(false)
const tableRef = ref()
const selectedRows = ref([])

const form = reactive({
  level: '',
  room: 1,
  class_name: '',
  homeroom_teacher_id: '',
  homeroom_teacher_name_snapshot: '',
  homeroom_teacher_ids: [],
  homeroom_teacher_names_snapshot: [],
  room_number: '',
  home_room_id: '',
  max_students: 40,
  is_schedule_only: false,
})

const rules = {
  level: [{ required: true, message: 'กรุณาเลือกระดับชั้น', trigger: 'change' }],
  room: [{ required: true, message: 'กรุณากรอกหมายเลขห้อง', trigger: 'blur' }]
}


const computedClassId = computed(() => {
  if (!form.level || !form.room) return ''
  return `${form.level}/${form.room}`
})

const filteredClasses = computed(() => {
  return classes.value.filter(c => {
    const matchSearch = !searchText.value ||
      (c.class_id || '').includes(searchText.value) ||
      (c.class_name || '').includes(searchText.value) ||
      (c.homeroom_teacher_name_snapshot || '').includes(searchText.value) ||
      (c.room_number || '').includes(searchText.value)
    const matchLevel = !filterLevel.value || c.level === filterLevel.value
    return matchSearch && matchLevel
  })
})

function countByLevelGroup(group) {
  if (group === 'ประถม') return classes.value.filter(c => (c.level || '').startsWith('ป.')).length
  if (group === 'มัธยม') return classes.value.filter(c => (c.level || '').startsWith('ม.')).length
  return 0
}

function onTeacherChange(teacherIds) {
  if (!Array.isArray(teacherIds)) teacherIds = []
  // map ตาม teacherIds order เพื่อให้ names[0] ตรงกับ ids[0] เสมอ
  const selectedTeachers = teacherIds.map(id => teachers.value.find(t => t.teacher_id === id)).filter(Boolean)
  form.homeroom_teacher_names_snapshot = selectedTeachers.map(t => `${t.prefix || ''}${t.name} ${t.surname}`)
  form.homeroom_teacher_name_snapshot = form.homeroom_teacher_names_snapshot.join(', ')
  form.homeroom_teacher_id = teacherIds.length > 0 ? teacherIds[0] : ''
}

function getTeacherDisplayName(teacherCode) {
  if (!teacherCode) return ''
  const t = teachers.value.find(t => t.teacher_id === teacherCode)
  return t ? `${t.prefix || ''}${t.name} ${t.surname}` : teacherCode
}

function parseJsonbArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function resolveHomeroomNames(cls) {
  const names = parseJsonbArray(cls.homeroom_teacher_names_snapshot)
  if (names.length) return names
  if (cls.homeroom_teacher_name_snapshot) return [cls.homeroom_teacher_name_snapshot]
  const ids = parseJsonbArray(cls.homeroom_teacher_ids)
  const fallbackIds = ids.length ? ids : (cls.homeroom_teacher_id ? [cls.homeroom_teacher_id] : [])
  return fallbackIds.map(id => getTeacherDisplayName(id)).filter(Boolean)
}

function mapCatalogRooms(catalog) {
  const activeRooms = Array.isArray(catalog?.active_rooms) ? catalog.active_rooms : []
  return activeRooms.map(r => ({
    room_id: r.room_id,
    room_name: r.room_name || '',
    room_type: r.room_type || 'other',
    is_active: r.is_active !== false,
  }))
}

async function loadHomeRoomOptions() {
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
    const [classesData, teachersData, roomsData] = await Promise.all([getClasses(), getTeachers(), loadHomeRoomOptions()])
    classes.value = classesData
    teachers.value = teachersData
    rooms.value = roomsData
  } finally {
    loading.value = false
  }
})

function openDialog(cls = null) {
  editingClass.value = cls
  if (cls) {
    Object.assign(form, {
      level: cls.level || '',
      room: cls.room || 1,
      class_name: cls.class_name || '',
      homeroom_teacher_id: cls.homeroom_teacher_id || '',
      homeroom_teacher_name_snapshot: cls.homeroom_teacher_name_snapshot || '',
      homeroom_teacher_ids: (Array.isArray(cls.homeroom_teacher_ids) && cls.homeroom_teacher_ids.length)
        ? [...cls.homeroom_teacher_ids]
        : (cls.homeroom_teacher_id ? [cls.homeroom_teacher_id] : []),
      homeroom_teacher_names_snapshot: (Array.isArray(cls.homeroom_teacher_names_snapshot) && cls.homeroom_teacher_names_snapshot.length)
        ? [...cls.homeroom_teacher_names_snapshot]
        : (cls.homeroom_teacher_name_snapshot ? [cls.homeroom_teacher_name_snapshot] : []),
      room_number: cls.room_number || '',
      home_room_id: cls.home_room_id || '',
      max_students: cls.max_students ?? 40,
      is_schedule_only: cls.is_schedule_only === true,
    })
  } else {
    Object.assign(form, {
      level: '',
      room: 1,
      class_name: '',
      homeroom_teacher_id: '',
      homeroom_teacher_name_snapshot: '',
      homeroom_teacher_ids: [],
      homeroom_teacher_names_snapshot: [],
      room_number: '',
      home_room_id: '',
      max_students: 40,
      is_schedule_only: false,
    })
  }
  dialogVisible.value = true
}

async function handleSave() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    const classId = computedClassId.value
    if (!classId) {
      ElMessage.error('กรุณากรอกระดับชั้นและห้อง')
      return
    }
    if (!editingClass.value) {
      const exists = classes.value.find(c => c.class_id === classId)
      if (exists) {
        ElMessage.error('ห้องนี้มีอยู่แล้ว กรุณาตรวจสอบระดับชั้นและหมายเลขห้อง')
        return
      }
    }
    if (form.homeroom_teacher_id) {
      const teacherExists = teachers.value.find(t => t.teacher_id === form.homeroom_teacher_id)
      if (!teacherExists) {
        ElMessage.error('ไม่พบครูที่ปรึกษาที่เลือกในระบบ')
        return
      }
    }
    saving.value = true
    try {
      await saveClass({
        id: editingClass.value?.id || null,
        class_id: classId,
        level: form.level,
        room: form.room,
        class_name: form.class_name,
        homeroom_teacher_id: form.homeroom_teacher_id,
        homeroom_teacher_name_snapshot: form.homeroom_teacher_name_snapshot,
        homeroom_teacher_ids: form.homeroom_teacher_ids,
        homeroom_teacher_names_snapshot: form.homeroom_teacher_names_snapshot,
        room_number: form.room_number,
        home_room_id: form.home_room_id || '',
        max_students: form.max_students,
        is_schedule_only: form.is_schedule_only,
      })
      ElMessage.success('บันทึกข้อมูลห้องเรียนเรียบร้อย')
      classes.value = await getClasses()
      dialogVisible.value = false
    } catch (e) {
      ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      saving.value = false
    }
  })
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบห้องเรียน "${row.class_id}"?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
  } catch {
    return // ผู้ใช้กดยกเลิก
  }
  loading.value = true
  try {
    await deleteClass(row.class_id)
    ElMessage.success('ลบห้องเรียนเรียบร้อย')
    classes.value = await getClasses()
  } catch (e) {
    ElMessage.error('ลบห้องเรียนไม่สำเร็จ: ' + e.message)
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
  } catch {
    return // ผู้ใช้กดยกเลิก
  }
  loading.value = true
  const failed = []
  for (const row of selectedRows.value) {
    try { await deleteClass(row.class_id) } catch (e) { failed.push(row.class_id); console.warn('deleteClass failed:', row.class_id, e.message) }
  }
  selectedRows.value = []
  classes.value = await getClasses()
  loading.value = false
  if (failed.length) {
    ElMessage.error(`ลบไม่สำเร็จบางรายการ: ${failed.join(', ')}`)
  } else {
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
  }
}

async function deleteAll() {
  const allRows = filteredClasses.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
  } catch {
    return // ผู้ใช้กดยกเลิก
  }
  loading.value = true
  const failed = []
  for (const row of [...allRows]) {
    try { await deleteClass(row.class_id) } catch (e) { failed.push(row.class_id); console.warn('deleteClass failed:', row.class_id, e.message) }
  }
  classes.value = await getClasses()
  loading.value = false
  if (failed.length) {
    ElMessage.error(`ลบไม่สำเร็จบางรายการ: ${failed.join(', ')}`)
  } else {
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
  }
}

// ===== Export =====
function handleExport() {
  const rows = classes.value.map(c => ({
    'ระดับชั้น': c.level || '',
    'ห้อง': c.room || '',
    'ชื่อห้อง': c.class_name || '',
    'ครูที่ปรึกษา (รหัส)': (c.homeroom_teacher_ids && c.homeroom_teacher_ids.length ? c.homeroom_teacher_ids : [c.homeroom_teacher_id]).filter(Boolean).join(', '),
    'ครูที่ปรึกษา (ชื่อ)': (c.homeroom_teacher_names_snapshot && c.homeroom_teacher_names_snapshot.length ? c.homeroom_teacher_names_snapshot : [c.homeroom_teacher_name_snapshot]).filter(Boolean).join(', '),
    'หมายเลขห้อง': c.room_number || '',
    'จำนวนนักเรียนสูงสุด': c.max_students || 40,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ห้องเรียน')
  // Template sheet
  const tplRows = [
    { 'ระดับชั้น': 'ม.1', 'ห้อง': 1, 'ชื่อห้อง': '', 'หมายเลขห้อง': '101', 'จำนวนนักเรียนสูงสุด': 40 },
    { 'ระดับชั้น': 'ม.2', 'ห้อง': 1, 'ชื่อห้อง': 'ห้องพิเศษวิทย์', 'หมายเลขห้อง': '201', 'จำนวนนักเรียนสูงสุด': 35 },
  ]
  const wsTpl = XLSX.utils.json_to_sheet(tplRows)
  XLSX.utils.book_append_sheet(wb, wsTpl, 'Template')
  XLSX.writeFile(wb, 'classes_export.xlsx')
  ElMessage.success('ส่งออกข้อมูลห้องเรียนสำเร็จ')
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
      const level = String(row['ระดับชั้น'] || '').trim()
      const room = Number(row['ห้อง']) || 0
      let _error = null
      if (!level) _error = 'ไม่มีระดับชั้น'
      else if (!room || room < 1) _error = 'ห้องไม่ถูกต้อง'
      return {
        level,
        room,
        class_name: String(row['ชื่อห้อง'] || '').trim(),
        homeroom_teacher_id: String(row['ครูที่ปรึกษา (รหัส)'] || '').trim(),
        room_number: String(row['หมายเลขห้อง'] || '').trim(),
        max_students: Number(row['จำนวนนักเรียนสูงสุด']) || 40,
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
  const errors = []
  for (const row of validRows) {
    const classId = `${row.level}/${row.room}`
    try {
      const homeroomIds = row.homeroom_teacher_id ? [row.homeroom_teacher_id] : undefined
      const homeroomNames = row.homeroom_teacher_id
        ? [getTeacherDisplayName(row.homeroom_teacher_id)]
        : undefined
      await saveClass({
        class_id: classId,
        level: row.level,
        room: row.room,
        class_name: row.class_name || classId,
        homeroom_teacher_id: row.homeroom_teacher_id || undefined,
        homeroom_teacher_ids: homeroomIds,
        homeroom_teacher_names_snapshot: homeroomNames,
        room_number: row.room_number,
        max_students: row.max_students,
      })
      imported++
    } catch (e) {
      errors.push(`${classId}: ${e.message}`)
    }
  }
  classes.value = await getClasses()
  importPreviewVisible.value = false
  importSaving.value = false
  if (errors.length) {
    ElMessage.warning({ message: `นำเข้า ${imported} ห้อง — ล้มเหลว ${errors.length} รายการ: ${errors.slice(0,3).join('; ')}`, duration: 6000 })
  } else {
    ElMessage.success(`นำเข้า ${imported} ห้องเรียนเรียบร้อย`)
  }
}

function handlePrint() {
  printReport({
    title: 'รายงานข้อมูลห้องเรียน',
    columns: [
      { label: 'รหัสห้อง', key: 'class_id', width: '100px' },
      { label: 'ระดับชั้น', key: 'level' },
      { label: 'ชั้น/ห้อง', key: 'room' },
      { label: 'โปรแกรม', key: 'program' },
      { label: 'จำนวนนักเรียน', key: 'student_count', width: '110px' },
      { label: 'ครูที่ปรึกษา', key: 'homeroom_teacher' },
      { label: 'ห้องเรียนหลัก', key: 'home_room_id' },
    ],
    rows: filteredClasses.value,
  })
}
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(240,147,251,0.25);
}
.stat-card {
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
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
