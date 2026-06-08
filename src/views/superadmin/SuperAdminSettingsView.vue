<template>
  <div class="superadmin-settings">
    <div class="page-header">
      <div class="header-content">
        <el-icon class="header-icon"><Setting /></el-icon>
        <div>
          <h2>System Settings & Status</h2>
          <p>Manage SuperAdmin account, system configuration, and database status</p>
        </div>
      </div>
    </div>

    <el-card class="settings-card superadmin-card">
      <template #header>
        <div class="card-header">
          <el-icon class="card-icon"><User /></el-icon>
          <span>SuperAdmin Account</span>
        </div>
      </template>

      <div v-if="superAdminExists" class="success-section">
        <el-alert
          title="SuperAdmin account already initialized"
          type="success"
          :closable="false"
          effect="dark"
          show-icon
        >
          <template #default>
            The SuperAdmin account (muksingapp@gmail.com) has been successfully initialized and is ready to use.
          </template>
        </el-alert>
        <div class="account-details">
          <div class="detail-item">
            <span class="detail-label">
              <el-icon><SuccessFilled /></el-icon>
              Email
            </span>
            <span class="detail-value">muksingapp@gmail.com</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">
              <el-icon><SuccessFilled /></el-icon>
              Role
            </span>
            <span class="detail-value">SuperAdmin (Master)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">
              <el-icon><SuccessFilled /></el-icon>
              Status
            </span>
            <el-tag type="success" effect="dark">
              <el-icon><SuccessFilled /></el-icon>
              Active
            </el-tag>
          </div>
        </div>
      </div>

      <div v-else class="warning-section">
        <el-alert
          title="SuperAdmin account not found"
          type="warning"
          :closable="false"
          effect="dark"
          show-icon
          description="Click the button below to initialize a new SuperAdmin account."
        />

        <el-button
          type="primary"
          @click="initializeSuperAdmin"
          :loading="initLoading"
          size="large"
          class="init-button"
        >
          <el-icon><DocumentAdd /></el-icon>
          Initialize SuperAdmin Account
        </el-button>
      </div>
    </el-card>

    <el-card class="settings-card config-card">
      <template #header>
        <div class="card-header">
          <el-icon class="card-icon"><DataAnalysis /></el-icon>
          <span>System Statistics</span>
        </div>
      </template>

      <div v-if="loading" class="loading-placeholder">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>Loading statistics...</span>
      </div>

      <div v-else class="stats-grid">
        <div class="stat-box">
          <div class="stat-header">
            <el-icon class="stat-icon schools-icon"><School /></el-icon>
            <span class="stat-title">Total Schools</span>
          </div>
          <p class="stat-value">{{ totalSchools }}</p>
        </div>

        <div class="stat-box">
          <div class="stat-header">
            <el-icon class="stat-icon pending-icon"><DocumentAdd /></el-icon>
            <span class="stat-title">Pending Requests</span>
          </div>
          <p class="stat-value">{{ pendingRequests }}</p>
        </div>

        <div class="stat-box">
          <div class="stat-header">
            <el-icon class="stat-icon renewal-icon"><Calendar /></el-icon>
            <span class="stat-title">Pending Renewals</span>
          </div>
          <p class="stat-value">{{ pendingRenewals }}</p>
        </div>

        <div class="stat-box">
          <div class="stat-header">
            <el-icon class="stat-icon users-icon"><User /></el-icon>
            <span class="stat-title">Total Users</span>
          </div>
          <p class="stat-value">{{ totalUsers }}</p>
        </div>

        <div class="stat-box">
          <div class="stat-header">
            <el-icon class="stat-icon active-icon"><SuccessFilled /></el-icon>
            <span class="stat-title">Active Users</span>
          </div>
          <p class="stat-value">{{ activeUsers }}</p>
        </div>
      </div>
    </el-card>

    <el-card class="settings-card firebase-card">
      <template #header>
        <div class="card-header">
          <el-icon class="card-icon"><CircleCheck /></el-icon>
          <span>Firebase Configuration</span>
        </div>
      </template>

      <div class="config-grid">
        <div class="config-item">
          <span class="config-label">Project ID</span>
          <span class="config-value">master-teachtable</span>
        </div>

        <div class="config-item">
          <span class="config-label">Database</span>
          <span class="config-value">
            <el-tag type="primary" effect="light">Firestore</el-tag>
          </span>
        </div>

        <div class="config-item">
          <span class="config-label">Authentication</span>
          <span class="config-value">
            <el-tag type="info" effect="light">Firebase Auth</el-tag>
          </span>
        </div>

        <div class="config-item">
          <span class="config-label">Storage</span>
          <span class="config-value">
            <el-tag type="success" effect="light">Cloud Storage</el-tag>
          </span>
        </div>
      </div>

      <el-alert
        title="Configuration Status"
        type="success"
        effect="dark"
        :closable="false"
        show-icon
        class="config-alert"
      >
        <template #default>
          Firebase project is properly configured for multi-tenant operations. All collections are prefixed with school IDs for complete data isolation and security.
        </template>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import {
  Setting,
  User,
  DataAnalysis,
  Loading,
  School,
  DocumentAdd,
  Calendar,
  SuccessFilled,
  CircleCheck
} from '@element-plus/icons-vue'

