<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-bold text-white">✅ พฤติกรรมมาเรียน</h1>
            <p class="text-white/80 text-sm mt-1">ตั้งค่าตารางมาเรียนของโรงเรียน พร้อมคะแนนแนะนำ — ภาคเรียน {{ term }}</p>
          </div>
          <div class="flex gap-2">
            <el-button @click="handleImport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📥 นำเข้า
            </el-button>
            <el-button @click="handleExport" style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📤 ส่งออก
            </el-button>
            <el-button type="primary" @click="openDialog()" style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
              + เพิ่มสถานะ
            </el-button>
            <input ref="importFileRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onImportFile" />
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#ede9fe,#ddd6fe)">
          <div class="stat-value" style="color:#7c3aed">{{ statuses.length }}</div>
          <div class="stat-label">ทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ statuses.filter(s => s.is_active).length }}</div>
          <div class="stat-label">เปิดใช้งาน</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fee2e2,#fecaca)">
          <div class="stat-value" style="color:#dc2626">{{ statuses.filter(s => s.affects_behavior).length }}</div>
          <div class="stat-label">หักคะแนนพฤติกรรม</div>
        </div>
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
        <el-table ref="tableRef" :data="statuses" border stripe
          @selection-change="onSelectionChange"
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }">
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column prop="sort_order" label="ลำดับ" width="70" align="center" sortable />
          <el-table-column prop="status_code" label="รหัสสถานะ" width="130" />
          <el-table-column prop="label" label="ชื่อสถานะ" />
          <el-table-column label="สี" width="100" align="center">
            <template #default="{ row }">
              <div class="flex items-center gap-1 justify-center">
                <span class="color-dot" :style="{ background: COLOR_MAP[row.color] || row.color }"></span>
                <span class="text-xs text-gray-500">{{ row.color }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="คะแนนแนะนำ" width="120" align="center">
            <template #default="{ row }">
              <span :class="Number(row.points_default || 0) < 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'">
                {{ Number(row.points_default || 0) > 0 ? '+' : '' }}{{ Number(row.points_default || 0) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="ช่วงคะแนน" width="120" align="center">
            <template #default="{ row }">
              <span class="text-xs text-gray-500">{{ Number(row.points_min || 0) }} / {{ Number(row.points_max || 0) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="มีผลต่อคะแนน" width="130" align="center">
            <template #default="{ row }">
              <el-tag :type="row.affects_behavior ? 'danger' : 'success'" size="small">
                {{ row.affects_behavior ? 'ใช่' : 'ไม่' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="เปิดใช้งาน" width="110" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.is_active" @change="toggleStatus(row)" />
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
      <el-dialog v-model="dialogVisible" :title="editing ? 'แก้ไขสถานะ' : 'เพิ่มสถานะใหม่'" width="500px">
        <el-form :model="form" ref="formRef" label-width="160px" v-loading="dialogLoading">
          <el-form-item label="รหัสสถานะ" prop="status_code" :rules="[{ required: true, message: 'กรุณากรอกรหัสสถานะ' }]">
            <el-input v-model="form.status_code" :disabled="!!editing" placeholder="เช่น present, late, absent" />
          </el-form-item>
          <el-form-item label="ชื่อสถานะ" prop="label" :rules="[{ required: true, message: 'กรุณากรอกชื่อสถานะ' }]">
            <el-input v-model="form.label" placeholder="เช่น มาเรียน, มาสาย, ขาดเรียน" />
          </el-form-item>
          <el-form-item label="สี">
            <el-select v-model="form.color" class="w-full">
              <el-option v-for="c in COLOR_OPTIONS" :key="c.value" :label="c.label" :value="c.value">
                <div class="flex items-center gap-2">
                  <span class="color-dot" :style="{ background: c.hex }"></span>
                  <span>{{ c.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="ลำดับการแสดงผล">
            <el-input-number v-model="form.sort_order" :min="1" :max="99" />
          </el-form-item>
          <el-form-item label="คะแนนแนะนำ">
            <el-input-number v-model="form.points_default" :min="-100" :max="100" :step="1" />
          </el-form-item>
          <el-form-item label="คะแนนต่ำสุด">
            <div>
              <el-input-number v-model="form.points_min" :min="-100" :max="100" :step="1" />
              <div class="text-gray-400 text-xs mt-1">คะแนนต่ำสุดที่ปรับลดได้</div>
            </div>
          </el-form-item>
          <el-form-item label="คะแนนสูงสุด">
            <div>
              <el-input-number v-model="form.points_max" :min="-100" :max="100" :step="1" />
              <div class="text-gray-400 text-xs mt-1">คะแนนสูงสุดที่ปรับเพิ่มได้</div>
            </div>
          </el-form-item>
          <el-form-item label="มีผลต่อคะแนน">
            <el-switch v-model="form.affects_behavior" />
          </el-form-item>
          <el-form-item v-if="form.affects_behavior" label="รูปแบบพฤติกรรม">
            <el-select v-model="form.behavior_setting_id" class="w-full" placeholder="เลือกรูปแบบพฤติกรรม" clearable>
              <el-option v-for="s in behaviorSettings" :key="s.setting_id" :label="s.label" :value="s.setting_id" />
            </el-select>
          </el-form-item>
          <el-form-item label="เปิดใช้งาน">
            <el-switch v-model="form.is_active" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="dialogLoading" @click="saveStatus">บันทึก</el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from '@/supabase/firestore'
import { getSchoolDb } from '@/supabase/db'
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

const statuses = ref([])
const behaviorSettings = ref([])
const tableRef = ref()
const selectedRows = ref([])

const COLOR_OPTIONS = [
  { value: 'green', label: 'เขียว (มาเรียน)', hex: '#67C23A' },
  { value: 'yellow', label: 'เหลือง (มาสาย)', hex: '#E6A23C' },
  { value: 'red', label: 'แดง (ขาด)', hex: '#F56C6C' },
  { value: 'blue', label: 'น้ำเงิน (ลา)', hex: '#409EFF' },
  { value: 'purple', label: 'ม่วง (อื่นๆ)', hex: '#9C27B0' },
  { value: 'gray', label: 'เทา (ไม่ระบุ)', hex: '#909399' },
]

const COLOR_MAP = {
  green: '#67C23A',
  yellow: '#E6A23C',
  red: '#F56C6C',
  blue: '#409EFF',
  purple: '#9C27B0',
  gray: '#909399',
}

const form = reactive({
  status_code: '',
  label: '',
  color: 'green',
  sort_order: 1,
  points_default: 0,
  points_min: 0,
  points_max: 0,
  affects_behavior: false,
  behavior_setting_id: null,
  is_active: true,
})

function openDialog(status = null) {
  editing.value = status
  if (status) {
    Object.assign(form, {
      status_code: status.status_code,
      label: status.label,
      color: status.color || 'green',
      sort_order: status.sort_order || 1,
      points_default: Number(status.points_default || 0),
      points_min: Number(status.points_min || 0),
      points_max: Number(status.points_max || 0),
      affects_behavior: !!status.affects_behavior,
      behavior_setting_id: status.behavior_setting_id || null,
      is_active: status.is_active !== false,
    })
  } else {
    Object.assign(form, {
      status_code: '',
      label: '',
      color: 'green',
      sort_order: statuses.value.length + 1,
      points_default: 0,
      points_min: 0,
      points_max: 0,
      affects_behavior: false,
      behavior_setting_id: null,
      is_active: true,
    })
  }
  dialogVisible.value = true
}

async function saveStatus() {
  await formRef.value?.validate()
  dialogLoading.value = true
  try {
    const id = form.status_code
    const data = {
      status_code: form.status_code,
      label: form.label,
      color: form.color,
      sort_order: form.sort_order,
      points_default: Number(form.points_default || 0),
      points_min: Number(form.points_min || 0),
      points_max: Number(form.points_max || 0),
      affects_behavior: form.affects_behavior,
      behavior_setting_id: form.affects_behavior ? form.behavior_setting_id : null,
      is_active: form.is_active,
      updated_at: serverTimestamp(),
    }
    await setDoc(doc(db(), `terms/${term.value}/attendance_status_settings`, id), data, { merge: true })
    // update local
    const idx = statuses.value.findIndex(s => s.status_code === id)
    if (idx >= 0) {
      Object.assign(statuses.value[idx], data)
    } else {
      statuses.value.push({ id, ...data })
    }
    statuses.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    ElMessage.success('บันทึกสำเร็จ')
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    dialogLoading.value = false
  }
}

async function toggleStatus(row) {
  try {
    await setDoc(doc(db(), `terms/${term.value}/attendance_status_settings`, row.status_code), {
      is_active: row.is_active,
      updated_at: serverTimestamp(),
    }, { merge: true })
    ElMessage.success(`${row.is_active ? 'เปิด' : 'ปิด'}ใช้งานสถานะ "${row.label}" แล้ว`)
  } catch (e) {
    row.is_active = !row.is_active
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบสถานะ "${row.label}" (${row.status_code}) ?`,
      'ลบสถานะ',
      { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    await deleteDoc(doc(db(), `terms/${term.value}/attendance_status_settings`, row.status_code))
    const idx = statuses.value.findIndex(s => s.status_code === row.status_code)
    if (idx >= 0) statuses.value.splice(idx, 1)
    ElMessage.success('ลบสถานะแล้ว')
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
      await deleteDoc(doc(db(), `terms/${term.value}/attendance_status_settings`, row.status_code))
      const idx = statuses.value.findIndex(s => s.status_code === row.status_code)
      if (idx >= 0) statuses.value.splice(idx, 1)
    }
    selectedRows.value = []
    ElMessage.success('ลบรายการที่เลือกเรียบร้อย')
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function deleteAll() {
  const allRows = statuses.value
  if (!allRows.length) return
  try {
    await ElMessageBox.confirm(
      `ยืนยันการลบทั้งหมด ${allRows.length} รายการ? ไม่สามารถกู้คืนได้`,
      'ยืนยันการลบทั้งหมด',
      { confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
    loading.value = true
    for (const row of [...allRows]) {
      await deleteDoc(doc(db(), `terms/${term.value}/attendance_status_settings`, row.status_code))
    }
    statuses.value = []
    ElMessage.success('ลบทั้งหมดเรียบร้อย')
  } catch { /* cancelled */ } finally { loading.value = false }
}

async function loadStatuses() {
  loading.value = true
  try {
    const snap = await getDocs(collection(db(), `terms/${term.value}/attendance_status_settings`))
    statuses.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

async function loadBehaviorSettings() {
  try {
    behaviorSettings.value = await getBehaviorSettings()
  } catch (e) {
    behaviorSettings.value = []
  }
}

// Export
function handleExport() {
  const rows = statuses.value.map(s => ({
    รหัสสถานะ: s.status_code,
    ชื่อ: s.label,
    สี: s.color,
    ลำดับ: s.sort_order,
    คะแนนแนะนำ: Number(s.points_default || 0),
    คะแนนต่ำสุด: Number(s.points_min || 0),
    คะแนนสูงสุด: Number(s.points_max || 0),
    มีผลต่อคะแนน: s.affects_behavior ? 'ใช่' : 'ไม่',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'สถานะการมาเรียน')
  XLSX.writeFile(wb, `attendance_status_${term.value}.xlsx`)
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
      const code = row['รหัสสถานะ']
      if (!code) continue
      const data = {
        status_code: String(code),
        label: row['ชื่อ'] || '',
        color: row['สี'] || 'green',
        sort_order: Number(row['ลำดับ']) || 1,
        points_default: Number(row['คะแนนแนะนำ'] || 0),
        points_min: Number(row['คะแนนต่ำสุด'] || 0),
        points_max: Number(row['คะแนนสูงสุด'] || 0),
        affects_behavior: row['มีผลต่อคะแนน'] === 'ใช่' || row['มีผลต่อคะแนน'] === true,
        is_active: true,
        updated_at: serverTimestamp(),
      }
      await setDoc(doc(db(), `terms/${term.value}/attendance_status_settings`, String(code)), data, { merge: true })
      imported++
    }
    await loadStatuses()
    ElMessage.success(`นำเข้า ${imported} รายการสำเร็จ`)
  } catch (err) {
    ElMessage.error('นำเข้าไม่สำเร็จ: ' + err.message)
  } finally {
    loading.value = false
    e.target.value = ''
  }
}

onMounted(async () => {
  await Promise.all([loadStatuses(), loadBehaviorSettings()])
})
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16px;
  padding: 24px 28px;
  box-shadow: 0 4px 24px rgba(16,185,129,0.2);
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

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
