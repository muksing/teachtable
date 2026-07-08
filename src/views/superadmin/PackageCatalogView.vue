<template>
  <div class="package-catalog">
    <el-card class="surface-card">
      <div class="page-header">
        <div>
          <h2 style="margin:0;font-size:22px;font-weight:800;color:#0f172a">📦 แพ็กเกจรายปี</h2>
          <p style="margin:6px 0 0;color:#64748b;font-size:13px">กำหนดชื่อและราคาแพ็กเกจที่โรงเรียนเลือกได้เมื่อต่ออายุ</p>
        </div>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon> เพิ่มแพ็กเกจ
        </el-button>
      </div>

      <el-table :data="packages" v-loading="loading" style="width:100%" empty-text="ยังไม่มีแพ็กเกจ">
        <el-table-column prop="sort_order" label="ลำดับ" width="80" align="center" />
        <el-table-column prop="code" label="รหัส" width="130" />
        <el-table-column prop="name" label="ชื่อแพ็กเกจ" min-width="180" />
        <el-table-column label="ราคาต่อปี" width="150" align="right">
          <template #default="{ row }">
            <span style="font-weight:700;color:#0284c7">
              {{ Number(row.monthly_fee || 0).toLocaleString('th-TH') }} บาท/ปี
            </span>
          </template>
        </el-table-column>
        <el-table-column label="สถานะ" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_active !== false ? 'success' : 'info'">
              {{ row.is_active !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="230" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain @click="openEditDialog(row)">แก้ไข</el-button>
            <el-popconfirm
              :title="row.is_active !== false ? 'ปิดใช้งานแพ็กเกจนี้?' : 'เปิดใช้งานแพ็กเกจนี้?'"
              :confirm-button-text="row.is_active !== false ? 'ปิดใช้งาน' : 'เปิดใช้งาน'"
              cancel-button-text="ยกเลิก"
              @confirm="handleToggleActive(row)"
            >
              <template #reference>
                <el-button size="small" :type="row.is_active !== false ? 'warning' : 'success'" plain>
                  {{ row.is_active !== false ? 'ปิด' : 'เปิด' }}
                </el-button>
              </template>
            </el-popconfirm>
            <el-popconfirm
              :title="`ลบแพ็กเกจ &quot;${row.name}&quot; ถาวร?`"
              confirm-button-text="ลบ"
              confirm-button-type="danger"
              cancel-button-text="ยกเลิก"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button size="small" type="danger" plain>ลบ</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create / Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? 'เพิ่มแพ็กเกจใหม่' : 'แก้ไขแพ็กเกจ'"
      width="480px"
      destroy-on-close
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="รหัสแพ็กเกจ" required>
          <el-input v-model="form.code" placeholder="เช่น BASIC, PRO, STANDARD" :disabled="dialogMode === 'edit'" />
          <div v-if="dialogMode === 'edit'" class="hint">รหัสไม่สามารถแก้ไขได้</div>
        </el-form-item>
        <el-form-item label="ชื่อแพ็กเกจ" required>
          <el-input v-model="form.name" placeholder="เช่น แพ็กเกจเริ่มต้น, แพ็กเกจมาตรฐาน" />
        </el-form-item>
        <el-form-item label="ราคาต่อปี (บาท)" required>
          <el-input-number v-model="form.annual_fee" :min="0" :step="500" style="width:100%" />
        </el-form-item>
        <el-form-item label="ลำดับการแสดง">
          <el-input-number v-model="form.sort_order" :min="1" :max="999" style="width:100%" />
          <div class="hint">ตัวเลขน้อย = แสดงก่อน</div>
        </el-form-item>
        <el-form-item v-if="dialogMode === 'create'" label="สถานะ">
          <el-switch v-model="form.is_active" active-text="เปิดใช้งาน" inactive-text="ปิดใช้งาน" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">บันทึก</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import { Plus } from '@element-plus/icons-vue'

const { loading, getPackageCatalog, createPackage, updatePackage, togglePackageActive, deletePackage } = useSchoolManagement()

const packages = ref([])
const dialogVisible = ref(false)
const dialogMode = ref('create')
const saving = ref(false)
const editingCode = ref(null)

const form = reactive({ code: '', name: '', annual_fee: 5000, sort_order: 99, is_active: true })

function resetForm() {
  form.code = ''
  form.name = ''
  form.annual_fee = 5000
  form.sort_order = 99
  form.is_active = true
  editingCode.value = null
}

function openCreateDialog() {
  resetForm()
  dialogMode.value = 'create'
  dialogVisible.value = true
}

function openEditDialog(pkg) {
  resetForm()
  form.code = pkg.code || ''
  form.name = pkg.name || ''
  form.annual_fee = Number(pkg.monthly_fee || 0)
  form.sort_order = Number(pkg.sort_order || 99)
  form.is_active = pkg.is_active !== false
  editingCode.value = pkg.code
  dialogMode.value = 'edit'
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.code.trim()) { ElMessage.warning('กรุณากรอกรหัสแพ็กเกจ'); return }
  if (!form.name.trim()) { ElMessage.warning('กรุณากรอกชื่อแพ็กเกจ'); return }
  saving.value = true
  try {
    let result
    if (dialogMode.value === 'create') {
      result = await createPackage({
        code: form.code,
        name: form.name,
        monthly_fee: form.annual_fee,
        sort_order: form.sort_order,
        is_active: form.is_active,
        duration_months: 12,
        scheduler_limit: 1,
      })
    } else {
      result = await updatePackage(editingCode.value, {
        name: form.name,
        monthly_fee: form.annual_fee,
        sort_order: form.sort_order,
      })
    }
    if (!result.success) { ElMessage.error(result.error || 'บันทึกไม่สำเร็จ'); return }
    ElMessage.success(dialogMode.value === 'create' ? 'สร้างแพ็กเกจแล้ว' : 'แก้ไขแพ็กเกจแล้ว')
    dialogVisible.value = false
    await loadCatalog()
  } catch (err) {
    ElMessage.error(err.message || 'บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}

async function handleDelete(pkg) {
  const result = await deletePackage(pkg.code)
  if (result.success) {
    ElMessage.success('ลบแพ็กเกจแล้ว')
    await loadCatalog()
  } else {
    ElMessage.error(result.error || 'ลบไม่สำเร็จ')
  }
}

async function handleToggleActive(pkg) {
  const newState = pkg.is_active === false
  const result = await togglePackageActive(pkg.code, newState)
  if (result.success) {
    ElMessage.success(newState ? 'เปิดใช้งานแพ็กเกจแล้ว' : 'ปิดใช้งานแพ็กเกจแล้ว')
    await loadCatalog()
  } else {
    ElMessage.error(result.error || 'เกิดข้อผิดพลาด')
  }
}

async function loadCatalog() {
  const result = await getPackageCatalog(false)
  if (result.success) packages.value = result.data
  else ElMessage.error(result.error || 'โหลดแพ็กเกจไม่สำเร็จ')
}

onMounted(loadCatalog)
</script>

<style scoped>
.package-catalog { padding: 0; }
.surface-card { border: 1px solid #e2e8f0; border-radius: 18px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }
</style>
