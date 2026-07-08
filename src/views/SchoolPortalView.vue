<template>
  <div class="portal-bg">
    <div class="portal-wrap">

      <!-- Back button -->
      <button class="back-btn" @click="router.push('/')">← เปลี่ยนโรงเรียน</button>

      <!-- School branding -->
      <div v-if="loading" class="state-box"><div class="spinner"></div></div>
      <div v-else-if="notFound" class="state-box">
        <div style="font-size:48px;margin-bottom:12px">❓</div>
        <p style="color:rgba(255,255,255,.7);font-size:15px">ไม่พบโรงเรียน<br><span style="font-size:12px;opacity:.6">{{ slug }}</span></p>
        <button class="back-btn" style="margin:16px auto 0;display:inline-block" @click="router.push('/')">← กลับไปเลือกโรงเรียน</button>
      </div>
      <template v-else>
        <div class="school-branding">
          <div class="school-logo-wrap">
            <img v-if="school.logo" :src="school.logo" :alt="school.name" class="school-logo-img" />
            <span v-else class="school-logo-placeholder">🏫</span>
          </div>
          <h1 class="school-name">{{ school.name }}</h1>
          <p class="portal-sub">เลือกประเภทผู้ใช้งาน</p>
        </div>

        <!-- Role chooser -->
        <div class="role-grid">
          <button class="role-card role-card--teacher" @click="goTeacher">
            <div class="role-icon">👨‍🏫</div>
            <div class="role-title">ครูและบุคลากร</div>
            <div class="role-desc">เข้าสู่ระบบด้วยอีเมล</div>
          </button>

          <button class="role-card role-card--student" @click="goStudent">
            <div class="role-icon">🎓</div>
            <div class="role-title">นักเรียน</div>
            <div class="role-desc">ใช้รหัสนักเรียน + บัตรประชาชน</div>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase/client'

const route  = useRoute()
const router = useRouter()
const slug   = route.params.schoolId   // school_code หรือ UUID (รองรับทั้งสองแบบ)

const school  = ref({ id: '', name: '', logo: '' })
const loading = ref(true)
const notFound = ref(false)

onMounted(async () => {
  try {
    // ลอง school_code ก่อน ถ้าไม่เจอค่อยลอง id (UUID — backward compatible)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    let data = null

    if (isUUID) {
      // รูปแบบเก่า — ค้นด้วย id โดยตรง
      const res = await supabase.from('schools').select('id, name, settings').eq('id', slug).maybeSingle()
      data = res.data
    } else {
      // รูปแบบใหม่ — ค้นด้วย school_code
      const res = await supabase.from('schools').select('id, name, settings').eq('school_code', slug).maybeSingle()
      data = res.data
    }

    if (data) {
      school.value = {
        id:   data.id,
        name: data.settings?.school_info?.school_name_th || data.name || '',
        logo: data.settings?.logo_url || '',
      }
    } else {
      notFound.value = true
    }
  } finally {
    loading.value = false
  }
})

function goTeacher() {
  // ส่ง UUID จริงเสมอ (ไม่ใช่ school_code)
  router.push({ path: '/login', query: { school: school.value.id } })
}

function goStudent() {
  router.push({ path: '/student/login', query: { school: school.value.id } })
}
</script>

<style scoped>
.portal-bg {
  min-height: 100dvh;
  background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 20px;
  font-family: 'Sarabun', sans-serif;
}
.portal-wrap { width: 100%; max-width: 420px; }

.back-btn {
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2);
  color: rgba(255,255,255,.8); border-radius: 10px; padding: 8px 14px;
  font-size: 13px; cursor: pointer; font-family: inherit;
  margin-bottom: 24px; display: block;
  transition: background .2s;
}
.back-btn:hover { background: rgba(255,255,255,.18); }

.school-branding { text-align: center; margin-bottom: 32px; }
.school-logo-wrap {
  width: 96px; height: 96px; border-radius: 22px;
  background: white; margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,.3);
}
.school-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 8px; box-sizing: border-box; }
.school-logo-placeholder { font-size: 48px; }
.school-name { font-size: 20px; font-weight: 800; color: white; margin: 0 0 6px; line-height: 1.3; }
.portal-sub { font-size: 14px; color: rgba(255,255,255,.6); margin: 0; }

.role-grid { display: flex; flex-direction: column; gap: 14px; }
.role-card {
  border: none; border-radius: 20px; padding: 24px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer; font-family: inherit;
  transition: transform .15s, opacity .2s;
  text-align: center;
}
.role-card:active { transform: scale(.97); }
.role-card:hover { opacity: .92; }

.role-card--teacher {
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  color: white;
}
.role-card--student {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: white;
}

.role-icon { font-size: 44px; line-height: 1; }
.role-title { font-size: 20px; font-weight: 800; }
.role-desc { font-size: 13px; opacity: .8; }

.state-box { text-align: center; padding: 60px 0; }
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(255,255,255,.2);
  border-top-color: white; border-radius: 50%;
  animation: spin .8s linear infinite;
  margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
