<template>
  <AppLayout>
    <div class="renewal-page" v-loading="renewalHistoryLoading && !renewalHistory.length">
      <div class="renewal-header-card">
        <div>
          <h1>ต่ออายุการใช้งาน</h1>
          <p>คำนวณราคาจากสูตร SuperAdmin แล้วส่งคำขอพร้อมสลิปการโอน</p>
        </div>
      </div>

      <el-card class="section-card plan-card" shadow="never">
        <template #header>
          <span class="section-title">แพ็กเกจปัจจุบัน</span>
        </template>
        <div class="info-grid">
          <div class="info-item fee">
            <div class="label">ราคา/เดือน</div>
            <div class="value">{{ currentPlanFeeLabel }}</div>
          </div>
          <div class="info-item limit">
            <div class="label">จัดพร้อมกันสูงสุด</div>
            <div class="value">{{ currentPlanLimitLabel }}</div>
          </div>
          <div class="info-item status" :class="{ expired: schoolStore.isViewOnlyMode }">
            <div class="label">สถานะ/หมดอายุ</div>
            <div class="value">{{ currentPlanStatusLabel }}</div>
          </div>
        </div>
        <el-alert
          v-if="schoolStore.isViewOnlyMode"
          type="error"
          :closable="false"
          show-icon
          class="mt-3"
          title="แพ็กเกจหมดอายุแล้ว"
          description="ระบบอยู่ในโหมดดูอย่างเดียว กรุณาส่งคำขอต่ออายุด้านล่าง"
        />
      </el-card>

      <el-card class="section-card renewal-card" shadow="never">
        <template #header>
          <span class="section-title">ฟอร์มขอต่ออายุสมาชิก</span>
        </template>

        <el-form label-position="top" class="renewal-form">
          <div class="form-grid">
            <el-form-item label="จำนวนเดือน">
              <el-radio-group v-model="renewalForm.months" class="months-radio">
                <el-radio :label="1">1 เดือน</el-radio>
                <el-radio :label="3">3 เดือน</el-radio>
                <el-radio :label="6">6 เดือน</el-radio>
                <el-radio :label="12">12 เดือน</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="โหมดการต่ออายุ">
              <el-radio-group v-model="renewalForm.renewalMode" class="months-radio">
                <el-radio label="manual">ตั้งค่าเอง (ให้ SuperAdmin ตรวจ)</el-radio>
                <el-radio label="auto">อัตโนมัติเมื่อโอนครบ</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>

          <div class="param-card">
            <h3>ค่าที่แก้ไขได้สำหรับคำนวณ</h3>
            <div class="form-grid params">
              <el-form-item label="ห้องเรียน">
                <el-input-number v-model="renewalForm.rooms" :min="1" :step="1" class="full" />
              </el-form-item>
              <el-form-item label="จำนวนครู">
                <el-input-number v-model="renewalForm.teachers" :min="1" :step="1" class="full" />
              </el-form-item>
              <el-form-item label="วันต่อสัปดาห์">
                <el-input-number v-model="renewalForm.days" :min="1" :max="7" :step="1" class="full" />
              </el-form-item>
              <el-form-item label="คาบต่อวัน">
                <el-input-number v-model="renewalForm.periods" :min="1" :max="20" :step="1" class="full" />
              </el-form-item>
              <el-form-item label="จัดพร้อมกัน (5-10 คน)">
                <el-input-number v-model="renewalForm.concurrent" :min="5" :max="10" :step="1" class="full" />
              </el-form-item>
            </div>
          </div>

          <div class="fixed-card">
            <h3>ค่าคงที่จากระบบ (แก้ไม่ได้)</h3>
            <div class="fixed-grid">
              <div class="fixed-item">
                <span>จัดอัตโนมัติ</span>
                <strong>5 ครั้ง</strong>
              </div>
              <div class="fixed-item">
                <span>ล้างตารางใหม่</span>
                <strong>5 ครั้ง</strong>
              </div>
            </div>
          </div>

          <el-alert
            v-if="formulaError"
            type="error"
            :closable="false"
            show-icon
            :title="formulaError"
            description="ระบบจะไม่ใช้ค่า default ในการคำนวณ กรุณาแจ้ง SuperAdmin ให้บันทึกสูตรและตรวจสิทธิ์การอ่านสูตร"
          />

          <div class="metrics-grid" v-loading="formulaLoading">
            <div class="metric reads"><span>Reads</span><strong>{{ number(pricingModel.readTotal) }}</strong></div>
            <div class="metric writes"><span>Writes</span><strong>{{ number(pricingModel.writeTotal) }}</strong></div>
            <div class="metric deletes"><span>Deletes</span><strong>{{ number(pricingModel.deleteTotal) }}</strong></div>
            <div class="metric monthly"><span>ราคาคำนวณ/เดือน</span><strong>{{ currency(pricingModel.monthly) }}</strong></div>
            <div class="metric total"><span>ยอดคำนวณสุทธิ</span><strong>{{ currency(totalModel.total) }}</strong></div>
          </div>

          <div class="summary-bar">
            <el-tag type="success" effect="dark">ส่วนลด {{ discountPercent }}%</el-tag>
            <span>ประหยัด {{ currency(totalModel.discount) }}</span>
          </div>

          <div class="calc-save-wrap">
            <div class="calc-save-note" v-if="savedCalculationAt">บันทึกล่าสุด: {{ formatDateLabel(savedCalculationAt) }}</div>
            <el-button type="success" plain :loading="savingCalculation" :disabled="!formulaReady" @click="saveCalculationSnapshot">
              💾 บันทึกยอดคำนวณไว้ก่อนโอน
            </el-button>
          </div>

          <div class="form-grid payment-grid">
            <el-form-item label="ยอดที่คำนวณได้ (บาท)">
              <el-input :model-value="currency(totalModel.total)" readonly class="full" />
            </el-form-item>
            <el-form-item label="วันที่โอนเงิน">
              <el-date-picker
                v-model="renewalForm.paymentDate"
                type="datetime"
                placeholder="เลือกวันและเวลา"
                format="DD/MM/YYYY HH:mm"
                value-format="YYYY-MM-DDTHH:mm:ss"
                class="full"
              />
            </el-form-item>
          </div>

          <el-form-item label="หลักฐานโอนเงิน" required>
            <div class="renewal-proof-box">
              <div class="proof-actions">
                <el-button type="primary" plain :loading="renewalProofUploading" @click="triggerRenewalProofUpload">
                  {{ renewalForm.paymentProofImage ? 'เปลี่ยนสลิป' : 'อัปโหลดสลิป' }}
                </el-button>
                <el-button v-if="renewalForm.paymentProofImage" type="danger" plain @click="clearRenewalProof">ลบสลิป</el-button>
                <span v-if="renewalForm.paymentProofName" class="file-name">{{ renewalForm.paymentProofName }}</span>
              </div>
              <input ref="renewalProofFileRef" type="file" accept="image/*" style="display:none" @change="onRenewalProofFile" />
              <div v-if="renewalForm.paymentProofImage" class="renewal-proof-preview">
                <img :src="renewalForm.paymentProofImage" alt="หลักฐานโอนเงิน" class="renewal-proof-image" />
              </div>
              <div v-else class="proof-hint">ต้องแนบหลักฐานโอนเงินก่อนส่งคำขอ</div>
            </div>
          </el-form-item>

          <el-form-item label="หมายเหตุ">
            <el-input
              v-model="renewalForm.note"
              type="textarea"
              :rows="3"
              placeholder="เช่น ต้องการต่ออายุด่วนก่อนเปิดภาคเรียน"
            />
          </el-form-item>

          <div class="action-wrap">
            <el-button type="primary" :loading="requestingRenewal" :disabled="!formulaReady" @click="submitRenewalRequest">
              ส่งคำขอต่ออายุถึง SuperAdmin
            </el-button>
          </div>
        </el-form>
      </el-card>

      <el-card class="section-card renewal-history-card" shadow="never">
        <template #header>
          <span class="section-title">คำขอต่ออายุล่าสุดของโรงเรียน</span>
        </template>

        <div v-if="renewalHistoryLoading" class="loading-text">กำลังโหลดข้อมูลคำขอล่าสุด...</div>

        <div v-else-if="latestRenewalRequest" class="latest-renewal-grid">
          <div class="latest-renewal-meta">
            <div class="latest-renewal-row">
              <span class="label">สถานะ</span>
              <el-tag :type="renewalStatusType(latestRenewalRequest.status)">{{ latestRenewalRequest.status || 'pending' }}</el-tag>
            </div>
            <div class="latest-renewal-row">
              <span class="label">แพ็กเกจปัจจุบันตอนส่งคำขอ</span>
              <span>{{ latestRenewalRequest.current_plan_code || latestRenewalRequest.plan_code || '-' }}</span>
            </div>
            <div class="latest-renewal-row">
              <span class="label">โหมด</span>
              <span>{{ latestRenewalRequest.renewal_mode === 'auto' ? 'อัตโนมัติเมื่อโอนครบ' : 'ตั้งค่าเอง' }}</span>
            </div>
            <div class="latest-renewal-row">
              <span class="label">ยอดคำนวณ</span>
              <span>{{ Number(latestRenewalRequest.calculated_total || 0).toLocaleString('th-TH') }} บาท</span>
            </div>
            <div class="latest-renewal-row">
              <span class="label">ยอดที่ต้องโอน</span>
              <span>{{ Number(latestRenewalRequest.amount || 0).toLocaleString('th-TH') }} บาท</span>
            </div>
            <div class="latest-renewal-row">
              <span class="label">วันที่ส่งคำขอ</span>
              <span>{{ formatDateLabel(latestRenewalRequest.created_at) }}</span>
            </div>
            <div class="latest-renewal-row">
              <span class="label">วันที่โอน</span>
              <span>{{ formatDateLabel(latestRenewalRequest.payment_date) }}</span>
            </div>
            <div class="latest-renewal-row latest-renewal-note">
              <span class="label">หมายเหตุ</span>
              <span>{{ latestRenewalRequest.note || '-' }}</span>
            </div>
            <div v-if="latestRenewalRequest.rejection_reason" class="latest-renewal-row latest-renewal-note text-rose-600">
              <span class="label">เหตุผลที่ไม่อนุมัติ</span>
              <span>{{ latestRenewalRequest.rejection_reason }}</span>
            </div>
          </div>
          <div class="latest-renewal-proof">
            <div class="proof-label">สลิปล่าสุดที่ส่ง</div>
            <img
              v-if="latestRenewalRequest.payment_proof_image"
              :src="latestRenewalRequest.payment_proof_image"
              alt="สลิปล่าสุด"
              class="renewal-proof-image"
            />
            <div v-else class="loading-text">ยังไม่มีการแนบสลิป</div>
          </div>
        </div>

        <el-empty v-else description="ยังไม่มีคำขอต่ออายุที่ส่งไว้" />
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { doc, collection, setDoc, getDocs, query, orderBy, addDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { getSchoolDb, db as masterDb } from '@/firebase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import {
  usePricingFormula,
  DEFAULT_PRICING_FORMULA,
  normalizePricingFormula,
  calcFormulaMonthly,
  calcFormulaTotal,
  getDiscountPercent,
} from '@/composables/usePricingFormula'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { getPricingFormula } = usePricingFormula()

