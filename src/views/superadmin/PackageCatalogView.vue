<template>
  <div class="package-catalog">
    <el-card class="surface-card">
      <div class="page-header">
        <div>
          <h2>จัดการแพ็กเกจ</h2>
          <p>กำหนดชื่อแพ็กเกจ ราคา ระยะเวลา และจำนวนผู้จัดตารางพร้อมกัน</p>
        </div>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          เพิ่มแพ็กเกจ
        </el-button>
      </div>

      <el-table
        :data="packages"
        v-loading="loading"
        style="width: 100%"
        empty-text="ยังไม่มีแพ็กเกจ กรุณาสร้างแพ็กเกจใหม่"
      >
        <el-table-column prop="sort_order" label="ลำดับ" width="80" align="center" />
        <el-table-column prop="code" label="รหัส" width="120" />
        <el-table-column prop="name" label="ชื่อแพ็กเกจ" min-width="160" />
        <el-table-column label="ราคา/เดือน" width="130" align="right">
          <template #default="scope">
            {{ Number(scope.row.monthly_fee || 0).toLocaleString('th-TH') }} บาท
          </template>
        </el-table-column>
        <el-table-column label="ระยะเวลาแนะนำ" width="150" align="center">
          <template #default="scope">
            {{ scope.row.duration_months || 1 }} เดือน
          </template>
        </el-table-column>
        <el-table-column label="จัดพร้อมกัน" width="130" align="center">
          <template #default="scope">
            {{ scope.row.scheduler_limit || 1 }} คน
          </template>
        </el-table-column>
        <el-table-column label="สถานะ" width="110" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.is_active !== false ? 'success' : 'info'">
              {{ scope.row.is_active !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200" fixed="right" align="center">
          <template #default="scope">
            <el-button size="small" type="primary" plain @click="openEditDialog(scope.row)">แก้ไข</el-button>
            <el-popconfirm
              :title="scope.row.is_active !== false ? 'ปิดใช้งานแพ็กเกจนี้?' : 'เปิดใช้งานแพ็กเกจนี้?'"
              :confirm-button-text="scope.row.is_active !== false ? 'ปิดใช้งาน' : 'เปิดใช้งาน'"
              cancel-button-text="ยกเลิก"
              @confirm="handleToggleActive(scope.row)"
            >
              <template #reference>
                <el-button
                  size="small"
                  :type="scope.row.is_active !== false ? 'warning' : 'success'"
                  plain
                >
                  {{ scope.row.is_active !== false ? 'ปิด' : 'เปิด' }}
                </el-button>
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
      width="520px"
      destroy-on-close
    >
      <el-form :model="form" label-width="160px" class="pkg-form">
        <el-form-item label="รหัสแพ็กเกจ" required>
          <el-input
            v-model="form.code"
            placeholder="เช่น BASIC, PRO, 500"
            :disabled="dialogMode === 'edit'"
          />
          <div v-if="dialogMode === 'edit'" class="hint">รหัสแพ็กเกจไม่สามารถแก้ไขได้</div>
        </el-form-item>
        <el-form-item label="ชื่อแพ็กเกจ" required>
          <el-input v-model="form.name" placeholder="เช่น แพ็กเกจเริ่มต้น, แพ็กเกจพรีเมียม" />
        </el-form-item>
        <el-form-item label="ราคา/เดือน (บาท)" required>
          <el-input-number v-model="form.monthly_fee" :min="1" :step="100" style="width:100%" />
        </el-form-item>
        <el-form-item label="ระยะเวลาแนะนำ" required>
          <el-radio-group v-model="form.duration_months">
            <el-radio :label="1">1 เดือน</el-radio>
            <el-radio :label="3">3 เดือน</el-radio>
            <el-radio :label="6">6 เดือน</el-radio>
            <el-radio :label="12">12 เดือน</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="จัดพร้อมกัน (คน)" required>
          <el-input-number v-model="form.scheduler_limit" :min="1" :max="99" style="width:100%" />
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
import { useAuthStore } from '@/stores/auth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import { Plus } from '@element-plus/icons-vue'

const authStore = useAuthStore()
const { loading, getPackageCatalog, createPackage, updatePackage, togglePackageActive } = useSchoolManagement()

const packages = ref([])
const dialogVisible = ref(false)
const dialogMode = ref('create')
const saving = ref(false)
const editingId = ref(null)

const form = reactive({
  code: '',
  name: '',
  monthly_fee: 200,
  duration_months: 1,
  scheduler_limit: 2,
  sort_order: 99,
  is_active: true,
})

function resetForm() {
  form.code = ''
  form.name = ''
  form.monthly_fee = 200
  form.duration_months = 1
  form.scheduler_limit = 2
  form.sort_order = 99
  form.is_active = true
  editingId.value = null
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
  form.monthly_fee = Number(pkg.monthly_fee || 0)
  form.duration_months = Number(pkg.duration_months || 1)
  form.scheduler_limit = Number(pkg.scheduler_limit || 1)
  form.sort_order = Number(pkg.sort_order || 99)
  form.is_active = pkg.is_active !== false
  editingId.value = pkg.id
  dialogMode.value = 'edit'
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.code.trim()) {
    ElMessage.warning('กรุณากรอกรหัสแพ็กเกจ')
    return
  }
  if (!form.name.trim()) {
    ElMessage.warning('กรุณากรอกชื่อแพ็กเกจ')
    return
  }
  saving.value = true
  try {
    const uid = authStore.profile?.uid
    let result
    if (dialogMode.value === 'create') {
      result = await createPackage({ ...form }, uid)
    } else {
      result = await updatePackage(editingId.value, {
        name: form.name,
        monthly_fee: form.monthly_fee,
        duration_months: form.duration_months,
        scheduler_limit: form.scheduler_limit,
        sort_order: form.sort_order,
      }, uid)
    }
    if (!result.success) {
      ElMessage.error(result.error || 'บันทึกไม่สำเร็จ')
      return
    }
    ElMessage.success(dialogMode.value === 'create' ? 'สร้างแพ็กเกจแล้ว' : 'แก้ไขแพ็กเกจแล้ว')
    dialogVisible.value = false
    await loadCatalog()
  } catch (err) {
    ElMessage.error(err.message || 'บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}

async function handleToggleActive(pkg) {
  const uid = authStore.profile?.uid
  const newState = pkg.is_active === false
  const result = await togglePackageActive(pkg.id, newState, uid)
  if (result.success) {
    ElMessage.success(newState ? 'เปิดใช้งานแพ็กเกจแล้ว' : 'ปิดใช้งานแพ็กเกจแล้ว')
    await loadCatalog()
  } else {
    ElMessage.error(result.error || 'เกิดข้อผิดพลาด')
  }
}

async function loadCatalog() {
  const result = await getPackageCatalog(false)
  if (result.success) {
    packages.value = result.data
  } else {
    ElMessage.error(result.error || 'โหลดแพ็กเกจไม่สำเร็จ')
  }
}

onMounted(() => {
  loadCatalog()
})
</script>

<style scoped>
.package-catalog {
  padding: 20px;
}

.surface-card {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
}

.page-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.pkg-form {
  margin-top: 4px;
}

.hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
</style>
