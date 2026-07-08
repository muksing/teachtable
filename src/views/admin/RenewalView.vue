<template>
  <AppLayout>
    <div class="renewal-page">
      <!-- Header -->
      <div class="renewal-header-card">
        <h1>ต่ออายุการใช้งาน</h1>
        <p>เลือกแพ็กเกจ แนบสลิปโอนเงิน แล้วส่งคำขอถึง SuperAdmin</p>
      </div>

      <!-- Current Plan -->
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title">แพ็กเกจปัจจุบัน</span></template>
        <div class="info-grid">
          <div class="info-item fee">
            <div class="label">ราคาต่อปี</div>
            <div class="value">{{ currentPlanFeeLabel }}</div>
          </div>
          <div class="info-item status" :class="{ expired: schoolStore.isViewOnlyMode }">
            <div class="label">สถานะ / หมดอายุ</div>
            <div class="value">{{ currentPlanStatusLabel }}</div>
          </div>
        </div>
        <el-alert
          v-if="schoolStore.isViewOnlyMode"
          type="error" :closable="false" show-icon class="mt-3"
          title="แพ็กเกจหมดอายุแล้ว"
          description="ระบบอยู่ในโหมดดูอย่างเดียว กรุณาส่งคำขอต่ออายุด้านล่าง"
        />
      </el-card>

      <!-- Renewal Form -->
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title">ฟอร์มขอต่ออายุ</span></template>

        <el-form label-position="top" class="renewal-form">
          <!-- Package Selection -->
          <el-form-item label="เลือกแพ็กเกจ" required>
            <div v-if="packagesLoading" style="color:#64748b;font-size:13px">กำลังโหลดแพ็กเกจ...</div>
            <div v-else-if="!packages.length" style="color:#dc2626;font-size:13px">ยังไม่มีแพ็กเกจที่เปิดใช้งาน กรุณาติดต่อ SuperAdmin</div>
            <div v-else class="pkg-grid">
              <div
                v-for="pkg in packages"
                :key="pkg.code"
                class="pkg-card"
                :class="{ selected: renewalForm.packageCode === pkg.code }"
                @click="selectPackage(pkg)"
              >
                <div class="pkg-name">{{ pkg.name }}</div>
                <div class="pkg-price">฿{{ Number(pkg.monthly_fee || 0).toLocaleString() }}</div>
                <div class="pkg-period">ต่อปี</div>
              </div>
            </div>
          </el-form-item>

          <!-- Selected Summary -->
          <div v-if="selectedPackage" class="selected-summary">
            <span>แพ็กเกจที่เลือก: <b>{{ selectedPackage.name }}</b></span>
            <span class="summary-price">ยอดที่ต้องโอน: <b>฿{{ Number(selectedPackage.monthly_fee || 0).toLocaleString() }}</b></span>
          </div>

          <!-- Payment Date -->
          <el-form-item label="วันที่โอนเงิน" required>
            <el-date-picker
              v-model="renewalForm.paymentDate"
              type="datetime"
              placeholder="เลือกวันและเวลา"
              format="DD/MM/YYYY HH:mm"
              value-format="YYYY-MM-DDTHH:mm:ss"
              style="width:100%;max-width:320px"
            />
          </el-form-item>

          <!-- Slip Upload -->
          <el-form-item label="หลักฐานโอนเงิน (สลิป)" required>
            <div class="proof-box">
              <div class="proof-actions">
                <el-button type="primary" plain :loading="proofUploading" @click="$refs.proofFileRef.click()">
                  {{ renewalForm.proofImage ? 'เปลี่ยนสลิป' : 'อัปโหลดสลิป' }}
                </el-button>
                <el-button v-if="renewalForm.proofImage" type="danger" plain @click="clearProof">ลบ</el-button>
                <span v-if="renewalForm.proofName" class="file-name">{{ renewalForm.proofName }}</span>
              </div>
              <input ref="proofFileRef" type="file" accept="image/*" style="display:none" @change="onProofFile" />
              <div v-if="renewalForm.proofImage" class="proof-preview">
                <img :src="renewalForm.proofImage" alt="สลิป" />
              </div>
              <div v-else class="proof-hint">ต้องแนบสลิปก่อนส่งคำขอ</div>
            </div>
          </el-form-item>

          <!-- Note -->
          <el-form-item label="หมายเหตุ">
            <el-input v-model="renewalForm.note" type="textarea" :rows="2" placeholder="เช่น ต้องการต่ออายุด่วนก่อนเปิดภาคเรียน" />
          </el-form-item>

          <div class="action-wrap">
            <el-button type="primary" size="large" :loading="submitting" @click="submitRequest">
              📨 ส่งคำขอต่ออายุถึง SuperAdmin
            </el-button>
          </div>
        </el-form>
      </el-card>

      <!-- History -->
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title">คำขอล่าสุด</span></template>
        <div v-if="historyLoading" style="color:#64748b;font-size:13px">กำลังโหลด...</div>
        <div v-else-if="latestRequest" class="latest-grid">
          <div class="latest-meta">
            <div class="meta-row">
              <span class="label">สถานะ</span>
              <el-tag :type="statusType(latestRequest.status)">{{ latestRequest.status || 'pending' }}</el-tag>
            </div>
            <div class="meta-row">
              <span class="label">แพ็กเกจที่ขอ</span>
              <span>{{ latestRequest.plan_code || latestRequest.current_plan_code || '-' }}</span>
            </div>
            <div class="meta-row">
              <span class="label">ยอดโอน</span>
              <span>{{ Number(latestRequest.amount || 0).toLocaleString('th-TH') }} บาท</span>
            </div>
            <div class="meta-row">
              <span class="label">วันที่ส่ง</span>
              <span>{{ fmtDate(latestRequest.created_at) }}</span>
            </div>
            <div class="meta-row">
              <span class="label">วันที่โอน</span>
              <span>{{ fmtDate(latestRequest.payment_date) }}</span>
            </div>
            <div v-if="latestRequest.note" class="meta-row">
              <span class="label">หมายเหตุ</span>
              <span>{{ latestRequest.note }}</span>
            </div>
            <div v-if="latestRequest.rejection_reason" class="meta-row" style="color:#dc2626">
              <span class="label">เหตุผลที่ไม่อนุมัติ</span>
              <span>{{ latestRequest.rejection_reason }}</span>
            </div>
          </div>
          <div class="latest-proof">
            <div class="label" style="margin-bottom:6px">สลิปที่ส่ง</div>
            <img v-if="latestRequest.payment_proof_image" :src="latestRequest.payment_proof_image" alt="สลิป" class="proof-thumb" />
            <div v-else style="color:#94a3b8;font-size:12px">ไม่มีสลิป</div>
          </div>
        </div>
        <el-empty v-else description="ยังไม่มีคำขอต่ออายุ" />
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolManagement } from '@/composables/useSchoolManagement'

