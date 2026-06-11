<template>
  <AppLayout>
    <div class="dashboard-wrapper p-6">
      <el-alert
        v-if="schoolStore.isViewOnlyMode"
        type="error"
        :closable="false"
        show-icon
        class="mb-4"
        title="แพ็กเกจหมดอายุ: ตอนนี้ใช้งานได้เฉพาะดูตารางสอน"
        :description="expiredDescription"
      />

      <el-alert
        v-else-if="schoolStore.planNotice?.unread"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        :title="schoolStore.planNotice?.title || 'มีการอัปเดตแพ็กเกจ'"
        :description="schoolStore.planNotice?.message || ''"
      />

      <!-- Header Section -->
      <div class="header-section mb-8 p-8 rounded-3xl bg-grad-royal text-white shadow-xl relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex items-center gap-4 mb-4">
            <div class="avatar-lg bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl">
              {{ authStore.profile?.displayName?.charAt(0) || '👋' }}
            </div>
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight">สวัสดี, {{ authStore.profile?.displayName }}</h1>
              <p class="text-white/80">ยินดีต้อนรับกลับสู่ระบบจัดการตารางสอน</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-sm mt-6 pt-6 border-t border-white/10">
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <span>📅</span> {{ thaiDate }}
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <span>🏫</span> {{ schoolStore.schoolName || 'ยังไม่ได้กำหนดชื่อโรงเรียน' }}
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
              <span>🏷️</span> {{ schoolStore.termLabel }}
            </div>
          </div>
        </div>
        <!-- Decorative blobs -->
        <div class="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-10 -left-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
      </div>

      <!-- Package Info Card (admin only) -->
      <div v-if="authStore.isAdmin && schoolStore.pricingPlan" class="package-info-card mb-6"
        :class="schoolStore.isViewOnlyMode ? 'pkg-expired' : 'pkg-active'">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="pkg-icon">💳</div>
            <div>
              <div class="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">แพ็กเกจปัจจุบัน</div>
              <div class="flex flex-wrap items-center gap-3">
                <span class="font-bold text-lg">{{ schoolStore.pricingPlan.code || '-' }} บาท/เดือน</span>
                <span class="text-sm opacity-80">ผู้จัดได้ {{ schoolStore.schedulerLimit }} คน</span>
                <span class="pkg-badge" :class="schoolStore.isViewOnlyMode ? 'pkg-badge-expired' : 'pkg-badge-active'">
                  {{ schoolStore.isViewOnlyMode ? '⛔ หมดอายุ' : '✅ ใช้งานได้' }}
                </span>
              </div>
              <div class="text-sm mt-1 opacity-80">
                {{ schoolStore.isViewOnlyMode ? 'หมดอายุเมื่อ' : 'ใช้งานได้ถึง' }}: {{ subscriptionExpiryLabel }}
              </div>
            </div>
          </div>
          <router-link to="/admin/renewal">
            <el-button :type="schoolStore.isViewOnlyMode ? 'danger' : 'primary'" size="small">
              💳 {{ schoolStore.isViewOnlyMode ? 'ต่ออายุทันที' : 'ต่ออายุ / จัดการแพ็กเกจ' }}
            </el-button>
          </router-link>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10" v-loading="loadingStats">
        <div v-for="stat in stats" :key="stat.label" class="stat-card-modern glass-card p-6 rounded-2xl flex flex-col items-center justify-center text-center">
          <div class="stat-icon-circle mb-3" :style="{ background: stat.color + '15', color: stat.color }">
            {{ stat.icon }}
          </div>
          <div class="text-3xl font-black mb-1" :style="{ color: stat.color }">
            {{ stat.value === null ? '...' : stat.value }}
          </div>
          <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">{{ stat.label }}</div>
        </div>
      </div>

      <!-- Quick Action Cards -->
      <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span class="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
        เมนูจัดการหลัก
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-if="authStore.isAdmin" class="action-card-modern group">
          <div class="card-bg bg-grad-primary"></div>
          <div class="card-content">
            <div class="icon-box text-4xl mb-4">🗂️</div>
            <h3 class="text-xl font-bold mb-2">จัดการข้อมูลพื้นฐาน</h3>
            <p class="text-white/70 text-sm mb-6">จัดการข้อมูลครู นักเรียน รายวิชา และห้องเรียนทั้งหมด</p>
            <router-link to="/admin/teachers">
              <el-button color="white" class="w-full text-indigo-600 font-bold rounded-xl shadow-lg">เข้าสู่เมนูจัดการ</el-button>
            </router-link>
          </div>
        </div>

        <div v-if="authStore.isAdmin || authStore.isScheduler" class="action-card-modern group">
          <div class="card-bg bg-grad-success"></div>
          <div class="card-content">
            <div class="icon-box text-4xl mb-4">📅</div>
            <h3 class="text-xl font-bold mb-2">จัดตารางสอน</h3>
            <p class="text-white/70 text-sm mb-6">สร้างและปรับแต่งตารางสอนสำหรับภาคเรียนปัจจุบัน</p>
            <router-link :to="schoolStore.isViewOnlyMode ? '/planning/print' : '/planning/timetable'">
              <el-button color="white" class="w-full text-emerald-600 font-bold rounded-xl shadow-lg">
                {{ schoolStore.isViewOnlyMode ? 'ไปหน้าดูตาราง' : 'ไปยังหน้าจัดตาราง' }}
              </el-button>
            </router-link>
          </div>
        </div>

        <div v-if="authStore.isAdmin" class="action-card-modern group">
          <div class="card-bg bg-grad-info"></div>
          <div class="card-content">
            <div class="icon-box text-4xl mb-4">📊</div>
            <h3 class="text-xl font-bold mb-2">สรุปรายงาน</h3>
            <p class="text-white/70 text-sm mb-6">ดูรายงานภาระงานและสรุปผลการจัดตารางรายห้อง/รายครู</p>
            <router-link to="/reports/assignments">
              <el-button color="white" class="w-full text-blue-600 font-bold rounded-xl shadow-lg">ดูรายงาน</el-button>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getTeachers, getStudents, getSubjects, getClasses } = useSchoolDb()

