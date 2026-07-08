    <div class="register-glow register-glow-a" />
    <div class="register-glow register-glow-b" />

    <div class="register-container">
      <div class="register-topbar">
        <el-button class="btn-back" @click="goHome"> กลับหน้าแรก</el-button>
      </div>

      <el-card class="register-card">
        <template #header>
          <div class="card-header">
            <h2>สมัครสมาชิกโรงเรียน</h2>
            <p>กรอกข้อมูลเพียงครั้งเดียว แล้วรอ SuperAdmin อนุมัติผ่านอีเมล</p>
          </div>
        </template>

        <el-form
          ref="registrationFormRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <div class="section-card section-school">
            <h3> ข้อมูลโรงเรียน</h3>
            <div class="grid-two">
              <el-form-item label="ชื่อโรงเรียน" prop="schoolName">
                <el-input v-model="form.schoolName" placeholder="กรอกชื่อโรงเรียน" />
              </el-form-item>

              <el-form-item label="อีเมลโรงเรียน" prop="schoolEmail">
                <el-input v-model="form.schoolEmail" placeholder="school@example.ac.th" />
              </el-form-item>

              <el-form-item label="เบอร์โทรโรงเรียน" prop="schoolPhone">
                <el-input v-model="form.schoolPhone" placeholder="02-xxx-xxxx" />
              </el-form-item>

              <el-form-item label="ที่อยู่โรงเรียน" prop="schoolAddress" class="full-row">
                <el-input
                  v-model="form.schoolAddress"
                  type="textarea"
                  :rows="3"
                  placeholder="กรอกที่อยู่โรงเรียน"
                />
              </el-form-item>
            </div>
          </div>

          <div class="section-card section-contact">
            <h3> ข้อมูลผู้ประสานงาน</h3>
            <div class="grid-two">
              <el-form-item label="ชื่อผู้ติดต่อ" prop="contactName">
                <el-input v-model="form.contactName" placeholder="ชื่อ-นามสกุลผู้ติดต่อ" />
              </el-form-item>

              <el-form-item label="เบอร์โทรผู้ติดต่อ" prop="contactPhone">
                <el-input v-model="form.contactPhone" placeholder="08x-xxx-xxxx" />
              </el-form-item>

              <el-form-item label="อีเมลผู้ติดต่อ" prop="contactEmail" class="full-row">
                <el-input v-model="form.contactEmail" placeholder="contact@example.com" />
              </el-form-item>
            </div>
          </div>

          <div class="section-card section-admin">
            <h3> บัญชีผู้ดูแลโรงเรียน</h3>
            <p class="section-note">บัญชีนี้จะใช้เป็นบัญชีแรกสำหรับเข้าสู่ระบบของโรงเรียน</p>
            <div class="grid-two">
              <el-form-item label="อีเมลผู้ดูแล" prop="adminEmail" class="full-row">
                <el-input v-model="form.adminEmail" placeholder="admin@school.ac.th" />
              </el-form-item>

              <el-form-item label="รหัสผ่านเริ่มต้น" prop="adminPassword">
                <el-input
                  v-model="form.adminPassword"
                  type="password"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  show-password
                />
              </el-form-item>

              <el-form-item label="ยืนยันรหัสผ่าน" prop="confirmPassword">
                <el-input
                  v-model="form.confirmPassword"
                  type="password"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  show-password
                />
              </el-form-item>
            </div>
          </div>

          <div class="section-card section-terms">
            <el-form-item prop="acceptTerms" class="mb-0">
              <el-checkbox v-model="form.acceptTerms">
                ฉันยอมรับ
                <el-link type="primary" @click="showTerms">เงื่อนไขการใช้งาน</el-link>
                และ
                <el-link type="primary" @click="showPrivacy">นโยบายความเป็นส่วนตัว</el-link>
              </el-checkbox>
            </el-form-item>
          </div>

          <div class="action-bar">
            <el-button size="large" @click="resetForm">ล้างข้อมูล</el-button>
            <el-button
              type="primary"
              size="large"
              class="btn-submit"
              :loading="submitting"
              @click="handleSubmit"
            >
              {{ submitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอสมัครสมาชิก' }}
            </el-button>
          </div>
        </el-form>
      </el-card>
    </div>

    <el-dialog v-model="termsDialogVisible" title="เงื่อนไขการใช้งาน" width="600px">
      <div class="policy-content">
        <h4>1. การใช้งานระบบ</h4>
        <p>ระบบนี้สำหรับการจัดตารางสอนและบริหารข้อมูลภายในสถานศึกษาเท่านั้น</p>
        <h4>2. ความปลอดภัยบัญชี</h4>
        <p>ผู้ใช้งานต้องรักษาข้อมูลบัญชีและรหัสผ่านของตนเองอย่างเหมาะสม</p>
        <h4>3. การคุ้มครองข้อมูล</h4>
        <p>ข้อมูลของโรงเรียนจะถูกใช้เพื่อการให้บริการระบบเท่านั้น</p>
      </div>
    </el-dialog>

    <el-dialog v-model="privacyDialogVisible" title="นโยบายความเป็นส่วนตัว" width="600px">
      <div class="policy-content">
        <h4>1. ข้อมูลที่เก็บ</h4>
        <p>เก็บข้อมูลที่จำเป็นต่อการสร้างบัญชีและการให้บริการของระบบ</p>
        <h4>2. การใช้ข้อมูล</h4>
        <p>ใช้เพื่อการจัดการระบบ แจ้งผลการอนุมัติ และการสนับสนุนผู้ใช้งาน</p>
        <h4>3. ระยะเวลาการเก็บข้อมูล</h4>
        <p>ข้อมูลจะถูกเก็บตราบเท่าที่บัญชีโรงเรียนยังคงใช้งานอยู่</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { supabase } from '@/supabase/client'
import { SCHOOL_REQUEST_STATUS } from '@/supabase/schema'

const router = useRouter()
const registrationFormRef = ref()
const submitting = ref(false)
const termsDialogVisible = ref(false)
const privacyDialogVisible = ref(false)

const form = reactive({
  schoolName: '',
  schoolAddress: '',
  schoolPhone: '',
  schoolEmail: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  adminEmail: '',
  adminPassword: '',
  confirmPassword: '',
  acceptTerms: false
})

const rules = {
  schoolName: [{ required: true, message: 'กรุณากรอกชื่อโรงเรียน', trigger: 'blur' }],
  schoolAddress: [{ required: true, message: 'กรุณากรอกที่อยู่โรงเรียน', trigger: 'blur' }],
  schoolPhone: [
    { required: true, message: 'กรุณากรอกเบอร์โทรโรงเรียน', trigger: 'blur' },
    { pattern: /^[\d\s\-\+\(\)]+$/, message: 'รูปแบบเบอร์โทรไม่ถูกต้อง', trigger: 'blur' }
  ],
  schoolEmail: [
    { required: true, message: 'กรุณากรอกอีเมลโรงเรียน', trigger: 'blur' },
    { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง', trigger: 'blur' }
  ],
  contactName: [{ required: true, message: 'กรุณากรอกชื่อผู้ติดต่อ', trigger: 'blur' }],
  contactPhone: [{ required: true, message: 'กรุณากรอกเบอร์โทรผู้ติดต่อ', trigger: 'blur' }],
  contactEmail: [
    { required: true, message: 'กรุณากรอกอีเมลผู้ติดต่อ', trigger: 'blur' },
    { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง', trigger: 'blur' }
  ],
  adminEmail: [
    { required: true, message: 'กรุณากรอกอีเมลผู้ดูแล', trigger: 'blur' },
    { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง', trigger: 'blur' }
  ],
  adminPassword: [
    { required: true, message: 'กรุณากรอกรหัสผ่าน', trigger: 'blur' },
    { min: 6, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: 'กรุณายืนยันรหัสผ่าน', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.adminPassword) callback(new Error('รหัสผ่านไม่ตรงกัน'))
        else callback()
      },
      trigger: 'blur'
    }
  ],
  acceptTerms: [{ required: true, message: 'กรุณายอมรับเงื่อนไขการใช้งาน', trigger: 'change' }]
}

function goHome() {
  router.push('/')
}

async function handleSubmit() {
  if (!registrationFormRef.value) return
  const valid = await registrationFormRef.value.validate()
  if (!valid) return

  submitting.value = true
  try {
    const approvalToken = crypto.randomUUID()

    const now = new Date().toISOString()
    const { error } = await supabase.from('school_requests').insert([{
      schoolName: form.schoolName,
      schoolAddress: form.schoolAddress,
      schoolPhone: form.schoolPhone,
      schoolEmail: form.schoolEmail,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
      adminEmail: form.adminEmail,
      adminPassword: form.adminPassword,
      status: SCHOOL_REQUEST_STATUS.PENDING,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: '',
      schoolId: null,
      approvedAt: null,
      approvalToken,
      tokenCreatedAt: now,
      superAdminNotifiedAt: null
    }])
    if (error) throw error

    ElMessage.success('ขอบคุณสำหรับการสมัครสมาชิก และรอ SuperAdmin อนุมัติ ให้ตรวจสอบอีเมล')
    resetForm()
    setTimeout(() => router.push('/'), 1400)
  } catch (error) {
    console.error('Error submitting registration:', error)
    ElMessage.error('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  registrationFormRef.value?.resetFields()
  Object.keys(form).forEach(key => {
    if (typeof form[key] === 'string') form[key] = ''
    if (typeof form[key] === 'boolean') form[key] = false
  })
}

function showTerms() {
  termsDialogVisible.value = true
}

function showPrivacy() {
  privacyDialogVisible.value = true
}
</script>

<style scoped>
.register-page {
  min-height: 100dvh;
  padding: 28px 14px 40px;
  background: radial-gradient(circle at 16% 18%, #6ee7b7 0%, transparent 36%),
    radial-gradient(circle at 82% 14%, #93c5fd 0%, transparent 34%),
    linear-gradient(135deg, #0b3b63 0%, #135d66 48%, #1f2937 100%);
  position: relative;
  overflow: hidden;
}

.register-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(64px);
  opacity: 0.35;
  pointer-events: none;
}

.register-glow-a {
  width: 320px;
  height: 320px;
  left: -120px;
  bottom: -120px;
  background: #f59e0b;
}

.register-glow-b {
  width: 260px;
  height: 260px;
  right: -80px;
  top: -60px;
  background: #22d3ee;
}

.register-container {
  max-width: 960px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}

.register-topbar {
  margin-bottom: 12px;
}

.btn-back {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.register-card {
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.3);
  overflow: hidden;
}

.card-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 30px;
  font-weight: 800;
}

.card-header p {
  margin: 6px 0 0;
  color: #475569;
  font-size: 14px;
}

.section-card {
  margin-bottom: 16px;
  border-radius: 14px;
  border: 1px solid #dbeafe;
  padding: 16px;
}

.section-card h3 {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 700;
}

.section-note {
  margin: -2px 0 12px;
  color: #64748b;
  font-size: 13px;
}

.section-school {
  background: linear-gradient(180deg, #f0f9ff, #e0f2fe);
}

.section-contact {
  background: linear-gradient(180deg, #f0fdf4, #dcfce7);
}

.section-admin {
  background: linear-gradient(180deg, #fdf4ff, #fae8ff);
}

.section-terms {
  background: #f8fafc;
}

.grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.full-row {
  grid-column: 1 / -1;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.btn-submit {
  min-width: 230px;
  border: none;
  background: linear-gradient(135deg, #0ea5e9, #2563eb);
}

.policy-content h4 {
  margin: 12px 0 6px;
  color: #0f172a;
}

.policy-content p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

:deep(.el-card__body) {
  padding: 20px;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
}

@media (max-width: 860px) {
  .card-header h2 {
    font-size: 26px;
  }

  .grid-two {
    grid-template-columns: 1fr;
  }

  .action-bar {
    flex-direction: column-reverse;
  }

  .btn-submit {
    width: 100%;
  }
}
</style>
