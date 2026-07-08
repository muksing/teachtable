<template>
  <div class="superadmin-dashboard">
    <el-container style="height: 100vh">
      <!-- Sidebar -->
      <el-aside width="240px" class="sidebar">
        <div class="sidebar-header">
          <h3>Master-teachtable</h3>
          <p>SuperAdmin Panel</p>
        </div>

        <el-menu
          :default-active="$route.path"
          class="sidebar-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/superadmin/dashboard">
            <el-icon><House /></el-icon>
            <span>Dashboard</span>
          </el-menu-item>

          <el-menu-item index="/superadmin/school-requests">
            <el-icon><DocumentAdd /></el-icon>
            <span>School Requests</span>
            <el-badge
              v-if="pendingRequestsCount > 0"
              :value="pendingRequestsCount"
              class="request-badge"
            />
          </el-menu-item>

          <el-menu-item index="/superadmin/schools">
            <el-icon><School /></el-icon>
            <span>Active Schools</span>
          </el-menu-item>

          <el-menu-item index="/superadmin/packages">
            <el-icon><Box /></el-icon>
            <span>แพ็กเกจ</span>
          </el-menu-item>

          <el-menu-item index="/superadmin/renewal-approval">
            <el-icon><DocumentChecked /></el-icon>
            <span>อนุมัติต่ออายุ</span>
          </el-menu-item>

          <el-menu-item index="/superadmin/settings">
            <el-icon><Setting /></el-icon>
            <span>Settings</span>
          </el-menu-item>
        </el-menu>

        <div class="sidebar-footer">
          <el-button class="logout-btn" type="danger" @click="handleLogout" :loading="logoutLoading">
            <el-icon><SwitchButton /></el-icon>
            Logout
          </el-button>
        </div>
      </el-aside>

      <!-- Main Content -->
      <el-container>
        <el-header class="main-header">
          <h2>{{ currentPageTitle }}</h2>
          <div class="header-actions">
            <span class="welcome-chip">Welcome, {{ profile?.displayName || 'SuperAdmin' }}</span>
          </div>
        </el-header>

        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import {
  House,
  DocumentAdd,
  DocumentChecked,
  School,
  Box,
  Setting,
  SwitchButton
} from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const { logout } = useMasterAuth()
const { getSchoolRequests, getRenewalRequests } = useSchoolManagement()

const logoutLoading = ref(false)
const pendingRequestsCount = ref(0)

const profile = computed(() => authStore.profile)

const currentPageTitle = computed(() => {
  const route = router.currentRoute.value
  const titles = {
    '/superadmin/dashboard': 'Dashboard',
    '/superadmin/school-requests': 'School Registration Requests',
    '/superadmin/schools': 'Active Schools',
    '/superadmin/renewal-approval': 'อนุมัติต่ออายุ',
    '/superadmin/settings': 'System Settings'
  }
  return titles[route.path] || 'Master-teachtable'
})

function handleMenuSelect(index) {
  router.push(index)
}

async function handleLogout() {
  logoutLoading.value = true
  const result = await logout()
  if (result.success) {
    router.push('/login')
  }
  logoutLoading.value = false
}

async function loadPendingRequestsCount() {
  const [schoolRequestsResult, renewalRequestsResult] = await Promise.all([
    getSchoolRequests('pending'),
    getRenewalRequests('pending'),
  ])
  if (schoolRequestsResult.success || renewalRequestsResult.success) {
    pendingRequestsCount.value = (schoolRequestsResult.success ? schoolRequestsResult.data.length : 0)
      + (renewalRequestsResult.success ? renewalRequestsResult.data.length : 0)
  }
}

onMounted(() => {
  loadPendingRequestsCount()
})
</script>

<style scoped>
.superadmin-dashboard {
  background: radial-gradient(circle at 5% 5%, #dbeafe 0%, transparent 25%),
    radial-gradient(circle at 90% 10%, #ede9fe 0%, transparent 30%),
    #f8fafc;
}

.sidebar {
  background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%);
  color: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 8px 0 24px rgba(15, 23, 42, 0.16);
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.sidebar-header h3 {
  margin: 0 0 5px 0;
  color: #93c5fd;
  font-size: 18px;
  font-weight: 800;
}

.sidebar-header p {
  margin: 0;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.85);
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background-color: transparent;
}

.sidebar-menu :deep(.el-menu-item) {
  color: #cbd5e1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  height: 50px;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: rgba(148, 163, 184, 0.18);
  color: white;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: white;
  font-weight: 700;
}

.request-badge {
  margin-left: 10px;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.logout-btn {
  width: 100%;
  border-radius: 10px;
}

.main-header {
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.main-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 800;
}

.header-actions {
  color: #64748b;
}

.welcome-chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 600;
}

.main-content {
  padding: 24px;
  background: transparent;
}
</style>