const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { getPackageCatalog } = useSchoolManagement()

const packages = ref([])
const packagesLoading = ref(false)
const historyLoading = ref(false)
const history = ref([])
const submitting = ref(false)
const proofUploading = ref(false)
const proofFileRef = ref(null)

const renewalForm = reactive({
  packageCode: '',
  paymentDate: '',
  proofImage: '',
  proofName: '',
  note: '',
})

const selectedPackage = computed(() => packages.value.find(p => p.code === renewalForm.packageCode) || null)
const latestRequest = computed(() => history.value[0] || null)

const currentPlanFeeLabel = computed(() => {
  const fee = Number(schoolStore.pricingPlan?.monthly_fee || schoolStore.pricingPlan?.annual_fee || 0)
  return fee > 0 ? `฿${fee.toLocaleString()} / ปี` : 'ยังไม่กำหนด'
})

const currentPlanStatusLabel = computed(() => {
  const exp = schoolStore.subscriptionExpiry
  if (!exp) return 'ยังไม่กำหนดวันหมดอายุ'
  const label = exp.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  return schoolStore.isViewOnlyMode ? `หมดอายุแล้ว (${label})` : `ใช้งานได้ถึง ${label}`
})

function selectPackage(pkg) {
  renewalForm.packageCode = pkg.code
}

function clearProof() {
  renewalForm.proofImage = ''
  renewalForm.proofName = ''
}

function compressToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height
      const maxW = 1280, maxH = 1280
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = reject
    img.src = url
  })
}

async function onProofFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { ElMessage.error('ไฟล์ใหญ่เกิน 5MB'); e.target.value = ''; return }
  proofUploading.value = true
  try {
    renewalForm.proofImage = await compressToBase64(file)
    renewalForm.proofName = file.name
  } catch { ElMessage.error('อัปโหลดสลิปไม่สำเร็จ') }
  finally { proofUploading.value = false; e.target.value = '' }
}

async function submitRequest() {
  if (!renewalForm.packageCode) { ElMessage.warning('กรุณาเลือกแพ็กเกจ'); return }
  if (!renewalForm.paymentDate) { ElMessage.warning('กรุณาเลือกวันที่โอนเงิน'); return }
  if (!renewalForm.proofImage) { ElMessage.warning('กรุณาแนบหลักฐานโอนเงิน'); return }

  submitting.value = true
  try {
    const schoolId = authStore.schoolId
    const pkg = selectedPackage.value
    const { error } = await supabase.from('school_requests').insert([{
      school_id: schoolId,
      school_name: schoolStore.schoolName || '-',
      plan_code: pkg.code,
      current_plan_code: pkg.code,
      amount: Number(pkg.monthly_fee || 0),
      payment_date: renewalForm.paymentDate,
      payment_proof_image: renewalForm.proofImage,
      payment_proof_name: renewalForm.proofName || '',
      note: renewalForm.note || '',
      contact_email: authStore.profile?.email || '',
      contact_name: authStore.profile?.displayName || '-',
      status: 'pending',
      created_at: new Date().toISOString(),
      created_by_uid: authStore.profile?.uid || null,
      renewal_mode: 'manual',
    }])
    if (error) throw error
    ElMessage.success('ส่งคำขอต่ออายุเรียบร้อยแล้ว')
    renewalForm.packageCode = ''
    renewalForm.paymentDate = ''
    renewalForm.proofImage = ''
    renewalForm.proofName = ''
    renewalForm.note = ''
    await loadHistory()
  } catch (e) {
    ElMessage.error('ส่งคำขอไม่สำเร็จ: ' + e.message)
  } finally {
    submitting.value = false
  }
}