const formulaLoading = ref(false)
const formulaReady = ref(false)
const formulaError = ref('')
const pricingFormula = ref({ ...DEFAULT_PRICING_FORMULA })

const renewalProofFileRef = ref(null)
const renewalProofUploading = ref(false)
const requestingRenewal = ref(false)
const renewalHistoryLoading = ref(false)
const renewalHistory = ref([])
const savingCalculation = ref(false)
const savedCalculationAt = ref(null)

const renewalForm = reactive({
  months: 1,
  rooms: 12,
  teachers: 15,
  days: 5,
  periods: 8,
  concurrent: 5,
  paymentDate: '',
  paymentProofImage: '',
  paymentProofName: '',
  note: '',
  renewalMode: 'manual',
})

const latestRenewalRequest = computed(() => renewalHistory.value[0] || null)
const normalizedFormula = computed(() => normalizePricingFormula(pricingFormula.value))

const pricingInput = computed(() => ({
  rooms: Number(renewalForm.rooms || 1),
  days: Number(renewalForm.days || 5),
  periods: Number(renewalForm.periods || 8),
  concurrent: Math.min(10, Math.max(5, Number(renewalForm.concurrent || 5))),
  teachers: Number(renewalForm.teachers || 1),
  autoRuns: 5,
  resetCycles: 5,
}))

