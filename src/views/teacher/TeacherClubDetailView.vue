<template>
  <AppLayout>
    <div class="p-6" v-loading="loading">
      <!-- Back + Header -->
      <div class="flex items-center gap-3 mb-5">
        <el-button :icon="ArrowLeft" circle @click="router.back()" />
        <div>
          <h1 class="text-xl font-bold text-gray-800">{{ club?.name || '...' }}</h1>
          <span class="text-sm text-gray-500">
            {{ club?.type === 'normal' ? 'ชุมนุมปกติ' : 'ชุมนุมพิเศษ' }} · ภาคเรียน {{ term }}
          </span>
        </div>
        <el-tag v-if="club" :type="club.is_active ? 'success' : 'danger'" size="small" class="ml-2">
          {{ club.is_active ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร' }}
        </el-tag>
      </div>

      <!-- Stat Strip -->
      <div class="grid grid-cols-3 gap-4 mb-5">
        <div class="stat-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">
          <div class="stat-value" style="color:#1d4ed8">{{ members.length }}</div>
          <div class="stat-label">สมาชิก</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#bbf7d0)">
          <div class="stat-value" style="color:#15803d">{{ sessions.length }}</div>
          <div class="stat-label">ครั้งที่จัดแล้ว</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fdf4ff,#fae8ff)">
          <div class="stat-value" style="color:#a21caf">{{ club?.max_capacity || '∞' }}</div>
          <div class="stat-label">รับสูงสุด</div>
        </div>
      </div>

      <el-tabs v-model="activeTab" type="border-card">

        <!-- ===== สมาชิก ===== -->
        <el-tab-pane label="👥 สมาชิก" name="members">
          <div class="flex justify-between items-center mb-4">
            <span class="text-gray-600 font-medium">
              สมาชิก {{ members.length }} คน
              <span v-if="club?.max_capacity" class="text-gray-400 text-sm ml-1">
                (รับได้อีก {{ Math.max(0, club.max_capacity - members.length) }} คน)
              </span>
            </span>
            <el-button type="primary" size="small" @click="addMemberVisible = true">+ เพิ่มสมาชิก</el-button>
          </div>

          <el-table :data="members" border stripe
            :header-cell-style="{ background:'#4f46e5', color:'white', fontWeight:'600', fontSize:'13px' }">
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column prop="student_id" label="เลขประจำตัว" width="120" align="center" />
            <el-table-column prop="student_name" label="ชื่อ-สกุล" min-width="160" />
            <el-table-column prop="class_room" label="ห้อง" width="90" align="center" />
            <el-table-column prop="student_no" label="เลขที่" width="70" align="center" />
            <el-table-column label="วันสมัคร" width="115" align="center">
              <template #default="{ row }">{{ formatDate(row.enrolled_at) }}</template>
            </el-table-column>
            <el-table-column label="จัดการ" width="90" align="center">
              <template #default="{ row }">
                <el-button size="small" type="danger" plain @click="removeMember(row)">ลบ</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- Add Member Dialog -->
          <el-dialog v-model="addMemberVisible" title="เพิ่มสมาชิก" width="820px" @open="onAddMemberOpen">
            <el-alert v-if="club?.max_capacity && members.length >= club.max_capacity"
              type="error" :closable="false" show-icon
              :title="`ชุมนุมเต็มแล้ว (${members.length}/${club.max_capacity} คน)`" class="mb-3" />
            <el-alert v-else-if="club?.max_capacity" type="info" :closable="false" show-icon
              :title="`รับได้อีก ${club.max_capacity - members.length} คน (สูงสุด ${club.max_capacity} คน)`"
              class="mb-3" />

            <div class="mb-3 flex gap-2 flex-wrap items-center">
              <el-input v-model="studentSearch" placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..." clearable
                style="flex:1;min-width:180px" />
              <el-select v-model="filterClass" placeholder="กรองห้อง" clearable style="width:140px">
                <el-option v-for="c in classOptions" :key="c" :label="c" :value="c" />
              </el-select>
              <el-button size="small" @click="selectAllStudents">เลือกทั้งหมด</el-button>
              <el-button size="small" @click="clearStudentSelection">ยกเลิก</el-button>
            </div>

            <el-table ref="addMemberTableRef" :data="filteredStudents" border stripe max-height="380"
              @selection-change="selectedStudents = $event"
              :header-cell-style="{ background:'#4f46e5', color:'white', fontSize:'13px' }">
              <el-table-column type="selection" width="45" />
              <el-table-column prop="student_id" label="เลขประจำตัว" width="120" align="center" />
              <el-table-column prop="student_no" label="เลขที่" width="70" align="center" />
              <el-table-column prop="student_name" label="ชื่อ-สกุล" min-width="150" />
              <el-table-column prop="class_room" label="ห้อง" width="90" align="center" />
            </el-table>
            <div class="mt-2 text-sm text-gray-500">เลือกแล้ว {{ selectedStudents.length }} คน</div>

            <template #footer>
              <el-button @click="addMemberVisible = false">ยกเลิก</el-button>
              <el-button type="primary" :loading="memberLoading" @click="addMembers"
                :disabled="!selectedStudents.length || (club?.max_capacity && members.length >= club.max_capacity)">
                เพิ่มสมาชิก ({{ selectedStudents.length }})
              </el-button>
            </template>
          </el-dialog>
        </el-tab-pane>

        <!-- ===== บันทึกการประชุม ===== -->
        <el-tab-pane label="📋 บันทึกการประชุม" name="sessions">
          <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <span class="text-gray-600 font-medium">จัดทั้งหมด {{ sessions.length }} ครั้ง</span>
            <div class="flex gap-2">
              <el-button size="small" plain @click="printSessionList">🖨️ พิมพ์</el-button>
              <el-button size="small" plain @click="exportSessionListExcel">📥 Excel</el-button>
              <el-button type="primary" size="small" @click="openNewSession">+ บันทึกครั้งใหม่</el-button>
            </div>
          </div>

          <div v-if="sessions.length === 0" class="text-center py-10 text-gray-400">
            ยังไม่มีบันทึก กด "บันทึกครั้งใหม่" เพื่อเริ่ม
          </div>
          <div v-else class="space-y-3">
            <div v-for="s in sessions" :key="s.session_id"
              class="flex items-center justify-between px-4 py-3 rounded-xl border hover:bg-indigo-50 transition">
              <div class="cursor-pointer flex-1" @click="openSession(s)">
                <span class="font-semibold text-gray-700">ครั้งที่ {{ s.session_number }}</span>
                <span class="ml-3 text-sm text-gray-500">{{ formatDate(s.session_date) }}</span>
                <span v-if="s.topic" class="ml-3 text-sm text-indigo-600 font-medium">{{ s.topic }}</span>
                <span v-else-if="s.note" class="ml-3 text-sm text-gray-400 italic">{{ s.note }}</span>
              </div>
              <div class="flex items-center gap-2 ml-2">
                <el-tag size="small" type="success">มา {{ countPresent(s) }}</el-tag>
                <el-tag size="small" type="danger">ขาด {{ countAbsent(s) }}</el-tag>
                <el-tag size="small" type="warning">ลา {{ countLeave(s) }}</el-tag>
                <el-icon class="cursor-pointer" @click="openSession(s)"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>

          <!-- Session Dialog -->
          <el-dialog v-model="sessionDialogVisible"
            :title="editingSessionId ? `ครั้งที่ ${editingSessionNum} — ${editingSessionDate}` : 'บันทึกการประชุมใหม่'"
            width="920px">

            <!-- Header fields -->
            <div class="mb-4 grid grid-cols-2 gap-4">
              <el-form-item label="เรื่อง/กิจกรรม" required>
                <el-input v-model="sessionForm.topic" placeholder="ระบุเรื่องที่สอน/กิจกรรมที่จัด..." />
              </el-form-item>
              <el-form-item label="หมายเหตุ">
                <el-input v-model="sessionForm.note" placeholder="หมายเหตุเพิ่มเติม..." />
              </el-form-item>
            </div>
            <div v-if="!editingSessionId" class="mb-4">
              <el-form-item label="วันที่">
                <el-date-picker v-model="sessionForm.session_date" type="date" placeholder="เลือกวัน" style="width:220px" />
              </el-form-item>
            </div>

            <!-- Attendance table -->
            <div v-if="members.length === 0" class="text-gray-400 text-center py-6">ยังไม่มีสมาชิก</div>
            <el-table v-else :data="members" border stripe max-height="400"
              :header-cell-style="{ background:'#4f46e5', color:'white', fontSize:'13px' }">
              <el-table-column type="index" label="#" width="45" align="center" />
              <el-table-column prop="student_id" label="เลขประจำตัว" width="115" align="center" />
              <el-table-column prop="student_name" label="ชื่อ-สกุล" min-width="130" />
              <el-table-column prop="class_room" label="ห้อง" width="72" align="center" />
              <el-table-column prop="student_no" label="เลขที่" width="60" align="center" />
              <el-table-column label="สถานะ" width="320" align="center">
                <template #default="{ row }">
                  <div class="club-status-grid">
                    <button v-for="s in attendanceStatuses" :key="s.status_code"
                      class="club-sbtn"
                      :class="attendanceMap[row.student_id] === s.label ? `club-sbtn-${s.color}` : 'club-sbtn-off'"
                      @click="setStatus(row.student_id, s.label)">
                      {{ s.label }}
                    </button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="คะแนนพฤติกรรม" width="110" align="center">
                <template #default="{ row }">
                  <el-input-number
                    v-model="behaviorMap[row.student_id]"
                    :min="-100" :max="100" :step="1" size="small"
                    style="width:100px" controls-position="right" />
                </template>
              </el-table-column>
              <el-table-column label="หมายเหตุ" min-width="100">
                <template #default="{ row }">
                  <el-input v-model="attendanceNoteMap[row.student_id]" size="small" placeholder="ระบุ..." />
                </template>
              </el-table-column>
            </el-table>

            <!-- File upload — required for new session -->
            <div class="mt-4 pt-3" style="border-top:1px solid #e2e8f0">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-semibold text-gray-600">📎 ภาพประกอบกิจกรรม</span>
                <el-tag v-if="!editingSessionId" type="danger" size="small">บังคับ</el-tag>
                <span class="text-xs text-gray-400">(สูงสุด 5 ไฟล์)</span>
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <label class="club-file-btn">
                  <input type="file" accept="image/*" multiple @change="onFileChange" style="display:none" />
                  📁 เลือกภาพ
                </label>
                <div v-for="(f, i) in sessionFiles" :key="i" class="club-file-tag">
                  {{ f.name }}
                  <button class="ml-1 text-red-400" @click="removeFile(i)">✕</button>
                </div>
              </div>
            </div>
            <!-- Existing images -->
            <div v-if="editingFileUrls.length" class="mt-2">
              <div class="text-xs text-gray-500 mb-1">ภาพที่บันทึกแล้ว:</div>
              <div class="flex flex-wrap gap-2">
                <a v-for="f in editingFileUrls" :key="f.url" :href="f.url" target="_blank" rel="noopener">
                  <img :src="getThumbnailUrl(f.url)" class="w-16 h-16 object-cover rounded border" :alt="f.name" />
                </a>
              </div>
            </div>

            <template #footer>
              <el-button v-if="editingSessionId" plain @click="printCurrentSession">🖨️ พิมพ์รายงาน</el-button>
              <el-button @click="sessionDialogVisible = false">ยกเลิก</el-button>
              <el-button type="primary" :loading="sessionLoading || uploadingFiles" @click="saveSession">
                {{ uploadingFiles ? 'กำลังอัพโหลด...' : 'บันทึก' }}
              </el-button>
            </template>
          </el-dialog>
        </el-tab-pane>

        <!-- ===== รายงาน ===== -->
        <el-tab-pane label="📊 รายงาน" name="report">
          <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <span class="text-gray-600 font-medium">สรุปการเข้าร่วม {{ members.length }} คน / {{ sessions.length }} ครั้ง</span>
            <div class="flex gap-2">
              <el-button size="small" plain @click="printClubReport">🖨️ พิมพ์</el-button>
              <el-button size="small" plain @click="exportExcel">📥 Excel ปพ.5</el-button>
            </div>
          </div>

          <div v-if="members.length === 0 || sessions.length === 0" class="text-center py-10 text-gray-400">
            ต้องมีสมาชิกและบันทึกการประชุมอย่างน้อย 1 ครั้ง
          </div>
          <div v-else class="overflow-x-auto">

            <table class="pp5-table">
              <thead>
                <tr>
                  <th class="pp5-th" style="width:40px">ที่</th>
                  <th class="pp5-th" style="width:110px">เลขประจำตัว</th>
                  <th class="pp5-th" style="min-width:150px">ชื่อ-สกุล</th>
                  <th class="pp5-th" style="width:80px">ห้อง</th>
                  <th class="pp5-th" style="width:60px">เลขที่</th>
                  <th v-for="(s, si) in sortedSessions" :key="s.session_id" class="pp5-th pp5-th-session">
                    <div>ครั้งที่ {{ si + 1 }}</div>
                    <div style="font-size:10px;font-weight:400">{{ formatDateShort(s.session_date) }}</div>
                  </th>
                  <th class="pp5-th" style="width:48px;background:#166534">มา</th>
                  <th class="pp5-th" style="width:48px;background:#991b1b">ขาด</th>
                  <th class="pp5-th" style="width:48px;background:#ca8a04">ลา</th>
                  <th class="pp5-th" style="width:52px;background:#1e40af">% มา</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, idx) in sortedMembers" :key="m.student_id">
                  <td class="pp5-td" style="text-align:center">{{ idx + 1 }}</td>
                  <td class="pp5-td" style="text-align:center">{{ m.student_id }}</td>
                  <td class="pp5-td">{{ m.student_name }}</td>
                  <td class="pp5-td" style="text-align:center">{{ m.class_room }}</td>
                  <td class="pp5-td" style="text-align:center">{{ m.student_no }}</td>
                  <td v-for="s in sortedSessions" :key="s.session_id"
                    class="pp5-td pp5-status-cell" :class="statusCellClass(s, m.student_id)">
                    {{ reportCellText(s, m.student_id) }}
                  </td>
                  <td class="pp5-td" style="text-align:center;font-weight:700;color:#166534">{{ memberPresent(m) }}</td>
                  <td class="pp5-td" style="text-align:center;font-weight:700;color:#991b1b">{{ memberAbsent(m) }}</td>
                  <td class="pp5-td" style="text-align:center;font-weight:700;color:#ca8a04">{{ memberLeave(m) }}</td>
                  <td class="pp5-td" style="text-align:center;font-weight:600">
                    {{ sessions.length ? Math.round(memberPresent(m) / sessions.length * 100) : 0 }}%
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" class="pp5-td pp5-foot">รวมเข้าร่วม</td>
                  <td v-for="s in sortedSessions" :key="s.session_id"
                    class="pp5-td pp5-foot" style="text-align:center">{{ sessionPresentCount(s) }}</td>
                  <td colspan="4" class="pp5-td pp5-foot"></td>
                </tr>
              </tfoot>
            </table>

            <div class="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
              <span><b>มา</b>=มาเรียน</span><span><b>สาย</b>=มาสาย</span>
              <span><b>โดด</b>=โดดเรียน</span><span><b>ขาด</b>=ขาดเรียน</span>
              <span><b>ป่วย</b>=ลาป่วย</span><span><b>กิจ</b>=ลากิจ</span>
              <span><b>ราชการ</b>=ไปราชการ</span>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </AppLayout>


</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  doc, getDoc, updateDoc, deleteField, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'
import { useSchoolDb } from '@/composables/useSchoolDb'

const schoolStore = useSchoolStore()
const authStore   = useAuthStore()
const { getStudents, getAttendanceStatuses } = useSchoolDb()

const gasUploadUrl   = computed(() => schoolStore.schoolInfo?.gas_upload_web_app_url || '')
const gdriveFolderId = computed(() => schoolStore.schoolInfo?.gdrive_folder_id || '')
const schoolName     = computed(() => schoolStore.schoolInfo?.name || schoolStore.schoolName || 'โรงเรียน')
const schoolLogo     = computed(() => schoolStore.schoolInfo?.logo_url || '')
const teacherId      = computed(() => authStore.profile?.uid || '')
const teacherName    = computed(() => authStore.profile?.displayName || authStore.profile?.email || '')

// ── Attendance statuses ───────────────────────────────────────────
const DEFAULT_STATUSES = [
  { status_code: 'B001', label: 'มาเรียน',  color: 'green',  points_default:   0, sort_order: 1 },
  { status_code: 'B002', label: 'มาสาย',    color: 'yellow', points_default:  -2, sort_order: 2 },
  { status_code: 'B003', label: 'โดดเรียน', color: 'red',    points_default: -15, sort_order: 3 },
  { status_code: 'B004', label: 'ลาป่วย',   color: 'purple', points_default:   0, sort_order: 4 },
  { status_code: 'B005', label: 'ลากิจ',    color: 'blue',   points_default:   0, sort_order: 5 },
  { status_code: 'B006', label: 'ไปราชการ', color: 'gray',   points_default:   0, sort_order: 6 },
]
const attendanceStatuses = ref([...DEFAULT_STATUSES])
const defaultStatus = computed(() => attendanceStatuses.value[0]?.label || 'มาเรียน')

const PRESENT_SET = new Set(['มาเรียน', 'มาสาย', 'ไปราชการ', 'present', 'late', 'official'])
const ABSENT_SET  = new Set(['ขาดเรียน', 'โดดเรียน', 'absent'])
const LEAVE_SET   = new Set(['ลาป่วย', 'ลากิจ', 'sick', 'leave'])

const STATUS_SYMBOL = {
  'มาเรียน': 'มา', 'present': 'มา',
  'มาสาย': 'สาย',   'late':    'สาย',
  'โดดเรียน': 'โดด', 'absent': 'โดด',
  'ขาดเรียน': 'ขาด',
  'ลาป่วย': 'ป่วย', 'sick': 'ป่วย',
  'ลากิจ': 'กิจ', 'leave': 'กิจ',
  'ไปราชการ': 'ราชการ', 'official': 'ราชการ',
}
const STATUS_CELL_CLS = {
  'มาเรียน': 'pp5-present', 'present': 'pp5-present',
  'มาสาย': 'pp5-late',      'late':    'pp5-late',
  'โดดเรียน': 'pp5-absent', 'absent': 'pp5-absent',
  'ขาดเรียน': 'pp5-absent',
  'ลาป่วย': 'pp5-sick',
  'ลากิจ': 'pp5-leave',
  'ไปราชการ': 'pp5-offsite',
}

// ── Router / DB ───────────────────────────────────────────────────
const router  = useRouter()
const route   = useRoute()
const db      = () => getSchoolDb()
const batchDb = () => db().firestore || db()
const term    = computed(() => schoolStore.currentTerm || '2568_1')
const clubId  = computed(() => route.params.clubId)
const clubRef = computed(() => doc(db(), `terms/${term.value}/clubs`, clubId.value))

// ── Core state (single document) ─────────────────────────────────
const clubDoc = ref(null)
const loading = ref(false)
const activeTab = ref('members')

const club = computed(() => clubDoc.value)

// Members derived from embedded map — student_id always from the map key (backward compat)
const members = computed(() =>
  Object.entries(clubDoc.value?.members || {})
    .map(([id, d]) => ({ ...d, student_id: id }))
    .sort((a, b) => {
      const cr = (a.class_room || '').localeCompare(b.class_room || '')
      if (cr !== 0) return cr
      return (Number(a.student_no) || 0) - (Number(b.student_no) || 0)
    })
)

// Sessions derived from embedded map — newest first for list view
const sessions = computed(() =>
  Object.values(clubDoc.value?.sessions || {})
    .sort((a, b) => (b.session_number || 0) - (a.session_number || 0))
)

// Sessions sorted oldest→newest for report columns
const sortedSessions = computed(() =>
  [...sessions.value].sort((a, b) => {
    const da = toDate(a.session_date)
    const db_ = toDate(b.session_date)
    return da - db_
  })
)

const sortedMembers = computed(() =>
  [...members.value].sort((a, b) => {
    const cr = (a.class_room || '').localeCompare(b.class_room || '')
    if (cr !== 0) return cr
    return (Number(a.student_no) || 0) - (Number(b.student_no) || 0)
  })
)

// ── Member dialog ─────────────────────────────────────────────────
const addMemberVisible   = ref(false)
const addMemberTableRef  = ref(null)
const memberLoading      = ref(false)
const allStudents        = ref([])
const studentSearch      = ref('')
const filterClass        = ref('')
const selectedStudents   = ref([])

const classOptions = computed(() => {
  const set = new Set(allStudents.value.map(s => s.class_room).filter(Boolean))
  return [...set].sort()
})

const filteredStudents = computed(() => {
  const existingIds = new Set(Object.keys(clubDoc.value?.members || {}))
  return allStudents.value.filter(s => {
    if (existingIds.has(s.student_id)) return false
    if (filterClass.value && s.class_room !== filterClass.value) return false
    if (studentSearch.value) {
      const q = studentSearch.value.toLowerCase()
      return (s.student_name || '').toLowerCase().includes(q) ||
             (s.student_id   || '').toLowerCase().includes(q)
    }
    return true
  })
})

function selectAllStudents()     { addMemberTableRef.value?.toggleAllSelection() }
function clearStudentSelection() { addMemberTableRef.value?.clearSelection() }

// ── Session dialog ────────────────────────────────────────────────
const sessionDialogVisible = ref(false)
const sessionLoading       = ref(false)
const uploadingFiles       = ref(false)
const sessionFiles         = ref([])
const editingSessionId     = ref(null)
const editingSessionNum    = ref(0)
const editingSessionDate   = ref('')
const editingFileUrls      = ref([])

const sessionForm      = reactive({ session_date: new Date(), topic: '', note: '' })
const attendanceMap    = reactive({})
const attendanceNoteMap = reactive({})
const behaviorMap      = reactive({})  // per-student behavior point adjustment

// ── Helpers ───────────────────────────────────────────────────────
function toDate(val) {
  if (!val) return new Date(0)
  return val?.toDate ? val.toDate() : new Date(val)
}
function formatDate(val) {
  const d = toDate(val)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function formatDateShort(val) {
  const d = toDate(val)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
}
function formatDateStr(val) {
  const d = toDate(val)
  if (isNaN(d)) return ''
  return d.toISOString().split('T')[0]
}
function normalizeStatus(raw) {
  if (!raw) return defaultStatus.value
  if (raw === 'present') return 'มาเรียน'
  if (raw === 'late')    return 'มาสาย'
  if (raw === 'absent')  return 'โดดเรียน'
  return raw
}
function getDefaultPoints(label) {
  const s = attendanceStatuses.value.find(st => st.label === label)
  return s?.points_default ?? 0
}
function setStatus(studentId, label) {
  attendanceMap[studentId] = label
  behaviorMap[studentId]   = getDefaultPoints(label)
}

function countPresent(s) {
  if (!s.attendance) return 0
  return Object.values(s.attendance).filter(a => PRESENT_SET.has(a.status)).length
}
function countAbsent(s) {
  if (!s.attendance) return 0
  return Object.values(s.attendance).filter(a => ABSENT_SET.has(a.status)).length
}
function countLeave(s) {
  if (!s.attendance) return 0
  return Object.values(s.attendance).filter(a => LEAVE_SET.has(a.status)).length
}

function getStatus(s, sid)        { return s.attendance?.[sid]?.status || '' }
function reportCellText(s, sid)   { return STATUS_SYMBOL[getStatus(s, sid)] ?? '' }
function statusCellClass(s, sid)  { return STATUS_CELL_CLS[getStatus(s, sid)] || '' }
function memberPresent(m) {
  return sortedSessions.value.filter(s => PRESENT_SET.has(getStatus(s, m.student_id))).length
}
function memberAbsent(m) {
  return sortedSessions.value.filter(s => ABSENT_SET.has(getStatus(s, m.student_id))).length
}
function memberLeave(m) {
  return sortedSessions.value.filter(s => LEAVE_SET.has(getStatus(s, m.student_id))).length
}
function sessionPresentCount(s) {
  if (!s.attendance) return 0
  return Object.values(s.attendance).filter(a => PRESENT_SET.has(a.status)).length
}

function getThumbnailUrl(url) {
  if (!url) return ''
  let fileId = null
  const m1 = url.match(/lh3\.googleusercontent\.com\/d\/([^/?&#]+)/)
  if (m1) fileId = m1[1]
  if (!fileId) { const m2 = url.match(/[?&]id=([^&#]+)/); if (m2) fileId = m2[1]; }
  if (!fileId) { const m3 = url.match(/\/file\/d\/([^/?&#]+)/); if (m3) fileId = m3[1]; }
  return fileId ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : url
}

// ── Load students ─────────────────────────────────────────────────
function onAddMemberOpen() {
  selectedStudents.value = []
  studentSearch.value = ''
  filterClass.value = ''
  loadStudentsForPick()
}

async function loadStudentsForPick() {
  if (allStudents.value.length) return
  try {
    const raw = await getStudents()
    allStudents.value = raw.map(s => ({
      ...s,
      student_name: s.student_name || `${s.prefix || ''}${s.name || ''} ${s.surname || ''}`.trim(),
      student_no:   s.student_no   || s.seat_number || '',
      class_room:   s.class_room   || s.class_name_snapshot || s.class_id || '',
    })).sort((a, b) => {
      const cr = (a.class_room || '').localeCompare(b.class_room || '')
      if (cr !== 0) return cr
      return (Number(a.student_no) || 0) - (Number(b.student_no) || 0)
    })
  } catch {
    ElMessage.error('โหลดรายชื่อนักเรียนไม่สำเร็จ')
  }
}

// ── Add / Remove members — 1 write each ──────────────────────────
async function addMembers() {
  if (!selectedStudents.value.length) return
  const cap = clubDoc.value?.max_capacity
  if (cap && members.value.length + selectedStudents.value.length > cap) {
    ElMessage.warning(`รับได้อีกเพียง ${cap - members.value.length} คน`)
    return
  }
  memberLoading.value = true
  try {
    const now = new Date()
    const updates = {}
    for (const s of selectedStudents.value) {
      const data = {
        student_id:   s.student_id,
        student_name: s.student_name,
        student_no:   s.student_no || '',
        class_id:     s.class_id   || '',
        class_room:   s.class_room || '',
        enrolled_at:  now,
      }
      updates[`members.${s.student_id}`] = data
    }
    updates.updated_at = serverTimestamp()
    await updateDoc(clubRef.value, updates)  // 1 write
    // Update local state after successful write
    if (!clubDoc.value.members) clubDoc.value.members = {}
    for (const s of selectedStudents.value) {
      clubDoc.value.members[s.student_id] = {
        student_id: s.student_id, student_name: s.student_name,
        student_no: s.student_no || '', class_id: s.class_id || '',
        class_room: s.class_room || '', enrolled_at: now,
      }
    }
    await updateDoc(clubRef.value, { member_count: members.value.length })
    ElMessage.success(`เพิ่มสมาชิก ${selectedStudents.value.length} คนสำเร็จ`)
    addMemberVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    memberLoading.value = false
  }
}

async function removeMember(member) {
  try {
    await ElMessageBox.confirm(
      `ลบ "${member.student_name}" ออกจากชุมนุมนี้?`,
      'ยืนยัน', { confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
    await updateDoc(clubRef.value, {    // 1 write
      [`members.${member.student_id}`]: deleteField(),
      updated_at: serverTimestamp(),
    })
    delete clubDoc.value.members[member.student_id]
    await updateDoc(clubRef.value, { member_count: members.value.length })
    ElMessage.success('ลบสมาชิกแล้ว')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  }
}

// ── Session open ──────────────────────────────────────────────────
function openNewSession() {
  editingSessionId.value   = null
  editingFileUrls.value    = []
  sessionForm.session_date = new Date()
  sessionForm.topic = ''
  sessionForm.note  = ''
  sessionFiles.value = []
  members.value.forEach(m => {
    attendanceMap[m.student_id]     = defaultStatus.value
    attendanceNoteMap[m.student_id] = ''
    behaviorMap[m.student_id]       = getDefaultPoints(defaultStatus.value)
  })
  sessionDialogVisible.value = true
}

function openSession(s) {
  editingSessionId.value   = s.session_id
  editingSessionNum.value  = s.session_number
  editingSessionDate.value = formatDate(s.session_date)
  editingFileUrls.value    = s.file_urls || []
  sessionForm.topic = s.topic || ''
  sessionForm.note  = s.note  || ''
  sessionFiles.value = []
  members.value.forEach(m => {
    const att = s.attendance?.[m.student_id]
    attendanceMap[m.student_id]     = normalizeStatus(att?.status)
    attendanceNoteMap[m.student_id] = att?.note || ''
    behaviorMap[m.student_id]       = att?.behavior_points ?? getDefaultPoints(normalizeStatus(att?.status))
  })
  sessionDialogVisible.value = true
}

// ── Save session — 1 write + behavior batch ───────────────────────
async function saveSession() {
  if (!sessionForm.topic.trim()) {
    ElMessage.warning('กรุณากรอกเรื่อง/กิจกรรม')
    return
  }
  const hasExistingImages = editingFileUrls.value.length > 0
  const hasNewFiles       = sessionFiles.value.length > 0
  if (!hasExistingImages && !hasNewFiles) {
    ElMessage.warning('กรุณาแนบภาพประกอบกิจกรรม')
    return
  }

  sessionLoading.value = true
  try {
    // Build attendance map
    const attendance = {}
    members.value.forEach(m => {
      attendance[m.student_id] = {
        status:          attendanceMap[m.student_id] || defaultStatus.value,
        note:            attendanceNoteMap[m.student_id] || '',
        behavior_points: behaviorMap[m.student_id] ?? 0,
      }
    })

    // Upload images
    let fileUrls = [...editingFileUrls.value]
    if (hasNewFiles) {
      uploadingFiles.value = true
      const sessionId_ = editingSessionId.value || `ses_${Date.now()}`
      fileUrls = [...fileUrls, ...await uploadSessionFiles(sessionId_)]
      uploadingFiles.value = false
    }

    const t = term.value
    let sessionId, prevAttendance

    if (editingSessionId.value) {
      sessionId = editingSessionId.value
      prevAttendance = clubDoc.value.sessions?.[sessionId]?.attendance || {}

      await updateDoc(clubRef.value, {          // 1 write
        [`sessions.${sessionId}.attendance`]: attendance,
        [`sessions.${sessionId}.file_urls`]:  fileUrls,
        [`sessions.${sessionId}.topic`]:      sessionForm.topic,
        [`sessions.${sessionId}.note`]:       sessionForm.note,
        updated_at: serverTimestamp(),
      })
      if (clubDoc.value.sessions?.[sessionId]) {
        Object.assign(clubDoc.value.sessions[sessionId], {
          attendance, file_urls: fileUrls,
          topic: sessionForm.topic, note: sessionForm.note,
        })
      }
    } else {
      sessionId = `ses_${clubId.value}_${Date.now()}`
      const sessionDate = sessionForm.session_date instanceof Date
        ? sessionForm.session_date : new Date(sessionForm.session_date)
      prevAttendance = {}
      const sessionData = {
        session_id:     sessionId,
        session_number: sessions.value.length + 1,
        topic:          sessionForm.topic,
        note:           sessionForm.note,
        session_date:   sessionDate,
        attendance,
        file_urls:      fileUrls,
        created_at:     new Date(),
      }
      await updateDoc(clubRef.value, {          // 1 write
        [`sessions.${sessionId}`]: sessionData,
        session_count: sessions.value.length + 1,
        updated_at: serverTimestamp(),
      })
      if (!clubDoc.value.sessions) clubDoc.value.sessions = {}
      clubDoc.value.sessions[sessionId] = sessionData
    }

    // Write behavior logs (delta from previous)
    await saveBehaviorLogs(sessionId, attendance, prevAttendance, t)

    sessionFiles.value = []
    ElMessage.success('บันทึกการประชุมสำเร็จ')
    sessionDialogVisible.value = false
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    sessionLoading.value = false
    uploadingFiles.value = false
  }
}

// ── Behavior integration ──────────────────────────────────────────
async function saveBehaviorLogs(sessionId, newAtt, prevAtt, t) {
  const membersNeedUpdate = members.value.filter(m => {
    const newPts  = newAtt[m.student_id]?.behavior_points ?? 0
    const prevPts = prevAtt[m.student_id]?.behavior_points ?? 0
    return newPts !== prevPts
  })
  if (!membersNeedUpdate.length) return

  // Read current behavior summaries (batch)
  const summarySnaps = await Promise.all(
    membersNeedUpdate.map(m => getDoc(doc(db(), `terms/${t}/behavior_summary`, m.student_id)))
  )

  const batch = writeBatch(batchDb())
  const clubName = clubDoc.value?.name || ''
  const sesNum   = clubDoc.value?.sessions?.[sessionId]?.session_number || ''

  summarySnaps.forEach((snap, i) => {
    const m      = membersNeedUpdate[i]
    const newPts = newAtt[m.student_id]?.behavior_points ?? 0
    const prevPts = prevAtt[m.student_id]?.behavior_points ?? 0
    const delta  = newPts - prevPts

    const sumData    = snap.exists() ? snap.data() : { total_score: 0, general_score: 0 }
    const scoreBefore = sumData.general_score ?? sumData.total_score ?? 0
    const scoreAfter  = scoreBefore + delta
    const newTotal    = (sumData.total_score ?? 0) + delta

    const logId = `club_${clubId.value}_${sessionId}_${m.student_id}`
    batch.set(doc(db(), `terms/${t}/behavior_logs`, logId), {
      log_id:                       logId,
      student_id:                   m.student_id,
      class_id:                     m.class_id || '',
      behavior_type:                'general',
      source:                       'club',
      ref_club_id:                  clubId.value,
      ref_session_id:               sessionId,
      label_snapshot:               `ชุมนุม ${clubName} ครั้งที่ ${sesNum}`,
      behavior_type_label_snapshot: 'กิจกรรมชุมนุม',
      points_change:                newPts,
      score_before:                 scoreBefore,
      score_after:                  scoreAfter,
      date:                         formatDateStr(clubDoc.value?.sessions?.[sessionId]?.session_date),
      note:                         newAtt[m.student_id]?.note || '',
      recorded_by:                  teacherId.value,
      recorded_by_name_snapshot:    teacherName.value,
      can_delete:                   true,
      updated_at:                   serverTimestamp(),
    })

    batch.set(doc(db(), `terms/${t}/behavior_summary`, m.student_id), {
      general_score: scoreAfter,
      total_score:   newTotal,
      last_updated:  serverTimestamp(),
    }, { merge: true })

    // อัปเดตคะแนนกลับไปที่ตารางนักเรียน เพื่อให้โชว์ในหน้าจัดการนักเรียนทันที
    batch.update(doc(db(), `terms/${t}/students`, m.student_id), {
      total_behavior_score: newTotal,
      general_behavior_score: scoreAfter
    })
  })

  await batch.commit()
}

// ── Shared: build logo+school header HTML ─────────────────────────
function buildSchoolHeader(subtitle) {
  const logo = schoolLogo.value
  const logoHtml = logo
    ? `<img src="${logo}" style="width:64px;height:64px;object-fit:contain;border-radius:8px;" crossorigin="anonymous">`
    : `<div style="font-size:48px;line-height:1">🏫</div>`
  return `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px;border-bottom:2px solid #1e3a8a;padding-bottom:10px">
      ${logoHtml}
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e3a8a">${String(schoolName.value || '')}</div>
        <div style="font-size:14px;font-weight:600;margin-top:2px">${subtitle}</div>
      </div>
    </div>`
}

const PRINT_BASE_CSS = `
  body { font-family:'TH Sarabun New',Sarabun,sans-serif; font-size:14px; padding:16px 24px; }
  table { border-collapse:collapse; width:100%; margin-top:10px; }
  th { background:#1e3a8a; color:#fff; padding:5px 8px; border:1px solid #3b5bdb; text-align:center; font-weight:700; }
  td { padding:4px 8px; border:1px solid #9ca3af; }
  .center { text-align:center; }
  @media print { @page { margin:1.2cm; } }
`

// ── Print session — new window, data-driven ───────────────────────
function buildSessionReportHtml(s) {
  const escape = t => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const presentCount = countPresent(s)
  const absentCount  = countAbsent(s)

  const memberRows = members.value.map((m, idx) => {
    const att    = s.attendance?.[m.student_id] || {}
    const status = att.status || 'มาเรียน'
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${idx + 1}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${escape(m.student_id)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af">${escape(m.student_name)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${escape(m.class_room)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${escape(m.student_no)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center;font-weight:700">${escape(status)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af">${escape(att.note)}</td>
    </tr>`
  }).join('')

  const imageHtml = (s.file_urls || []).map(f => {
    const thumb = getThumbnailUrl(f.url)
    return `<img src="${thumb}" style="width:120px;height:120px;object-fit:cover;border:1px solid #d1d5db;border-radius:4px;" />`
  }).join('')

  const topicLine  = s.topic ? `<div style="text-align:center;font-weight:600;margin-top:4px">เรื่อง/กิจกรรม: ${escape(s.topic)}</div>` : ''
  const noteLine   = s.note  ? `<div style="text-align:center;font-size:13px;color:#374151">หมายเหตุ: ${escape(s.note)}</div>` : ''
  const imagesSection = imageHtml
    ? `<div style="margin-top:12px"><div style="font-weight:700;margin-bottom:6px">ภาพประกอบกิจกรรม</div><div style="display:flex;flex-wrap:wrap;gap:8px">${imageHtml}</div></div>` : ''

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายงานชุมนุม ครั้งที่ ${s.session_number}</title>
<style>
  ${PRINT_BASE_CSS}
  .sig { display:flex; gap:60px; justify-content:center; margin-top:28px; }
  .sig-box { text-align:center; }
  .sig-line { border-bottom:1px solid #374151; width:200px; height:40px; margin:0 auto 4px; }
</style>
</head>
<body>
${buildSchoolHeader(`บันทึกการเข้าร่วมกิจกรรมชุมนุม`)}
<div style="text-align:center;font-size:13px;color:#374151">
  ชุมนุม: ${escape(clubDoc.value?.name)} &nbsp;|&nbsp; ครั้งที่ ${s.session_number}
  &nbsp;|&nbsp; วันที่ ${escape(formatDate(s.session_date))}
  &nbsp;|&nbsp; ภาคเรียน ${escape(term.value)}
</div>
${topicLine}${noteLine}
<table>
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th style="width:110px">เลขประจำตัว</th>
      <th style="min-width:160px">ชื่อ-สกุล</th>
      <th style="width:80px">ห้อง</th>
      <th style="width:65px">เลขที่</th>
      <th style="width:100px">สถานะ</th>
      <th>หมายเหตุ</th>
    </tr>
  </thead>
  <tbody>${memberRows}</tbody>
</table>
${imagesSection}
<div class="sig">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div style="font-weight:700;font-size:13px">ครูที่ปรึกษาชุมนุม</div>
    <div style="font-size:12px;color:#4b5563">(${escape(clubDoc.value?.teacher_name) || '.................................'})</div>
    <div style="font-size:12px;color:#6b7280;margin-top:4px">วันที่ ........../........../..........&nbsp;</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div style="font-weight:700;font-size:13px">ผู้ตรวจ</div>
    <div style="font-size:12px;color:#4b5563">(.................................)</div>
    <div style="font-size:12px;color:#6b7280;margin-top:4px">วันที่ ........../........../..........&nbsp;</div>
  </div>
</div>
<div style="text-align:center;margin-top:12px;font-size:13px;color:#374151">
  มาเรียน ${presentCount} คน &nbsp;|&nbsp; ขาด ${absentCount} คน &nbsp;|&nbsp; ลา ${countLeave(s)} คน &nbsp;|&nbsp; รวม ${members.value.length} คน
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`
}

function printSession(s) {
  const win = window.open('', '_blank', 'width=960,height=720')
  win.document.write(buildSessionReportHtml(s))
  win.document.close()
}

function printCurrentSession() {
  const sId = editingSessionId.value
  if (!sId || !clubDoc.value?.sessions?.[sId]) return
  printSession(clubDoc.value.sessions[sId])
}

// ── Print/Export report ───────────────────────────────────────────
function buildSummaryReportHtml() {
  const escape = t => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const sesArr = sortedSessions.value
  const memArr = sortedMembers.value

  const sessionHeaders = sesArr.map((s, si) =>
    `<th style="background:#4f46e5;color:#fff;padding:4px 6px;border:1px solid #3b5bdb;text-align:center;min-width:48px;font-size:11px;vertical-align:bottom">
      <div>ครั้งที่ ${si + 1}</div>
      <div style="font-size:9px;font-weight:400">${escape(formatDateShort(s.session_date))}</div>
    </th>`
  ).join('')

  const memberRows = memArr.map((m, idx) => {
    const sessionCells = sesArr.map(s => {
      const sym = STATUS_SYMBOL[getStatus(s, m.student_id)] ?? ''
      const cls = STATUS_CELL_CLS[getStatus(s, m.student_id)] || ''
      const bg = cls === 'pp5-present' ? '#dcfce7' : cls === 'pp5-absent' ? '#fee2e2'
        : cls === 'pp5-late' ? '#fef9c3' : cls === 'pp5-sick' ? '#f3e8ff'
        : cls === 'pp5-leave' ? '#dbeafe' : cls === 'pp5-offsite' ? '#f1f5f9' : '#fff'
      return `<td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center;font-weight:700;font-size:11px;background:${bg}">${escape(sym)}</td>`
    }).join('')
    const pres = memberPresent(m)
    const abs  = memberAbsent(m)
    const pct  = sesArr.length ? Math.round(pres / sesArr.length * 100) : 0
    return `<tr>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center">${idx + 1}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center">${escape(m.student_id)}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1">${escape(m.student_name)}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center">${escape(m.class_room)}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center">${escape(m.student_no)}</td>
      ${sessionCells}
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#166534">${pres}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#991b1b">${abs}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#ca8a04">${memberLeave(m)}</td>
      <td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center;font-weight:600">${pct}%</td>
    </tr>`
  }).join('')

  const footCells = sesArr.map(s =>
    `<td style="padding:3px 5px;border:1px solid #cbd5e1;text-align:center;background:#f8fafc;font-weight:700">${sessionPresentCount(s)}</td>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>สรุปการเข้าร่วมชุมนุม — ${escape(clubDoc.value?.name)}</title>
<style>
  ${PRINT_BASE_CSS}
  table { font-size:12px; }
  @media print { @page { size:landscape; margin:1cm; } }
</style>
</head>
<body>
${buildSchoolHeader(`บันทึกเวลาเรียน — ชุมนุม ${escape(clubDoc.value?.name)}`)}
<div style="font-size:13px;margin-bottom:8px">
  ภาคเรียน ${escape(term.value)} &nbsp;|&nbsp; ครูที่ปรึกษา ${escape(clubDoc.value?.teacher_name || '')}
  &nbsp;|&nbsp; สมาชิก ${memArr.length} คน จัด ${sesArr.length} ครั้ง
</div>
<table>
  <thead>
    <tr>
      <th style="background:#1e3a8a;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:36px">ที่</th>
      <th style="background:#1e3a8a;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:100px">เลขประจำตัว</th>
      <th style="background:#1e3a8a;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;min-width:140px">ชื่อ-สกุล</th>
      <th style="background:#1e3a8a;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:70px">ห้อง</th>
      <th style="background:#1e3a8a;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:55px">เลขที่</th>
      ${sessionHeaders}
      <th style="background:#166534;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:40px">มา</th>
      <th style="background:#991b1b;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:40px">ขาด</th>
      <th style="background:#ca8a04;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:40px">ลา</th>
      <th style="background:#1e40af;color:#fff;padding:5px 6px;border:1px solid #3b5bdb;width:46px">%มา</th>
    </tr>
  </thead>
  <tbody>${memberRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="padding:3px 5px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700">รวมเข้าร่วม</td>
      ${footCells}
      <td colspan="4" style="padding:3px 5px;border:1px solid #cbd5e1;background:#f8fafc"></td>
    </tr>
  </tfoot>
</table>
<div style="margin-top:8px;font-size:11px;color:#6b7280">
  <b>มา</b>=มาเรียน &nbsp; <b>สาย</b>=มาสาย &nbsp; <b>โดด</b>=โดดเรียน &nbsp; <b>ขาด</b>=ขาดเรียน &nbsp; <b>ป่วย</b>=ลาป่วย &nbsp; <b>กิจ</b>=ลากิจ &nbsp; <b>ราชการ</b>=ไปราชการ
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`
}

function printClubReport() {
  const win = window.open('', '_blank', 'width=1100,height=760')
  win.document.write(buildSummaryReportHtml())
  win.document.close()
}

function exportExcel() {
  const sesArr = sortedSessions.value
  const memArr = sortedMembers.value
  const hdrs = ['ที่', 'เลขประจำตัว', 'ชื่อ-สกุล', 'ห้อง', 'เลขที่',
    ...sesArr.map((s, si) => `ครั้งที่ ${si + 1} (${formatDateShort(s.session_date)})`),
    'รวมมา', 'รวมขาด', 'รวมลา', '% มา',
  ]
  const rows = memArr.map((m, i) => [
    i + 1, m.student_id, m.student_name, m.class_room, m.student_no || '',
    ...sesArr.map(s => STATUS_SYMBOL[getStatus(s, m.student_id)] ?? ''),
    memberPresent(m), memberAbsent(m), memberLeave(m),
    sesArr.length ? Math.round(memberPresent(m) / sesArr.length * 100) + '%' : '0%',
  ])
  const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ปพ.5 ชุมนุม')
  XLSX.writeFile(wb, `club_${club.value?.name || clubId.value}_${term.value}.xlsx`)
}

function buildSessionListHtml() {
  const escape = t => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const rows = [...sessions.value]
    .sort((a, b) => (a.session_number || 0) - (b.session_number || 0))
    .map(s => `<tr>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${s.session_number}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${escape(formatDate(s.session_date))}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af">${escape(s.topic || '')}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${countPresent(s)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${countAbsent(s)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af;text-align:center">${countLeave(s)}</td>
      <td style="padding:4px 8px;border:1px solid #9ca3af">${escape(s.note || '')}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายการประชุมชุมนุม — ${escape(clubDoc.value?.name)}</title>
<style>${PRINT_BASE_CSS}</style>
</head>
<body>
${buildSchoolHeader(`รายการจัดกิจกรรมชุมนุม — ${escape(clubDoc.value?.name)}`)}
<div style="font-size:13px;margin-bottom:8px">
  ภาคเรียน ${escape(term.value)} &nbsp;|&nbsp; ครูที่ปรึกษา ${escape(clubDoc.value?.teacher_name || '')}
</div>
<table>
  <thead>
    <tr>
      <th style="width:60px">ครั้งที่</th>
      <th style="width:120px">วันที่</th>
      <th>เรื่อง/กิจกรรม</th>
      <th style="width:55px">มา</th>
      <th style="width:55px">ขาด</th>
      <th style="width:55px">ลา</th>
      <th>หมายเหตุ</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`
}

function printSessionList() {
  const win = window.open('', '_blank', 'width=900,height=680')
  win.document.write(buildSessionListHtml())
  win.document.close()
}

function exportSessionListExcel() {
  const rows = [...sessions.value]
    .sort((a, b) => (a.session_number || 0) - (b.session_number || 0))
    .map(s => [
      s.session_number,
      formatDate(s.session_date),
      s.topic || '',
      s.note  || '',
      countPresent(s),
      countAbsent(s),
      countLeave(s),
    ])
  const hdrs = ['ครั้งที่', 'วันที่', 'เรื่อง/กิจกรรม', 'หมายเหตุ', 'มา', 'ขาด', 'ลา']
  const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'รายการประชุม')
  XLSX.writeFile(wb, `sessions_${club.value?.name || clubId.value}_${term.value}.xlsx`)
}

// ── File upload ───────────────────────────────────────────────────
function onFileChange(e) {
  sessionFiles.value = Array.from(e.target.files || []).slice(0, 5)
  e.target.value = ''
}
function removeFile(i) { sessionFiles.value = sessionFiles.value.filter((_, idx) => idx !== i) }

async function uploadSessionFiles(sessionId) {
  if (!sessionFiles.value.length || !gasUploadUrl.value) return []
  const urls = []
  for (let i = 0; i < sessionFiles.value.length; i++) {
    const file = sessionFiles.value[i]
    try {
      const base64 = await toBase64(file)
      const res = await fetch(gasUploadUrl.value, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          route: 'upload-student-photo',
          folderId: gdriveFolderId.value,
          fileName: `club_${clubId.value}_${sessionId}_${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          base64Data: base64.split(',')[1],
        }),
      })
      const data = JSON.parse(await res.text())
      if (data.url) urls.push({ name: file.name, url: data.url })
    } catch { /* skip */ }
  }
  return urls
}
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ── Load — 1 read ────────────────────────────────────────────────
async function loadClub() {
  loading.value = true
  try {
    const [snap, statuses] = await Promise.all([
      getDoc(clubRef.value),
      getAttendanceStatuses().catch(() => []),
    ])
    if (!snap.exists()) {
      ElMessage.error('ไม่พบชุมนุมนี้')
      router.back()
      return
    }
    clubDoc.value = { id: snap.id, ...snap.data() }
    if (statuses.length) attendanceStatuses.value = statuses
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loading.value = false
  }
}

onMounted(loadClub)
</script>

<style scoped>
.stat-card  { border-radius:12px; padding:20px 24px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
.stat-value { font-size:2rem; font-weight:800; line-height:1; }
.stat-label { font-size:.85rem; color:#6b7280; margin-top:4px; }

.club-status-grid { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.club-sbtn {
  padding:3px 7px; border-radius:6px; font-size:11.5px; font-weight:600;
  border:1.5px solid transparent; cursor:pointer; transition:all .12s; white-space:nowrap;
}
.club-sbtn-off    { background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; }
.club-sbtn-off:hover { background:#e2e8f0; }
.club-sbtn-green  { background:#dcfce7; color:#166534; border-color:#86efac; }
.club-sbtn-yellow { background:#fef9c3; color:#854d0e; border-color:#fde047; }
.club-sbtn-red    { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
.club-sbtn-purple { background:#f3e8ff; color:#6b21a8; border-color:#d8b4fe; }
.club-sbtn-blue   { background:#dbeafe; color:#1e40af; border-color:#93c5fd; }
.club-sbtn-gray   { background:#f1f5f9; color:#475569; border-color:#94a3b8; }

/* ปพ.5 report table */
.pp5-table { border-collapse:collapse; width:100%; font-size:13px; }
.pp5-th {
  background:#1e3a8a; color:#fff; padding:6px 8px;
  border:1px solid #3b5bdb; text-align:center; font-weight:700; white-space:nowrap; vertical-align:bottom;
}
.pp5-th-session { background:#4f46e5; min-width:52px; }
.pp5-td { padding:5px 8px; border:1px solid #cbd5e1; vertical-align:middle; }
.pp5-status-cell { text-align:center; font-weight:700; }
.pp5-present { background:#dcfce7; color:#166534; }
.pp5-late    { background:#fef9c3; color:#92400e; }
.pp5-absent  { background:#fee2e2; color:#991b1b; }
.pp5-sick    { background:#f3e8ff; color:#6b21a8; }
.pp5-leave   { background:#dbeafe; color:#1e40af; }
.pp5-offsite { background:#f1f5f9; color:#475569; }
.pp5-foot    { background:#f8fafc; font-weight:700; font-size:12px; }

.club-file-btn {
  display:inline-flex; align-items:center; gap:4px; padding:5px 12px;
  border-radius:8px; font-size:13px; cursor:pointer;
  background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-weight:600;
}
.club-file-btn:hover { background:#dbeafe; }
.club-file-tag {
  display:inline-flex; align-items:center; gap:4px; padding:3px 8px;
  border-radius:6px; font-size:12px; background:#f1f5f9; color:#475569;
  border:1px solid #e2e8f0; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
</style>

<style>
</style>
