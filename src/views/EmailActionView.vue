<template>
  <div class="email-action-page">

    <!-- Loading -->
    <div v-if="uiState === 'loading'" class="action-card">
      <el-icon :size="52" color="#409eff" class="spinning"><Loading /></el-icon>
      <p class="hint">กำลังโหลดข้อมูล...</p>
    </div>

    <!-- Already Processed -->
    <div v-else-if="uiState === 'already-processed'" class="action-card">
      <el-icon :size="52" color="#e6a23c"><InfoFilled /></el-icon>
      <h2>ดำเนินการไปแล้ว</h2>
      <p>คำขอของโรงเรียน <b>{{ schoolInfo.schoolName }}</b> ได้รับการ
        <b>{{ schoolInfo.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ' }}</b> ไปแล้ว</p>
      <el-button @click="goAdmin">ไปยังหน้าจัดการคำขอ</el-button>
    </div>

    <!-- Confirm: Approve -->
    <div v-else-if="uiState === 'confirm' && routeAction === 'approve'" class="action-card">
      <el-icon :size="52" color="#67c23a"><CircleCheckFilled /></el-icon>
      <h2>อนุมัติคำขอโรงเรียน</h2>
      <el-descriptions :column="1" border class="school-desc">
        <el-descriptions-item label="ชื่อโรงเรียน">{{ schoolInfo.schoolName }}</el-descriptions-item>
        <el-descriptions-item label="ผู้ติดต่อ">{{ schoolInfo.contactName }}</el-descriptions-item>
        <el-descriptions-item label="ที่อยู่">{{ schoolInfo.schoolAddress || '-' }}</el-descriptions-item>
        <el-descriptions-item label="เบอร์โทร">{{ schoolInfo.schoolPhone || '-' }}</el-descriptions-item>
      </el-descriptions>
      <p class="hint">ยืนยันการอนุมัติ? ระบบจะสร้างบัญชีและส่งอีเมลยินดีต้อนรับโดยอัตโนมัติ</p>
      <el-button type="success" size="large" :loading="submitting" @click="doSubmit">
        ✅&nbsp; ยืนยันอนุมัติ
      </el-button>
    </div>

    <!-- Confirm: Reject -->
    <div v-else-if="uiState === 'confirm' && routeAction === 'reject'" class="action-card">
      <el-icon :size="52" color="#f56c6c"><CircleCloseFilled /></el-icon>
      <h2>ปฏิเสธคำขอโรงเรียน</h2>
      <p>โรงเรียน: <b>{{ schoolInfo.schoolName }}</b></p>
      <el-form class="reject-form">
        <el-form-item label="เหตุผล (จำเป็น)">
          <el-input
            v-model="rejectReason"
            type="textarea"
            :rows="4"
            placeholder="ระบุเหตุผลที่จะแจ้งให้โรงเรียนทราบ..."
            :maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <el-button
        type="danger"
        size="large"
        :loading="submitting"
        :disabled="!rejectReason.trim()"
        @click="doSubmit"
      >
        ❌&nbsp; ยืนยันปฏิเสธ
      </el-button>
    </div>

    <!-- Success -->
    <div v-else-if="uiState === 'success'" class="action-card">
      <el-icon v-if="routeAction === 'approve'" :size="52" color="#67c23a"><CircleCheckFilled /></el-icon>
      <el-icon v-else :size="52" color="#f56c6c"><CircleCloseFilled /></el-icon>
      <h2>{{ routeAction === 'approve' ? '✅ อนุมัติสำเร็จ' : '❌ ปฏิเสธสำเร็จ' }}</h2>
      <p v-if="routeAction === 'approve'">
        โรงเรียน <b>{{ schoolInfo.schoolName }}</b> ได้รับการอนุมัติแล้ว<br/>
        ระบบส่งอีเมลข้อมูลการเข้าสู่ระบบให้ผู้ดูแลโรงเรียนเรียบร้อย
      </p>
      <p v-else>
        ปฏิเสธคำขอของโรงเรียน <b>{{ schoolInfo.schoolName }}</b> เรียบร้อย<br/>
        ระบบแจ้งเหตุผลให้ผู้ขอทางอีเมลแล้ว
      </p>
      <el-button type="primary" @click="goHome">กลับหน้าแรก</el-button>
    </div>

    <!-- Error -->
    <div v-else-if="uiState === 'error'" class="action-card">
      <el-icon :size="52" color="#f56c6c"><WarningFilled /></el-icon>
      <h2>เกิดข้อผิดพลาด</h2>
      <p>{{ errorMessage }}</p>
      <el-button @click="goHome">กลับหน้าแรก</el-button>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import {
  Loading, InfoFilled,
  CircleCheckFilled, CircleCloseFilled, WarningFilled
} from '@element-plus/icons-vue'
import { db } from '@/firebase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'

const route = useRoute()
const router = useRouter()
const gasApprovalEndpoint = import.meta.env.VITE_GAS_APPROVAL_ENDPOINT || ''
const authStore = useAuthStore()
const { approveSchoolRequest, rejectSchoolRequest } = useSchoolManagement()

const routeAction = route.query.action   // 'approve' | 'reject'
const token       = route.query.token
const requestId   = ref('')

const uiState     = ref('loading')       // loading | confirm | already-processed | success | error
const submitting  = ref(false)
const rejectReason = ref('')
const errorMessage = ref('')
const schoolInfo  = ref({ schoolName: '', contactName: '', schoolAddress: '', schoolPhone: '', status: '' })

function goAdmin() {
  router.push('/superadmin/school-requests')
}

function goHome() {
  router.push('/')
}

onMounted(async () => {
  if (!token || !['approve', 'reject'].includes(routeAction)) {
    errorMessage.value = 'ลิงก์ไม่ถูกต้อง กรุณาตรวจสอบหรือขอลิงก์ใหม่'
    uiState.value = 'error'
    return
  }

  try {
    const requestSnap = await getDocs(query(
      collection(db, 'school_requests'),
      where('approvalToken', '==', token),
      limit(1)
    ))

    if (requestSnap.empty) {
      errorMessage.value = 'ไม่พบคำขอ หรือลิงก์หมดอายุแล้ว'
      uiState.value = 'error'
      return
    }

    const requestDoc = requestSnap.docs[0]
    const requestData = requestDoc.data()
    requestId.value = requestDoc.id

    if (requestData.status !== 'pending') {
      schoolInfo.value = {
        schoolName: requestData.schoolName,
        status: requestData.status
      }
      uiState.value = 'already-processed'
      return
    }

    schoolInfo.value = {
      schoolName: requestData.schoolName,
      contactName: requestData.contactName,
      schoolAddress: requestData.schoolAddress || '',
      schoolPhone: requestData.schoolPhone || '',
      status: requestData.status
    }
    uiState.value = 'confirm'
  } catch {
    errorMessage.value = 'ไม่สามารถโหลดข้อมูลคำขอได้ กรุณาลองใหม่'
    uiState.value = 'error'
  }
})

async function doSubmit() {
  if (routeAction === 'reject' && !rejectReason.value.trim()) return

  submitting.value = true

  try {
    let result
    if (gasApprovalEndpoint) {
      const response = await fetch(gasApprovalEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: 'school-approval',
          action: routeAction,
          token: String(token || ''),
          reason: routeAction === 'reject' ? rejectReason.value.trim() : ''
        })
      })
      result = await response.json()
    } else {
      if (!authStore.isSuperAdmin) {
        errorMessage.value = 'ยังไม่ตั้งค่าโหมดอนุมัติผ่านลิงก์อัตโนมัติ กรุณาเข้าสู่ระบบ SuperAdmin ก่อนดำเนินการ'
        uiState.value = 'error'
        return
      }
      result = routeAction === 'approve'
        ? await approveSchoolRequest(requestId.value, authStore.profile?.uid)
        : await rejectSchoolRequest(requestId.value, rejectReason.value.trim(), authStore.profile?.uid)
    }

    if (!result.success) {
      if (result.alreadyProcessed) {
        schoolInfo.value = {
          schoolName: result.schoolName || schoolInfo.value.schoolName,
          status: result.status || schoolInfo.value.status
        }
        uiState.value = 'already-processed'
      } else {
        errorMessage.value = result.message || result.error || 'เกิดข้อผิดพลาด'
        uiState.value = 'error'
      }
      return
    }

    uiState.value = 'success'
  } catch {
    errorMessage.value = 'ไม่สามารถดำเนินการได้'
    uiState.value = 'error'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.email-action-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 20px;
}

.action-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 48px 40px;
  max-width: 580px;
  width: 100%;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.action-card h2 {
  margin: 16px 0 8px;
  font-size: 22px;
  color: #303133;
}

.action-card p {
  color: #606266;
  margin: 8px 0 20px;
  line-height: 1.6;
}

.hint {
  color: #909399 !important;
  font-size: 14px;
}

.school-desc {
  margin: 16px 0 20px;
  text-align: left;
}

.reject-form {
  width: 100%;
  max-width: 480px;
  text-align: left;
  margin: 0 auto 16px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
