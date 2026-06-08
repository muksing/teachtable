<template>
  <AppLayout>
    <div class="p-6">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-title">📚 วิชาเรียน</div>
        <div class="flex gap-2 items-center">
          <el-button v-if="!isLocked" @click="triggerImport">📥 นำเข้า Excel</el-button>
          <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleImportFile" />
          <el-button @click="exportExcel">📤 ส่งออก Excel</el-button>
          <el-button type="primary" plain @click="handlePrint">🖨️ พิมพ์รายงาน</el-button>
          <el-button v-if="!isLocked" type="primary" @click="openDialog()">+ เพิ่มวิชา</el-button>
          <span v-if="isLocked" class="text-xs text-red-500 font-semibold bg-red-50 px-2 py-1 rounded-lg">🔒 ล็อคแล้ว</span>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
          <div class="text-3xl font-bold">{{ subjects.length }}</div>
          <div class="text-sm opacity-90 mt-1">วิชาทั้งหมด</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
          <div class="text-3xl font-bold">{{ countByType('วิชาพื้นฐาน') }}</div>
          <div class="text-sm opacity-90 mt-1">วิชาพื้นฐาน</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
          <div class="text-3xl font-bold">{{ countByType('วิชาเพิ่มเติม') }}</div>
          <div class="text-sm opacity-90 mt-1">วิชาเพิ่มเติม</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <el-input
          v-model="searchText"
          placeholder="ค้นหารหัส, ชื่อวิชา..."
          clearable
          style="width: 260px"
        >
          <template #prefix><span class="text-gray-400">🔍</span></template>
        </el-input>
        <el-select v-model="filterDept" placeholder="กลุ่มสาระทั้งหมด" clearable style="width: 240px">
          <el-option v-for="d in DEPT_OPTIONS" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filterLevel" placeholder="ระดับชั้นทั้งหมด" clearable style="width: 160px">
          <el-option v-for="l in LEVELS" :key="l" :label="l" :value="l" />
        </el-select>
        <el-select v-model="filterType" placeholder="ประเภทวิชาทั้งหมด" clearable style="width: 180px">
          <el-option v-for="t in SUBJECT_TYPES" :key="t" :label="t" :value="t" />
        </el-select>
      </div>

      <!-- Table -->
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
      </div>
      <el-table ref="tableRef" :data="filteredSubjects" border stripe v-loading="loading"
        @selection-change="onSelectionChange"
        :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }"
        style="width:100%" row-key="subject_code">
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column prop="subject_code" label="รหัสวิชา" width="110" />
        <el-table-column label="ชื่อวิชา" min-width="200">
          <template #default="{ row }">
            <div class="font-medium">{{ row.name }}</div>
            <div class="text-xs text-gray-400">{{ row.name_en }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="dept" label="กลุ่มสาระ" min-width="180" />
        <el-table-column label="ระดับชั้น" width="160">
          <template #default="{ row }">
            <div class="flex flex-wrap gap-1">
              <el-tag v-for="l in (row.levels || [])" :key="l" size="small" type="info">{{ l }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="credits" label="หน่วยกิต" width="90" align="center" />
        <el-table-column prop="periods_per_week" label="คาบ/สัปดาห์" width="100" align="center" />
        <el-table-column label="ประเภท" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.subject_type)" size="small">{{ row.subject_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="จัดการ" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="!isLocked">
              <el-button size="small" type="primary" plain @click="openDialog(row)">แก้ไข</el-button>
              <el-button size="small" type="danger" plain @click="confirmDelete(row)">ลบ</el-button>
            </template>
            <span v-else class="text-xs text-gray-400">—</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- Add/Edit Dialog -->
      <el-dialog
        v-model="dialogVisible"
        :title="editingSubject ? 'แก้ไขข้อมูลวิชา' : 'เพิ่มวิชาใหม่'"
        width="620px"
        destroy-on-close
      >
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <div class="grid grid-cols-2 gap-x-4">
            <el-form-item label="รหัสวิชา" prop="subject_code">
              <el-input v-model="form.subject_code" placeholder="เช่น ท21101" />
            </el-form-item>
            <el-form-item label="ประเภทวิชา" prop="subject_type">
              <el-select v-model="form.subject_type" class="w-full">
                <el-option v-for="t in SUBJECT_TYPES" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="ชื่อวิชา (ภาษาไทย)" prop="name" class="col-span-1">
              <el-input v-model="form.name" placeholder="ชื่อวิชาภาษาไทย" />
            </el-form-item>
            <el-form-item label="ชื่อวิชา (อังกฤษ)">
              <el-input v-model="form.name_en" placeholder="Subject name in English" />
            </el-form-item>
            <el-form-item label="กลุ่มสาระ" prop="dept">
              <el-select v-model="form.dept" class="w-full">
                <el-option v-for="d in DEPT_OPTIONS" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
            <el-form-item label="ระดับชั้นที่ใช้" prop="levels">
              <el-select v-model="form.levels" multiple class="w-full" placeholder="เลือกระดับชั้น">
                <el-option v-for="l in LEVELS" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
            <el-form-item label="หน่วยกิต">
              <el-input-number v-model="form.credits" :min="0" :step="0.5" :precision="1" class="w-full" />
            </el-form-item>
            <el-form-item label="คาบ/สัปดาห์" prop="periods_per_week">
              <el-input-number v-model="form.periods_per_week" :min="1" :max="20" class="w-full" />
            </el-form-item>
            <el-form-item label="คาบติดกัน (consecutive)">
              <el-input-number v-model="form.consecutive_periods" :min="1" :max="4" class="w-full" />
            </el-form-item>
            <el-form-item label="หมายเหตุ">
              <el-input v-model="form.note" placeholder="หมายเหตุเพิ่มเติม" />
            </el-form-item>
          </div>
          <div v-if="consecutiveError" class="text-red-500 text-sm mt-1 ml-1">{{ consecutiveError }}</div>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">บันทึก</el-button>
        </template>
      </el-dialog>

      <!-- Import Preview Dialog -->
      <el-dialog v-model="importDialogVisible" title="ตรวจสอบข้อมูลนำเข้า" width="780px" destroy-on-close>
        <div class="mb-3 text-sm text-gray-600">
          พบข้อมูล <strong>{{ importRows.length }}</strong> รายการ
          <span v-if="importErrors.length" class="text-red-500 ml-2">มีข้อผิดพลาด {{ importErrors.length }} รายการ</span>
        </div>
        <el-table :data="importRows" border stripe max-height="360" size="small">
          <el-table-column prop="subject_code" label="รหัสวิชา" width="110" />
          <el-table-column prop="name" label="ชื่อวิชา" min-width="160" />
          <el-table-column prop="dept" label="กลุ่มสาระ" min-width="160" />
          <el-table-column prop="subject_type" label="ประเภท" width="120" />
          <el-table-column label="สถานะ" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row._error ? 'danger' : 'success'" size="small">
                {{ row._error ? 'ผิดพลาด' : 'ปกติ' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="หมายเหตุ" min-width="140">
            <template #default="{ row }">
              <span class="text-xs text-red-500">{{ row._error }}</span>
            </template>
          </el-table-column>
        </el-table>
        <template #footer>
          <el-button @click="importDialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" :disabled="importRows.every(r => r._error)" @click="confirmImport">
            นำเข้าข้อมูลที่ถูกต้อง ({{ importRows.filter(r => !r._error).length }} รายการ)
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
import { DEPT_OPTIONS, LEVELS, SUBJECT_TYPES } from '@/utils/constants'
import { usePrintReport } from '@/composables/usePrintReport'
import { useScheduleGuard } from '@/composables/useScheduleGuard'
import { cascadeService } from '@/composables/cascadeService'
import { useSchoolStore } from '@/stores/school'

const { getSubjects, saveSubject, deleteSubject } = useSchoolDb()
const { printReport } = usePrintReport()
const { isLocked } = useScheduleGuard()
const schoolStore = useSchoolStore()

const subjects = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingSubject = ref(null)
const formRef = ref()
const fileInputRef = ref()
const importDialogVisible = ref(false)
const importRows = ref([])
const importErrors = ref([])
const tableRef = ref()
const selectedRows = ref([])
const searchText = ref('')
const filterDept = ref('')
const filterLevel = ref('')
const filterType = ref('')

const form = reactive({
  subject_code: '',
  name: '',
  name_en: '',
  dept: '',
  levels: [],
  subject_type: 'วิชาพื้นฐาน',
  credits: 1,
  periods_per_week: 2,
  consecutive_periods: 1,
  note: ''
})

const rules = {
  subject_code: [{ required: true, message: 'กรุณากรอกรหัสวิชา', trigger: 'blur' }],
  name: [{ required: true, message: 'กรุณากรอกชื่อวิชา', trigger: 'blur' }],
  dept: [{ required: true, message: 'กรุณาเลือกกลุ่มสาระ', trigger: 'change' }],
  levels: [{ required: true, type: 'array', min: 1, message: 'กรุณาเลือกระดับชั้น', trigger: 'change' }],
  subject_type: [{ required: true, message: 'กรุณาเลือกประเภทวิชา', trigger: 'change' }],
  periods_per_week: [{ required: true, message: 'กรุณากรอกจำนวนคาบ', trigger: 'blur' }]
}

const consecutiveError = computed(() => {
  const ppw = form.periods_per_week
  const cp = form.consecutive_periods
  if (!ppw || !cp || cp <= 0) return ''
  if (ppw % cp !== 0) return `${ppw} ÷ ${cp} ไม่ลงตัว (คาบติดกันต้องหารคาบ/สัปดาห์ได้ลงตัว)`
  return ''
})

const filteredSubjects = computed(() => {
  return subjects.value.filter(s => {
    const matchSearch = !searchText.value ||
      (s.subject_code || '').includes(searchText.value) ||
      (s.name || '').includes(searchText.value) ||
      (s.name_en || '').toLowerCase().includes(searchText.value.toLowerCase())
    const matchDept = !filterDept.value || s.dept === filterDept.value
    const matchLevel = !filterLevel.value || (s.levels || []).includes(filterLevel.value)
    const matchType = !filterType.value || s.subject_type === filterType.value
    return matchSearch && matchDept && matchLevel && matchType
  })
})

function countByType(type) {
  return subjects.value.filter(s => s.subject_type === type).length
}

function typeTagType(type) {
  if (type === 'วิชาพื้นฐาน') return 'primary'
  if (type === 'วิชาเพิ่มเติม') return 'success'
  return 'warning'
}

onMounted(async () => {
  loading.value = true
  subjects.value = await getSubjects()
  loading.value = false
})

function openDialog(subject = null) {
  editingSubject.value = subject
  if (subject) {
    Object.assign(form, {
      subject_code: subject.subject_code || '',
      name: subject.name || '',
      name_en: subject.name_en || '',
      dept: subject.dept || '',
      levels: subject.levels ? [...subject.levels] : [],
      subject_type: subject.subject_type || 'วิชาพื้นฐาน',
      credits: subject.credits ?? 1,
      periods_per_week: subject.periods_per_week ?? 2,
      consecutive_periods: subject.consecutive_periods ?? 1,
      note: subject.note || ''
    })
  } else {
    Object.assign(form, {
      subject_code: '',
      name: '',
      name_en: '',
      dept: '',
      levels: [],
      subject_type: 'วิชาพื้นฐาน',
      credits: 1,
      periods_per_week: 2,
      consecutive_periods: 1,
      note: ''
    })
  }
  dialogVisible.value = true
}

async function handleSave() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    if (consecutiveError.value) {
      ElMessage.error(consecutiveError.value)
      return
    }
    if (!editingSubject.value) {
      const exists = subjects.value.find(s => s.subject_code === form.subject_code)
      if (exists) {
        ElMessage.error('รหัสวิชาซ้ำ กรุณาใช้รหัสอื่น')
        return
      }
    }
    saving.value = true
    try {
      if (editingSubject.value) {
        await cascadeService.updateSubject(
          schoolStore.currentTerm,
          editingSubject.value.subject_code,
          editingSubject.value,
          { ...form }
        )
      } else {
        await saveSubject({ ...form })
      }
      ElMessage.success('บันทึกข้อมูลวิชาเรียบร้อย')
      subjects.value = await getSubjects()
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
      `ยืนยันการลบวิชา "${row.name}" (${row.subject_code})?`,
      'ยืนยันการลบ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    loading.value = true
    await deleteSubject(row.subject_code)
    ElMessage.success('ลบวิชาเรียบร้อย')
    subjects.value = await getSubjects()
  } catch {
    // cancelled
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
      await deleteSubject(row.subject_code)
    }
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
    subjects.value = await getSubjects()
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = filteredSubjects.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) {
      await deleteSubject(row.subject_code)
    }
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
    subjects.value = await getSubjects()
  } catch { /* cancelled */ } finally { loading.value = false }
}

