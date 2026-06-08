<template>
  <div class="public-home">
    <div class="aurora aurora-a" />
    <div class="aurora aurora-b" />
    <div class="mesh" />

    <div class="content-wrap">
      <section class="hero-panel">
        <p class="hero-kicker">TeachTable for Schools</p>
        <h1 class="hero-title">จัดตารางสอนให้ไวขึ้น ลดงานซ้อน และทำงานร่วมกันทั้งทีมในหน้าเดียว</h1>
        <p class="hero-subtitle">
          จากงานที่เคยใช้หลายวัน ให้กลายเป็น workflow ที่ตรวจสอบได้ แก้ไขง่าย
          และพร้อมพิมพ์ใช้งานจริง ทั้งฝ่ายวิชาการ ฝ่ายตาราง และครูผู้สอน
        </p>

        <div class="hero-actions">
          <router-link to="/register-school" class="cta-btn cta-primary">เริ่มสมัครใช้งานโรงเรียน</router-link>
          <router-link to="/pricing-calculator" class="cta-btn cta-ghost">คำนวณแพ็กเกจและยอดชำระ</router-link>
        </div>

        <div class="hero-stats">
          <div class="stat-block">
            <div class="stat-label">การทำงานร่วมกัน</div>
            <div class="stat-value">หลายบทบาท</div>
            <p>แอดมิน / ผู้จัดตาราง / ครู เข้าใช้ตามสิทธิ์</p>
          </div>
          <div class="stat-block">
            <div class="stat-label">ระบบรายงาน</div>
            <div class="stat-value">พร้อมใช้งาน</div>
            <p>พิมพ์ตาราง รายงานการสอน และข้อมูลติดตามได้ทันที</p>
          </div>
          <div class="stat-block">
            <div class="stat-label">โครงสร้างแพ็กเกจ</div>
            <div class="stat-value">ยืดหยุ่น</div>
            <p>เลือกจำนวนผู้จัดตารางและระยะเวลาให้เหมาะกับโรงเรียน</p>
          </div>
        </div>

        <div class="hero-points">
          <div class="point-chip">วางคาบอัตโนมัติและจัดมือได้</div>
          <div class="point-chip">ควบคุมสิทธิ์การแก้ไขรายบทบาท</div>
          <div class="point-chip">แชร์ภาระงานจัดตารางแบบทีม</div>
          <div class="point-chip">อนุมัติ / ล็อกตารางก่อนใช้งานจริง</div>
        </div>

        <div class="hero-note">
          เปลี่ยน “งานหนักช่วงเปิดเทอม” ให้เป็นระบบที่คาดการณ์ได้ และส่งมอบตรงเวลา
        </div>
      </section>

      <section class="auth-panel">
        <div class="auth-head">
          <div class="auth-icon">🔐</div>
          <div>
            <h2>เข้าสู่ระบบ</h2>
            <p>ใช้บัญชีโรงเรียนหรือบัญชีผู้ดูแลระบบเพื่อเริ่มใช้งาน</p>
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

        <div class="register-cta">
          <p>ยังไม่มีโรงเรียนในระบบ?</p>
          <router-link to="/register-school" class="register-link">สมัครสมาชิกโรงเรียน</router-link>
        </div>
      </section>
    </div>

    <section class="sales-sections">
      <article class="sales-card">
        <p class="sales-kicker">ทำไมหลายโรงเรียนเลือกใช้</p>
        <h3>เพราะลดงานซ้ำ และคุมคุณภาพได้จริง</h3>
        <ul>
          <li>เห็นตารางรวมทั้งโรงเรียนในมุมเดียว</li>
          <li>ลดความคลาดเคลื่อนจากการแก้ไฟล์หลายชุด</li>
          <li>ตรวจสอบประวัติการปรับตารางย้อนหลังได้</li>
        </ul>
      </article>

      <article class="sales-card sales-card-accent">
        <p class="sales-kicker">ขั้นตอนเริ่มต้น</p>
        <h3>สมัครง่าย อนุมัติไว เริ่มจัดตารางได้ทันที</h3>
        <ol>
          <li>กรอกข้อมูลโรงเรียนและผู้ติดต่อ</li>
          <li>รออนุมัติจาก SuperAdmin ผ่านอีเมล</li>
          <li>เข้าสู่ระบบและตั้งค่าเทอมแรกได้เลย</li>
        </ol>
      </article>

      <article class="sales-card">
        <p class="sales-kicker">เหมาะกับใคร</p>
        <h3>โรงเรียนที่ต้องการ workflow ชัดเจนและทีมทำงานร่วมกัน</h3>
        <ul>
          <li>โรงเรียนที่มีผู้จัดตารางมากกว่า 1 คน</li>
          <li>โรงเรียนที่ต้องคุมคุณภาพตารางก่อนประกาศ</li>
          <li>โรงเรียนที่ต้องการรายงานเพื่อผู้บริหาร</li>
        </ul>
      </article>
    </section>

    <section class="bottom-cta">
      <h3>พร้อมเริ่มระบบจัดตารางสอนที่ทีมของคุณใช้ร่วมกันได้จริงหรือยัง?</h3>
      <p>สมัครโรงเรียนวันนี้ แล้วเริ่มวางโครงตารางเทอมใหม่ได้ทันที</p>
      <div class="bottom-cta-actions">
        <router-link to="/register-school" class="cta-btn cta-primary">สมัครสมาชิกโรงเรียน</router-link>
        <router-link to="/login" class="cta-btn cta-ghost-dark">เข้าสู่ระบบ</router-link>
      </div>
    </section>
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
.public-home {
  --bg-a: #0e7490;
  --bg-b: #155e75;
  --bg-c: #0f172a;
  --ink-strong: #0f172a;
  --ink-soft: #475569;
  min-height: 100dvh;
  background: radial-gradient(circle at 18% 20%, #67e8f9 0%, transparent 35%),
    radial-gradient(circle at 80% 14%, #38bdf8 0%, transparent 32%),
    linear-gradient(145deg, var(--bg-a), var(--bg-b) 52%, var(--bg-c));
  position: relative;
  overflow: hidden;
  padding: 34px 16px 46px;
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

.content-wrap {
  position: relative;
  z-index: 2;
  max-width: 1160px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
}

.hero-panel,
.auth-panel {
  border-radius: 22px;
  backdrop-filter: blur(7px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.23);
}

.hero-panel {
  padding: 36px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08));
  color: #ffffff;
}

.hero-kicker {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.2);
  padding: 7px 12px;
  border-radius: 999px;
}