const EMPTY_MODEL = {
  slotCount: 0,
  swapEvents: 0,
  readTotal: 0,
  writeTotal: 0,
  deleteTotal: 0,
  readCost: 0,
  writeCost: 0,
  deleteCost: 0,
  blazeCost: 0,
  base: 0,
  target: 0,
  monthly: 0,
}

const pricingModel = computed(() => {
  if (!formulaReady.value) return EMPTY_MODEL
  return calcFormulaMonthly(pricingInput.value, normalizedFormula.value)
})
const discountPercent = computed(() => {
  if (!formulaReady.value) return 0
  return getDiscountPercent(renewalForm.months, normalizedFormula.value)
})
const totalModel = computed(() => {
  if (!formulaReady.value) return { subTotal: 0, discount: 0, total: 0 }
  return calcFormulaTotal(pricingModel.value.monthly, renewalForm.months, discountPercent.value)
})

const db = () => getSchoolDb()

const currentPlanFeeLabel = computed(() => {
  const fee = Number(schoolStore.pricingPlan?.monthly_fee || 0)
  return fee > 0 ? `${fee} บาท` : 'ยังไม่กำหนด'
})

const currentPlanLimitLabel = computed(() => {
  const limit = Number(schoolStore.schedulerLimit || 0)
  return limit > 0 ? `${limit} คน` : '-'
})