function fmtDate(value) {
  if (!value) return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d)) return '-'
  return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusType(s) {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'danger'
  return 'warning'
}

async function loadPackages() {
  packagesLoading.value = true
  const res = await getPackageCatalog(true)
  if (res.success) packages.value = res.data
  packagesLoading.value = false
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const { data } = await supabase
      .from('school_requests')
      .select('*')
      .eq('school_id', authStore.schoolId)
      .order('created_at', { ascending: false })
      .limit(5)
    history.value = data || []
  } finally {
    historyLoading.value = false
  }
}

onMounted(() => { loadPackages(); loadHistory() })
</script>

<style scoped>
.renewal-page { padding: 24px; display: grid; gap: 16px; }

.renewal-header-card {
  background: linear-gradient(120deg, #0ea5e9, #2563eb 55%, #4f46e5);
  border-radius: 18px; padding: 22px; color: #fff;
  box-shadow: 0 12px 26px rgba(37,99,235,.25);
}
.renewal-header-card h1 { margin: 0; font-size: 26px; font-weight: 800; }
.renewal-header-card p { margin: 6px 0 0; opacity: .9; font-size: 14px; }

.section-card { border-radius: 16px; border: 1px solid #dbeafe; overflow: hidden; }
.section-title { color: #fff; font-size: 14px; font-weight: 700; }
:deep(.el-card__header) { padding: 12px 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
:deep(.el-card__body) { padding: 20px; }

.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.info-item { border-radius: 12px; padding: 14px; }
.info-item .label { color: #64748b; font-size: 12px; }
.info-item .value { font-size: 20px; font-weight: 700; margin-top: 2px; }
.info-item.fee { background: #eff6ff; border: 1px solid #bfdbfe; }
.info-item.fee .value { color: #1d4ed8; }
.info-item.status { background: #fff7ed; border: 1px solid #fdba74; }
.info-item.status .value { color: #b45309; }
.info-item.status.expired { background: #fef2f2; border-color: #fecaca; }
.info-item.status.expired .value { color: #b91c1c; }
.mt-3 { margin-top: 12px; }

.renewal-form { display: grid; gap: 16px; }

.pkg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.pkg-card {
  border: 2px solid #e2e8f0; border-radius: 14px; padding: 16px 12px;
  text-align: center; cursor: pointer; transition: all .15s;
  background: #f8fafc;
}
.pkg-card:hover { border-color: #60a5fa; background: #eff6ff; }
.pkg-card.selected { border-color: #2563eb; background: #dbeafe; }
.pkg-name { font-weight: 700; color: #1e1b4b; font-size: 14px; }
.pkg-price { font-size: 22px; font-weight: 800; color: #0284c7; margin-top: 6px; }
.pkg-period { font-size: 11px; color: #94a3b8; }

.selected-summary {
  display: flex; justify-content: space-between; align-items: center;
  background: linear-gradient(135deg, #dbeafe, #ede9fe);
  border-radius: 12px; padding: 12px 16px;
  font-size: 14px; color: #1e1b4b;
}
.summary-price { font-size: 16px; }

.proof-box { width: 100%; border: 1px dashed #93c5fd; border-radius: 12px; padding: 12px; background: #f8fbff; }
.proof-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.file-name { color: #64748b; font-size: 12px; }
.proof-hint { font-size: 12px; color: #dc2626; margin-top: 8px; }
.proof-preview { margin-top: 10px; max-width: 360px; }
.proof-preview img { width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; border: 1px solid #cbd5e1; }

.action-wrap { text-align: right; }

.latest-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
.latest-meta { display: grid; gap: 10px; }
.meta-row {
  display: flex; justify-content: space-between; gap: 12px; padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0; font-size: 13px;
}
.meta-row .label { color: #64748b; font-weight: 600; }
.latest-proof { display: flex; flex-direction: column; }
.proof-thumb { width: 100%; max-height: 240px; object-fit: contain; border-radius: 8px; border: 1px solid #cbd5e1; }

:deep(.el-form-item__label) { font-size: 13px; color: #334155; font-weight: 700; }

@media (max-width: 768px) {
  .renewal-page { padding: 12px; }
  .info-grid { grid-template-columns: 1fr; }
  .latest-grid { grid-template-columns: 1fr; }
  .pkg-grid { grid-template-columns: repeat(2, 1fr); }
  .selected-summary { flex-direction: column; gap: 4px; }
}
</style>
