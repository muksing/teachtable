<template>
  <div class="picker-bg">
    <div class="picker-wrap">
      <!-- Header -->
      <div class="picker-header">
        <div class="picker-logo">🏫</div>
        <h1 class="picker-title">ยินดีต้อนรับ</h1>
        <p class="picker-subtitle">เลือกโรงเรียนของคุณ</p>
      </div>

      <!-- Search -->
      <div class="search-wrap">
        <input
          v-model="query"
          type="search"
          placeholder="🔍 ค้นหาชื่อโรงเรียน..."
          class="search-input"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>กำลังโหลด...</p>
      </div>

      <!-- Empty -->
      <div v-else-if="!filtered.length" class="state-box">
        <div style="font-size:40px">🔍</div>
        <p>ไม่พบโรงเรียนที่ค้นหา</p>
      </div>

      <!-- School grid -->
      <div v-else class="school-grid">
        <button
          v-for="school in filtered"
          :key="school.id"
          class="school-card"
          @click="selectSchool(school)"
        >
          <div class="school-logo-wrap">
            <img v-if="school.logo" :src="school.logo" :alt="school.name" class="school-logo-img" />
            <span v-else class="school-logo-placeholder">🏫</span>
          </div>
          <div class="school-name">{{ school.name }}</div>
        </button>
      </div>

      <!-- Footer links -->
      <div class="footer-links">
        <router-link to="/register-school" class="footer-link footer-link--register">
          📋 สมัครใช้งานโรงเรียนใหม่
        </router-link>
        <router-link to="/login" class="footer-link footer-link--admin">
          🔐 ผู้ดูแลระบบ / SuperAdmin
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/supabase/client'

const router = useRouter()
const schools = ref([])
const loading = ref(true)
const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return schools.value
  return schools.value.filter(s => s.name.toLowerCase().includes(q))
})

function selectSchool(school) {
  // ใช้ school_code ถ้ามี มิฉะนั้น fallback เป็น UUID
  router.push(`/s/${school.code || school.id}`)
}

onMounted(async () => {
  try {
    const { data } = await supabase
      .from('schools')
      .select('id, name, settings, school_code')
      .neq('is_active', false)
      .order('name')
    schools.value = (data || []).map(s => ({
      id:   s.id,
      code: s.school_code || s.id,   // ใช้ school_code ถ้ามี
      name: s.settings?.school_info?.school_name_th || s.name || s.id,
      logo: s.settings?.logo_url || '',
    }))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.picker-bg {
  min-height: 100dvh;
  background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
  display: flex;
  justify-content: center;
  padding: 24px 16px 48px;
  font-family: 'Sarabun', sans-serif;
}
.picker-wrap {
  width: 100%;
  max-width: 640px;
}

.picker-header {
  text-align: center;
  padding: 32px 0 20px;
  color: white;
}
.picker-logo { font-size: 52px; margin-bottom: 10px; }
.picker-title { font-size: 26px; font-weight: 800; margin: 0; }
.picker-subtitle { font-size: 15px; opacity: .7; margin: 6px 0 0; }

.search-wrap { margin-bottom: 20px; }
.search-input {
  width: 100%;
  padding: 13px 18px;
  border-radius: 14px;
  border: 1.5px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.1);
  color: white;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  backdrop-filter: blur(10px);
}
.search-input::placeholder { color: rgba(255,255,255,.5); }
.search-input:focus { border-color: rgba(255,255,255,.4); background: rgba(255,255,255,.15); }

.state-box {
  text-align: center;
  color: rgba(255,255,255,.6);
  padding: 48px 0;
  font-size: 15px;
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .8s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.school-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}
.school-card {
  background: rgba(255,255,255,.08);
  border: 1.5px solid rgba(255,255,255,.12);
  border-radius: 18px;
  padding: 20px 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background .2s, transform .15s;
  color: white;
  font-family: inherit;
  text-align: center;
  backdrop-filter: blur(10px);
}
.school-card:hover {
  background: rgba(255,255,255,.16);
  transform: translateY(-2px);
}
.school-card:active { transform: scale(.97); }

.school-logo-wrap {
  width: 72px; height: 72px;
  border-radius: 16px;
  background: white;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.school-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 6px; box-sizing: border-box; }
.school-logo-placeholder { font-size: 36px; }
.school-name {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  opacity: .9;
}

.footer-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 36px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.footer-link {
  font-size: 13px;
  text-decoration: none;
  padding: 9px 20px;
  border-radius: 10px;
  transition: background .2s;
}
.footer-link--register {
  color: #93c5fd;
  border: 1px solid rgba(147,197,253,.3);
  background: rgba(147,197,253,.08);
}
.footer-link--register:hover { background: rgba(147,197,253,.18); }
.footer-link--admin {
  color: rgba(255,255,255,.4);
  font-size: 12px;
}
.footer-link--admin:hover { color: rgba(255,255,255,.7); }
</style>
