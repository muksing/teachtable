<template>
  <div class="active-schools">
    <el-card class="surface-card header-card">
      <div class="page-header">
        <div class="header-title">
          <el-icon class="header-icon"><School /></el-icon>
          <div>
            <h2>จัดการโรงเรียนที่ใช้งาน</h2>
            <p>แสดงข้อมูลคำนวณล่าสุด และตั้งค่าวันหมดอายุพร้อมสิทธิ์การใช้งาน</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button type="primary" @click="refreshSchools" :loading="loading">
            <el-icon><Refresh /></el-icon>
            รีเฟรช
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="filter-card">
      <div class="search-filter-section">
        <el-input
          v-model="searchText"
          placeholder="ค้นหา โรงเรียน School ID อีเมล..."
          class="search-box"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button @click="expandFilters = !expandFilters" plain>
          <el-icon><Filter /></el-icon>
          Filters
        </el-button>
      </div>

      <div v-if="expandFilters" class="filter-section">
        <div class="filter-row">
          <div class="filter-group">
            <label>สถานะ</label>
            <el-select v-model="filterStatus" placeholder="ทั้งหมด" clearable @change="handleFilter">
              <el-option label="ทั้งหมด" value="" />
              <el-option label="Active" value="active" />
              <el-option label="Suspended" value="suspended" />
            </el-select>
          </div>
          <div class="filter-group">
            <label>หมดอายุ</label>
            <el-select v-model="filterExpiry" placeholder="ทั้งหมด" clearable @change="handleFilter">
              <el-option label="ทั้งหมด" value="" />
              <el-option label="ยังไม่หมดอายุ" value="active" />
              <el-option label="หมดอายุแล้ว" value="expired" />
            </el-select>
          </div>
          <div class="filter-group">
            <label>Range วันหมดอายุ</label>
            <el-date-picker
              v-model="filterDateRange"
              type="daterange"
              range-separator="-"
              start-placeholder="เริ่ม"
              end-placeholder="สิ้นสุด"
              @change="handleFilter"
              clearable
            />
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="content-card">
      <el-table
        :data="paginatedSchools"
        style="width: 100%"
        :loading="loading"
        empty-text="ไม่พบโรงเรียน"
        stripe
        class="schools-table"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="schoolName" label="โรงเรียน" min-width="240" show-overflow-tooltip>
          <template #default="scope">
            <div class="school-info">
              <el-icon><School /></el-icon>
              <span>{{ scope.row.schoolName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="schoolId" label="School ID" width="160" show-overflow-tooltip />
        <el-table-column prop="adminEmail" label="Admin" min-width="220" show-overflow-tooltip />
        <el-table-column label="ข้อมูลคำนวณล่าสุด" width="280" align="center">
          <template #default="scope">
            <div class="calc-cell">
              <div class="calc-row"><span>ห้องเรียน</span><b class="badge-number">{{ getLatestCalc(scope.row).rooms || '-' }}</b></div>
              <div class="calc-row"><span>ครู</span><b class="badge-number">{{ getLatestCalc(scope.row).teachers || '-' }}</b></div>
              <div class="calc-row"><span>จัดพร้อมกัน</span><b class="badge-primary">{{ getLatestCalc(scope.row).concurrent || '-' }}</b></div>
              <div class="calc-row"><span>จำนวนเงิน</span><b class="badge-amount">{{ formatMoney(getLatestCalc(scope.row).amount) }}</b></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="จัดพร้อมกัน" width="180" align="center">
          <template #default="scope">
            <div class="limit-cell">
              <el-tag type="primary" effect="light" size="large">
                <el-icon><User /></el-icon>
                {{ scope.row.scheduler_limit_effective || 0 }} คน
              </el-tag>
              <span class="limit-source">
                <el-tag :type="scope.row.limit_source === 'override' ? 'warning' : 'info'" size="small" effect="light">
                  {{ scope.row.limit_source === 'override' ? 'Custom' : 'Package' }}
                </el-tag>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="หมดอายุ" width="160" align="center">
          <template #default="scope">
            <el-tag :type="getExpiryTagType(scope.row.pricing_plan)">
              <el-icon><Calendar /></el-icon>
              {{ formatPlanExpiry(scope.row.pricing_plan) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="สถานะ" width="130" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.isActive ? 'success' : 'danger'" effect="dark">
              <el-icon>
                <SuccessFilled v-if="scope.row.isActive" />
                <CircleCloseFilled v-else />
              </el-icon>
              {{ scope.row.isActive ? 'Active' : 'Suspended' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="ฟีเจอร์พิเศษ" width="240" align="center">
          <template #default="scope">
            <div class="feature-cell">
              <div class="feature-row">
                <span>บันทึกเข้าสอน</span>
                <el-switch
                  :model-value="isFeatureEnabled(scope.row, 'teaching_log_enabled')"
                  :loading="isFeatureUpdating(scope.row, 'teaching_log_enabled')"
                  inline-prompt
                  active-text="ON"
                  inactive-text="OFF"
                  @change="() => toggleFeature(scope.row, 'teaching_log_enabled', 'บันทึกเข้าสอน')"
                />
              </div>
              <div class="feature-row">
                <span>ชุมนุม</span>
                <el-switch
                  :model-value="isFeatureEnabled(scope.row, 'club_module_enabled')"
                  :loading="isFeatureUpdating(scope.row, 'club_module_enabled')"
                  inline-prompt
                  active-text="ON"
                  inactive-text="OFF"
                  @change="() => toggleFeature(scope.row, 'club_module_enabled', 'ชุมนุม')"
                />
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="280" fixed="right" align="center">
          <template #default="scope">
            <div class="action-group">
              <el-button type="primary" size="small" @click="openPlanDialog(scope.row)">
                <el-icon><Edit /></el-icon>
                ต่อสมาชิก
              </el-button>
              <el-button
                :type="scope.row.isActive ? 'danger' : 'success'"
                size="small"
                plain
                @click="handleToggleStatus(scope.row)"
              >
                <el-icon v-if="scope.row.isActive"><CircleCloseFilled /></el-icon>
                <el-icon v-else><SuccessFilled /></el-icon>
                {{ scope.row.isActive ? 'Suspend' : 'Activate' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[5, 10, 20, 50]"
        :total="filteredSchools.length"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
        class="pagination-component"
      />
    </el-card>

    <el-dialog
      v-model="planDialog.visible"
      title="ตั้งค่าแพ็กเกจและสิทธิ์การใช้งาน"
      width="680px"
      destroy-on-close
    >
      <div class="plan-top">
        <div class="school-label">โรงเรียน: <b>{{ planDialog.schoolName }}</b></div>
        <div class="current-label">Limit ปัจจุบัน: {{ planDialog.currentEffectiveLimit }} คน</div>
      </div>

      <el-form label-width="180px" class="plan-form">
        <el-form-item label="ข้อมูลคำนวณจากโรงเรียน">
          <div class="calc-summary">
            <div class="calc-row"><span>จำนวนห้องเรียน</span><b>{{ planDialog.calcRooms || '-' }}</b></div>
            <div class="calc-row"><span>จำนวนครู</span><b>{{ planDialog.calcTeachers || '-' }}</b></div>
            <div class="calc-row"><span>จำนวนคนจัด</span><b>{{ planDialog.calcConcurrent || '-' }}</b></div>
            <div class="calc-row"><span>จำนวนเงิน</span><b>{{ formatMoney(planDialog.calcAmount) }}</b></div>
          </div>
        </el-form-item>

        <el-form-item label="จำนวนเงินที่บันทึก (บาท)">
          <div class="override-wrap">
            <el-input-number v-model="planDialog.monthlyFeeOverride" :min="0" :max="99999" :step="10" />
            <span class="hint">ใส่ 0 = ใช้ค่าจากแพ็กเกจ</span>
          </div>
        </el-form-item>

        <el-form-item label="วันหมดอายุ">
          <el-radio-group v-model="planDialog.expiryMode">
            <el-radio label="auto_months">อัตโนมัติแบบเดือน</el-radio>
            <el-radio label="auto_days">อัตโนมัติแบบวัน (ทดสอบ)</el-radio>
            <el-radio label="manual_date">กำหนดวันเอง</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="planDialog.expiryMode === 'auto_months'" label="ต่ออายุ (เดือน)">
          <el-radio-group v-model="planDialog.planMonths">
            <el-radio :label="1">1 เดือน</el-radio>
            <el-radio :label="3">3 เดือน</el-radio>
            <el-radio :label="6">6 เดือน</el-radio>
            <el-radio :label="12">12 เดือน</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="planDialog.expiryMode === 'auto_days'" label="ต่ออายุ (วัน)">
          <el-radio-group v-model="planDialog.planDays">
            <el-radio :label="1">1 วัน</el-radio>
            <el-radio :label="3">3 วัน</el-radio>
            <el-radio :label="7">7 วัน</el-radio>
            <el-radio :label="14">14 วัน</el-radio>
            <el-radio :label="30">30 วัน</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="planDialog.expiryMode === 'manual_date'" label="วันหมดอายุที่ต้องการ">
          <el-date-picker
            v-model="planDialog.manualDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="DD/MM/YYYY"
            class="w-full"
            placeholder="เลือกวันหมดอายุ"
          />
        </el-form-item>

        <el-divider />

        <el-form-item label="จำนวนผู้จัดพร้อมกัน (กำหนดเอง)">
          <div class="override-wrap">
            <el-input-number v-model="planDialog.schedulerLimitOverride" :min="0" :max="99" />
            <span class="hint">ใส่ 0 = ใช้ค่าเริ่มต้นตามแพ็กเกจ</span>
          </div>
        </el-form-item>

        <el-form-item label="หมายเหตุ">
          <el-input
            v-model="planDialog.note"
            type="textarea"
            :rows="3"
            placeholder="เช่น ปรับสิทธิ์พิเศษช่วงเปิดเทอม"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="planDialog.visible = false">ยกเลิก</el-button>
        <el-button type="primary" :loading="planDialog.saving" @click="savePlan">บันทึก</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import { 
  Refresh,
  School,
  Search,
  Filter,
  Edit,
  User,
  Calendar,
  SuccessFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue'

const authStore = useAuthStore()
const { getSchools, toggleSchoolStatus: toggleStatus, updateSchoolPricingPlan, updateSchoolFeatureFlags } = useSchoolManagement()

const loading = ref(false)
const schools = ref([])
const searchText = ref('')
const expandFilters = ref(false)
const filterStatus = ref('')
const filterExpiry = ref('')
const filterDateRange = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const featureUpdatingMap = ref({})
const planDialog = reactive({
  visible: false,
  saving: false,
  schoolId: '',
  schoolName: '',
  currentEffectiveLimit: 0,
  planCode: '200',
  expiryMode: 'auto_months',
  planMonths: 1,
  planDays: 7,
  manualDate: '',
  schedulerLimitOverride: 0,
  monthlyFeeOverride: 0,
  calcRooms: 0,
  calcTeachers: 0,
  calcConcurrent: 0,
  calcAmount: 0,
  note: '',
})

// Computed properties for filtering and pagination
const filteredSchools = computed(() => {
  return schools.value
    .filter(school => {
      const text = `${school.schoolName} ${school.schoolId} ${school.adminEmail}`.toLowerCase()
      return text.includes(searchText.value.toLowerCase())
    })
    .filter(school => {
      if (filterStatus.value === 'active' && !school.isActive) return false
      if (filterStatus.value === 'suspended' && school.isActive) return false
      return true
    })
    .filter(school => {
      if (filterExpiry.value === 'expired') {
        const exp = school.pricing_plan?.expires_at
        if (!exp) return true
        const d = typeof exp?.toDate === 'function' ? exp.toDate() : new Date(exp)
        return d.getTime() <= Date.now()
      }
      if (filterExpiry.value === 'active') {
        const exp = school.pricing_plan?.expires_at
        if (!exp) return false
        const d = typeof exp?.toDate === 'function' ? exp.toDate() : new Date(exp)
        return d.getTime() > Date.now()
      }
      return true
    })
    .filter(school => {
      if (!filterDateRange.value || filterDateRange.value.length !== 2) return true
      const [start, end] = filterDateRange.value
      const exp = school.pricing_plan?.expires_at
      if (!exp) return false
      const d = typeof exp?.toDate === 'function' ? exp.toDate() : new Date(exp)
      return d >= start && d <= end
    })
})

const paginatedSchools = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSchools.value.slice(start, start + pageSize.value)
})

function handleSearch() {
  currentPage.value = 1
}

function handleFilter() {
  currentPage.value = 1
}

function handlePageChange(page) {
  currentPage.value = page
}

function handlePageSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
}

function formatMoney(amount) {
  const n = Number(amount || 0)
  if (n <= 0) return '-'
  return `${n.toLocaleString('th-TH')} บาท`
}

function getLatestCalc(school) {
  const approval = school?.latest_renewal_approval || null
  const input = approval?.calculation_input || {}
  return {
    rooms: Number(input.rooms || 0),
    teachers: Number(input.teachers || 0),
    concurrent: Number(input.concurrent || 0),
    amount: Number(approval?.calculated_monthly || 0),
  }
}

function formatPlanExpiry(plan) {
  const exp = plan?.expires_at
  if (!exp) return 'ไม่กำหนด'
  const d = typeof exp?.toDate === 'function' ? exp.toDate() : new Date(exp)
  if (Number.isNaN(d.getTime())) return 'ไม่กำหนด'
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getExpiryTagType(plan) {
  const exp = plan?.expires_at
  if (!exp) return 'danger'
  const d = typeof exp?.toDate === 'function' ? exp.toDate() : new Date(exp)
  if (Number.isNaN(d.getTime())) return 'danger'
  return d.getTime() <= Date.now() ? 'danger' : 'success'
}

async function loadSchools() {
  loading.value = true
  try {
    const result = await getSchools()
    if (result.success) {
      schools.value = result.data
    } else {
      ElMessage.error(result.error || 'โหลดข้อมูลโรงเรียนไม่สำเร็จ')
    }
  } catch (error) {
    console.error('Error loading schools:', error)
    ElMessage.error('เกิดข้อผิดพลาดขณะโหลดข้อมูลโรงเรียน')
  } finally {
    loading.value = false
  }
}

async function handleToggleStatus(school) {
  const action = school.isActive ? 'suspend' : 'activate'
  try {
    await ElMessageBox.confirm(`Are you sure you want to ${action} ${school.schoolName}?`, 'Confirm Action', {
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      type: 'warning'
    })

    const result = await toggleStatus(school.id, !school.isActive)
    if (result.success) {
      ElMessage.success(`School ${action}d successfully`)
      await loadSchools()
    } else {
      ElMessage.error(result.error || `Failed to ${action} school`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`An error occurred while ${action}ing the school`)
    }
  }
}

function openPlanDialog(school) {
  const calc = getLatestCalc(school)
  planDialog.visible = true
  planDialog.schoolId = school.id
  planDialog.schoolName = school.schoolName || school.schoolId || ''
  planDialog.currentEffectiveLimit = Number(school.scheduler_limit_effective || 0)
  planDialog.planCode = String(school.pricing_plan?.code || '200')
  planDialog.expiryMode = 'auto_months'
  planDialog.planMonths = 1
  planDialog.planDays = 7
  planDialog.manualDate = ''
  planDialog.schedulerLimitOverride = Number(school.scheduler_limit_override || calc.concurrent || 0)
  planDialog.monthlyFeeOverride = Number(calc.amount || school.pricing_plan?.monthly_fee || 0)
  planDialog.calcRooms = calc.rooms
  planDialog.calcTeachers = calc.teachers
  planDialog.calcConcurrent = calc.concurrent
  planDialog.calcAmount = calc.amount
  planDialog.note = ''
}

async function savePlan() {
  if (!planDialog.schoolId) return

  if (planDialog.expiryMode === 'manual_date' && !planDialog.manualDate) {
    ElMessage.warning('กรุณาเลือกวันหมดอายุ')
    return
  }

  planDialog.saving = true
  try {
    const result = await updateSchoolPricingPlan(
      planDialog.schoolId,
      planDialog.planCode,
      authStore.profile?.uid,
      {
        expiryMode: planDialog.expiryMode,
        planMonths: planDialog.planMonths,
        planDays: planDialog.planDays,
        manualDate: planDialog.manualDate,
        schedulerLimitOverride: Number(planDialog.schedulerLimitOverride || 0),
        monthlyFeeOverride: Number(planDialog.monthlyFeeOverride || 0),
        note: planDialog.note,
      }
    )

    if (!result.success) {
      ElMessage.error(result.error || 'บันทึกแพ็กเกจไม่สำเร็จ')
      return
    }

    ElMessage.success('บันทึกแพ็กเกจเรียบร้อยแล้ว')
    planDialog.visible = false
    await loadSchools()
  } catch (error) {
    ElMessage.error(error.message || 'บันทึกแพ็กเกจไม่สำเร็จ')
  } finally {
    planDialog.saving = false
  }
}

function refreshSchools() {
  loadSchools()
}

function getFeatureKey(schoolId, featureName) {
  return `${schoolId}:${featureName}`
}

function isFeatureEnabled(school, featureName) {
  return school?.feature_flags?.[featureName] === true
}

function isFeatureUpdating(school, featureName) {
  return featureUpdatingMap.value[getFeatureKey(school?.id, featureName)] === true
}

async function toggleFeature(school, featureName, label) {
  if (!school?.id) return

  const key = getFeatureKey(school.id, featureName)
  const nextValue = !isFeatureEnabled(school, featureName)
  featureUpdatingMap.value = {
    ...featureUpdatingMap.value,
    [key]: true,
  }

  try {
    const result = await updateSchoolFeatureFlags(
      school.id,
      { [featureName]: nextValue },
      authStore.profile?.uid || null,
    )

    if (!result.success) {
      ElMessage.error(result.error || `อัปเดตฟีเจอร์ ${label} ไม่สำเร็จ`)
      return
    }

    school.feature_flags = {
      ...(school.feature_flags || {}),
      [featureName]: nextValue,
    }
    ElMessage.success(`${label}: ${nextValue ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว'}`)
  } catch (error) {
    ElMessage.error(error.message || `อัปเดตฟีเจอร์ ${label} ไม่สำเร็จ`)
  } finally {
    featureUpdatingMap.value = {
      ...featureUpdatingMap.value,
      [key]: false,
    }
  }
}

onMounted(() => {
  loadSchools()
})
</script>

<style scoped>
.active-schools {
  padding: 24px;
  background: radial-gradient(circle at 8% 0%, #dbeafe 0%, #fdf4ff 42%, #ecfeff 100%);
  min-height: 100vh;
}

.header-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.16);
  margin-bottom: 20px;
  background: white;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.header-icon {
  font-size: 32px;
  color: #7c3aed;
}

.header-title h2 {
  margin: 0;
  color: #0f172a;
  font-size: 26px;
  font-weight: 700;
}

.header-title p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.14);
  margin-bottom: 20px;
  background: white;
}

.search-filter-section {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-box {
  flex: 1;
  max-width: 400px;
}

.search-box :deep(.el-input__wrapper) {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
}

.search-box :deep(.el-input__wrapper:focus-within) {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  color: #475569;
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-group :deep(.el-select),
.filter-group :deep(.el-date-picker) {
  min-width: 200px;
}

.content-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 14px 26px rgba(14, 116, 144, 0.12);
  background: white;
}

.schools-table {
  border-radius: 12px;
  overflow: hidden;
}

.schools-table :deep(.el-table__header th) {
  background: linear-gradient(180deg, #dbeafe 0%, #ede9fe 100%);
  color: #1e1b4b;
  font-weight: 600;
  border: none;
}

.schools-table :deep(.el-table__body tr:hover > td) {
  background: #eef2ff !important;
}

.schools-table :deep(.el-table__body tr) {
  border-bottom: 1px solid #e2e8f0;
}

.school-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #0f172a;
}

.school-info :deep(.el-icon) {
  color: #7c3aed;
}

.calc-cell {
  display: grid;
  gap: 6px;
  padding: 4px 0;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: #334155;
  padding: 4px 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  border-radius: 6px;
}

.calc-row span {
  font-weight: 500;
}

.badge-number,
.badge-primary,
.badge-amount {
  font-weight: 700;
  color: #4f46e5;
  font-size: 13px;
}

.badge-amount {
  color: #ec4899;
}

.limit-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.limit-cell :deep(.el-tag) {
  border-radius: 8px;
}

.limit-source {
  margin-top: 2px;
}

.action-group {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.feature-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 6px;
}

.feature-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #334155;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  border-radius: 8px;
  padding: 6px 8px;
}

.action-group :deep(.el-button--primary) {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  border-color: transparent;
}

.action-group :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%);
  border-color: transparent;
}

.pagination-component {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.surface-card {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.plan-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #dbeafe, #ede9fe);
}

.school-label {
  color: #1e293b;
}

.current-label {
  color: #334155;
  font-size: 13px;
}

.plan-form {
  margin-top: 10px;
}

.override-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  color: #64748b;
  font-size: 12px;
}

.calc-summary {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  display: grid;
  gap: 6px;
}
</style>