const currentPlanStatusLabel = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'ยังไม่กำหนดวันหมดอายุ'
  const dateLabel = exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  return schoolStore.isViewOnlyMode ? `หมดอายุแล้ว (${dateLabel})` : `ใช้งานได้ถึง ${dateLabel}`
})

function number(n) {
  return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function currency(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท'
}

function triggerRenewalProofUpload() {
  renewalProofFileRef.value?.click()
}

function compressToBase64(file, maxW = 1280, maxH = 1280, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width
      let h = img.height
      if (w > maxW) {
        h = Math.round(h * maxW / w)
        w = maxW
      }
      if (h > maxH) {
        w = Math.round(w * maxH / h)
        h = maxH
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

async function onRenewalProofFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('ไฟล์หลักฐานโอนเงินใหญ่เกินไป (สูงสุด 5MB)')
    e.target.value = ''
    return
  }
  renewalProofUploading.value = true
  try {
    const base64 = await compressToBase64(file)
    renewalForm.paymentProofImage = base64
    renewalForm.paymentProofName = file.name
    ElMessage.success('แนบหลักฐานโอนเงินแล้ว')
  } catch (err) {
    ElMessage.error('อัปโหลดหลักฐานไม่สำเร็จ: ' + err.message)
  } finally {
    renewalProofUploading.value = false
    e.target.value = ''
  }
}

function clearRenewalProof() {
  renewalForm.paymentProofImage = ''
  renewalForm.paymentProofName = ''
}

async function loadPricingFormula() {
  formulaLoading.value = true
  formulaReady.value = false
  formulaError.value = ''
  try {
    const result = await getPricingFormula()
    if (result.success && result.data && !result.fromDefault) {
      pricingFormula.value = result.data
      formulaReady.value = true
      return
    }
    formulaError.value = 'ไม่พบสูตรคำนวณที่บันทึกโดย SuperAdmin'
  } catch (err) {
    console.error('Failed to load pricing formula:', err)
    formulaError.value = 'ไม่สามารถโหลดสูตรคำนวณจากระบบได้'
  } finally {
    formulaLoading.value = false
  }
}

function getCalculationSnapshotDoc() {
  return doc(db(), 'renewal_calculation_cache', 'latest')
}

async function loadCalculationSnapshot() {
  try {
    const snap = await getDoc(getCalculationSnapshotDoc())
    if (!snap.exists()) return
    const data = snap.data()
    if (data?.input) {
      renewalForm.months = Number(data.input.months || renewalForm.months)
      renewalForm.rooms = Number(data.input.rooms || renewalForm.rooms)
      renewalForm.teachers = Number(data.input.teachers || renewalForm.teachers)
      renewalForm.days = Number(data.input.days || renewalForm.days)
      renewalForm.periods = Number(data.input.periods || renewalForm.periods)
      renewalForm.concurrent = Number(data.input.concurrent || renewalForm.concurrent)
      renewalForm.renewalMode = data.input.renewalMode || renewalForm.renewalMode
    }
    savedCalculationAt.value = data?.saved_at || null
  } catch (err) {
    console.warn('Load calculation snapshot failed:', err)
  }
}

async function saveCalculationSnapshot() {
  if (!formulaReady.value) {
    ElMessage.warning('ยังไม่พร้อมบันทึก เพราะยังโหลดสูตรคำนวณไม่สำเร็จ')
    return
  }
  savingCalculation.value = true
  try {
    const payload = {
      input: {
        months: Number(renewalForm.months || 1),
        rooms: Number(renewalForm.rooms || 1),
        teachers: Number(renewalForm.teachers || 1),
        days: Number(renewalForm.days || 5),
        periods: Number(renewalForm.periods || 8),
        concurrent: Number(renewalForm.concurrent || 5),
        renewalMode: renewalForm.renewalMode || 'manual',
      },
      calculated: {
        monthly: Number(pricingModel.value.monthly || 0),
        total: Number(totalModel.value.total || 0),
        discount_percent: Number(discountPercent.value || 0),
        discount_amount: Number(totalModel.value.discount || 0),
      },
      pricing_formula_snapshot: { ...normalizedFormula.value },
      saved_by_uid: authStore.profile?.uid || null,
      saved_at: new Date().toISOString(),
      updated_at: serverTimestamp(),
    }
    await setDoc(getCalculationSnapshotDoc(), payload, { merge: true })
    savedCalculationAt.value = payload.saved_at
    ElMessage.success('บันทึกยอดคำนวณเรียบร้อยแล้ว')
  } catch (err) {
    ElMessage.error('บันทึกยอดคำนวณไม่สำเร็จ: ' + err.message)
  } finally {
    savingCalculation.value = false
  }
}

async function submitRenewalRequest() {
  if (!formulaReady.value) {
    ElMessage.error('ยังไม่สามารถส่งคำขอได้ เพราะยังโหลดสูตรคำนวณของ SuperAdmin ไม่สำเร็จ')
    return
  }
  if (!renewalForm.paymentProofImage) {
    ElMessage.warning('กรุณาแนบหลักฐานโอนเงินก่อนส่งคำขอ')
    return
  }
  if (!renewalForm.paymentDate) {
    ElMessage.warning('กรุณาเลือกวันที่โอนเงิน')
    return
  }
  requestingRenewal.value = true
  try {
    const schoolId = authStore.schoolId || schoolStore.schoolInfo?.school_id || ''
    const schoolName = schoolStore.schoolName || schoolStore.schoolInfo?.name || '-'
    const contactEmail = authStore.profile?.email || schoolStore.schoolInfo?.email || ''
    const contactName = authStore.profile?.displayName || '-'
    const currentPlanCode = schoolStore.pricingPlan?.code || ''
    const masterRequestRef = doc(collection(masterDb, 'renewal_requests'))
    const requestId = masterRequestRef.id

    const calculatedMonthly = Number(pricingModel.value.monthly || 0)
    const calculatedTotal = Number(totalModel.value.total || 0)
    const discountValue = Number(totalModel.value.discount || 0)
    const dueAmount = Math.max(1, Math.round(calculatedTotal))

    const requestPayload = {
      request_id: requestId,
      school_id: schoolId,
      school_name: schoolName,
      current_plan_code: currentPlanCode,
      months: Number(renewalForm.months || 1),
      amount: dueAmount,
      payment_date: renewalForm.paymentDate,
      payment_proof_image: renewalForm.paymentProofImage,
      payment_proof_name: renewalForm.paymentProofName || '',
      note: renewalForm.note || '',
      contact_email: contactEmail,
      contact_name: contactName,
      status: 'pending',
      created_at: serverTimestamp(),
      created_by_uid: authStore.profile?.uid || null,
      renewal_mode: renewalForm.renewalMode,
      calculation_input: {
        rooms: Number(renewalForm.rooms || 1),
        teachers: Number(renewalForm.teachers || 1),
        days: Number(renewalForm.days || 5),
        periods: Number(renewalForm.periods || 8),
        concurrent: Number(renewalForm.concurrent || 5),
        auto_runs: 5,
        reset_cycles: 5,
      },
      calculated_monthly: calculatedMonthly,
      calculated_total: calculatedTotal,
      discount_percent: Number(discountPercent.value || 0),
      discount_amount: discountValue,
      pricing_formula_snapshot: { ...normalizedFormula.value },
    }

    await Promise.all([
      setDoc(masterRequestRef, requestPayload),
      setDoc(doc(collection(db(), 'renewal_requests'), requestId), requestPayload),
    ])

    await addDoc(collection(masterDb, 'email_queue'), {
      to: 'muksingapp@gmail.com',
      subject: `[ต่ออายุ] ${schoolName} ส่งคำขอต่ออายุ ${renewalForm.months} เดือน`,
      htmlBody: `
        <h3>มีคำขอต่ออายุสมาชิกจากโรงเรียน</h3>
        <p><b>เลขที่คำขอ:</b> ${requestId}</p>
        <p><b>โรงเรียน:</b> ${schoolName}</p>
        <p><b>schoolId:</b> ${schoolId || '-'}</p>
        <p><b>แพ็กเกจปัจจุบัน:</b> ${currentPlanCode || '-'}</p>
        <p><b>ระยะเวลา:</b> ${renewalForm.months} เดือน</p>
        <p><b>โหมดต่ออายุ:</b> ${renewalForm.renewalMode === 'auto' ? 'อัตโนมัติเมื่อโอนครบ' : 'ตั้งค่าเอง'}</p>
        <p><b>ยอดคำนวณ:</b> ${calculatedTotal.toLocaleString('th-TH')} บาท</p>
        <p><b>ยอดที่ต้องโอน:</b> ${dueAmount.toLocaleString('th-TH')} บาท</p>
        <p><b>พารามิเตอร์:</b> ห้อง ${renewalForm.rooms}, ครู ${renewalForm.teachers}, วัน/สัปดาห์ ${renewalForm.days}, คาบ/วัน ${renewalForm.periods}, จัดพร้อมกัน ${renewalForm.concurrent}</p>
        <p><b>ค่าคงที่:</b> จัดอัตโนมัติ 5 ครั้ง, ล้างตาราง 5 ครั้ง</p>
        <p><b>วันที่โอน:</b> ${renewalForm.paymentDate}</p>
        <p><b>ผู้ติดต่อ:</b> ${contactName} (${contactEmail || '-'})</p>
        <p><b>หมายเหตุ:</b> ${renewalForm.note || '-'}</p>
      `,
      status: 'pending',
      createdAt: serverTimestamp(),
    })

    ElMessage.success('ส่งคำขอต่ออายุเรียบร้อยแล้ว')

    renewalForm.months = 1
    renewalForm.rooms = 12
    renewalForm.teachers = 15
    renewalForm.days = 5
    renewalForm.periods = 8
    renewalForm.concurrent = 5
    renewalForm.paymentDate = ''
    renewalForm.paymentProofImage = ''
    renewalForm.paymentProofName = ''
    renewalForm.note = ''
    renewalForm.renewalMode = 'manual'

    await loadRenewalHistory()
  } catch (e) {
    ElMessage.error('ส่งคำขอต่ออายุไม่สำเร็จ: ' + e.message)
  } finally {
    requestingRenewal.value = false
  }
}

async function loadRenewalHistory() {
  renewalHistoryLoading.value = true
  try {
    const snapshot = await getDocs(query(collection(db(), 'renewal_requests'), orderBy('created_at', 'desc')))
    renewalHistory.value = snapshot.docs.map((snap) => {
      const data = snap.data()
      return {
        id: snap.id,
        ...data,
        created_at: typeof data.created_at?.toDate === 'function' ? data.created_at.toDate() : data.created_at ? new Date(data.created_at) : null,
        payment_date: data.payment_date ? new Date(data.payment_date) : null,
        reviewed_at: typeof data.reviewed_at?.toDate === 'function' ? data.reviewed_at.toDate() : data.reviewed_at ? new Date(data.reviewed_at) : null,
      }
    })
  } catch (e) {
    console.error('Failed to load renewal history:', e)
  } finally {
    renewalHistoryLoading.value = false
  }
}

function formatDateLabel(value) {
  if (!value) return '-'
  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(dateValue.getTime())) return '-'
  return dateValue.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renewalStatusType(status) {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

onMounted(async () => {
  await Promise.all([loadRenewalHistory(), loadPricingFormula(), loadCalculationSnapshot()])
})
</script>

<style scoped>
.renewal-page {
  padding: 24px;
  display: grid;
  gap: 16px;
}

.renewal-header-card {
  background: linear-gradient(120deg, #0ea5e9, #2563eb 55%, #4f46e5);
  border-radius: 18px;
  padding: 22px;
  color: #fff;
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.25);
}

.renewal-header-card h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
}

.renewal-header-card p {
  margin: 6px 0 0;
  opacity: 0.95;
}

.section-card {
  border-radius: 16px;
  border: 1px solid #dbeafe;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.section-title {
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.plan-card {
  background: linear-gradient(180deg, #f8fbff, #eef2ff);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.info-item {
  border-radius: 12px;
  padding: 12px;
}

.info-item .label {
  color: #64748b;
  font-size: 12px;
}

.info-item .value {
  font-size: 20px;
  font-weight: 700;
  margin-top: 2px;
}

.info-item.fee {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.info-item.fee .value {
  color: #1d4ed8;
}

.info-item.limit {
  background: #ecfdf5;
  border: 1px solid #86efac;
}

.info-item.limit .value {
  color: #047857;
}

.info-item.status {
  background: #fff7ed;
  border: 1px solid #fdba74;
}

.info-item.status .value {
  color: #b45309;
}

.info-item.status.expired {
  background: #fef2f2;
  border-color: #fecaca;
}

.info-item.status.expired .value {
  color: #b91c1c;
}

.renewal-card {
  background: linear-gradient(180deg, #f8fbff, #f5f3ff 35%, #ffffff);
}

.renewal-form {
  display: grid;
  gap: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
}

.form-grid.params {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.full {
  width: 100%;
}

.param-card,
.fixed-card {
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #dbeafe;
}

.param-card {
  background: linear-gradient(180deg, #ecfdf5, #ffffff);
}

.fixed-card {
  background: linear-gradient(180deg, #fff7ed, #ffffff);
}

.param-card h3,
.fixed-card h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #0f172a;
}

.fixed-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.fixed-item {
  border-radius: 10px;
  padding: 10px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fixed-item span {
  color: #92400e;
  font-size: 13px;
}

.fixed-item strong {
  color: #b45309;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  border-radius: 12px;
  padding: 10px;
  border: 1px solid #e2e8f0;
}

.metric span {
  display: block;
  font-size: 12px;
  color: #475569;
}

.metric strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  color: #0f172a;
}

.metric.reads { background: #eff6ff; border-color: #bfdbfe; }
.metric.writes { background: #ecfdf5; border-color: #86efac; }
.metric.deletes { background: #fef2f2; border-color: #fecaca; }
.metric.monthly { background: #f5f3ff; border-color: #c4b5fd; }
.metric.total { background: #f0fdfa; border-color: #99f6e4; }

.summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 10px;
  background: #f1f5f9;
  padding: 10px 12px;
  font-weight: 600;
}

.payment-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.calc-save-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px dashed #94a3b8;
  border-radius: 10px;
  padding: 10px 12px;
}

.calc-save-note {
  font-size: 12px;
  color: #475569;
}

.renewal-proof-box {
  width: 100%;
  border: 1px dashed #93c5fd;
  border-radius: 12px;
  padding: 10px;
  background: #f8fbff;
}

.proof-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.file-name {
  color: #64748b;
  font-size: 12px;
}

.proof-hint {
  font-size: 12px;
  color: #dc2626;
  margin-top: 8px;
}

.renewal-proof-preview {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  padding: 10px;
  max-width: 360px;
  margin-top: 10px;
}

.renewal-proof-image {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: 8px;
}

.action-wrap {
  text-align: right;
}

.renewal-history-card {
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.loading-text {
  color: #64748b;
  font-size: 13px;
}

.latest-renewal-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}

.latest-renewal-meta {
  display: grid;
  gap: 10px;
}

.latest-renewal-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}

.latest-renewal-row .label,
.proof-label {
  color: #64748b;
  font-weight: 600;
}

.latest-renewal-note {
  align-items: flex-start;
}

.latest-renewal-proof {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

:deep(.el-card__header) {
  padding: 12px 20px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}

:deep(.el-card__body) {
  padding: 20px;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  color: #334155;
  font-weight: 700;
}

:deep(.el-input-number .el-input__wrapper),
:deep(.el-input .el-input__wrapper),
:deep(.el-select .el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-date-editor.el-input .el-input__wrapper) {
  background: #ffffff;
  border: 1px solid #bfdbfe;
  box-shadow: 0 0 0 1px rgba(191, 219, 254, 0.2) inset;
}

:deep(.el-radio__inner) {
  border-color: #60a5fa;
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: #2563eb;
  background: #2563eb;
}

@media (max-width: 1200px) {
  .form-grid.params {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .info-grid,
  .form-grid,
  .payment-grid,
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .latest-renewal-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .renewal-page {
    padding: 12px;
  }

  .renewal-header-card h1 {
    font-size: 22px;
  }

  .info-grid,
  .form-grid,
  .form-grid.params,
  .payment-grid,
  .metrics-grid,
  .fixed-grid {
    grid-template-columns: 1fr;
  }

  .action-wrap {
    text-align: left;
  }
}
</style>
