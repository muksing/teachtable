<template>
  <div class="renewal-approval-page">
    <div class="hero-card">
      <div>
        <p class="hero-kicker">SuperAdmin Renewal Management</p>
        <h1>จัดการคำขอต่ออายุแพ็คเกจ</h1>
        <p class="hero-desc">ตรวจสอบและอนุมัติคำขอต่ออายุจากโรงเรียน</p>
      </div>
      <el-tag type="success" effect="dark" size="large" v-if="stats">
        {{ stats.pending }} คำขอรอการตรวจสอบ
      </el-tag>
    </div>

    <!-- Tabs for different statuses -->
    <el-tabs v-model="activeTab" class="tabs-card" type="card">
      <el-tab-pane label="⏳ รอการตรวจสอบ" name="pending">
        <div class="tab-content">
          <el-empty v-if="filteredRequests.length === 0" description="ไม่มีคำขอรอการตรวจสอบ" />

          <div v-for="request in filteredRequests" :key="request.id" class="request-card pending-card">
            <RequestCardContent :request="request" />
            <div class="card-actions">
              <el-button @click="openDetailModal(request)">ดูรายละเอียด</el-button>
              <el-button type="success" @click="handleApprove(request)">✅ อนุมัติ</el-button>
              <el-button type="danger" @click="handleReject(request)">❌ ปฏิเสธ</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="✅ อนุมัติแล้ว" name="approved">
        <div class="tab-content">
          <el-empty v-if="filteredRequests.length === 0" description="ไม่มีคำขอที่อนุมัติแล้ว" />

          <div v-for="request in filteredRequests" :key="request.id" class="request-card approved-card">
            <RequestCardContent :request="request" :hideActions="true" />
            <div class="card-meta">
              <span>อนุมัติโดย: {{ request.approvedBy }}</span>
              <span>{{ formatDate(request.approvedAt) }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="❌ ปฏิเสธแล้ว" name="rejected">
        <div class="tab-content">
          <el-empty v-if="filteredRequests.length === 0" description="ไม่มีคำขอที่ปฏิเสธแล้ว" />

          <div v-for="request in filteredRequests" :key="request.id" class="request-card rejected-card">
            <RequestCardContent :request="request" :hideActions="true" />
            <div class="card-meta">
              <span v-if="request.rejectionReason" class="reason">
                เหตุผล: {{ request.rejectionReason }}
              </span>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Detail Modal -->
    <el-dialog 
      v-model="showDetailModal" 
      :title="'รายละเอียดคำขอ: ' + selectedRequest?.id"
      width="600px"
      center
    >
      <div class="detail-content" v-if="selectedRequest">
        <!-- School Info -->
        <div class="detail-section">
          <h4>📍 ข้อมูลโรงเรียน</h4>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="label">รหัสโรงเรียน:</span>
              <span class="value">{{ selectedRequest.schoolId }}</span>
            </div>
            <div class="detail-row">
              <span class="label">เลขที่คำขอ:</span>
              <span class="value">{{ selectedRequest.id }}</span>
            </div>
          </div>
        </div>

        <!-- Calculation Parameters -->
        <div class="detail-section">
          <h4>📊 พารามิเตอร์การคำนวณ</h4>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="label">ห้องเรียน:</span>
              <span class="value">{{ selectedRequest.calculationParams?.rooms }}</span>
            </div>
            <div class="detail-row">
              <span class="label">วัน/สัปดาห์:</span>
              <span class="value">{{ selectedRequest.calculationParams?.days }}</span>
            </div>
            <div class="detail-row">
              <span class="label">คาบ/วัน:</span>
              <span class="value">{{ selectedRequest.calculationParams?.periods }}</span>
            </div>
            <div class="detail-row">
              <span class="label">จำนวนครู:</span>
              <span class="value">{{ selectedRequest.calculationParams?.teachers }}</span>
            </div>
            <div class="detail-row">
              <span class="label">คนจัดพร้อมกัน:</span>
              <span class="value">{{ selectedRequest.calculationParams?.concurrent }}</span>
            </div>
            <div class="detail-row">
              <span class="label">ระยะเวลา:</span>
              <span class="value">{{ selectedRequest.calculationParams?.months }} เดือน</span>
            </div>
          </div>
        </div>

        <!-- Pricing -->
        <div class="detail-section">
          <h4>💰 ราคา</h4>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="label">ราคา/เดือน:</span>
              <span class="value">{{ currency(selectedRequest.pricing?.monthlyPrice) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">ยอดรวม:</span>
              <span class="value highlight">{{ currency(selectedRequest.pricing?.totalPrice) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">ส่วนลด:</span>
              <span class="value">{{ selectedRequest.pricing?.discountPercent }}% ({{ currency(selectedRequest.pricing?.discount) }})</span>
            </div>
          </div>
        </div>

        <!-- Payment Evidence -->
        <div class="detail-section" v-if="selectedRequest.paymentEvidence">
          <h4>📄 หลักฐานการโอนเงิน</h4>
          <div class="detail-grid">
            <div class="detail-row">
              <span class="label">วันที่โอน:</span>
              <span class="value">{{ formatDate(selectedRequest.paymentEvidence?.transferDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">จำนวนเงิน:</span>
              <span class="value">{{ currency(selectedRequest.paymentEvidence?.amount) }}</span>
            </div>
            <div class="detail-row" v-if="selectedRequest.paymentEvidence?.slipFile">
              <span class="label">สลิป:</span>
              <span class="value">{{ selectedRequest.paymentEvidence.slipFile }}</span>
            </div>
          </div>
        </div>

        <!-- Request Meta -->
        <div class="detail-section">
          <h4>ℹ️ ข้อมูลคำขอ</h4>
          <div class="detail-grid">  
            <div class="detail-row">
              <span class="label">ประเภท:</span>
              <span class="value">
                {{ selectedRequest.renewalType === 'manual' ? 'ตั้งค่าเอง' : 'อัตโนมัติ' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="label">สถานะ:</span>
              <el-tag 
                :type="statusType(selectedRequest.status)"
                effect="dark"
              >
                {{ statusLabel(selectedRequest.status) }}
              </el-tag>
            </div>
            <div class="detail-row" v-if="selectedRequest.notes">
              <span class="label">หมายเหตุ:</span>
              <span class="value">{{ selectedRequest.notes }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDetailModal = false">ปิด</el-button>
        <el-button 
          v-if="selectedRequest?.status === 'pending'"
          type="success" 
          @click="handleApprove(selectedRequest)"
        >
          ✅ อนุมัติ
        </el-button>
        <el-button 
          v-if="selectedRequest?.status === 'pending'"
          type="danger" 
          @click="handleReject(selectedRequest)"
        >
          ❌ ปฏิเสธ
        </el-button>
      </template>
    </el-dialog>

    <!-- Approval Confirmation -->
    <el-dialog v-model="showApprovalDialog" title="✅ ยืนยันการอนุมัติ" width="400px" center>
      <div v-if="selectedRequest" class="approval-content">
        <p>โรงเรียน: <strong>{{ selectedRequest.schoolId }}</strong></p>
        <p>จำนวนเงิน: <strong>{{ currency(selectedRequest.pricing?.totalPrice) }}</strong></p>
        <p>ระยะเวลา: <strong>{{ selectedRequest.calculationParams?.months }} เดือน</strong></p>
        <el-form label-position="top">
          <el-form-item label="เลือกระยะเวลาต่ออายุ (เดือน)">
            <el-select v-model="approveDuration" placeholder="เลือก">
              <el-option :value="1" label="1 เดือน" />
              <el-option :value="3" label="3 เดือน" />
              <el-option :value="6" label="6 เดือน" />
              <el-option :value="12" label="12 เดือน" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showApprovalDialog = false">ยกเลิก</el-button>
        <el-button 
          type="success" 
          :loading="approving"
          @click="confirmApprove"
        >
          ยืนยัน
        </el-button>
      </template>
    </el-dialog>

    <!-- Rejection Confirmation -->
    <el-dialog v-model="showRejectionDialog" title="❌ ปฏิเสธคำขอ" width="400px" center>
      <el-form label-position="top">
        <el-form-item label="เหตุผลในการปฏิเสธ*" required>
          <el-input 
            v-model="rejectionReason"
            type="textarea"
            rows="4"
            placeholder="บอกเหตุผลที่ปฏิเสธ..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRejectionDialog = false">ยกเลิก</el-button>
        <el-button 
          type="danger"
          :loading="rejecting"
          @click="confirmReject"
        >
          ปฏิเสธ
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { usePackageRenewal } from '@/composables/usePackageRenewal'
import RequestCardContent from '../scheduler/RequestCardContent.vue'

const authStore = useAuthStore()
const { approveRenewalRequest, rejectRenewalRequest } = usePackageRenewal()

const activeTab = ref('pending')
const showDetailModal = ref(false)
const showApprovalDialog = ref(false)
const showRejectionDialog = ref(false)
const selectedRequest = ref(null)
const allRequests = ref([])
const approveDuration = ref(12)
const rejectionReason = ref('')
const approving = ref(false)
const rejecting = ref(false)

const stats = computed(() => {
  if (allRequests.value.length === 0) return null
  return {
    pending: allRequests.value.filter(r => r.status === 'pending').length,
    approved: allRequests.value.filter(r => r.status === 'approved').length,
    rejected: allRequests.value.filter(r => r.status === 'rejected').length,
  }
})

const filteredRequests = computed(() => {
  return allRequests.value.filter(r => r.status === activeTab.value)
})

function currency(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' บาท'
}

function formatDate(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function statusLabel(status) {
  const labels = {
    pending: 'รอการตรวจสอบ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธแล้ว',
    active: 'ใช้งานแล้ว',
  }
  return labels[status] || status
}

function statusType(status) {
  const types = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    active: 'success',
  }
  return types[status] || 'info'
}

function openDetailModal(request) {
  selectedRequest.value = request
  showDetailModal.value = true
}

function handleApprove(request) {
  selectedRequest.value = request
  approveDuration.value = request.calculationParams?.months || 12
  showApprovalDialog.value = true
}

function handleReject(request) {
  selectedRequest.value = request
  rejectionReason.value = ''
  showRejectionDialog.value = true
}

async function confirmApprove() {
  if (!selectedRequest.value) return

  approving.value = true
  try {
    const result = await approveRenewalRequest(
      selectedRequest.value.schoolId,
      selectedRequest.value.id,
      authStore.profile?.uid,
      approveDuration.value
    )

    if (result.success) {
      ElMessage.success(result.message)
      selectedRequest.value.status = 'approved'
      selectedRequest.value.approvedAt = new Date()
      selectedRequest.value.approvedBy = authStore.profile?.uid
      showApprovalDialog.value = false
      showDetailModal.value = false
    } else {
      ElMessage.error(result.error)
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error('เกิดข้อผิดพลาด: ' + error.message)
  } finally {
    approving.value = false
  }
}

async function confirmReject() {
  if (!selectedRequest.value || !rejectionReason.value) {
    ElMessage.warning('กรุณาระบุเหตุผล')
    return
  }

  rejecting.value = true
  try {
    const result = await rejectRenewalRequest(
      selectedRequest.value.schoolId,
      selectedRequest.value.id,
      authStore.profile?.uid,
      rejectionReason.value
    )

    if (result.success) {
      ElMessage.success(result.message)
      selectedRequest.value.status = 'rejected'
      selectedRequest.value.rejectionReason = rejectionReason.value
      selectedRequest.value.approvedAt = new Date()
      selectedRequest.value.approvedBy = authStore.profile?.uid
      showRejectionDialog.value = false
      showDetailModal.value = false
    } else {
      ElMessage.error(result.error)
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error('เกิดข้อผิดพลาด: ' + error.message)
  } finally {
    rejecting.value = false
  }
}

async function loadRenewalRequests() {
  // Note: ต้องใช้ Cloud Function หรือ Admin API เพื่อดึงคำขอจากโรงเรียนทั้งหมด
  // จากปัจจุบัน client SDK ไม่สามารถ query ข้ามหลาย subcollections ได้
  console.log('Load renewal requests - use Cloud Function endpoint')
  // Temporary mock data
  allRequests.value = []
}

onMounted(() => {
  loadRenewalRequests()
})
</script>

<style scoped>
.renewal-approval-page {
  padding: 18px;
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 50%, #fef2f2 100%);
  min-height: 100vh;
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  padding: 18px;
  border-radius: 16px;
  margin-bottom: 14px;
  background: linear-gradient(120deg, #8b5cf6, #7c3aed 55%, #6d28d9);
  color: #fff;
  box-shadow: 0 14px 30px rgba(124, 58, 237, 0.25);
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

.tabs-card {
  margin-top: 12px;
}

.tab-content {
  padding: 12px 0;
}

.request-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 14px;
  margin-bottom: 12px;
  transition: all 0.3s;
}

.request-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.request-card.pending-card {
  border-left: 4px solid #f59e0b;
  background: linear-gradient(90deg, #fef3c7 0%, #ffffff 20%);
}

.request-card.approved-card {
  border-left: 4px solid #10b981;
  background: linear-gradient(90deg, #d1fae5 0%, #ffffff 20%);
}

.request-card.rejected-card {
  border-left: 4px solid #ef4444;
  background: linear-gradient(90deg, #fee2e2 0%, #ffffff 20%);
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.card-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.card-meta .reason {
  color: #dc2626;
  font-weight: 600;
}

.detail-content {
  max-height: 500px;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: #0f172a;
  font-size: 14px;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.detail-row .label {
  color: #64748b;
  min-width: 100px;
}

.detail-row .value {
  color: #0f172a;
  font-weight: 500;
}

.detail-row .value.highlight {
  color: #059669;
  font-weight: 700;
}

.approval-content {
  padding: 12px 0;
}

.approval-content p {
  margin: 8px 0;
  color: #0f172a;
}

.approval-content strong {
  color: #1f2937;
}

@media (max-width: 700px) {
  .renewal-approval-page {
    padding: 12px;
  }

  .hero-card {
    flex-direction: column;
    gap: 8px;
  }

  .hero-card h1 {
    font-size: 22px;
  }

  .card-actions {
    flex-direction: column;
  }

  .card-meta {
    flex-direction: column;
  }
}
</style>