function triggerImport() {
  fileInputRef.value?.click()
}

function handleImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    if (rows.length < 2) {
      ElMessage.warning('ไม่พบข้อมูลในไฟล์')
      return
    }
    const existingCodes = new Set(subjects.value.map(s => s.subject_code))
    const parsed = rows.slice(1).filter(r => r.some(c => c)).map(r => {
      const levelsRaw = String(r[3] || '').trim()
      const obj = {
        subject_code: String(r[0] || '').trim(),
        name: String(r[1] || '').trim(),
        name_en: String(r[2] || '').trim(),
        levels: levelsRaw ? levelsRaw.split(',').map(l => l.trim()).filter(Boolean) : [],
        dept: String(r[4] || '').trim(),
        subject_type: String(r[5] || 'วิชาพื้นฐาน').trim(),
        credits: parseFloat(r[6]) || 1,
        periods_per_week: parseInt(r[7]) || 2,
        consecutive_periods: parseInt(r[8]) || 1,
        note: String(r[9] || '').trim()
      }
      let error = ''
      if (!obj.subject_code) error = 'ไม่มีรหัสวิชา'
      else if (existingCodes.has(obj.subject_code)) error = `รหัส ${obj.subject_code} ซ้ำ`
      else if (!obj.name) error = 'ไม่มีชื่อวิชา'
      if (error) obj._error = error
      return obj
    })
    importRows.value = parsed
    importErrors.value = parsed.filter(r => r._error)
    importDialogVisible.value = true
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function confirmImport() {
  const validRows = importRows.value.filter(r => !r._error)
  if (!validRows.length) return
  saving.value = true
  try {
    for (const row of validRows) {
      const { _error, ...data } = row
      await saveSubject(data)
    }
    ElMessage.success(`นำเข้าข้อมูล ${validRows.length} รายการเรียบร้อย`)
    subjects.value = await getSubjects()
    importDialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    saving.value = false
  }
}

