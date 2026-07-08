<template>
  <div class="login-bg">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">🎓</div>
        <h1 class="login-title">พอร์ทัลนักเรียน</h1>
        <p class="login-subtitle">ตรวจสอบคะแนนและข้อมูลการเรียน</p>
      </div>

      <!-- login mode toggle -->
      <div class="mode-tabs">
        <button class="mode-tab" :class="{ active: loginMode === 'code' }" @click="loginMode = 'code'; errorMsg = ''">
          🎫 รหัสนักเรียน
        </button>
        <button class="mode-tab" :class="{ active: loginMode === 'email' }" @click="loginMode = 'email'; errorMsg = ''">
          📧 อีเมล
        </button>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">

        <!-- Mode: รหัสนักเรียน -->
        <template v-if="loginMode === 'code'">
          <div class="field-group">
            <label class="field-label">รหัสนักเรียน</label>
            <input
              v-model="form.studentCode"
              type="text"
              class="field-input"
              placeholder="เช่น 12345"
              autocomplete="username"
            />
          </div>
        </template>

        <!-- Mode: อีเมล -->
        <template v-else>
          <div class="field-group">
            <label class="field-label">อีเมล</label>
            <input
              v-model="form.email"
              type="email"
              class="field-input"
              placeholder="email@example.com"
              autocomplete="email"
            />
          </div>
        </template>

        <!-- Credential (ใช้ทั้ง 2 mode) -->
        <div class="field-group">
          <label class="field-label">
            {{ hasSetPin ? 'รหัสผ่าน (PIN)' : 'เลขบัตรประชาชน หรือ วันเดือนปีเกิด' }}
          </label>
          <div class="input-wrap">
            <input
              v-model="form.credential"
              :type="showCred ? 'text' : 'password'"
              class="field-input"
              :placeholder="hasSetPin ? 'กรอก PIN ที่ตั้งไว้' : 'เลขบัตร 13 หลัก หรือ DDMMYYYY'"
              autocomplete="current-password"
              required
            />
            <button type="button" class="toggle-vis" @click="showCred = !showCred">
              {{ showCred ? '🙈' : '👁️' }}
            </button>
          </div>
          <p v-if="!hasSetPin" class="field-hint">
            ถ้าไม่มีเลขบัตรฯ ให้ใช้วันเดือนปีเกิด เช่น เกิด 5 ม.ค. 2550 → <strong>05012550</strong>
          </p>
        </div>

        <div v-if="loginMode === 'code' && !schoolId" class="no-school-msg">
          ลิงก์ไม่ถูกต้อง —
          <router-link to="/" class="picker-link">กลับไปเลือกโรงเรียน</router-link>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>

        <button type="button" class="toggle-mode-btn" @click="hasSetPin = !hasSetPin">
          {{ hasSetPin ? 'ยังไม่มี PIN → ใช้เลขบัตรแทน' : 'มี PIN แล้ว → เข้าด้วย PIN' }}
        </button>

        <router-link to="/" class="back-school-link">← เปลี่ยนโรงเรียน</router-link>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudentStore } from '@/stores/student'

const route = useRoute()
const router = useRouter()
const studentStore = useStudentStore()

const form = ref({ studentCode: '', email: '', credential: '' })
const loading   = ref(false)
const showCred  = ref(false)
const hasSetPin = ref(false)
const errorMsg  = ref('')
const loginMode = ref('code')  // 'code' | 'email'

// Pre-fill school_id from query param (admin distributes the link)
const schoolId = ref(route.query.school || '')

onMounted(() => {
  if (studentStore.isLoggedIn) router.replace('/student/dashboard')
})

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true
  try {
    let ok = false
    if (loginMode.value === 'email') {
      if (!form.value.email.trim()) { errorMsg.value = 'กรุณากรอกอีเมล'; return }
      ok = await studentStore.loginByEmail(form.value.email.trim(), form.value.credential.trim())
    } else {
      if (!schoolId.value) { errorMsg.value = 'ลิงก์ไม่ถูกต้อง — ขอลิงก์ใหม่จากครูหรือผู้ดูแลระบบ'; return }
      ok = await studentStore.login(schoolId.value, form.value.studentCode.trim(), form.value.credential.trim())
    }
    if (!ok) {
      errorMsg.value = loginMode.value === 'email'
        ? 'ไม่พบบัญชีที่ตรงกับอีเมลและรหัสผ่านนี้'
        : 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง'
      return
    }
    if (!studentStore.session?.has_set_pin) {
      router.push('/student/change-pin')
    } else {
      router.push('/student/dashboard')
    }
  } catch (e) {
    errorMsg.value = 'เกิดข้อผิดพลาด: ' + (e.message || e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-bg {
  min-height: 100dvh;
  background: linear-gradient(160deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  font-family: 'Sarabun', sans-serif;
}
.login-card {
  background: white;
  border-radius: 20px;
  padding: 32px 28px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
.login-header { text-align: center; margin-bottom: 28px; }
.login-logo { font-size: 48px; margin-bottom: 8px; }
.login-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0; }
.login-subtitle { font-size: 14px; color: #6b7280; margin: 4px 0 0; }

.login-form { display: flex; flex-direction: column; gap: 18px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 14px; font-weight: 600; color: #374151; }
.field-input {
  padding: 12px 14px;
  border: 1.5px solid #d1d5db;
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color .2s;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus { border-color: #6366f1; }
.input-wrap { position: relative; }
.input-wrap .field-input { padding-right: 44px; }
.toggle-vis {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px;
}
.field-hint { font-size: 12px; color: #9ca3af; margin: 0; }

.error-msg {
  background: #fef2f2; color: #b91c1c;
  border: 1px solid #fca5a5; border-radius: 8px;
  padding: 10px 14px; font-size: 14px;
}

.login-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white; border: none; border-radius: 12px;
  padding: 14px; font-size: 16px; font-weight: 700;
  cursor: pointer; font-family: inherit;
  transition: opacity .2s;
}
.login-btn:disabled { opacity: .6; cursor: not-allowed; }
.login-btn:hover:not(:disabled) { opacity: .9; }

.toggle-mode-btn {
  background: none; border: none; color: #6366f1; font-size: 13px;
  cursor: pointer; text-decoration: underline; font-family: inherit; padding: 0;
}
.no-school-msg {
  background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
  border-radius: 8px; padding: 10px 14px; font-size: 14px;
}
.picker-link { color: #d97706; font-weight: 700; }
.back-school-link {
  display: block; text-align: center; color: #9ca3af; font-size: 13px;
  text-decoration: none; margin-top: 4px;
}

/* ── Login mode tabs ── */
.mode-tabs {
  display: flex; gap: 0;
  background: #f1f5f9; border-radius: 14px; padding: 4px;
  margin-bottom: 20px;
}
.mode-tab {
  flex: 1; padding: 11px 8px; border: none; border-radius: 11px;
  background: transparent; color: #64748b;
  font-size: 15px; font-weight: 700; cursor: pointer;
  transition: all 0.15s;
}
.mode-tab.active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
</style>