const { initializeSuperAdmin: initSuperAdmin } = useMasterAuth()
const { getSuperAdminStats } = useSchoolManagement()

const initLoading = ref(false)
const superAdminExists = ref(true) // Assume it exists for now
const totalSchools = ref(0)
const pendingRequests = ref(0)
const totalUsers = ref(0)
const activeUsers = ref(0)
const pendingRenewals = ref(0)
const loading = ref(false)

async function initializeSuperAdmin() {
  initLoading.value = true

  try {
    const result = await initSuperAdmin()
    if (result.success) {
      ElMessage.success('SuperAdmin account initialized successfully')
      superAdminExists.value = true
    } else {
      ElMessage.error(result.error || 'Failed to initialize SuperAdmin')
    }
  } catch (error) {
    console.error('Error initializing SuperAdmin:', error)
    ElMessage.error('An error occurred while initializing SuperAdmin')
  } finally {
    initLoading.value = false
  }
}

async function loadSystemStats() {
  try {
    const statsResult = await getSuperAdminStats()
    if (statsResult.success) {
      totalSchools.value = statsResult.data.totalSchools
      pendingRequests.value = statsResult.data.pendingRequests
      totalUsers.value = statsResult.data.totalUsers
      activeUsers.value = statsResult.data.activeUsers || 0
      pendingRenewals.value = statsResult.data.pendingRenewals
      if (statsResult.data.hasPartialFailure) {
        ElMessage.warning('โหลดค่าสถิติบางส่วนไม่สำเร็จ ระบบแสดงค่าเท่าที่ดึงได้')
      }
    } else {
      ElMessage.error(statsResult.error || 'โหลดค่าสถิติไม่สำเร็จ')
    }
  } catch (error) {
    console.error('Error loading system stats:', error)
    ElMessage.error('โหลดค่าสถิติไม่สำเร็จ')
  }
}

onMounted(() => {
  loadSystemStats()
})
</script>

<style scoped>
.superadmin-settings {
  padding: 24px;
  background: radial-gradient(circle at 10% 0%, #dbeafe 0%, #fdf2f8 46%, #ecfeff 100%);
  min-height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 42%, #ec4899 100%);
  padding: 32px 36px;
  border-radius: 18px;
  color: white;
  box-shadow: 0 18px 44px rgba(124, 58, 237, 0.34);
}

.header-icon {
  opacity: 0.9;
}

.header-content h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
}

.header-content p {
  margin: 6px 0 0;
  font-size: 13px;
  opacity: 0.9;
}

.settings-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 14px 26px rgba(30, 41, 59, 0.12);
  margin-bottom: 20px;
  background: white;
  overflow: hidden;
}

.settings-card :deep(.el-card__header) {
  border-bottom: 1px solid #e2e8f0;
  padding: 20px 24px;
  background: linear-gradient(180deg, #ede9fe 0%, #dbeafe 100%);
}

.settings-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.card-icon {
  font-size: 22px;
  color: #7c3aed;
}

.superadmin-card :deep(.el-card__header) {
  border-bottom-color: #e0e7ff;
}

.firebase-card :deep(.el-card__header) {
  border-bottom-color: #dbeafe;
}

.config-card :deep(.el-card__header) {
  border-bottom-color: #f0fdf4;
}

.success-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.success-section :deep(.el-alert) {
  border-radius: 12px;
}

.account-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #fdf4ff 0%, #eef2ff 100%);
  gap: 12px;
}

.detail-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-weight: 600;
  font-size: 13px;
  flex: 1;
}

.detail-label .el-icon {
  color: #10b981;
  font-size: 18px;
}

.detail-value {
  color: #0f172a;
  font-weight: 600;
  font-size: 14px;
}

.warning-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.warning-section :deep(.el-alert) {
  border-radius: 12px;
}

.init-button {
  align-self: flex-start;
  border-radius: 10px;
  font-weight: 600;
  padding: 12px 24px;
  height: auto;
}

.init-button :deep(.el-icon) {
  margin-right: 6px;
}

.loading-placeholder {
  text-align: center;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #64748b;
}

.loading-icon {
  font-size: 32px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-box {
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #fdf4ff 0%, #eef2ff 100%);
  transition: all 0.3s ease;
}

.stat-box:hover {
  border-color: #a5b4fc;
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.14);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.stat-icon {
  font-size: 20px;
}

.schools-icon {
  color: #4f46e5;
}

.pending-icon {
  color: #f97316;
}

.renewal-icon {
  color: #d946ef;
}

.users-icon {
  color: #2563eb;
}

.active-icon {
  color: #16a34a;
}

.stat-title {
  color: #475569;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #f0f9ff 0%, #eef2ff 100%);
}

.config-label {
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-value {
  color: #0f172a;
  font-weight: 600;
  font-size: 14px;
}

.config-alert {
  border-radius: 12px;
  margin-top: 20px;
}

.config-alert :deep(.el-alert__title) {
  font-weight: 600;
}

.config-alert :deep(.el-alert__content) {
  font-size: 13px;
  line-height: 1.6;
}
</style>