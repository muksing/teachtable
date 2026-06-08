<template>
  <div class="renewal-page">
    <div class="hero-card">
      <div>
        <p class="hero-kicker">School Package Management</p>
        <h1>ต่ออายุแพ็คเกจ</h1>
        <p class="hero-desc">คำนวณและขอต่ออายุแผนการใช้งาน พร้อมแนบสลิปการโอน</p>
      </div>
    </div>

    <!-- Current Plan Info -->
    <el-card class="section-card info-card">
      <template #header>
        <div class="section-title">🎯 แผนปัจจุบัน</div>
      </template>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">รหัสแผน</span>
          <strong>{{ currentPlan?.code || '-' }}</strong>
        </div>
        <div class="info-item">
          <span class="label">ราคารายเดือน</span>
          <strong>{{ currency(currentPlan?.monthlyFee) }}</strong>
        </div>
        <div class="info-item">
          <span class="label">หมดอายุ</span>
          <strong>{{ formatDate(currentPlan?.expiresAt) }}</strong>
        </div>
        <div class="info-item">
          <span class="label">จำนวนวัน</span>
          <strong :style="{ color: daysLeft < 30 ? '#ef4444' : '#10b981' }">
            {{ daysLeft }} วัน
          </strong>
        </div>
      </div>
    </el-card>

    <!-- Renewal Parameters Form -->
    <el-card class="section-card form-card">
      <template #header>
        <div class="section-title">📊 ตั้งค่าคำนวณต่ออายุ</div>
      </template>

      <el-form label-position="top" class="renewal-form">
        <!-- Editable Parameters -->
        <div class="form-section">
          <h3>✏️ ค่าที่ปรับแต่งได้</h3>
          <div class="form-grid editable">
            <el-form-item label="ห้องเรียน*" required>
              <el-input-number v-model="formData.rooms" :min="1" :step="1" class="full" />
            </el-form-item>
            <el-form-item label="วัน/สัปดาห์*" required>
              <el-input-number v-model="formData.days" :min="1" :max="7" :step="1" class="full" />
            </el-form-item>
            <el-form-item label="คาบ/วัน*" required>
              <el-input-number v-model="formData.periods" :min="1" :max="20" :step="1" class="full" />
            </el-form-item>
            <el-form-item label="จำนวนครู*" required>
              <el-input-number v-model="formData.teachers" :min="1" :step="1" class="full" />
            </el-form-item>
            <el-form-item label="คนจัดพร้อมกัน (5-10)*" required>
              <el-input-number 
                v-model="formData.concurrent" 
                :min="5" 
                :max="10" 
                :step="1" 
                class="full" 
              />
            </el-form-item>
            <el-form-item label="ระยะเวลา (เดือน)*" required>
              <el-select v-model="formData.months" class="full-select">
                <el-option :value="1" label="1 เดือน" />
                <el-option :value="3" label="3 เดือน" />
                <el-option :value="6" label="6 เดือน" />
                <el-option :value="12" label="12 เดือน" />
              </el-select>
            </el-form-item>
          </div>
        </div>

        <!-- Fixed Parameters (Read-only) -->
        <div class="form-section">
          <h3>🔒 ค่าคงที่ (ไม่สามารถแก้ไข)</h3>
          <div class="form-grid readonly">
            <div class="readonly-field">
              <span class="label">จัดพร้อมกันอัตโนมัติ</span>
              <strong>5 ครั้ง/เดือน</strong>
            </div>
            <div class="readonly-field">
              <span class="label">ล้างตารางใหม่</span>
              <strong>5 ครั้ง/เดือน</strong>
            </div>
          </div>
        </div>
      </el-form>
    </el-card>

    <!-- Calculation Result -->
    <el-card class="section-card result-card" v-if="calculationResult">
      <template #header>
        <div class="section-title">💰 ผลการคำนวณ</div>
      </template>

      <div class="metrics-grid">
        <div class="metric-item reads">
          <span>Reads</span>
          <strong>{{ number(calculationResult.details.readTotal) }}</strong>
        </div>
        <div class="metric-item writes">
          <span>Writes</span>
          <strong>{{ number(calculationResult.details.writeTotal) }}</strong>
        </div>
        <div class="metric-item deletes">
          <span>Deletes</span>
          <strong>{{ number(calculationResult.details.deleteTotal) }}</strong>
        </div>
        <div class="metric-item blaze">
          <span>Blaze / เดือน</span>
          <strong>{{ currency(calculationResult.details.blazeCost) }}</strong>
        </div>
        <div class="metric-item monthly">
          <span>ราคา / เดือน</span>
          <strong>{{ currency(calculationResult.monthlyPrice) }}</strong>
        </div>
        <div class="metric-item total">
          <span>ยอดรวม {{ formData.months }} เดือน</span>
          <strong>{{ currency(calculationResult.totalPrice) }}</strong>
        </div>
      </div>

      <div class="summary-bar">
        <el-tag effect="dark" type="success">ส่วนลด {{ calculationResult.discountPercent }}%</el-tag>
        <span>ประหยัด {{ currency(calculationResult.discount) }}</span>
      </div>
    </el-card>

    <!-- Payment Evidence -->
    <el-card class="section-card payment-card">
      <template #header>
        <div class="section-title">📄 หลักฐานการโอนเงิน</div>
      </template>

      <el-form label-position="top">
        <el-form-item label="วันที่โอน*" required>
          <el-date-picker 
            v-model="formData.transferDate" 
            type="date" 
            :disabled-date="disabledDate"
            class="full"
          />
        </el-form-item>
        <el-form-item label="จำนวนเงินที่โอน (บาท)*" required>
          <el-input-number 
            v-model="formData.paymentAmount" 
            :min="0" 
            :step="100" 
            class="full" 
          />
        </el-form-item>
        <el-form-item label="แนบสลิปการโอน (ไฟล์รูป)*" required>
          <el-upload
            v-model:file-list="slipFileList"
            action="#"
            :auto-upload="false"
            :limit="1"
            accept=".jpg,.jpeg,.png,.pdf"
            :on-change="handleSlipUpload"
            drag
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              กดที่นี่หรือลากไฟล์ (JPG, PNG, PDF)
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item label="หมายเหตุเพิ่มเติม">
          <el-input 
            v-model="formData.notes" 
            type="textarea" 
            rows="3" 
            placeholder="เช่น บัญชีธนาคารใคร, เวลาโอน, ฯลฯ"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Renewal Type Selection -->
    <el-card class="section-card type-card">
      <template #header>
        <div class="section-title">🔄 ประเภทการต่ออายุ</div>
      </template>

      <el-radio-group v-model="formData.renewalType" class="renewal-type-group">
        <el-radio value="manual" size="large">
          <div class="radio-content">
            <span class="radio-title">ต่ออายุแบบตั้งค่าเอง</span>
            <span class="radio-desc">ใช้ค่าที่ calc ด้านบน โดย SuperAdmin ต้องยืนยัน</span>
          </div>
        </el-radio>
        <el-radio value="auto" size="large" disabled>
          <div class="radio-content">
            <span class="radio-title">ต่ออายุแบบอัตโนมัติ</span>
            <span class="radio-desc">ถ้าครบเงินตามคำนวณ จะต่อปีน้อยโดยไม่ต้องขออนุญาต</span>
          </div>
        </el-radio>
      </el-radio-group>
    </el-card>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <el-button @click="resetForm" :disabled="submitting">ยกเลิก</el-button>
      <el-button 
        type="primary" 
        size="large" 
        :loading="submitting"
        @click="submitRenewalRequest"
        :disabled="!isFormValid"
      >
        📨 ส่งคำขอต่ออายุ
      </el-button>
    </div>

    <!-- Success Message -->
    <el-dialog v-model="showSuccess" title="✅ สำเร็จ" width="500px" center>
      <div class="success-content">
        <el-icon class="success-icon"><circle-check-filled /></el-icon>
        <p>ส่งคำขอต่ออายุเรียบร้อยแล้ว</p>
        <p class="subtitle">คำขอของท่านอยู่ระหว่างการตรวจสอบ SuperAdmin จะติดต่อกลับในเร็วๆ นี้</p>
        <p class="request-id">รหัสคำขอ: {{ lastRequestId }}</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="showSuccess = false; resetForm()">ปิด</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { usePackageRenewal } from '@/composables/usePackageRenewal'