function exportExcel() {
  const headers = ['รหัสวิชา', 'ชื่อวิชา', 'ชื่อวิชา (อังกฤษ)', 'ระดับชั้น', 'กลุ่มสาระ', 'ประเภทวิชา', 'หน่วยกิต', 'คาบ/สัปดาห์', 'คาบติดกัน', 'หมายเหตุ']
  const rows = filteredSubjects.value.map(s => [
    s.subject_code, s.name, s.name_en,
    (s.levels || []).join(','), s.dept, s.subject_type,
    s.credits, s.periods_per_week, s.consecutive_periods, s.note
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'วิชาเรียน')
  XLSX.writeFile(wb, 'subjects.xlsx')
}

function handlePrint() {
  printReport({
    title: 'รายงานข้อมูลรายวิชา',
    columns: [
      { label: 'รหัสวิชา', key: 'subject_code', width: '110px' },
      { label: 'ชื่อวิชา (ไทย)', key: 'subject_name_th' },
      { label: 'ชื่อวิชา (อังกฤษ)', key: 'subject_name_en' },
      { label: 'กลุ่มสาระ', key: 'dept' },
      { label: 'หน่วยกิต', key: 'credits', width: '80px' },
      { label: 'ชั่วโมง/สัปดาห์', key: 'hours_per_week', width: '110px' },
      { label: 'ระดับชั้น', key: 'level' },
    ],
    rows: filteredSubjects.value,
  })
}
</script>
