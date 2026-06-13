<template>
  <div class="login-page">
    <div class="aurora aurora-a" />
    <div class="aurora aurora-b" />
    <div class="mesh" />

    <div class="login-card">
      <div class="brand">
        <div class="brand-icon">🏫</div>
        <div>
          <div class="brand-name">TeachTable</div>
          <div class="brand-sub">ระบบจัดการโรงเรียน</div>
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
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const { login, loading, error } = useMasterAuth()

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

onMounted(() => {
  if (authStore.isLoggedIn) {
    router.push(authStore.isSuperAdmin ? '/superadmin/dashboard' : '/dashboard')
  }
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
</style>
