<template>
  <div class="login-page">
    <div class="aurora aurora-a" />
    <div class="aurora aurora-b" />
    <div class="mesh" />

    <div class="login-card">
      <div class="brand">
        <div class="brand-icon">
          <img v-if="schoolLogo" :src="schoolLogo" class="brand-logo-img" alt="โลโก้โรงเรียน" />
          <span v-else>🏫</span>
        </div>
        <div>
          <div class="brand-name">{{ schoolDisplayName || 'TeachTable' }}</div>
          <div class="brand-sub">{{ schoolDisplayName ? 'ระบบบริหารจัดการโรงเรียน' : 'ระบบจัดการโรงเรียน' }}</div>
        </div>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="email">
          <el-input
            v-model="form.email"
            type="email"
            placeholder="อีเมล"
            size="large"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="รหัสผ่าน"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          class="mb-4"
          :closable="false"
        />

        <el-button
          type="primary"
          size="large"
          class="w-full login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </el-button>

        <!-- divider -->
        <div class="login-divider">
          <span>หรือ</span>
        </div>

        <!-- Google button -->
        <button class="google-btn" :disabled="googleLoading" @click="handleGoogleLogin">
          <svg v-if="!googleLoading" class="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <svg v-else class="google-icon animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#dadce0" stroke-width="3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <span>{{ googleLoading ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google' }}</span>
        </button>

        <el-alert
          v-if="googleError"
          :title="googleError"
          type="error"
          show-icon
          class="mt-3"
          :closable="false"
        />
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/supabase/client'

const router = useRouter()
const authStore = useAuthStore()
const { login, loading, error, loginWithGoogle, googleLoading, googleError } = useMasterAuth()

async function handleGoogleLogin() {
  await loginWithGoogle()
  // browser จะ redirect ไป Google ทันที ถ้าสำเร็จ
}

const formRef = ref()
const form = reactive({ email: '', password: '' })
const rules = {
  email: [
    { required: true, message: 'กรุณากรอกอีเมล', trigger: 'blur' },
    { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง', trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'กรุณากรอกรหัสผ่าน', trigger: 'blur' },
    { min: 6, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', trigger: 'blur' }
  ]
}

const schoolLogo       = ref('')
const schoolDisplayName = ref('')

async function loadSchoolBranding() {
  try {
    const { data } = await supabase
      .from('schools')
      .select('name, settings')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    if (data) {
      schoolDisplayName.value = data.settings?.school_info?.school_name_th || data.name || ''
      schoolLogo.value        = data.settings?.logo_url || ''
    }
  } catch { /* หน้า login ไม่แสดง error ถ้าโหลดไม่ได้ */ }
}

onMounted(async () => {
  if (authStore.isLoggedIn) {
    router.push(authStore.isSuperAdmin ? '/superadmin/dashboard' : '/dashboard')
    return
  }
  loadSchoolBranding()
})

async function handleLogin() {
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    const result = await login(form.email, form.password)
    if (result && result.success) {
      const redirectTarget = router.currentRoute.value.query.redirect
      if (redirectTarget && typeof redirectTarget === 'string') {
        router.push(redirectTarget)
      } else {
        router.push(authStore.isSuperAdmin ? '/superadmin/dashboard' : '/dashboard')
      }
    }
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 18% 20%, #67e8f9 0%, transparent 35%),
    radial-gradient(circle at 80% 14%, #38bdf8 0%, transparent 32%),
    linear-gradient(145deg, #0e7490, #155e75 52%, #0f172a);
  position: relative;
  overflow: hidden;
  padding: 24px 16px;
}

.mesh {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(circle at center, black 38%, transparent 100%);
  opacity: 0.22;
}

.aurora {
  position: absolute;
  border-radius: 999px;
  filter: blur(56px);
  opacity: 0.45;
  pointer-events: none;
}

.aurora-a {
  width: 360px;
  height: 360px;
  left: -100px;
  bottom: -90px;
  background: #f97316;
}

.aurora-b {
  width: 280px;
  height: 280px;
  right: -84px;
  top: -58px;
  background: #22d3ee;
}

.login-card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 400px;
  background: linear-gradient(180deg, rgba(255,255,255,0.97), rgba(241,245,249,0.98));
  border-radius: 22px;
  padding: 32px 28px;
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.28);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.brand-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #0284c7, #0ea5e9);
  font-size: 26px;
  flex-shrink: 0;
  overflow: hidden;
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 14px;
  background: white;
  padding: 4px;
}

.brand-name {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.1;
}

.brand-sub {
  font-size: 13px;
  color: #64748b;
  margin-top: 2px;
}

.login-btn {
  border: none;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
  width: 100%;
}

.login-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 16px 0 14px; color: #94a3b8; font-size: 13px;
}
.login-divider::before,
.login-divider::after {
  content: ''; flex: 1; height: 1px; background: #e2e8f0;
}

.google-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 11px 16px; border-radius: 10px;
  border: 1.5px solid #dadce0; background: #fff; cursor: pointer;
  font-size: 14px; font-weight: 600; color: #3c4043;
  transition: box-shadow .15s, background .15s;
  font-family: inherit;
}
.google-btn:hover:not(:disabled) {
  background: #f8f9fa; box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.google-btn:disabled { opacity: .65; cursor: not-allowed; }
.google-icon { width: 20px; height: 20px; flex-shrink: 0; }
.animate-spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