// Thai Buddhist Calendar date
const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน',
  'พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม',
  'กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
]
const THAI_DAYS_FULL = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

const thaiDate = computed(() => {
  const now     = new Date()
  const day     = now.getDate()
  const month   = THAI_MONTHS[now.getMonth()]
  const year    = now.getFullYear() + 543
  const dayName = THAI_DAYS_FULL[now.getDay()]
  return `วัน${dayName}ที่ ${day} ${month} พ.ศ. ${year}`
})

const expiredDescription = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'กรุณาติดต่อผู้ดูแลเพื่อทำการต่ออายุแพ็กเกจ'
  return `หมดอายุเมื่อ ${exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}`
})

const subscriptionExpiryLabel = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'ยังไม่กำหนด'
  return exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
})

// Stats
const loadingStats = ref(false)
const stats = ref([
  { icon: '👨‍🏫', label: 'ครูทั้งหมด',      value: null, color: '#6366f1' },
  { icon: '👨‍🎓', label: 'นักเรียนทั้งหมด',  value: null, color: '#10b981' },
  { icon: '📚',  label: 'วิชาทั้งหมด',      value: null, color: '#f59e0b' },
  { icon: '🏫',  label: 'ห้องเรียน',         value: null, color: '#3b82f6' }
])

onMounted(async () => {
  loadingStats.value = true
  try {
    const [teachers, students, subjects, classes] = await Promise.all([
      getTeachers(),
      getStudents(),
      getSubjects(),
      getClasses()
    ])
    stats.value[0].value = teachers.length
    stats.value[1].value = students.length
    stats.value[2].value = subjects.length
    stats.value[3].value = classes.length
  } catch (e) {
    ElMessage.error('โหลดข้อมูลสถิติไม่สำเร็จ: ' + e.message)
    stats.value.forEach(s => { if (s.value === null) s.value = '-' })
  } finally {
    loadingStats.value = false
  }
})
</script>

<style scoped>
.package-info-card {
  border-radius: 16px;
  padding: 16px 20px;
  color: white;
}

.pkg-active {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  box-shadow: 0 4px 16px rgba(14,165,233,0.2);
}

.pkg-expired {
  background: linear-gradient(135deg, #dc2626, #9f1239);
  box-shadow: 0 4px 16px rgba(220,38,38,0.2);
}

.pkg-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  background: rgba(255,255,255,0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pkg-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
}

.pkg-badge-active {
  background: rgba(255,255,255,0.25);
  color: white;
}

.pkg-badge-expired {
  background: rgba(255,255,255,0.25);
  color: #fef2f2;
}

.dashboard-wrapper {
  max-width: 1200px;
  margin: 0 auto;
}

.avatar-lg {
  width: 64px;
  height: 64px;
}

.stat-card-modern {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 24px;
}

.stat-card-modern:hover {
  transform: translateY(-8px);
}

.stat-icon-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.action-card-modern {
  position: relative;
  height: 240px;
  border-radius: 28px;
  overflow: hidden;
  padding: 30px;
  color: white;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.1);
}

.action-card-modern:hover {
  transform: scale(1.02);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
}

.card-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  transition: opacity 0.4s;
}

.action-card-modern:hover .card-bg {
  opacity: 0.9;
}

.card-content {
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.icon-box {
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