.hero-title {
  margin-top: 14px;
  font-size: clamp(28px, 4.5vw, 44px);
  line-height: 1.12;
  font-weight: 800;
}

.hero-subtitle {
  margin-top: 14px;
  max-width: 760px;
  font-size: 17px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.92);
}

.hero-actions {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 12px;
  text-decoration: none;
  font-weight: 700;
  font-size: 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cta-btn:hover {
  transform: translateY(-1px);
}

.cta-primary {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #111827;
  box-shadow: 0 10px 18px rgba(249, 115, 22, 0.35);
}

.cta-ghost {
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.13);
  color: #ffffff;
}

.cta-ghost-dark {
  border: 1px solid #0f766e;
  color: #0f766e;
  background: #ffffff;
}

.hero-stats {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-block {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.12);
}

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
}

.stat-value {
  margin-top: 3px;
  font-size: 20px;
  font-weight: 800;
}

.stat-block p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
}

.hero-points {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.point-chip {
  font-size: 13px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.24);
  padding: 8px 12px;
  border-radius: 999px;
}

.hero-note {
  margin-top: 18px;
  font-weight: 600;
  color: #fde68a;
}

.auth-panel {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(241, 245, 249, 0.98));
  padding: 26px;
}

.auth-head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.auth-head h2 {
  margin: 0;
  font-size: 25px;
  color: var(--ink-strong);
}

.auth-head p {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
}

.auth-icon {
  width: 48px;
  height: 48px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #0284c7, #0ea5e9);
  color: white;
  font-size: 22px;
}

.login-btn {
  border: none;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
}

.register-cta {
  margin-top: 15px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
}

.register-link {
  display: inline-block;
  margin-top: 6px;
  color: #0f766e;
  font-weight: 700;
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}

.sales-sections {
  position: relative;
  z-index: 2;
  max-width: 1160px;
  margin: 22px auto 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.sales-card {
  border-radius: 18px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 28px rgba(2, 6, 23, 0.18);
}

.sales-card-accent {
  background: linear-gradient(145deg, #fef3c7, #ffedd5);
  border-color: rgba(251, 146, 60, 0.4);
}

.sales-kicker {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0e7490;
}

.sales-card h3 {
  margin: 8px 0 10px;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.35;
}

.sales-card ul,
.sales-card ol {
  margin: 0;
  padding-left: 18px;
  color: #334155;
  display: grid;
  gap: 6px;
  line-height: 1.6;
}

.bottom-cta {
  position: relative;
  z-index: 2;
  max-width: 1160px;
  margin: 18px auto 0;
  border-radius: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow: 0 16px 30px rgba(2, 6, 23, 0.16);
}

.bottom-cta h3 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(21px, 2.8vw, 28px);
}

.bottom-cta p {
  margin: 6px 0 0;
  color: #475569;
}

.bottom-cta-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 980px) {
  .content-wrap {
    grid-template-columns: 1fr;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .hero-panel {
    padding: 26px;
  }

  .auth-panel {
    padding: 22px;
  }

  .sales-sections {
    grid-template-columns: 1fr;
    margin-top: 16px;
  }
}
</style>
