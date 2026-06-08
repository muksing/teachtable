<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">⭐ ตั้งค่าพฤติกรรม</h1>
            <p class="text-white/80 text-sm mt-1">กำหนดรูปแบบพฤติกรรมสำหรับการประเมิน — ภาคเรียน {{ term }}</p>
          </div>
          <div class="flex gap-2">
            <el-button @click="handleImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า
            </el-button>
            <el-button @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก
            </el-button>
            <el-button type="primary" @click="openDialog()" style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
              + เพิ่มรูปแบบ
            </el-button>
            <input ref="importFileRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onImportFile" />
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#fdf4ff,#fae8ff)">
          <div class="stat-value" style="color:#a21caf">{{ settings.length }}</div>
          <div class="stat-label">ทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="stat-value" style="color:#1d4ed8">{{ settings.filter(s => s.behavior_type === 'general').length }}</div>
          <div class="stat-label">ความประพฤติ</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ settings.filter(s => s.behavior_type === 'attendance').length }}</div>
          <div class="stat-label">การมาเรียน</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fff7ed,#fed7aa)">
          <div class="stat-value" style="color:#c2410c">{{ settings.filter(s => s.behavior_type === 'learning').length }}</div>
          <div class="stat-label">ในห้องเรียน</div>
        </div>
      </div>

      <!-- Tabs -->
      <el-tabs v-model="activeTab" type="card" class="mb-4 behavior-tabs" @tab-change="tableRef?.clearSelection()">
        <el-tab-pane name="learning">
          <template #label><span>📚 พฤติกรรมในห้องเรียน <el-badge :value="settings.filter(s=>s.behavior_type==='learning').length" type="warning" class="ml-1" /></span></template>
        </el-tab-pane>
        <el-tab-pane name="general">
          <template #label><span>⭐ ความประพฤติทั่วไป <el-badge :value="settings.filter(s=>s.behavior_type==='general').length" type="primary" class="ml-1" /></span></template>
        </el-tab-pane>
      </el-tabs>

      <!-- Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)">
        <!-- Section hint -->
        <div v-if="activeTab === 'learning'" class="mb-3 px-3 py-2 rounded-lg text-sm" style="background:#fffbeb;border:1px solid #fde68a;color:#92400e">
          💡 พฤติกรรมในห้องเรียน — ครูเลือกได้ขณะบันทึกเข้าสอน (ไม่รวมความประพฤติทั่วไป)
        </div>
        <div v-else class="mb-3 px-3 py-2 rounded-lg text-sm" style="background:#f0f9ff;border:1px solid #bae6fd;color:#075985">
          💡 ความประพฤติทั่วไป — ใช้สำหรับการประเมินพฤติกรรมนอกห้องเรียน / รายงานวินัย
        </div>
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
        <el-table ref="tableRef" :data="filteredSettings" border stripe
          @selection-change="onSelectionChange"
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }">
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="setting_id" label="รหัส" width="140" />
          <el-table-column prop="label" label="ชื่อพฤติกรรม" min-width="180" />
          <el-table-column label="คะแนน default" width="120" align="center">
            <template #default="{ row }">
              <span :class="row.points_default < 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'">
                {{ row.points_default > 0 ? '+' : '' }}{{ row.points_default }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="min / max" width="110" align="center">
            <template #default="{ row }">
              <span class="text-gray-500 text-xs">{{ row.points_min }} / {{ row.points_max }}</span>
            </template>
          </el-table-column>
          <el-table-column label="อัตโนมัติ" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_auto ? 'warning' : 'info'" size="small">
                {{ row.is_auto ? 'ใช่' : 'ไม่' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="เปิดใช้" width="90" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.is_active" @change="toggleActive(row)" />
            </template>
          </el-table-column>
          <el-table-column label="จัดการ" width="140" align="center">
            <template #default="{ row }">
              <el-button size="small" @click="openDialog(row)">แก้ไข</el-button>
              <el-button size="small" type="danger" @click="confirmDelete(row)">ลบ</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Dialog -->
      <el-dialog v-model="dialogVisible" :title="editing ? 'แก้ไขรูปแบบพฤติกรรม' : 'เพิ่มรูปแบบพฤติกรรม'" width="540px">
        <el-form :model="form" ref="formRef" label-width="160px" v-loading="dialogLoading">
          <el-form-item label="รหัส" prop="setting_id" :rules="[{ required: true, message: 'กรุณากรอกรหัส' }]">
            <el-input v-model="form.setting_id" :disabled="!!editing" placeholder="เช่น absent_full, late_1, good_behavior" />
          </el-form-item>
          <el-form-item label="ชื่อพฤติกรรม" prop="label" :rules="[{ required: true, message: 'กรุณากรอกชื่อพฤติกรรม' }]">
            <el-input v-model="form.label" placeholder="เช่น ขาดเรียน, มาสาย, มีน้ำใจ" />
          </el-form-item>
          <el-form-item label="ประเภท" prop="behavior_type">
            <el-select v-model="form.behavior_type" class="w-full">
              <el-option v-for="t in TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="คะแนน default">
            <el-input-number v-model="form.points_default" :min="-100" :max="100" :step="1" @change="onDefaultChange" />
            <span class="ml-2 text-gray-400 text-xs">(ค่าลบ = หักคะแนน, ค่าบวก = ให้คะแนนพิเศษ)</span>
          </el-form-item>
          <el-form-item label="คะแนนต่ำสุด (ปรับได้ถึง)">
            <div>
              <el-input-number v-model="form.points_min" :min="-100" :max="form.points_default" :step="1" />
              <div class="text-gray-400 text-xs mt-1">คะแนนต่ำสุดที่ปรับลดได้ ≤ {{ form.points_default }}</div>
            </div>
          </el-form-item>
          <el-form-item label="คะแนนสูงสุด (ปรับได้ถึง)">
            <div>
              <el-input-number v-model="form.points_max" :min="form.points_default" :max="100" :step="1" />
              <div class="text-gray-400 text-xs mt-1">คะแนนสูงสุดที่ปรับเพิ่มได้ ≥ {{ form.points_default }}</div>
            </div>
          </el-form-item>
          <el-form-item label="">
            <span v-if="validationError" class="text-red-500 text-sm">{{ validationError }}</span>
          </el-form-item>
          <el-form-item label="อัตโนมัติ">
            <el-switch v-model="form.is_auto" />
            <span class="ml-2 text-gray-400 text-xs">ถ้าเปิด ระบบจะบันทึกให้อัตโนมัติ</span>
          </el-form-item>
          <el-form-item label="เปิดใช้งาน">
            <el-switch v-model="form.is_active" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="dialogLoading" @click="saveSetting">บันทึก</el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import * as XLSX from 'xlsx'

const schoolStore = useSchoolStore()
const { getBehaviorSettings } = useSchoolDb()

const db = () => getSchoolDb()
const term = computed(() => schoolStore.currentTerm || '2568_1')

const loading = ref(false)
const dialogLoading = ref(false)
const dialogVisible = ref(false)
const editing = ref(null)
const formRef = ref()
const importFileRef = ref(null)

const settings = ref([])
const activeTab = ref('learning')
const filteredSettings = computed(() => settings.value.filter(s => s.behavior_type === activeTab.value))
const tableRef = ref()
const selectedRows = ref([])

const TYPE_OPTIONS = [
  { value: 'general', label: 'ความประพฤติทั่วไป' },
  { value: 'attendance', label: 'การมาเรียน' },
  { value: 'learning', label: 'ในห้องเรียน' },
]

const TYPE_LABEL = { general: 'ความประพฤติ', attendance: 'การมาเรียน', learning: 'ในห้องเรียน' }
const TYPE_TAG = { general: 'primary', attendance: 'success', learning: 'warning' }

const form = reactive({
  setting_id: '',
  label: '',
  behavior_type: 'general',
  points_default: -1,
  points_min: -10,
  points_max: 0,
  is_auto: false,
  is_active: true,
})

function onDefaultChange(val) {
  if (form.points_min > val) form.points_min = val
  if (form.points_max < val) form.points_max = val
}

const validationError = computed(() => {
  if (form.points_min > form.points_default) return 'คะแนนต่ำสุดต้องน้อยกว่าหรือเท่ากับคะแนน default'
  if (form.points_default > form.points_max) return 'คะแนน default ต้องน้อยกว่าหรือเท่ากับคะแนนสูงสุด'
  return ''
})

function openDialog(item = null) {
  editing.value = item
  if (item) {
    Object.assign(form, {
      setting_id: item.setting_id,
      label: item.label,
      behavior_type: item.behavior_type || 'general',
      points_default: item.points_default ?? -1,
      points_min: item.points_min ?? -10,
      points_max: item.points_max ?? 0,
      is_auto: !!item.is_auto,
      is_active: item.is_active !== false,
    })
  } else {
    Object.assign(form, {
      setting_id: '',
      label: '',
      behavior_type: activeTab.value,
      points_default: -1,
      points_min: -10,
      points_max: 0,
      is_auto: false,
      is_active: true,
    })
  }
  dialogVisible.value = true
}

async function saveSetting() {
  await formRef.value?.validate()
  if (validationError.value) {
    ElMessage.warning(validationError.value)
    return
  }
  dialogLoading.value = true
  try {
    const id = form.setting_id
    const data = {
      setting_id: form.setting_id,
      label: form.label,
      behavior_type: form.behavior_type,
      points_default: form.points_default,
      points_min: form.points_min,
      points_max: form.points_max,
      is_auto: form.is_auto,
      is_active: form.is_active,
      updated_at: serverTimestamp(),
    }
    await setDoc(doc(db(), `terms/${term.value}/behavior_settings`, id), data, { merge: true })
    const idx = settings.value.findIndex(s => s.setting_id === id)
    if (idx >= 0) {
      Object.assign(settings.value[idx], data)
    } else {
      settings.value.push({ id, ...data })
    }
    ElMessage.success('บันทึกสำเร็จ')
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    dialogLoading.value = false
  }
}

async function toggleActive(row) {
  try {
    await setDoc(doc(db(), `terms/${term.value}/behavior_settings`, row.setting_id), {
      is_active: row.is_active,
      updated_at: serverTimestamp(),
    }, { merge: true })
    ElMessage.success(`${row.is_active ? 'เปิด' : 'ปิด'}ใช้งาน "${row.label}" แล้ว`)
  } catch (e) {
    row.is_active = !row.is_active
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบรูปแบบ "${row.label}" (${row.setting_id}) ?`,
      'ลบรูปแบบพฤติกรรม',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    await deleteDoc(doc(db(), `terms/${term.value}/behavior_settings`, row.setting_id))
    const idx = settings.value.findIndex(s => s.setting_id === row.setting_id)
    if (idx >= 0) settings.value.splice(idx, 1)
    ElMessage.success('ลบรูปแบบพฤติกรรมแล้ว')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
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
      await deleteDoc(doc(db(), `terms/${term.value}/behavior_settings`, row.setting_id))
      const idx = settings.value.findIndex(s => s.setting_id === row.setting_id)
      if (idx >= 0) settings.value.splice(idx, 1)
    }
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = filteredSettings.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) {
      await deleteDoc(doc(db(), `terms/${term.value}/behavior_settings`, row.setting_id))
    }
    settings.value = []
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function loadSettings() {
  loading.value = true
  try {
    settings.value = await getBehaviorSettings()
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

// Export
function handleExport() {
  const rows = settings.value.map(s => ({
    รหัส: s.setting_id,
    ชื่อพฤติกรรม: s.label,
    ประเภท: TYPE_LABEL[s.behavior_type] || s.behavior_type,
    คะแนนDefault: s.points_default,
    คะแนนต่ำสุด: s.points_min,
    คะแนนสูงสุด: s.points_max,
    อัตโนมัติ: s.is_auto ? 'ใช่' : 'ไม่',
    เปิดใช้: s.is_active ? 'ใช่' : 'ไม่',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ตั้งค่าพฤติกรรม')
  XLSX.writeFile(wb, `behavior_settings_${term.value}.xlsx`)
  ElMessage.success('ส่งออกข้อมูลสำเร็จ')
}

// Import
function handleImport() {
  importFileRef.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  loading.value = true
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws)
    let imported = 0
    for (const row of rows) {
      const id = row['รหัส']
      if (!id) continue
      // Map ประเภท label back to value
      const typeMap = { 'ความประพฤติ': 'general', 'ความประพฤติทั่วไป': 'general', 'การมาเรียน': 'attendance', 'ในห้องเรียน': 'learning' }
      const data = {
        setting_id: String(id),
        label: row['ชื่อพฤติกรรม'] || '',
        behavior_type: typeMap[row['ประเภท']] || 'general',
        points_default: Number(row['คะแนนDefault']) || 0,
        points_min: Number(row['คะแนนต่ำสุด']) || -10,
        points_max: Number(row['คะแนนสูงสุด']) || 0,
        is_auto: row['อัตโนมัติ'] === 'ใช่' || row['อัตโนมัติ'] === true,
        is_active: row['เปิดใช้'] !== 'ไม่',
        updated_at: serverTimestamp(),
      }
      await setDoc(doc(db(), `terms/${term.value}/behavior_settings`, String(id)), data, { merge: true })
      imported++
    }
    await loadSettings()
    ElMessage.success(`นำเข้า ${imported} รายการสำเร็จ`)
  } catch (err) {
    ElMessage.error('นำเข้าไม่สำเร็จ: ' + err.message)
  } finally {
    loading.value = false
    e.target.value = ''
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(168,85,247,0.2);
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
