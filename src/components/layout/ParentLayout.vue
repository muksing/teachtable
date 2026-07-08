<template>
  <div class="pp-root">
    <!-- Top bar -->
    <div class="pp-topbar">
      <img v-if="parentStore.schoolLogo" :src="parentStore.schoolLogo" class="pp-logo" />
      <div class="pp-school-name">{{ parentStore.schoolName || 'ระบบผู้ปกครอง' }}</div>
      <button class="pp-dark-btn" @click="toggleDark" :title="isDark ? 'โหมดสว่าง' : 'โหมดมืด'">{{ isDark ? '☀️' : '🌙' }}</button>
      <button class="pp-logout-btn" @click="logout">🚪 ออก</button>
    </div>
    <!-- Content -->
    <div class="pp-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useParentStore } from '@/stores/parent'
import { useDarkMode } from '@/composables/useDarkMode'

const router      = useRouter()
const parentStore = useParentStore()
const { isDark, toggle: toggleDark } = useDarkMode()

function logout() {
  parentStore.logout()
  router.replace({ name: 'ParentLogin' })
}
</script>

<style scoped>
/* ── Parent Theme: Warm amber/brown — elderly-friendly, welcoming ── */
.pp-root {
  min-height: 100dvh;
  background: #fefce8;
  display: flex;
  flex-direction: column;
  font-family: 'Noto Sans Thai', 'Sarabun', sans-serif;
}

/* Topbar */
.pp-topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #92400e 0%, #b45309 60%, #d97706 100%);
  box-shadow: 0 3px 16px rgba(146,64,14,0.35);
  position: sticky;
  top: 0;
  z-index: 50;
}

.pp-logo {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255,255,255,0.65);
  box-shadow: 0 0 0 3px rgba(217,119,6,0.4);
  flex-shrink: 0;
}

.pp-school-name {
  flex: 1;
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.2px;
}

.pp-logout-btn {
  background: rgba(255,255,255,0.18);
  border: 2px solid rgba(255,255,255,0.55);
  color: #fff;
  border-radius: 12px;
  padding: 10px 18px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s;
}
.pp-logout-btn:hover { background: rgba(255,255,255,0.28); }

.pp-dark-btn {
  background: rgba(255,255,255,0.18);
  border: 2px solid rgba(255,255,255,0.55);
  color: #fff;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 17px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .15s;
}
.pp-dark-btn:hover { background: rgba(255,255,255,0.28); }

.pp-content {
  flex: 1;
  padding: 0;
  overflow-y: auto;
}
</style>
