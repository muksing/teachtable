<template>
  <div>
    <h2 class="page-title">🔑 ตั้งรหัสผ่าน (PIN)</h2>
    <p class="page-sub">ใช้รหัสนี้แทนเลขบัตรประชาชนในการล็อกอินครั้งต่อไป<br>เลขบัตรประชาชนยังใช้ login ได้เสมอ</p>

    <div class="section-card">
      <form @submit.prevent="handleSubmit">
        <div class="field-group">
          <label class="field-label">เลขบัตรประชาชน (ยืนยันตัวตน)</label>
          <input
            v-model="form.govId"
            type="password"
            class="field-input"
            placeholder="เลขบัตรประชาชน 13 หลัก"
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label">PIN ใหม่ (ตัวเลขหรือตัวอักษร)</label>
          <div class="input-wrap">
            <input
              v-model="form.newPin"
              :type="show ? 'text' : 'password'"
              class="field-input"
              placeholder="ตั้ง PIN อย่างน้อย 4 ตัวอักษร"
              minlength="4"
              required
            />
            <button type="button" class="toggle-vis" @click="show = !show">{{ show ? '🙈' : '👁️' }}</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">ยืนยัน PIN ใหม่</label>
          <input
            v-model="form.confirmPin"
            :type="show ? 'text' : 'password'"
            class="field-input"
            placeholder="กรอกซ้ำอีกครั้ง"
            required
          />
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'กำลังบันทึก...' : 'บันทึก PIN' }}
        </button>

        <router-link to="/student/dashboard" class="back-link">← กลับหน้าหลัก</router-link>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const router = useRouter()
const session = computed(() => studentStore.session || {})

const form = ref({ govId: '', newPin: '', confirmPin: '' })
const loading = ref(false)
const show = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  if (form.value.newPin !== form.value.confirmPin) {
    errorMsg.value = 'PIN ทั้งสองช่องไม่ตรงกัน'
    return
  }
  if (form.value.newPin.length < 4) {
    errorMsg.value = 'PIN ต้องมีอย่างน้อย 4 ตัวอักษร'
    return
  }
  loading.value = true
  try {
    const { data, error } = await supabase.rpc('set_student_pin', {
      p_school_id:   session.value.school_id,
      p_student_code: session.value.student_code,
      p_gov_id:      form.value.govId.trim(),
      p_new_pin:     form.value.newPin,
    })
    if (error) throw error
    if (!data) {
      errorMsg.value = 'เลขบัตรประชาชนไม่ถูกต้อง'
      return
    }
    // อัปเดต session flag
    studentStore.refreshScores({ has_set_pin: true })
    successMsg.value = 'ตั้ง PIN สำเร็จ!'
    form.value = { govId: '', newPin: '', confirmPin: '' }
    setTimeout(() => router.push('/student/dashboard'), 1500)
  } catch (e) {
    errorMsg.value = 'เกิดข้อผิดพลาด: ' + (e.message || e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 6px; }
.page-sub { font-size: 13px; color: #6b7280; margin: 0 0 20px; line-height: 1.6; }
.section-card {
  background: white; border-radius: 16px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
}
.field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-label { font-size: 14px; font-weight: 600; color: #374151; }
.field-input {
  padding: 12px 14px; border: 1.5px solid #d1d5db; border-radius: 10px;
  font-size: 15px; font-family: inherit; outline: none; width: 100%; box-sizing: border-box;
}
.field-input:focus { border-color: #6366f1; }
.input-wrap { position: relative; }
.input-wrap .field-input { padding-right: 44px; }
.toggle-vis {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px;
}
.error-msg {
  background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5;
  border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px;
}
.success-msg {
  background: #dcfce7; color: #166534; border: 1px solid #86efac;
  border-radius: 8px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px;
}
.submit-btn {
  width: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white; border: none; border-radius: 12px; padding: 14px;
  font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit;
  transition: opacity .2s; margin-bottom: 14px;
}
.submit-btn:disabled { opacity: .6; cursor: not-allowed; }
.back-link {
  display: block; text-align: center; color: #6366f1; font-size: 14px;
  text-decoration: none; font-weight: 600;
}
</style>