import { UploadFilled, CircleCheckFilled } from '@element-plus/icons-vue'

const schoolStore = useSchoolStore()
const authStore = useAuthStore()
const { getActivePricingFormula, calculateRenewalPrice, createRenewalRequest } = usePackageRenewal()

const formData = reactive({
  rooms: 12,
  days: 5,
  periods: 8,
  teachers: 15,
  concurrent: 5,
  months: 12,
  transferDate: null,
  paymentAmount: 0,
  notes: '',
  renewalType: 'manual',
})

const slipFileList = ref([])
const pricingFormula = ref({})
const calculationResult = ref(null)
const submitting = ref(false)
const showSuccess = ref(false)
const lastRequestId = ref('')

const currentPlan = computed(() => schoolStore.pricingPlan)

const daysLeft = computed(() => {
  if (!currentPlan.value?.expiresAt) return 0
  const now = new Date()
  const expiry = new Date(currentPlan.value.expiresAt)
  const diff = expiry.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const isFormValid = computed(() => {
  return (
    formData.rooms > 0 &&
    formData.days > 0 &&
    formData.periods > 0 &&
    formData.teachers > 0 &&
    formData.concurrent >= 5 &&
    formData.concurrent <= 10 &&
    formData.months > 0 &&
    formData.transferDate &&
    formData.paymentAmount > 0 &&
    slipFileList.value.length > 0
  )
})

function currency(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' บาท'
}

function number(n) {
  return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function formatDate(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function disabledDate(date) {
  // ไม่อนุญาตให้เลือกวันในอดีต
  return date.getTime() < Date.now() - 86400000
}

function handleSlipUpload(file) {
  console.log('Slip file uploaded:', file)
}

async function loadPricingFormula() {
  const result = await getActivePricingFormula()
  pricingFormula.value = result
  calculatePrice()
}

function calculatePrice() {
  if (Object.keys(pricingFormula.value).length > 0) {
    calculationResult.value = calculateRenewalPrice(formData, pricingFormula.value)
  }
}

// Watch for form changes
const calcWatcher = () => {
  calculatePrice()
}

async function submitRenewalRequest() {
  if (!isFormValid.value) {
    ElMessage.warning('กรุณากรอกข้อมูลให้ครบถ้วน')
    return
  }

  submitting.value = true
  try {
    const slipData = slipFileList.value[0]?.raw
    const renewalData = {
      ...formData,
      currentPlan: currentPlan.value?.code,
      newPlan: currentPlan.value?.code, // ต่อแผนเดิม
      monthlyPrice: calculationResult.value?.monthlyPrice,
      totalPrice: calculationResult.value?.totalPrice,
      discountPercent: calculationResult.value?.discountPercent,
      discount: calculationResult.value?.discount,
      slipFile: slipData ? slipData.name : null,
      // Note: ในการผลิตจริง ต้องอัปโหลดไฟล์ไปที่ Firebase Storage ก่อน
    }

    const result = await createRenewalRequest(
      schoolStore.currentSchoolId,
      renewalData,
      authStore.profile?.uid
    )

    if (result.success) {
      lastRequestId.value = result.requestId
      showSuccess.value = true
      ElMessage.success('ส่งคำขอเรียบร้อยแล้ว')
    } else {
      ElMessage.error(result.error || 'ส่งคำขอไมสำเร็จ')
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error('เกิดข้อผิดพลาด: ' + error.message)
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  Object.assign(formData, {
    rooms: 12,
    days: 5,
    periods: 8,
    teachers: 15,
    concurrent: 5,
    months: 12,
    transferDate: null,
    paymentAmount: 0,
    notes: '',
    renewalType: 'manual',
  })
  slipFileList.value = []
  calculationResult.value = null
}

onMounted(() => {
  loadPricingFormula()
})
</script>

<style scoped>
.renewal-page {
  padding: 18px;
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 50%, #fef2f2 100%);
  min-height: 100vh;
}

.hero-card {
  padding: 18px;
  border-radius: 16px;
  margin-bottom: 14px;
  background: linear-gradient(120deg, #06b6d4, #0284c7 55%, #1d4ed8);
  color: #fff;
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.25);
}

.hero-kicker {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  opacity: 0.85;
}

.hero-card h1 {
  margin: 3px 0 5px;
  font-size: 28px;
}

.hero-desc {
  margin: 0;
  opacity: 0.95;
}

.section-card {
  margin-bottom: 12px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
}

.section-title {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}

.info-card {
  background: linear-gradient(180deg, #f0f9ff, #ffffff 35%);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.info-item {
  padding: 12px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #dbeafe;
}

.info-item .label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.info-item strong {
  display: block;
  font-size: 18px;
  color: #0f172a;
}

.form-card {
  background: linear-gradient(180deg, #ecfdf5, #ffffff 35%);
}

.form-grid.readonly {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.readonly-field {
  padding: 12px;
  background: #f1f5f9;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
}

.readonly-field .label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.readonly-field strong {
  display: block;
  font-size: 16px;
  color: #1e293b;
}

.full,
.full-select {
  width: 100%;
}

.result-card {
  background: linear-gradient(180deg, #fff7ed, #ffffff 35%);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.metric-item {
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #dbeafe;
  background: #fff;
  text-align: center;
}

.metric-item span {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.metric-item strong {
  display: block;
  font-size: 18px;
  color: #0f172a;
}

.metric-item.reads {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.metric-item.writes {
  background: #ecfdf5;
  border-color: #86efac;
}

.metric-item.deletes {
  background: #fef2f2;
  border-color: #fecaca;
}

.metric-item.blaze {
  background: #fff7ed;
  border-color: #fdba74;
}

.metric-item.monthly {
  background: #f5f3ff;
  border-color: #c4b5fd;
}

.metric-item.total {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 600;
}

.payment-card {
  background: linear-gradient(180deg, #fce7f3, #ffffff 35%);
}

.type-card {
  background: linear-gradient(180deg, #f0fdfa, #ffffff 35%);
}

.renewal-type-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 8px;
}

.radio-title {
  font-weight: 600;
  color: #0f172a;
}

.radio-desc {
  font-size: 12px;
  color: #64748b;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 24px 0;
}

.success-content {
  text-align: center;
  padding: 20px;
}

.success-icon {
  font-size: 48px;
  color: #10b981;
  margin-bottom: 12px;
}

.success-content p {
  margin: 12px 0;
  font-size: 16px;
  color: #0f172a;
}

.success-content .subtitle {
  font-size: 14px;
  color: #64748b;
}

.request-id {
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
  background: #f1f5f9;
  padding: 8px;
  border-radius: 6px;
  margin-top: 12px;
}

@media (max-width: 1000px) {
  .info-grid,
  .form-grid,
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .radio-content {
    margin-left: 0;
  }
}

@media (max-width: 700px) {
  .renewal-page {
    padding: 12px;
  }

  .hero-card {
    padding: 12px;
  }

  .hero-card h1 {
    font-size: 22px;
  }

  .info-grid,
  .form-grid,
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }
}
</style>
