<template>
  <div class="active-schools">
    <!-- Header -->
    <el-card class="surface-card mb-5">
      <div class="page-header">
        <div>
          <h2 style="margin:0;font-size:22px;font-weight:800;color:#0f172a">🏫 จัดการโรงเรียน</h2>
          <p style="margin:4px 0 0;color:#64748b;font-size:13px">ตั้งค่าอายุแพ็กเกจ เปิด/ปิดฟีเจอร์ และลบโรงเรียน</p>
        </div>
        <el-button type="primary" :loading="loading" @click="loadSchools">
          <el-icon><Refresh /></el-icon> รีเฟรช
        </el-button>
      </div>
    </el-card>

    <!-- Search -->
    <el-card class="surface-card mb-5">
      <el-input v-model="searchText" placeholder="🔍 ค้นหาชื่อโรงเรียน / อีเมล..." clearable style="max-width:400px" />
    </el-card>

    <!-- Table -->
    <el-card class="surface-card">
      <el-table :data="paginatedSchools" stripe style="width:100%" empty-text="ไม่พบโรงเรียน">
        <el-table-column prop="schoolName" label="โรงเรียน" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div style="font-weight:700;color:#1e1b4b">{{ row.schoolName }}</div>
            <div style="font-size:11px;color:#94a3b8">{{ row.adminEmail }}</div>
          </template>
        </el-table-column>

        <el-table-column label="ราคาต่อปี" width="130" align="center">
          <template #default="{ row }">
            <span style="font-weight:700;color:#0284c7">
              {{ row.pricing_plan?.annual_fee ? `฿${Number(row.pricing_plan.annual_fee).toLocaleString()}` : '—' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="หมดอายุ" width="140" align="center">
          <template #default="{ row }">
            <el-tag :type="getExpiryType(row)">
              {{ formatExpiry(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="สถานะ" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" effect="dark">
              {{ row.isActive ? 'Active' : 'Suspended' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="ฟีเจอร์" width="220" align="center">
          <template #default="{ row }">
            <div class="feature-cell">
              <div class="feature-row">
                <span>บันทึกเข้าสอน</span>
                <el-switch
                  :model-value="isFeatureEnabled(row, 'teaching_log_enabled')"
                  :loading="isFeatureUpdating(row, 'teaching_log_enabled')"
                  inline-prompt active-text="ON" inactive-text="OFF"
                  @change="() => toggleFeature(row, 'teaching_log_enabled', 'บันทึกเข้าสอน')"
                />
              </div>
              <div class="feature-row">
                <span>ชุมนุม</span>
                <el-switch
                  :model-value="isFeatureEnabled(row, 'club_module_enabled')"
                  :loading="isFeatureUpdating(row, 'club_module_enabled')"
                  inline-prompt active-text="ON" inactive-text="OFF"
                  @change="() => toggleFeature(row, 'club_module_enabled', 'ชุมนุม')"
                />
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-group">
              <el-button type="primary" size="small" @click="openPlanDialog(row)">
                <el-icon><Edit /></el-icon> ต่ออายุ
              </el-button>
              <el-button
                :type="row.isActive ? 'warning' : 'success'"
                size="small" plain
                @click="toggleStatus(row)"
              >{{ row.isActive ? 'Suspend' : 'Activate' }}</el-button>
              <el-button type="danger" size="small" plain @click="confirmDelete(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredSchools.length"
        layout="total, prev, pager, next"
        class="mt-4"
        style="justify-content:center;display:flex"
      />
    </el-card>

    <!-- Plan Dialog -->
    <el-dialog v-model="planDialog.visible" title="ตั้งค่าอายุแพ็กเกจ" width="520px" destroy-on-close>
      <div class="school-badge">🏫 {{ planDialog.schoolName }}</div>
      <div class="expiry-current">วันหมดอายุปัจจุบัน: <b>{{ planDialog.currentExpiry || 'ยังไม่กำหนด' }}</b></div>

      <el-form label-position="top" class="mt-4">
        <el-form-item label="ราคาต่อปี (บาท)">
          <el-input-number v-model="planDialog.annualFee" :min="0" :max="999999" :step="500" style="width:200px" />
          <span style="margin-left:10px;color:#64748b;font-size:12px">0 = ไม่ระบุราคา</span>
        </el-form-item>

        <el-form-item label="กำหนดวันหมดอายุ">
          <div style="display:flex;flex-direction:column;gap:10px;width:100%">
            <el-radio-group v-model="planDialog.expiryMode">
              <el-radio value="add_year">ต่อออก 1 ปี จากวันนี้ ({{ nextYearDate }})</el-radio>
              <el-radio value="manual">กำหนดวันเอง</el-radio>
            </el-radio-group>
            <el-date-picker
              v-if="planDialog.expiryMode === 'manual'"
              v-model="planDialog.manualDate"
              type="date"
              value-format="YYYY-MM-DD"
              format="DD/MM/YYYY"
              placeholder="เลือกวันหมดอายุ"
              style="width:100%"
            />
          </div>
        </el-form-item>

        <el-form-item label="หมายเหตุ">
          <el-input v-model="planDialog.note" type="textarea" :rows="2" placeholder="หมายเหตุ (ถ้ามี)" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="planDialog.visible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="planDialog.saving" @click="savePlan">💾 บันทึก</el-button>
      </template>
    </el-dialog>

    <!-- Delete Confirm Dialog -->
    <el-dialog v-model="deleteDialog.visible" title="⚠️ ลบโรงเรียน" width="480px">
      <div class="delete-warn">
        <p>คุณกำลังจะลบโรงเรียน <b>{{ deleteDialog.schoolName }}</b> และข้อมูลทั้งหมด</p>
        <p style="color:#dc2626;font-weight:700">⚠️ การลบนี้ไม่สามารถกู้คืนได้</p>
        <p>พิมพ์ชื่อโรงเรียนเพื่อยืนยัน:</p>
        <el-input v-model="deleteDialog.confirm" :placeholder="deleteDialog.schoolName" />
      </div>
      <template #footer>
        <el-button @click="deleteDialog.visible = false">ยกเลิก</el-button>
        <el-button
          type="danger"
          :loading="deleteDialog.deleting"
          :disabled="deleteDialog.confirm !== deleteDialog.schoolName"
          @click="doDelete"
        >🗑️ ลบโรงเรียนนี้</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import { supabase } from '@/supabase/client'
import { Refresh, Edit, Delete } from '@element-plus/icons-vue'

const authStore = useAuthStore()
const { getSchools, toggleSchoolStatus, updateSchoolFeatureFlags, deleteSchool } = useSchoolManagement()

const loading = ref(false)
const schools = ref([])
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(15)
const featureUpdatingMap = ref({})

const nextYearDate = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`
})

const planDialog = reactive({
  visible: false, saving: false,
  schoolId: '', schoolName: '', currentExpiry: '',
  annualFee: 0, expiryMode: 'add_year', manualDate: '', note: '',
})

const deleteDialog = reactive({
  visible: false, deleting: false,
  schoolId: '', schoolName: '', confirm: '',
})

const filteredSchools = computed(() => {
  const q = searchText.value.toLowerCase()
  if (!q) return schools.value
  return schools.value.filter(s =>
    `${s.schoolName} ${s.adminEmail}`.toLowerCase().includes(q)
  )
})

const paginatedSchools = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSchools.value.slice(start, start + pageSize.value)
})

function formatExpiry(row) {
  const exp = row.pricing_plan?.expires_at
  if (!exp) return 'ไม่กำหนด'
  const d = new Date(exp)
  if (isNaN(d)) return 'ไม่กำหนด'
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getExpiryType(row) {
  const exp = row.pricing_plan?.expires_at
  if (!exp) return 'danger'
  return new Date(exp) > new Date() ? 'success' : 'danger'
}

function isFeatureEnabled(school, feat) { return school?.feature_flags?.[feat] === true }
function isFeatureUpdating(school, feat) { return !!featureUpdatingMap.value[`${school?.id}:${feat}`] }

async function loadSchools() {
  loading.value = true
  try {
    const res = await getSchools()
    if (res.success) schools.value = res.data
    else ElMessage.error(res.error || 'โหลดข้อมูลไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}

async function toggleStatus(school) {
  try {
    await ElMessageBox.confirm(`${school.isActive ? 'Suspend' : 'Activate'} "${school.schoolName}"?`, 'ยืนยัน', { type: 'warning' })
    const res = await toggleSchoolStatus(school.id, !school.isActive)
    if (res.success) { ElMessage.success('อัปเดตสถานะแล้ว'); await loadSchools() }
    else ElMessage.error(res.error)
  } catch { /* cancel */ }
}

function openPlanDialog(school) {
  planDialog.visible = true
  planDialog.schoolId = school.id
  planDialog.schoolName = school.schoolName || school.schoolId
  planDialog.currentExpiry = formatExpiry(school)
  planDialog.annualFee = Number(school.pricing_plan?.annual_fee || 0)
  planDialog.expiryMode = 'add_year'
  planDialog.manualDate = ''
  planDialog.note = ''
}

async function savePlan() {
  if (planDialog.expiryMode === 'manual' && !planDialog.manualDate) {
    ElMessage.warning('กรุณาเลือกวันหมดอายุ'); return
  }
  planDialog.saving = true
  try {
    let expiresAt
    if (planDialog.expiryMode === 'add_year') {
      const d = new Date(); d.setFullYear(d.getFullYear() + 1)
      expiresAt = d.toISOString().split('T')[0]
    } else {
      expiresAt = planDialog.manualDate
    }

    // อัปเดต pricing_plan ใน schools table โดยตรง
    const currentPlan = schools.value.find(s => s.id === planDialog.schoolId)?.pricing_plan || {}
    const newPlan = {
      ...currentPlan,
      annual_fee: planDialog.annualFee,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
      note: planDialog.note || null,
    }
    const { error } = await supabase
      .from('schools')
      .update({ pricing_plan: newPlan })
      .eq('id', planDialog.schoolId)
    if (error) throw error

    ElMessage.success('บันทึกแพ็กเกจเรียบร้อย')
    planDialog.visible = false
    await loadSchools()
  } catch (e) {
    ElMessage.error(e.message || 'บันทึกไม่สำเร็จ')
  } finally {
    planDialog.saving = false
  }
}

async function toggleFeature(school, feat, label) {
  const key = `${school.id}:${feat}`
  const next = !isFeatureEnabled(school, feat)
  featureUpdatingMap.value = { ...featureUpdatingMap.value, [key]: true }
  try {
    const res = await updateSchoolFeatureFlags(school.id, { [feat]: next }, authStore.profile?.uid)
    if (res.success) {
      school.feature_flags = { ...(school.feature_flags || {}), [feat]: next }
      ElMessage.success(`${label}: ${next ? 'เปิด' : 'ปิด'}`)
    } else ElMessage.error(res.error)
  } finally {
    featureUpdatingMap.value = { ...featureUpdatingMap.value, [key]: false }
  }
}

function confirmDelete(school) {
  deleteDialog.visible = true
  deleteDialog.schoolId = school.id
  deleteDialog.schoolName = school.schoolName || school.schoolId
  deleteDialog.confirm = ''
}

async function doDelete() {
  if (deleteDialog.confirm !== deleteDialog.schoolName) return
  deleteDialog.deleting = true
  try {
    const res = await deleteSchool(deleteDialog.schoolId)
    if (res.success) {
      ElMessage.success('ลบโรงเรียนเรียบร้อยแล้ว')
      deleteDialog.visible = false
      await loadSchools()
    } else {
      ElMessage.error(res.error || 'ลบไม่สำเร็จ')
    }
  } finally {
    deleteDialog.deleting = false
  }
}

onMounted(loadSchools)
</script>

<style scoped>
.active-schools { padding: 0; }
.surface-card { border-radius: 14px; border: 1px solid #e2e8f0; }
.mb-5 { margin-bottom: 16px; }
.mt-4 { margin-top: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; }

.feature-cell { display: flex; flex-direction: column; gap: 6px; }
.feature-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; color: #334155; background: #f8fafc;
  border-radius: 8px; padding: 5px 8px; gap: 8px;
}

.action-group { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }

.school-badge {
  background: linear-gradient(135deg,#dbeafe,#ede9fe);
  border-radius: 10px; padding: 10px 14px;
  font-weight: 700; color: #1e1b4b; font-size: 15px;
}
.expiry-current { margin-top: 8px; font-size: 13px; color: #475569; }

.delete-warn { font-size: 14px; color: #374151; }
.delete-warn p { margin: 0 0 10px; }
</style>
