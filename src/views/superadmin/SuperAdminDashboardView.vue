<template>
  <div class="dashboard">
    <div class="page-header">
      <div class="header-content">
        <h1>SuperAdmin Dashboard</h1>
        <p>Manage the Master-teachtable SaaS platform and school subscriptions</p>
      </div>
      <el-button type="primary" @click="refreshData" :loading="loading">
        <el-icon><Refresh /></el-icon>
        Refresh
      </el-button>
    </div>

    <el-alert
      v-if="statsWarning"
      type="warning"
      :closable="true"
      class="warning-alert mb-4"
      title="โหลดค่าสถิติบางส่วนไม่สำเร็จ"
      description="ระบบแสดงค่าเท่าที่ดึงได้ หากตัวเลขดูผิดปกติให้กด Refresh อีกครั้ง"
    />

    <div class="stats-grid mb-10">
      <div class="stat-card stat-card-schools">
        <div class="stat-content">
          <div class="stat-icon-wrapper">
            <el-icon><School /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">Active Schools</p>
            <h3 class="stat-value">{{ totalSchools }}</h3>
            <p class="stat-footer">Across all regions</p>
          </div>
        </div>
        <div class="stat-badge stat-badge-primary">
          <el-icon><SuccessFilled /></el-icon>
        </div>
      </div>

      <div class="stat-card stat-card-pending">
        <div class="stat-content">
          <div class="stat-icon-wrapper">
            <el-icon><DocumentAdd /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">Pending Requests</p>
            <h3 class="stat-value">{{ pendingRequests }}</h3>
            <p class="stat-footer">Needs your attention</p>
          </div>
        </div>
        <div class="stat-badge stat-badge-warning">
          <el-icon><WarningFilled /></el-icon>
        </div>
      </div>

      <div class="stat-card stat-card-users">
        <div class="stat-content">
          <div class="stat-icon-wrapper">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">Active Users</p>
            <h3 class="stat-value">{{ activeUsers }}</h3>
            <p class="stat-footer">Users with active status</p>
          </div>
        </div>
        <div class="stat-badge stat-badge-info">
          <el-icon><SuccessFilled /></el-icon>
        </div>
      </div>

      <div class="stat-card stat-card-total-users">
        <div class="stat-content">
          <div class="stat-icon-wrapper">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">Total Users</p>
            <h3 class="stat-value">{{ totalUsers }}</h3>
            <p class="stat-footer">All user records</p>
          </div>
        </div>
        <div class="stat-badge stat-badge-secondary">
          <el-icon><User /></el-icon>
        </div>
      </div>

      <div class="stat-card stat-card-renewals">
        <div class="stat-content">
          <div class="stat-icon-wrapper">
            <el-icon><Calendar /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">Pending Renewals</p>
            <h3 class="stat-value">{{ pendingRenewals }}</h3>
            <p class="stat-footer">Waiting for payment review</p>
          </div>
        </div>
        <div class="stat-badge stat-badge-success">
          <el-icon><Clock /></el-icon>
        </div>
      </div>
    </div>

    <el-card class="recent-activity-card">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            <el-icon><DocumentCopy /></el-icon>
            <span>Recent Activity</span>
          </div>
          <el-button type="primary" size="small" @click="refreshData" :loading="loading" link>
            <el-icon><Refresh /></el-icon>
            Refresh
          </el-button>
        </div>
      </template>

      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading" size="24"><Loading /></el-icon>
        <span>Loading...</span>
      </div>

      <div v-else-if="recentRequests.length === 0" class="empty-state">
        <el-empty description="No recent activity" />
      </div>

      <div v-else class="activity-list">
        <div
          v-for="request in recentRequests"
          :key="request.id"
          class="activity-item"
          :class="{ 'activity-renewal': request.kind === 'renewal' }"
        >
          <div class="activity-icon">
            <el-icon
              :class="request.kind === 'renewal' ? 'icon-renewal' : 'icon-registration'"
            >
              <Calendar v-if="request.kind === 'renewal'" />
              <DocumentAdd v-else />
            </el-icon>
          </div>
          <div class="activity-body">
            <h4>{{ request.title }}</h4>
            <p>{{ request.subtitle }}</p>
            <small>{{ formatDate(request.date) }}</small>
          </div>
          <div class="activity-badge">
            <el-tag
              :type="request.kind === 'renewal' ? 'success' : 'warning'"
              effect="light"
              size="small"
            >
              <el-icon v-if="request.kind === 'renewal'"><Clock /></el-icon>
              <el-icon v-else><DocumentAdd /></el-icon>
              {{ request.kind === 'renewal' ? 'Renewal' : 'Registration' }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import { ElMessage } from 'element-plus'
import {
  School,
  DocumentAdd,
  User,
  Calendar,
  Refresh,
  Loading,
  SuccessFilled,
  WarningFilled,
  Clock,
  DocumentCopy
} from '@element-plus/icons-vue'

const { getSchools, getSchoolRequests, getRenewalRequests, getSuperAdminStats } = useSchoolManagement()

const loading = ref(false)
const totalSchools = ref(0)
const pendingRequests = ref(0)
const totalUsers = ref(0)
const activeUsers = ref(0)
const pendingRenewals = ref(0)
const recentRequests = ref([])
const statsWarning = ref(false)

async function loadDashboardData() {
  loading.value = true

  try {
    const [schoolsResult, requestsResult, renewalsResult, statsResult] = await Promise.all([
      getSchools(),
      getSchoolRequests('pending'),
      getRenewalRequests('pending'),
      getSuperAdminStats(),
    ])

    if (schoolsResult.success) {
      totalSchools.value = schoolsResult.data.length
    } else if (statsResult.success) {
      totalSchools.value = Number(statsResult.data.totalSchools || 0)
    }

    if (requestsResult.success) {
      pendingRequests.value = requestsResult.data.length
    } else if (statsResult.success) {
      pendingRequests.value = Number(statsResult.data.pendingRequests || 0)
    }

    if (renewalsResult.success) {
      pendingRenewals.value = renewalsResult.data.length
    } else if (statsResult.success) {
      pendingRenewals.value = Number(statsResult.data.pendingRenewals || 0)
    }

    if (statsResult.success) {
      totalUsers.value = Number(statsResult.data.totalUsers || 0)
      activeUsers.value = Number(statsResult.data.activeUsers || 0)
    }

    statsWarning.value = !schoolsResult.success
      || !requestsResult.success
      || !renewalsResult.success
      || !statsResult.success
      || Boolean(statsResult.success && statsResult.data.hasPartialFailure)

    const activities = []

    if (requestsResult.success) {
      activities.push(...requestsResult.data.map((item) => ({
        id: `school-${item.id}`,
        kind: 'registration',
        title: item.schoolName,
        subtitle: `${item.contactName} • ${item.contactEmail}`,
        date: item.submittedAt,
      })))
    }

    if (renewalsResult.success) {
      activities.push(...renewalsResult.data.map((item) => ({
        id: `renewal-${item.id}`,
        kind: 'renewal',
        title: item.school_name || item.school_id,
        subtitle: `${item.contact_name || '-'} • แพ็กเกจ ${item.plan_code || '-'} • ${item.amount || 0} บาท`,
        date: item.created_at,
      })))
    }

    recentRequests.value = activities
      .sort((a, b) => (b.date?.getTime?.() || 0) - (a.date?.getTime?.() || 0))
      .slice(0, 6)

  } catch (error) {
    console.error('Error loading dashboard data:', error)
    ElMessage.error('Failed to load dashboard statistics')
  } finally {
    loading.value = false
  }
}

function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function refreshData() {
  loadDashboardData()
}

onMounted(() => {
  loadDashboardData()
})
</script>

<style scoped>
.dashboard {
  padding: 24px;
  background: radial-gradient(circle at 12% 0%, #dbeafe 0%, #fdf4ff 44%, #f0fdf4 100%);
  min-height: 100vh;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 40%, #ec4899 100%);
  padding: 32px 36px;
  border-radius: 18px;
  color: white;
  box-shadow: 0 20px 44px rgba(124, 58, 237, 0.34);
}

.header-content h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.header-content p {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: 0.9;
}

.warning-alert {
  margin-bottom: 24px;
}

.warning-alert :deep(.el-alert__title) {
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 14px 28px rgba(30, 41, 59, 0.12);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: white;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: inherit;
}

.stat-card-schools::before {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.stat-card-pending::before {
  background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
}

.stat-card-users::before {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.stat-card-total-users::before {
  background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%);
}

.stat-card-renewals::before {
  background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 36px rgba(30, 41, 59, 0.2);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.stat-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%);
  font-size: 28px;
}

.stat-card-schools .stat-icon-wrapper {
  color: #667eea;
}

.stat-card-pending .stat-icon-wrapper {
  color: #ea580c;
}

.stat-card-users .stat-icon-wrapper,
.stat-card-total-users .stat-icon-wrapper {
  color: #0ea5e9;
}

.stat-card-renewals .stat-icon-wrapper {
  color: #c026d3;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.stat-value {
  margin: 8px 0 0 0;
  font-size: 36px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -1px;
}

.stat-footer {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.1;
  font-size: 24px;
}

.stat-badge-primary {
  color: #667eea;
}

.stat-badge-warning {
  color: #f59e0b;
}

.stat-badge-info {
  color: #10b981;
}

.stat-badge-secondary {
  color: #0ea5e9;
}

.stat-badge-success {
  color: #8b5cf6;
}

.recent-activity-card {
  border: none;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  background: white;
  overflow: hidden;
}

.recent-activity-card :deep(.el-card__header) {
  border-bottom: 1px solid #e2e8f0;
  padding: 24px;
}

.recent-activity-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.card-title .el-icon {
  color: #7c3aed;
  font-size: 22px;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #8c8c8c;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-state .is-loading {
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

.empty-state {
  padding: 60px 20px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%);
  transition: all 0.2s ease;
}

.activity-item:hover {
  border-color: #a5b4fc;
  background: linear-gradient(180deg, #eef2ff 0%, #ede9fe 100%);
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.15);
}

.activity-renewal {
  border-left: 4px solid #d946ef;
}

.activity-icon {
  flex-shrink: 0;
  font-size: 24px;
}

.activity-icon .icon-renewal {
  color: #d946ef;
}

.activity-icon .icon-registration {
  color: #f97316;
}

.activity-body {
  flex: 1;
  min-width: 0;
}

.activity-body h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: #0f172a;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-body p {
  margin: 0 0 4px 0;
  color: #64748b;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-body small {
  color: #94a3b8;
  font-size: 12px;
}

.activity-badge {
  flex-shrink: 0;
}

.mb-10 {
  margin-bottom: 40px !important;
}

.mb-4 {
  margin-bottom: 16px !important;
}
</style>