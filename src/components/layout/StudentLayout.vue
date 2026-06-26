<template>
  <!-- Exam fullscreen mode: hide all chrome, just render the view -->
  <router-view v-if="isExamMode" />

  <div v-else class="student-shell">
    <!-- Top bar -->
    <div class="student-topbar">
      <div class="student-identity">
        <router-link to="/student/dashboard" class="avatar-link">
          <img v-if="avatarUrl" :src="fixUrl(avatarUrl)" class="student-avatar" @error="avatarError = true" />
          <div v-else class="student-avatar-placeholder">{{ initials }}</div>
        </router-link>
        <div class="student-name-wrap">
          <div class="student-prefix">{{ session.prefix }}</div>
          <div class="student-names">
            <span class="name-first">{{ session.first_name }}</span>
            <span class="name-sep"> </span>
            <span class="name-last">{{ session.last_name }}</span>
          </div>
          <div class="student-class">ห้อง {{ session.class_id }}</div>
        </div>
      </div>
      <div class="student-topbar-actions">
        <router-link to="/student/change-pin" class="topbar-btn" title="เปลี่ยนรหัสผ่าน">🔑</router-link>
        <button class="topbar-btn" title="ออกจากระบบ" @click="handleLogout">🚪</button>
      </div>
    </div>

    <!-- Page content -->
    <div class="student-content">
      <router-view />
    </div>

    <!-- Bottom nav -->
    <nav class="student-bottomnav">
      <router-link v-for="tab in tabs" :key="tab.to" :to="tab.to" class="bottomnav-tab" active-class="bottomnav-tab--active">
        <span class="bottomnav-icon">{{ tab.icon }}</span>
        <span class="bottomnav-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStudentStore } from '@/stores/student'
import { fixPhotoUrl } from '@/composables/useStudentUpload'

const studentStore = useStudentStore()
const router = useRouter()
const route = useRoute()
const isExamMode = computed(() => !!route.meta?.examMode)
const session = computed(() => studentStore.session || {})
const avatarError = ref(false)

const avatarUrl = computed(() => {
  if (avatarError.value) return ''
  return session.value.photo_url || ''
})
const initials = computed(() => (session.value.first_name || '?').charAt(0))

function fixUrl(url) { return fixPhotoUrl(url) }

const tabs = [
  { to: '/student/dashboard',   icon: '🏠', label: 'หน้าหลัก' },
  { to: '/student/behavior',    icon: '⭐', label: 'พฤติกรรม' },
  { to: '/student/scores',      icon: '📝', label: 'คะแนนเก็บ' },
  { to: '/student/attendance',  icon: '📊', label: 'สรุปรายวิชา' },
  { to: '/student/club',        icon: '🎯', label: 'ชุมนุม' },
  { to: '/student/messages',    icon: '💬', label: 'ข้อความ' },
  { to: '/student/exams',       icon: '📋', label: 'สอบ' },
]

function handleLogout() {
  studentStore.logout()
  router.push('/student/login')
}
</script>

<style scoped>
.student-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #f0f4f8;
  font-family: 'Sarabun', sans-serif;
}
.student-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 2px 8px rgba(99,102,241,.35);
}
.student-identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
.avatar-link { flex-shrink: 0; display: block; }
.student-avatar {
  width: 46px; height: 46px; border-radius: 50%; object-fit: cover;
  border: 2px solid rgba(255,255,255,.8);
  box-shadow: 0 2px 8px rgba(0,0,0,.25);
}
.student-avatar-placeholder {
  width: 46px; height: 46px; border-radius: 50%;
  background: rgba(255,255,255,.25);
  border: 2px solid rgba(255,255,255,.6);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: white;
}
.student-name-wrap { min-width: 0; }
.student-prefix { font-size: 11px; opacity: .8; line-height: 1; margin-bottom: 1px; }
.student-names { display: flex; gap: 6px; align-items: baseline; flex-wrap: nowrap; }
.name-first { font-size: 16px; font-weight: 900; line-height: 1.2; white-space: nowrap; }
.name-last  { font-size: 14px; font-weight: 600; opacity: .9; white-space: nowrap; }
.student-class { font-size: 11px; opacity: .75; margin-top: 1px; }
.student-topbar-actions { display: flex; gap: 6px; }
.topbar-btn {
  background: rgba(255,255,255,.2); border: none; border-radius: 8px;
  padding: 6px 10px; font-size: 16px; cursor: pointer; color: white;
  text-decoration: none; display: flex; align-items: center;
}
.topbar-btn:hover { background: rgba(255,255,255,.35); }

.student-content {
  flex: 1;
  padding: 16px;
  padding-bottom: 80px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.student-bottomnav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: white;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 10px rgba(0,0,0,.08);
  z-index: 50;
}
.bottomnav-tab {
  flex: 1;
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 4px 10px;
  text-decoration: none;
  color: #9ca3af;
  font-size: 10px;
  transition: color .2s;
}
.bottomnav-tab--active { color: #6366f1; }
.bottomnav-icon { font-size: 20px; line-height: 1; }
.bottomnav-label { margin-top: 2px; }
</style>
