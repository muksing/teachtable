<template>
  <div class="pl-page">
    <div class="pl-card">
      <!-- Logo / Header -->
      <div class="pl-header">
        <div class="pl-icon">👨‍👩‍👧‍👦</div>
        <h1 class="pl-title">ระบบผู้ปกครอง</h1>
        <p class="pl-subtitle">ติดตามบุตรหลาน</p>
      </div>

      <!-- Form -->
      <div class="pl-form">
        <!-- Step 1: Phone -->
        <div class="pl-field">
          <label class="pl-label">📱 เบอร์โทรศัพท์</label>
          <input
            v-model="phone"
            type="tel"
            inputmode="numeric"
            maxlength="10"
            placeholder="0xx-xxx-xxxx"
            class="pl-input"
            :class="{ 'pl-input-err': errors.phone }"
            @input="errors.phone = ''"
          />
          <span v-if="errors.phone" class="pl-err">{{ errors.phone }}</span>
        </div>

        <!-- Step 2: ID last 6 -->
        <div class="pl-field">
          <label class="pl-label">🪪 เลขบัตรประชาชน 6 ตัวท้าย</label>
          <input
            v-model="idLast6"
            type="password"
            inputmode="numeric"
            maxlength="6"
            placeholder="xxxxxx"
            class="pl-input pl-input-id"
            :class="{ 'pl-input-err': errors.id }"
            @input="errors.id = ''"
          />
          <span v-if="errors.id" class="pl-err">{{ errors.id }}</span>
          <p class="pl-hint">ใช้เลขบัตรประชาชนของผู้ปกครองที่ลงทะเบียนไว้</p>
        </div>

        <!-- Error message -->
        <div v-if="loginError" class="pl-login-err">
          ⚠️ {{ loginError }}
        </div>

        <!-- Login button -->
        <button class="pl-btn" :disabled="loading" @click="doLogin">
          <span v-if="loading" class="pl-spinner">⏳</span>
          <span v-else>🔓 เข้าสู่ระบบ</span>
        </button>
      </div>

      <p class="pl-footer-note">หากไม่สามารถเข้าได้ กรุณาติดต่อโรงเรียน</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useParentStore } from '@/stores/parent'

const router      = useRouter()
const parentStore = useParentStore()

const phone      = ref('')
const idLast6    = ref('')
const loading    = ref(false)
const loginError = ref('')
const errors     = ref({ phone: '', id: '' })

async function doLogin() {
  errors.value = { phone: '', id: '' }
  loginError.value = ''

  const cleanPhone = phone.value.replace(/[^0-9]/g, '')
  if (cleanPhone.length < 9) { errors.value.phone = 'กรุณากรอกเบอร์โทรให้ถูกต้อง (9-10 หลัก)'; return }
  if (idLast6.value.length !== 6) { errors.value.id = 'กรุณากรอกเลขบัตร 6 ตัวท้าย'; return }

  loading.value = true
  try {
    await parentStore.login(cleanPhone, idLast6.value)
    router.replace({ name: 'ParentHome' })
  } catch (e) {
    loginError.value = e.message || 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.pl-page {
  min-height: 100dvh;
  background: linear-gradient(160deg, #78350f 0%, #92400e 40%, #d97706 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  font-family: 'Noto Sans Thai', sans-serif;
}
.pl-card {
  background: #fff;
  border-radius: 28px;
  padding: 36px 28px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  border-top: 5px solid #d97706;
}
.pl-header { text-align: center; margin-bottom: 32px; }
.pl-icon   { font-size: 64px; margin-bottom: 8px; }
.pl-title  { font-size: 28px; font-weight: 800; color: #92400e; margin: 0 0 4px; }
.pl-subtitle { font-size: 18px; color: #64748b; margin: 0; }

.pl-form { display: flex; flex-direction: column; gap: 24px; }
.pl-field { display: flex; flex-direction: column; gap: 8px; }
.pl-label { font-size: 20px; font-weight: 700; color: #92400e; }
.pl-input {
  font-size: 24px;
  font-weight: 600;
  padding: 16px 20px;
  border: 2.5px solid #fcd34d;
  border-radius: 14px;
  outline: none;
  color: #0f172a;
  letter-spacing: 2px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.pl-input:focus { border-color: #d97706; box-shadow: 0 0 0 3px rgba(217,119,6,0.18); }
.pl-input-id { font-size: 28px; text-align: center; letter-spacing: 8px; }
.pl-input-err { border-color: #ef4444; }
.pl-err { font-size: 15px; color: #ef4444; font-weight: 600; }
.pl-hint { font-size: 15px; color: #64748b; margin: 0; }

.pl-login-err {
  background: #fef2f2;
  border: 2px solid #fca5a5;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 18px;
  font-weight: 600;
  color: #dc2626;
  text-align: center;
}

.pl-btn {
  background: linear-gradient(135deg, #b45309, #92400e);
  color: #fff;
  border: none;
  border-radius: 16px;
  padding: 20px;
  font-size: 22px;
  font-weight: 800;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 6px 20px rgba(146,64,14,0.45);
}
.pl-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.pl-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pl-spinner { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.pl-footer-note { text-align: center; font-size: 15px; color: #94a3b8; margin: 24px 0 0; }
</style>
