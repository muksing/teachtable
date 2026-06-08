<template>
  <div class="school-requests">
    <div class="page-header-enhanced">
      <div class="header-title">
        <el-icon class="title-icon"><DocumentAdd /></el-icon>
        <div>
          <h2>School Registration Requests</h2>
          <p>ตรวจสอบคำขอสมัครโรงเรียนและคำขอต่ออายุ พร้อมพิจารณาหลักฐานโอนเงินได้ในหน้าเดียว</p>
        </div>
      </div>
      <el-button type="primary" @click="refreshRequests" class="refresh-btn">
        <el-icon><Refresh /></el-icon>
        Refresh
      </el-button>
    </div>

    <el-tabs v-model="activeTab" @tab-click="handleTabChange" class="requests-tabs">
      <el-tab-pane label="Pending" name="pending">
        <div class="tab-toolbar">
          <div class="search-filter-group">
            <el-input
              v-model="searchPending"
              placeholder="ค้นหา โรงเรียน ชื่อติดต่อ อีเมล..."
              class="search-input"
              clearable
              @input="handleSearchPending"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button @click="expandFiltersPending = !expandFiltersPending" plain>
              <el-icon><Filter /></el-icon>
              Filters
            </el-button>
          </div>
          <div v-if="expandFiltersPending" class="filter-options">
            <el-date-picker
              v-model="filterDateRangePending"
              type="daterange"
              range-separator="-"
              start-placeholder="วันเริ่มต้น"
              end-placeholder="วันสิ้นสุด"
              @change="handleFilterPending"
              clearable
            />
          </div>
        </div>

        <el-table
          :data="filteredPendingRequests"
          style="width: 100%"
          :loading="loading"
          empty-text="No pending requests"
          stripe
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="schoolName" label="School Name" min-width="200">
            <template #default="scope">
              <div class="school-name-cell">
                <span>{{ scope.row.schoolName }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="contactName" label="Contact Person" width="150" />
          <el-table-column prop="contactEmail" label="Email" min-width="200" />
          <el-table-column prop="contactPhone" label="Phone" width="120" />
          <el-table-column prop="schoolAddress" label="Address" min-width="180" show-overflow-tooltip />
          <el-table-column label="Submitted" width="130" align="center">
            <template #default="scope">
              <el-tag type="info" effect="light">
                {{ formatDate(scope.row.submittedAt) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="220" fixed="right" align="center">
            <template #default="scope">
              <div class="action-buttons">
                <el-button
                  type="success"
                  size="small"
                  @click="showApproveDialog(scope.row)"
                  link
                >
                  <el-icon><Check /></el-icon>
                  Approve
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  @click="showRejectDialog(scope.row)"
                  link
                >
                  <el-icon><Close /></el-icon>
                  Reject
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="currentPagePending"
          v-model:page-size="pageSizePending"
          :page-sizes="[5, 10, 20, 50]"
          :total="pendingRequests.length"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChangePending"
          @size-change="handlePageSizeChangePending"
          class="pagination-bottom"
        />
      </el-tab-pane>

      <el-tab-pane label="Approved" name="approved">
        <div class="tab-toolbar">
          <div class="search-filter-group">
            <el-input
              v-model="searchApproved"
              placeholder="ค้นหา โรงเรียน ชื่อติดต่อ School ID..."
              class="search-input"
              clearable
              @input="handleSearchApproved"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button @click="expandFiltersApproved = !expandFiltersApproved" plain>
              <el-icon><Filter /></el-icon>
              Filters
            </el-button>
          </div>
          <div v-if="expandFiltersApproved" class="filter-options">
            <el-date-picker
              v-model="filterDateRangeApproved"
              type="daterange"
              range-separator="-"
              start-placeholder="วันเริ่มต้น"
              end-placeholder="วันสิ้นสุด"
              @change="handleFilterApproved"
              clearable
            />
          </div>
        </div>

        <el-table
          :data="filteredApprovedRequests"
          style="width: 100%"
          :loading="loading"
          empty-text="No approved requests"
          stripe
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="schoolName" label="School Name" min-width="200" />
          <el-table-column prop="contactName" label="Contact Person" width="150" />
          <el-table-column prop="schoolId" label="School ID" width="140" />
          <el-table-column prop="adminEmail" label="Admin Email" min-width="210" />
          <el-table-column label="Approved" width="130" align="center">
            <template #default="scope">
              <el-tag type="success" effect="light">
                {{ formatDate(scope.row.approvedAt) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Status" width="100" align="center">
            <template #default>
              <el-tag type="success" effect="dark">
                <el-icon><SuccessFilled /></el-icon>
                Active
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="currentPageApproved"
          v-model:page-size="pageSizeApproved"
          :page-sizes="[5, 10, 20, 50]"
          :total="approvedRequests.length"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChangeApproved"
          @size-change="handlePageSizeChangeApproved"
          class="pagination-bottom"
        />
      </el-tab-pane>

      <el-tab-pane label="Rejected" name="rejected">
        <div class="tab-toolbar">
          <div class="search-filter-group">
            <el-input
              v-model="searchRejected"
              placeholder="ค้นหา โรงเรียน ชื่อติดต่อ อีเมล ..."
              class="search-input"
              clearable
              @input="handleSearchRejected"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button @click="expandFiltersRejected = !expandFiltersRejected" plain>
              <el-icon><Filter /></el-icon>
              Filters
            </el-button>
          </div>
          <div v-if="expandFiltersRejected" class="filter-options">
            <el-date-picker
              v-model="filterDateRangeRejected"
              type="daterange"
              range-separator="-"
              start-placeholder="วันเริ่มต้น"
              end-placeholder="วันสิ้นสุด"
              @change="handleFilterRejected"
              clearable
            />
          </div>
        </div>

        <el-table
          :data="filteredRejectedRequests"
          style="width: 100%"
          :loading="loading"
          empty-text="No rejected requests"
          stripe
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="schoolName" label="School Name" min-width="200" />
          <el-table-column prop="contactName" label="Contact Person" width="150" />
          <el-table-column prop="contactEmail" label="Email" min-width="210" />
          <el-table-column prop="rejectionReason" label="Reason" min-width="220" show-overflow-tooltip />
          <el-table-column label="Rejected" width="130" align="center">
            <template #default="scope">
              <el-tag type="danger" effect="light">
                {{ formatDate(scope.row.reviewedAt) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="240" fixed="right" align="center">
            <template #default="scope">
              <div class="action-buttons">
                <el-button
                  type="success"
                  size="small"
                  @click="showApproveDialog(scope.row)"
                  link
                >
                  <el-icon><Check /></el-icon>
                  Approve Again
                </el-button>
                <el-button
                  type="warning"
                  size="small"
                  @click="showRejectDialog(scope.row)"
                  link
                >
                  <el-icon><Edit /></el-icon>
                  Update Reason
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="currentPageRejected"
          v-model:page-size="pageSizeRejected"
          :page-sizes="[5, 10, 20, 50]"
          :total="rejectedRequests.length"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChangeRejected"
          @size-change="handlePageSizeChangeRejected"
          class="pagination-bottom"
        />
      </el-tab-pane>

      <el-tab-pane :label="renewalTabLabel" name="renewal">
        <div class="tab-toolbar">
          <div class="search-filter-group">
            <el-input
              v-model="searchRenewal"
              placeholder="ค้นหา โรงเรียน School ID แพ็กเกจ..."
              class="search-input"
              clearable
              @input="handleSearchRenewal"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button @click="expandFiltersRenewal = !expandFiltersRenewal" plain>
              <el-icon><Filter /></el-icon>
              Filters
            </el-button>
          </div>
          <div v-if="expandFiltersRenewal" class="filter-options">
            <el-select v-model="filterRenewalStatus" placeholder="สถานะ" clearable @change="handleFilterRenewal" style="width: 200px">
              <el-option label="All" value="" />
              <el-option label="Pending" value="pending" />
              <el-option label="Approved" value="approved" />
              <el-option label="Rejected" value="rejected" />
            </el-select>
            <el-select v-model="filterRenewalMode" placeholder="โหมด" clearable @change="handleFilterRenewal" style="width: 150px">
              <el-option label="All" value="" />
              <el-option label="Auto" value="auto" />
              <el-option label="Manual" value="manual" />
            </el-select>
          </div>
        </div>

        <el-table
          :data="filteredRenewalRequests"
          style="width: 100%"
          :loading="loading"
          empty-text="No renewal requests"
          stripe
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="school_name" label="School" min-width="220" />
          <el-table-column label="Plan" width="160" show-overflow-tooltip>
            <template #default="scope">
              <el-tag>{{ formatRenewalPlan(scope.row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="Amount" width="130" align="right">
            <template #default="scope">
              <span class="amount-text">{{ Number(scope.row.amount || 0).toLocaleString('th-TH') }} ฿</span>
            </template>
          </el-table-column>
          <el-table-column label="Calculated" width="140" align="right">
            <template #default="scope">
              <span class="calc-amount-text">{{ Number(scope.row.calculated_total || 0).toLocaleString('th-TH') }} ฿</span>
            </template>
          </el-table-column>
          <el-table-column label="Mode" width="120" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.renewal_mode === 'auto' ? 'success' : 'info'" effect="light">
                <el-icon v-if="scope.row.renewal_mode === 'auto'"><Clock /></el-icon>
                <el-icon v-else><Setting /></el-icon>
                {{ scope.row.renewal_mode === 'auto' ? 'Auto' : 'Manual' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Paid" width="130" align="center" show-overflow-tooltip>
            <template #default="scope">
              {{ formatDate(scope.row.payment_date) }}
            </template>
          </el-table-column>
          <el-table-column label="Proof" width="100" align="center">
            <template #default="scope">
              <el-image
                v-if="scope.row.payment_proof_image"
                :src="scope.row.payment_proof_image"
                :preview-src-list="[scope.row.payment_proof_image]"
                fit="cover"
                class="proof-thumb"
                preview-teleported
              />
              <span v-else class="text-gray-400 text-sm">No file</span>
            </template>
          </el-table-column>
          <el-table-column label="Status" width="120" align="center">
            <template #default="scope">
              <el-tag :type="getRenewalStatusType(scope.row.status)">
                {{ scope.row.status || 'pending' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Submitted" width="130" align="center">
            <template #default="scope">
              <el-tag type="info" effect="light" size="small">
                {{ formatDate(scope.row.created_at) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Note" min-width="180" show-overflow-tooltip>
            <template #default="scope">
              <span v-if="scope.row.note" class="note-text">{{ scope.row.note }}</span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="280" fixed="right" align="center">
            <template #default="scope">
              <div v-if="scope.row.status === 'pending'" class="action-buttons-flex">
                <el-button type="success" size="small" @click="showApproveRenewalDialog(scope.row)" link>
                  <el-icon><Check /></el-icon>
                  Approve
                </el-button>
                <el-button type="danger" size="small" @click="showRejectRenewalDialog(scope.row)" link>
                  <el-icon><Close /></el-icon>
                  Reject
                </el-button>
                <el-popconfirm
                  title="ลบคำขอนี้ใช่ไหม?"
                  confirm-button-text="ลบ"
                  cancel-button-text="ยกเลิก"
                  confirm-button-type="danger"
                  @confirm="confirmDeleteRenewal(scope.row)"
                >
                  <template #reference>
                    <el-button type="warning" size="small" link>
                      <el-icon><Delete /></el-icon>
                      Delete
                    </el-button>
                  </template>
                </el-popconfirm>
              </div>
              <div v-else class="action-reviewed">
                <el-tag type="info" effect="light" size="small">Reviewed</el-tag>
                <el-popconfirm
                  title="ลบคำขอนี้ใช่ไหม?"
                  confirm-button-text="ลบ"
                  cancel-button-text="ยกเลิก"
                  confirm-button-type="danger"
                  @confirm="confirmDeleteRenewal(scope.row)"
                >
                  <template #reference>
                    <el-button type="danger" size="small" plain icon link>
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </template>
                </el-popconfirm>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="currentPageRenewal"
          v-model:page-size="pageSizeRenewal"
          :page-sizes="[5, 10, 20, 50]"
          :total="renewalRequests.length"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChangeRenewal"
          @size-change="handlePageSizeChangeRenewal"
          class="pagination-bottom"
        />
      </el-tab-pane>
    </el-tabs>

    <el-alert
      v-if="pendingRenewalCount > 0"
      type="info"
      :closable="false"
      show-icon
      class="mb-4"
      title="มีคำขอต่ออายุรอพิจารณา"
      :description="`ขณะนี้มี ${pendingRenewalCount} รายการรอตรวจสอบสลิปและอนุมัติ`"
    />

    <!-- Approve Dialog -->
    <el-dialog
      v-model="approveDialogVisible"
      title="Approve School Registration"
      width="500px"
    >
      <div v-if="selectedRequest" class="dialog-content">
        <p><strong>School:</strong> {{ selectedRequest.schoolName }}</p>
        <p><strong>Contact:</strong> {{ selectedRequest.contactName }}</p>
        <p><strong>Email:</strong> {{ selectedRequest.contactEmail }}</p>
        <p><strong>Admin Email:</strong> {{ selectedRequest.adminEmail }}</p>

        <el-alert
          :title="selectedRequest.status === 'rejected' ? 'Re-Approval Notes' : 'Important Notes'"
          type="warning"
          :closable="false"
          style="margin-top: 20px"
        >
          <ul>
            <li v-if="selectedRequest.status !== 'rejected'">This will create a new school account</li>
            <li v-else>This will re-process a previously rejected request</li>
            <li>Admin will receive login credentials via email</li>
            <li>School will be able to access the system immediately</li>
          </ul>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="approveDialogVisible = false">Cancel</el-button>
        <el-button
          type="primary"
          @click="confirmApprove"
          :loading="approveLoading"
        >
          Confirm Approval
        </el-button>
      </template>
    </el-dialog>

    <!-- Reject Dialog -->
    <el-dialog
      v-model="rejectDialogVisible"
      title="Reject School Registration"
      width="500px"
    >
      <div v-if="selectedRequest" class="dialog-content">
        <p><strong>School:</strong> {{ selectedRequest.schoolName }}</p>
        <p><strong>Contact:</strong> {{ selectedRequest.contactName }}</p>

        <el-form :model="rejectForm" label-width="80px" style="margin-top: 20px">
          <el-form-item label="Reason" required>
            <el-input
              v-model="rejectForm.reason"
              type="textarea"
              :rows="3"
              placeholder="Please provide a reason for rejection"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="rejectDialogVisible = false">Cancel</el-button>
        <el-button
          type="danger"
          @click="confirmReject"
          :loading="rejectLoading"
          :disabled="!rejectForm.reason.trim()"
        >
          Confirm Rejection
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="approveRenewalDialogVisible"
      title="Approve Renewal Request"
      width="560px"
    >
      <div v-if="selectedRenewal" class="dialog-content">
        <p><strong>School:</strong> {{ selectedRenewal.school_name }}</p>
        <p><strong>Package:</strong> {{ formatRenewalPlan(selectedRenewal) }}</p>
        <p><strong>Amount:</strong> {{ Number(selectedRenewal.amount || 0).toLocaleString('th-TH') }} บาท</p>
        <p><strong>Calculated:</strong> {{ Number(selectedRenewal.calculated_total || 0).toLocaleString('th-TH') }} บาท</p>
        <p><strong>Mode:</strong> {{ selectedRenewal.renewal_mode === 'auto' ? 'อัตโนมัติเมื่อโอนครบ' : 'ตั้งค่าเอง' }}</p>
        <p><strong>Paid At:</strong> {{ formatDate(selectedRenewal.payment_date) }}</p>
        <p><strong>Contact:</strong> {{ selectedRenewal.contact_name }} ({{ selectedRenewal.contact_email || '-' }})</p>
        
        <el-divider />
        
        <div style="background: #f5f7fa; padding: 12px; border-radius: 4px; margin: 12px 0">
          <p style="margin: 0 0 8px 0">
            <strong>Calculated Concurrent:</strong>
            {{ selectedRenewal.calculation_input?.concurrent || 0 }} คน
          </p>
          <p style="margin: 0">
            <strong>Will Apply Scheduler Limit:</strong>
            <el-tag :type="selectedRenewal.calculation_input?.concurrent > 0 ? 'success' : 'info'">
              {{ selectedRenewal.calculation_input?.concurrent > 0 ? selectedRenewal.calculation_input.concurrent + ' คน' : 'ใช้ค่าแพ็กเกจ' }}
            </el-tag>
          </p>
        </div>
        
        <el-alert
          v-if="isUnderPaidAuto(selectedRenewal)"
          type="error"
          :closable="false"
          show-icon
          title="ยอดโอนไม่ครบตามยอดคำนวณสำหรับโหมดอัตโนมัติ"
          :description="`ขาดอีก ${Number(shortAmount(selectedRenewal)).toLocaleString('th-TH')} บาท`"
          style="margin-top: 12px"
        />
        <el-image
          v-if="selectedRenewal.payment_proof_image"
          :src="selectedRenewal.payment_proof_image"
          :preview-src-list="[selectedRenewal.payment_proof_image]"
          fit="contain"
          class="proof-dialog-image"
          preview-teleported
        />
      </div>

      <template #footer>
        <el-button @click="approveRenewalDialogVisible = false">Cancel</el-button>
        <el-button
          type="primary"
          @click="confirmApproveRenewal"
          :loading="approveRenewalLoading"
        >
          Confirm Renewal Approval
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rejectRenewalDialogVisible"
      title="Reject Renewal Request"
      width="520px"
    >
      <div v-if="selectedRenewal" class="dialog-content">
        <p><strong>School:</strong> {{ selectedRenewal.school_name }}</p>
        <p><strong>Package:</strong> {{ formatRenewalPlan(selectedRenewal) }}</p>

        <el-form :model="renewalRejectForm" label-width="80px" style="margin-top: 20px">
          <el-form-item label="Reason" required>
            <el-input
              v-model="renewalRejectForm.reason"
              type="textarea"
              :rows="3"
              placeholder="Please provide a reason for rejection"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="rejectRenewalDialogVisible = false">Cancel</el-button>
        <el-button
          type="danger"
          @click="confirmRejectRenewal"
          :loading="rejectRenewalLoading"
          :disabled="!renewalRejectForm.reason.trim()"
        >
          Confirm Rejection
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import {
  Refresh,
  Check,
  Close,
  Delete,
  DocumentAdd,
  Search,
  Filter,
  Edit,
  SuccessFilled,
  Clock,
  Setting
} from '@element-plus/icons-vue'

const authStore = useAuthStore()
const {
  getSchoolRequests,
  getRenewalRequests,
  approveSchoolRequest,
  approveRenewalRequest,
  rejectSchoolRequest,
  rejectRenewalRequest,
  deleteRenewalRequest,
  getPackageCatalog,
} = useSchoolManagement()

const catalogMap = ref({})

const loading = ref(false)
const activeTab = ref('pending')
const pendingRequests = ref([])
const approvedRequests = ref([])
const rejectedRequests = ref([])
const renewalRequests = ref([])

// Search states
const searchPending = ref('')
const searchApproved = ref('')
const searchRejected = ref('')
const searchRenewal = ref('')

// Filter states
const expandFiltersPending = ref(false)
const expandFiltersApproved = ref(false)
const expandFiltersRejected = ref(false)
const expandFiltersRenewal = ref(false)

const filterDateRangePending = ref([])
const filterDateRangeApproved = ref([])
const filterDateRangeRejected = ref([])

const filterRenewalStatus = ref('')
const filterRenewalMode = ref('')

// Pagination states
const currentPagePending = ref(1)
const pageSizePending = ref(10)

const currentPageApproved = ref(1)
const pageSizeApproved = ref(10)

const currentPageRejected = ref(1)
const pageSizeRejected = ref(10)

const currentPageRenewal = ref(1)
const pageSizeRenewal = ref(10)

// Dialog states
const approveDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const selectedRequest = ref(null)
const selectedRenewal = ref(null)
const approveLoading = ref(false)
const rejectLoading = ref(false)
const approveRenewalDialogVisible = ref(false)
const rejectRenewalDialogVisible = ref(false)
const approveRenewalLoading = ref(false)
const rejectRenewalLoading = ref(false)

const rejectForm = ref({
  reason: ''
})

const renewalRejectForm = ref({
  reason: ''
})

const pendingRenewalCount = computed(() => renewalRequests.value.filter((item) => item.status === 'pending').length)
const renewalTabLabel = computed(() => pendingRenewalCount.value > 0 ? `Renewal (${pendingRenewalCount.value})` : 'Renewal')

// Filtered and paginated pending requests
const filteredPendingRequests = computed(() => {
  let filtered = pendingRequests.value
    .filter(item => {
      const text = `${item.schoolName} ${item.contactName} ${item.contactEmail} ${item.contactPhone}`.toLowerCase()
      return text.includes(searchPending.value.toLowerCase())
    })
    .filter(item => {
      if (!filterDateRangePending.value || filterDateRangePending.value.length !== 2) return true
      const [start, end] = filterDateRangePending.value
      const itemDate = typeof item.submittedAt?.toDate === 'function' ? item.submittedAt.toDate() : new Date(item.submittedAt)
      return itemDate >= start && itemDate <= end
    })
  
  const start = (currentPagePending.value - 1) * pageSizePending.value
  return filtered.slice(start, start + pageSizePending.value)
})

// Filtered and paginated approved requests
const filteredApprovedRequests = computed(() => {
  let filtered = approvedRequests.value
    .filter(item => {
      const text = `${item.schoolName} ${item.contactName} ${item.schoolId || ''}`.toLowerCase()
      return text.includes(searchApproved.value.toLowerCase())
    })
    .filter(item => {
      if (!filterDateRangeApproved.value || filterDateRangeApproved.value.length !== 2) return true
      const [start, end] = filterDateRangeApproved.value
      const itemDate = typeof item.approvedAt?.toDate === 'function' ? item.approvedAt.toDate() : new Date(item.approvedAt)
      return itemDate >= start && itemDate <= end
    })
  
  const start = (currentPageApproved.value - 1) * pageSizeApproved.value
  return filtered.slice(start, start + pageSizeApproved.value)
})

// Filtered and paginated rejected requests
const filteredRejectedRequests = computed(() => {
  let filtered = rejectedRequests.value
    .filter(item => {
      const text = `${item.schoolName} ${item.contactName} ${item.contactEmail}`.toLowerCase()
      return text.includes(searchRejected.value.toLowerCase())
    })
    .filter(item => {
      if (!filterDateRangeRejected.value || filterDateRangeRejected.value.length !== 2) return true
      const [start, end] = filterDateRangeRejected.value
      const itemDate = typeof item.reviewedAt?.toDate === 'function' ? item.reviewedAt.toDate() : new Date(item.reviewedAt)
      return itemDate >= start && itemDate <= end
    })
  
  const start = (currentPageRejected.value - 1) * pageSizeRejected.value
  return filtered.slice(start, start + pageSizeRejected.value)
})

// Filtered and paginated renewal requests
const filteredRenewalRequests = computed(() => {
  let filtered = renewalRequests.value
    .filter(item => {
      const text = `${item.school_name} ${item.school_id || ''} ${item.plan_code || ''}`.toLowerCase()
      return text.includes(searchRenewal.value.toLowerCase())
    })
    .filter(item => {
      if (filterRenewalStatus.value && item.status !== filterRenewalStatus.value) return false
      if (filterRenewalMode.value && item.renewal_mode !== filterRenewalMode.value) return false
      return true
    })
  
  const start = (currentPageRenewal.value - 1) * pageSizeRenewal.value
  return filtered.slice(start, start + pageSizeRenewal.value)
})

async function loadRequests() {
  loading.value = true

  try {
    // Load all request types
    const [pending, approved, rejected, renewals] = await Promise.all([
      getSchoolRequests('pending'),
      getSchoolRequests('approved'),
      getSchoolRequests('rejected'),
      getRenewalRequests(),
    ])

    if (pending.success) pendingRequests.value = pending.data
    if (approved.success) approvedRequests.value = approved.data
    if (rejected.success) rejectedRequests.value = rejected.data
    if (renewals.success) {
      renewalRequests.value = renewals.data
      if (renewals.data.some((item) => item.status === 'pending')) {
        activeTab.value = 'renewal'
      }
    }

  } catch (error) {
    console.error('Error loading requests:', error)
    ElMessage.error('Failed to load requests')
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  // Tab content is already loaded
}

// Search handlers
function handleSearchPending() {
  currentPagePending.value = 1 // Reset pagination
}

function handleSearchApproved() {
  currentPageApproved.value = 1
}

function handleSearchRejected() {
  currentPageRejected.value = 1
}

function handleSearchRenewal() {
  currentPageRenewal.value = 1
}

// Filter handlers
function handleFilterPending() {
  currentPagePending.value = 1
}

function handleFilterApproved() {
  currentPageApproved.value = 1
}

function handleFilterRejected() {
  currentPageRejected.value = 1
}

function handleFilterRenewal() {
  currentPageRenewal.value = 1
}

// Pagination handlers
function handlePageChangePending(page) {
  currentPagePending.value = page
}

function handlePageSizeChangePending(size) {
  pageSizePending.value = size
  currentPagePending.value = 1
}

function handlePageChangeApproved(page) {
  currentPageApproved.value = page
}

function handlePageSizeChangeApproved(size) {
  pageSizeApproved.value = size
  currentPageApproved.value = 1
}

function handlePageChangeRejected(page) {
  currentPageRejected.value = page
}

function handlePageSizeChangeRejected(size) {
  pageSizeRejected.value = size
  currentPageRejected.value = 1
}

function handlePageChangeRenewal(page) {
  currentPageRenewal.value = page
}

function handlePageSizeChangeRenewal(size) {
  pageSizeRenewal.value = size
  currentPageRenewal.value = 1
}

function showApproveDialog(request) {
  selectedRequest.value = request
  approveDialogVisible.value = true
}

function showRejectDialog(request) {
  selectedRequest.value = request
  rejectForm.value.reason = ''
  rejectDialogVisible.value = true
}

function showApproveRenewalDialog(request) {
  selectedRenewal.value = request
  approveRenewalDialogVisible.value = true
}

function showRejectRenewalDialog(request) {
  selectedRenewal.value = request
  renewalRejectForm.value.reason = ''
  rejectRenewalDialogVisible.value = true
}

async function confirmApprove() {
  if (!selectedRequest.value) return

  approveLoading.value = true

  try {
    const result = await approveSchoolRequest(
      selectedRequest.value.id,
      authStore.profile?.uid
    )

    if (result.success) {
      ElMessage.success('School approved successfully!')
      approveDialogVisible.value = false
      await loadRequests() // Refresh data

      // Approval email is queued in useSchoolManagement
      console.log('Approval email queued for:', selectedRequest.value.adminEmail)

    } else {
      ElMessage.error(result.error || 'Failed to approve school')
    }

  } catch (error) {
    console.error('Error approving school:', error)
    ElMessage.error('An error occurred while approving the school')
  } finally {
    approveLoading.value = false
  }
}

async function confirmReject() {
  if (!selectedRequest.value || !rejectForm.value.reason.trim()) return

  rejectLoading.value = true

  try {
    const result = await rejectSchoolRequest(
      selectedRequest.value.id,
      rejectForm.value.reason,
      authStore.profile?.uid
    )

    if (result.success) {
      ElMessage.success('School request rejected')
      rejectDialogVisible.value = false
      await loadRequests() // Refresh data

      // Rejection email is queued in useSchoolManagement
      console.log('Rejection email queued for:', selectedRequest.value.contactEmail)

    } else {
      ElMessage.error(result.error || 'Failed to reject school')
    }

  } catch (error) {
    console.error('Error rejecting school:', error)
    ElMessage.error('An error occurred while rejecting the school')
  } finally {
    rejectLoading.value = false
  }
}

async function confirmApproveRenewal() {
  if (!selectedRenewal.value) return

  if (isUnderPaidAuto(selectedRenewal.value)) {
    ElMessage.warning('คำขอแบบอัตโนมัติต้องโอนครบตามยอดคำนวณก่อนอนุมัติ')
    return
  }

  approveRenewalLoading.value = true

  try {
    const result = await approveRenewalRequest(
      selectedRenewal.value.id,
      selectedRenewal.value.school_id,
      authStore.profile?.uid
    )

    if (result.success) {
      ElMessage.success('Renewal request approved successfully')
      approveRenewalDialogVisible.value = false
      await loadRequests()
    } else {
      ElMessage.error(result.error || 'Failed to approve renewal request')
    }
  } catch (error) {
    console.error('Error approving renewal request:', error)
    ElMessage.error('An error occurred while approving the renewal request')
  } finally {
    approveRenewalLoading.value = false
  }
}

async function confirmRejectRenewal() {
  if (!selectedRenewal.value || !renewalRejectForm.value.reason.trim()) return

  rejectRenewalLoading.value = true

  try {
    const result = await rejectRenewalRequest(
      selectedRenewal.value.id,
      selectedRenewal.value.school_id,
      renewalRejectForm.value.reason,
      authStore.profile?.uid
    )

    if (result.success) {
      ElMessage.success('Renewal request rejected')
      rejectRenewalDialogVisible.value = false
      await loadRequests()
    } else {
      ElMessage.error(result.error || 'Failed to reject renewal request')
    }
  } catch (error) {
    console.error('Error rejecting renewal request:', error)
    ElMessage.error('An error occurred while rejecting the renewal request')
  } finally {
    rejectRenewalLoading.value = false
  }
}

async function confirmDeleteRenewal(request) {
  try {
    const result = await deleteRenewalRequest(request.id, request.school_id)
    if (result.success) {
      ElMessage.success('ลบคำขอต่ออายุเรียบร้อยแล้ว')
      await loadRequests()
    } else {
      ElMessage.error(result.error || 'ไม่สามารถลบคำขอได้')
    }
  } catch (error) {
    console.error('Error deleting renewal request:', error)
    ElMessage.error('เกิดข้อผิดพลาดในการลบคำขอ')
  }
}

function formatRenewalPlan(request) {
  const months = Number(request?.months || 1)
  const code = request?.plan_code || request?.current_plan_code || '-'
  const name = catalogMap.value[code]
  const label = name ? `${name} (${code})` : code
  return `${label} / ${months} เดือน`
}

function getRenewalStatusType(status) {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

function isUnderPaidAuto(request) {
  if (!request) return false
  if (String(request.renewal_mode || 'manual') !== 'auto') return false
  const required = Number(request.calculated_total || 0)
  const paid = Number(request.amount || 0)
  return required > 0 && paid < required
}

function shortAmount(request) {
  if (!request) return 0
  const required = Number(request.calculated_total || 0)
  const paid = Number(request.amount || 0)
  return Math.max(0, required - paid)
}

function formatDate(date) {
  if (!date) return ''
  const normalized = typeof date?.toDate === 'function' ? date.toDate() : new Date(date)
  if (Number.isNaN(normalized.getTime())) return ''
  return normalized.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function refreshRequests() {
  loadRequests()
}

async function loadCatalogMap() {
  const result = await getPackageCatalog(false)
  if (result.success) {
    const map = {}
    result.data.forEach((pkg) => {
      map[pkg.code] = pkg.name || pkg.code
    })
    catalogMap.value = map
  }
}

onMounted(() => {
  loadRequests()
  loadCatalogMap()
})
</script>

<style scoped>
.school-requests {
  padding: 24px;
  background: radial-gradient(circle at 10% 0%, #e0f2fe 0%, #fdf2f8 45%, #fff7ed 100%);
  min-height: 100vh;
}

.page-header-enhanced {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 38%, #ec4899 100%);
  padding: 24px 28px;
  border-radius: 16px;
  color: white;
  box-shadow: 0 18px 40px rgba(124, 58, 237, 0.32);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.title-icon {
  font-size: 32px;
  opacity: 0.9;
}

.header-title h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.header-title p {
  margin: 6px 0 0;
  font-size: 13px;
  opacity: 0.9;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.requests-tabs {
  --el-border-radius-base: 12px;
}

.requests-tabs :deep(.el-tabs__header) {
  background: white;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.requests-tabs :deep(.el-tabs__nav) {
  padding: 0 16px;
}

.requests-tabs :deep(.el-tabs__nav-wrap::after) {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  height: 3px;
}

.requests-tabs :deep(.el-tabs__item) {
  color: #64748b !important;
  font-weight: 500;
}

.requests-tabs :deep(.el-tabs__item.is-active) {
  color: #667eea !important;
}

.tab-toolbar {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  padding: 16px 20px;
  margin-bottom: 16px;
  border-radius: 12px;
  box-shadow: 0 8px 22px rgba(30, 41, 59, 0.08);
}

.search-filter-group {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.search-input {
  max-width: 380px;
  flex-shrink: 0;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
}

.search-input :deep(.el-input__wrapper:focus-within) {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.filter-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.filter-options :deep(.el-date-picker),
.filter-options :deep(.el-select) {
  min-width: 200px;
}

.search-filter-group button {
  background: #f5f7fa;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #334155;
  padding: 8px 12px;
  height: 36px;
}

.search-filter-group button:hover {
  background: #ede9fe;
  border-color: #7c3aed;
  color: #6d28d9;
}

.requests-tabs :deep(.el-table) {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.requests-tabs :deep(.el-table__header th) {
  background: linear-gradient(180deg, #ede9fe 0%, #dbeafe 100%);
  color: #1e1b4b;
  font-weight: 600;
  border: none;
}

.requests-tabs :deep(.el-table__body tr:hover > td) {
  background: #eef2ff !important;
}

.requests-tabs :deep(.el-table__body tr) {
  border-bottom: 1px solid #e2e8f0;
}

.school-name-cell {
  display: flex;
  align-items: center;
  font-weight: 500;
  color: #0f172a;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-buttons-flex {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-reviewed {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.amount-text {
  color: #2563eb;
  font-weight: 600;
}

.calc-amount-text {
  color: #db2777;
  font-weight: 600;
}

.note-text {
  color: #475569;
  font-size: 13px;
}

.proof-thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  object-fit: cover;
}

.proof-dialog-image {
  width: 100%;
  max-width: 400px;
  margin: 16px 0;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.pagination-bottom {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding: 16px 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.requests-tabs :deep(.el-button--link) {
  color: #7c3aed;
}

.requests-tabs :deep(.el-button--link:hover) {
  color: #ec4899;
}

.requests-tabs :deep(.el-tag) {
  border-radius: 6px;
  border: none;
}

.requests-tabs :deep(.el-tag--light) {
  background: #ede9fe !important;
}

.requests-tabs :deep(.el-tag--success) {
  background: #22c55e !important;
  color: #fff !important;
}

.requests-tabs :deep(.el-tag--warning) {
  background: #f59e0b !important;
  color: #fff !important;
}

.requests-tabs :deep(.el-tag--danger) {
  background: #ef4444 !important;
  color: #fff !important;
}

.requests-tabs :deep(.el-tag--dark) {
  background: #667eea !important;
}

.dialog-content {
  line-height: 1.8;
}

.dialog-content p {
  margin: 10px 0;
}

.dialog-content strong {
  color: #667eea;
  font-weight: 600;
}

.proof-dialog-image {
  width: 100%;
  max-height: 360px;
  margin-top: 16px;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
}

:deep(.el-tabs__item.is-active) {
  font-weight: 700;
}

:deep(.el-table th.el-table__cell) {
  background: #f8fafc;
  color: #334155;
}
</style>