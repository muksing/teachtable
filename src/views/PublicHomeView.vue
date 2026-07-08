<template>
  <div class="lp-root">
    <div class="lp-aurora lp-aurora-a" />
    <div class="lp-aurora lp-aurora-b" />
    <div class="lp-mesh" />

    <div class="lp-card">

      <!-- Brand -->
      <div class="lp-brand">
        <div class="lp-brand-icon">🏫</div>
        <div>
          <div class="lp-brand-name">TeachTable</div>
          <div class="lp-brand-sub">ระบบบริหารจัดการโรงเรียน</div>
        </div>
      </div>

      <!-- Role tabs — 3 ปุ่ม -->
      <div class="lp-tabs">
        <button class="lp-tab" :class="{ 'lp-tab-active': role === 'teacher' }" @click="switchRole('teacher')">
          <span class="lp-tab-icon">👨‍🏫</span>
          <span>ครู / บุคลากร</span>
        </button>
        <button class="lp-tab" :class="{ 'lp-tab-active': role === 'student' }" @click="switchRole('student')">
          <span class="lp-tab-icon">🎓</span>
          <span>นักเรียน</span>
        </button>
        <button class="lp-tab" :class="{ 'lp-tab-active': role === 'parent' }" @click="switchRole('parent')">
          <span class="lp-tab-icon">👨‍👩‍👧</span>
          <span>ผู้ปกครอง</span>
        </button>
      </div>

      <!-- ── Teacher login ─────────────────────────────── -->
      <div v-if="role === 'teacher'" class="lp-form">
        <el-form ref="teacherFormRef" :model="tf" :rules="teacherRules" @submit.prevent="doTeacherLogin">
          <el-form-item prop="email">
            <el-input v-model="tf.email" type="email" placeholder="อีเมล" size="large" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="tf.password"
              type="password"
              placeholder="รหัสผ่าน"
              size="large"
              show-password
              @keyup.enter="doTeacherLogin"
            />
          </el-form-item>
          <el-alert v-if="teacherError" :title="teacherError" type="error" show-icon :closable="false" class="lp-alert" />
          <el-button type="primary" size="large" class="lp-btn lp-btn-teacher" :loading="teacherLoading" @click="doTeacherLogin">
            {{ teacherLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
          </el-button>
        </el-form>

        <div class="lp-divider"><span>หรือ</span></div>

        <button class="lp-google-btn" :disabled="googleLoading" @click="doGoogleLogin">
          <svg v-if="!googleLoading" class="lp-g-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <svg v-else class="lp-g-icon lp-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#dadce0" stroke-width="3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <span>{{ googleLoading ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google' }}</span>
        </button>
        <el-alert v-if="googleError" :title="googleError" type="error" show-icon :closable="false" class="lp-alert" />
      </div>

      <!-- ── Student login ─────────────────────────────── -->
      <div v-else-if="role === 'student'" class="lp-form">
        <p class="lp-hint-text">
          ใช้อีเมลของนักเรียนที่ลงทะเบียนไว้<br>
          และเลขบัตรประชาชน (หรือ PIN ที่ตั้งไว้)
        </p>

        <el-form ref="studentFormRef" :model="sf" :rules="studentRules" @submit.prevent="doStudentLogin">
          <el-form-item prop="email">
            <el-input v-model="sf.email" type="email" placeholder="อีเมลนักเรียน" size="large" />
          </el-form-item>
          <el-form-item prop="credential">
            <el-input
              v-model="sf.credential"
              type="password"
              placeholder="เลขบัตรประชาชน หรือ PIN"
              size="large"
              show-password
              @keyup.enter="doStudentLogin"
            />
          </el-form-item>
          <el-alert v-if="studentError" :title="studentError" type="error" show-icon :closable="false" class="lp-alert" />
          <el-button type="primary" size="large" class="lp-btn lp-btn-student" :loading="studentLoading" @click="doStudentLogin">
            {{ studentLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ' }}
          </el-button>
        </el-form>

        <p class="lp-sub-note">
          ยังไม่มีอีเมล?
          <a class="lp-link" @click="$router.push('/student/login')">ใช้รหัสนักเรียน + รหัสโรงเรียน</a>
        </p>
      </div>

      <!-- ── Parent login ──────────────────────────────── -->
      <div v-else-if="role === 'parent'" class="lp-form">
        <p class="lp-hint-text">
          ใช้เบอร์โทรศัพท์ที่ลงทะเบียนไว้<br>
          และเลขบัตรประชาชน 6 ตัวท้ายของผู้ปกครอง
        </p>

        <el-form ref="parentFormRef" :model="pf" :rules="parentRules" @submit.prevent="doParentLogin">
          <el-form-item prop="phone">
            <el-input
              v-model="pf.phone"
              type="tel"
              inputmode="numeric"
              placeholder="เบอร์โทรศัพท์ (0xx-xxx-xxxx)"
              size="large"
              maxlength="10"
            />
          </el-form-item>
          <el-form-item prop="idLast6">
            <el-input
              v-model="pf.idLast6"
              type="password"
              inputmode="numeric"
              placeholder="เลขบัตรประชาชน 6 ตัวท้าย"
              size="large"
              show-password
              maxlength="6"
              @keyup.enter="doParentLogin"
            />
          </el-form-item>
          <el-alert v-if="parentError" :title="parentError" type="error" show-icon :closable="false" class="lp-alert" />
          <el-button type="primary" size="large" class="lp-btn lp-btn-parent" :loading="parentLoading" @click="doParentLogin">
            {{ parentLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ' }}
          </el-button>
        </el-form>

        <p class="lp-sub-note">หากเข้าไม่ได้ กรุณาติดต่อโรงเรียนเพื่ออัปเดตข้อมูล</p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMasterAuth } from '@/composables/useMasterAuth'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { useParentStore } from '@/stores/parent'

const router       = useRouter()
const authStore    = useAuthStore()
const studentStore = useStudentStore()
const parentStore  = useParentStore()
const { login, loading: teacherLoading, error: teacherError,
        loginWithGoogle, googleLoading, googleError } = useMasterAuth()

// ── Role toggle ──────────────────────────────────────────
const role = ref('teacher')
function switchRole(r) {
  role.value = r
  tf.email = ''; tf.password = ''
  sf.email = ''; sf.credential = ''
  pf.phone = ''; pf.idLast6 = ''
  teacherError.value = ''; studentError.value = ''; parentError.value = ''
}

// ── Teacher ──────────────────────────────────────────────
const teacherFormRef = ref()
const tf = reactive({ email: '', password: '' })
const teacherRules = {
  email:    [{ required: true, type: 'email', message: 'กรุณากรอกอีเมลให้ถูกต้อง', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: 'รหัสผ่านอย่างน้อย 6 ตัวอักษร', trigger: 'blur' }],
}

async function doTeacherLogin() {
  const ok = await teacherFormRef.value?.validate().catch(() => false)
  if (!ok) return
  const result = await login(tf.email, tf.password)
  if (result?.success) {
    const redirect = router.currentRoute.value.query.redirect
    router.push(typeof redirect === 'string' ? redirect
      : authStore.isSuperAdmin ? '/superadmin/dashboard' : '/dashboard')
  }
}

async function doGoogleLogin() { await loginWithGoogle() }

// ── Student ──────────────────────────────────────────────
const studentFormRef = ref()
const sf             = reactive({ email: '', credential: '' })
const studentLoading = ref(false)
const studentError   = ref('')
const studentRules = {
  email:      [{ required: true, type: 'email', message: 'กรุณากรอกอีเมลให้ถูกต้อง', trigger: 'blur' }],
  credential: [{ required: true, message: 'กรุณากรอกเลขบัตรประชาชน หรือ PIN', trigger: 'blur' }],
}

async function doStudentLogin() {
  const ok = await studentFormRef.value?.validate().catch(() => false)
  if (!ok) return
  studentError.value = ''; studentLoading.value = true
  try {
    const success = await studentStore.loginByEmail(sf.email, sf.credential)
    if (success) router.push('/student/dashboard')
    else studentError.value = 'ไม่พบข้อมูลนักเรียน — กรุณาตรวจสอบอีเมลและรหัสที่กรอก'
  } catch (e) {
    studentError.value = e.message || 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    studentLoading.value = false
  }
}

// ── Parent ───────────────────────────────────────────────
const parentFormRef = ref()
const pf            = reactive({ phone: '', idLast6: '' })
const parentLoading = ref(false)
const parentError   = ref('')
const parentRules = {
  phone:   [
    { required: true, message: 'กรุณากรอกเบอร์โทรศัพท์', trigger: 'blur' },
    { pattern: /^[0-9]{9,10}$/, message: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก', trigger: 'blur' },
  ],
  idLast6: [
    { required: true, message: 'กรุณากรอกเลขบัตร 6 ตัวท้าย', trigger: 'blur' },
    { len: 6, message: 'ต้องเป็นตัวเลข 6 หลักพอดี', trigger: 'blur' },
  ],
}

async function doParentLogin() {
  const ok = await parentFormRef.value?.validate().catch(() => false)
  if (!ok) return
  parentError.value = ''; parentLoading.value = true
  try {
    await parentStore.login(pf.phone, pf.idLast6)
    router.push('/parent/home')
  } catch (e) {
    parentError.value = e.message || 'ไม่พบข้อมูล — กรุณาตรวจสอบเบอร์โทรและเลขบัตรประชาชน'
  } finally {
    parentLoading.value = false
  }
}

// ── Already logged in ────────────────────────────────────
onMounted(() => {
  if (authStore.isLoggedIn) {
    router.replace(authStore.isSuperAdmin ? '/superadmin/dashboard' : '/dashboard')
  } else if (studentStore.isLoggedIn) {
    router.replace('/student/dashboard')
  } else if (parentStore.isLoggedIn) {
    router.replace('/parent/home')
  }
})
</script>

<style scoped>
.lp-root {
  min-height: 100dvh;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 18% 20%, #67e8f9 0%, transparent 35%),
    radial-gradient(circle at 80% 14%, #38bdf8 0%, transparent 32%),
    linear-gradient(145deg, #0e7490, #155e75 52%, #0f172a);
  position: relative; overflow: hidden; padding: 24px 16px;
}
.lp-mesh {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(circle at center, black 38%, transparent 100%);
  opacity: 0.22;
}
.lp-aurora { position:absolute; border-radius:999px; filter:blur(56px); opacity:0.45; pointer-events:none; }
.lp-aurora-a { width:360px; height:360px; left:-100px; bottom:-90px; background:#f97316; }
.lp-aurora-b { width:280px; height:280px; right:-84px; top:-58px;  background:#22d3ee; }

/* Card */
.lp-card {
  position:relative; z-index:2;
  width:100%; max-width:420px;
  background: linear-gradient(180deg, rgba(255,255,255,0.97), rgba(241,245,249,0.98));
  border-radius:22px; padding:28px 28px 32px;
  border:1px solid rgba(255,255,255,0.3);
  box-shadow:0 24px 48px rgba(15,23,42,0.28);
}

/* Brand */
.lp-brand { display:flex; align-items:center; gap:12px; margin-bottom:22px; }
.lp-brand-icon {
  width:48px; height:48px; border-radius:13px; flex-shrink:0;
  background:linear-gradient(145deg,#0284c7,#0ea5e9);
  display:flex; align-items:center; justify-content:center; font-size:24px;
}
.lp-brand-name { font-size:20px; font-weight:800; color:#0f172a; }
.lp-brand-sub  { font-size:12px; color:#64748b; margin-top:2px; }

/* Tabs — 3 items */
.lp-tabs {
  display:flex; gap:6px; margin-bottom:20px;
  background:#f1f5f9; border-radius:14px; padding:5px;
}
.lp-tab {
  flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
  padding:9px 4px; border-radius:10px; border:none; cursor:pointer;
  font-size:12px; font-weight:600; color:#64748b; background:transparent;
  font-family:inherit; transition:all 0.15s; white-space:nowrap;
}
.lp-tab-active { background:#fff; color:#0f172a; box-shadow:0 2px 8px rgba(0,0,0,0.10); }
.lp-tab-icon { font-size:20px; line-height:1; }

/* Form */
.lp-form { display:flex; flex-direction:column; gap:0; }
.lp-alert { margin-bottom:12px; }

/* Buttons */
.lp-btn { width:100%; border:none; font-size:15px; font-weight:700; margin-top:4px; }
.lp-btn-teacher { background:linear-gradient(135deg,#0ea5e9,#2563eb); }
.lp-btn-student { background:linear-gradient(135deg,#7c3aed,#6366f1); }
.lp-btn-parent  { background:linear-gradient(135deg,#16a34a,#15803d); }

/* Divider */
.lp-divider {
  display:flex; align-items:center; gap:10px;
  margin:14px 0 12px; color:#94a3b8; font-size:13px;
}
.lp-divider::before,.lp-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }

/* Google */
.lp-google-btn {
  width:100%; display:flex; align-items:center; justify-content:center; gap:10px;
  padding:11px 16px; border-radius:10px;
  border:1.5px solid #dadce0; background:#fff; cursor:pointer;
  font-size:14px; font-weight:600; color:#3c4043; font-family:inherit;
  transition:box-shadow .15s, background .15s;
}
.lp-google-btn:hover:not(:disabled) { background:#f8f9fa; box-shadow:0 2px 8px rgba(0,0,0,.12); }
.lp-google-btn:disabled { opacity:.65; cursor:not-allowed; }
.lp-g-icon { width:20px; height:20px; flex-shrink:0; }
.lp-spin { animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* Hints */
.lp-hint-text {
  font-size:13px; color:#64748b; margin:0 0 12px;
  line-height:1.6; text-align:center;
}
.lp-sub-note { margin:14px 0 0; font-size:13px; color:#94a3b8; text-align:center; }
.lp-link { color:#6366f1; font-weight:600; cursor:pointer; text-decoration:underline; }
</style>
