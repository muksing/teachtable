<template>
  <AppLayout>
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">เช็คชื่อนักเรียน</h1>

      <!-- Filter Bar -->
      <el-card class="mb-4">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-sm text-gray-500 mb-1">วันที่</div>
            <el-date-picker
              v-model="selectedDate"
              type="date"
              placeholder="เลือกวันที่"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
              @change="onDateChange"
            />
          </div>
          <div>
            <div class="text-sm text-gray-500 mb-1">เลือกคาบสอน</div>
            <el-select
              v-model="selectedLogId"
              placeholder="เลือกคาบ"
              style="min-width: 280px"
              @change="onLogChange"
            >
              <el-option
                v-for="log in todayLogs"
                :key="log.log_id || log.id"
                :label="`คาบ${log.period} - ${log.subject_code_snapshot} - ห้อง ${log.class_id}`"
                :value="log.log_id || log.id"
              />
            </el-select>
          </div>
        </div>
      </el-card>

      <!-- No logs message -->
      <el-empty
        v-if="!loadingLogs && todayLogs.length === 0"
        description="ไม่พบบันทึกการสอนในวันนี้ กรุณาบันทึกการสอนก่อน"
      />

      <!-- Student Table -->
      <div v-if="selectedLogId" v-loading="loadingStudents">
        <!-- Summary Bar -->
        <el-card class="mb-4" v-if="students.length">
          <div class="flex flex-wrap gap-4 text-sm">
            <span class="font-medium">สรุป:</span>
            <span
              v-for="s in attendanceStatuses"
              :key="s.status_code"
              class="px-2 py-1 rounded text-white text-xs"
              :style="{ backgroundColor: s.color || '#909399' }"
            >
              {{ s.label }}: {{ countStatus(s.status_code) }}
            </span>
            <span class="text-gray-500">รวม: {{ students.length }} คน</span>
          </div>
        </el-card>

        <el-table v-if="students.length" :data="students" border stripe :header-cell-style="{ background: '#0891b2', color: 'white', fontWeight: '600' }">
          <el-table-column prop="student_id" label="รหัส" width="90" />
          <el-table-column label="ชื่อ-นามสกุล" min-width="160">
            <template #default="{ row }">{{ row.name }} {{ row.surname }}</template>
          </el-table-column>
          <el-table-column label="สถานะ" min-width="300">
            <template #default="{ row }">
              <div class="flex gap-1 flex-wrap">
                <el-button
                  v-for="status in attendanceStatuses"
                  :key="status.status_code"
                  :type="attendance[row.student_id] === status.status_code ? 'primary' : 'default'"
                  size="small"
                  :style="attendance[row.student_id] === status.status_code
                    ? { backgroundColor: status.color, borderColor: status.color }
                    : {}"
                  @click="setAttendance(row.student_id, status.status_code)"
                >
                  {{ status.label }}
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-4 flex gap-3" v-if="students.length">
          <el-button type="success" :loading="saving" @click="submitAttendance">
            บันทึกการเช็คชื่อทั้งหมด
          </el-button>
          <el-button @click="resetAll">รีเซ็ตทั้งหมด</el-button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useBehavior } from '@/composables/useBehavior'

const authStore = useAuthStore()
const { getTeachingLogs, getStudents, getAttendanceStatuses } = useSchoolDb()
const { recordAttendanceBulk } = useBehavior()

// ─── State ─────────────────────────────────────────────────────────────────────
const selectedDate      = ref(new Date().toISOString().split('T')[0])
const selectedLogId     = ref(null)
const todayLogs         = ref([])
const students          = ref([])
const studentCacheByClass = ref({})
const attendanceStatuses = ref([])
const attendance        = reactive({})
const loadingLogs       = ref(false)
const loadingStudents   = ref(false)
const saving            = ref(false)

// ─── Load teaching logs for date ───────────────────────────────────────────────
async function loadTodayLogs() {
  loadingLogs.value = true
  selectedLogId.value = null
  students.value = []
  try {
    const uid  = authStore.profile?.uid
    todayLogs.value = await getTeachingLogs(selectedDate.value, null, uid)
  } catch (e) {
    ElMessage.error('โหลดรายการคาบสอนไม่สำเร็จ: ' + e.message)
  } finally {
    loadingLogs.value = false
  }
}

// ─── Load statuses once ────────────────────────────────────────────────────────
async function loadStatuses() {
  try {
    attendanceStatuses.value = await getAttendanceStatuses()
    if (!attendanceStatuses.value.length) {
      // fallback defaults
      attendanceStatuses.value = [
        { status_code: 'present', label: 'มา',      color: '#67C23A' },
        { status_code: 'late',    label: 'สาย',     color: '#E6A23C' },
        { status_code: 'absent',  label: 'ขาด',     color: '#F56C6C' },
        { status_code: 'leave',   label: 'ลา',      color: '#909399' },
        { status_code: 'sick',    label: 'ลาป่วย',  color: '#909399' }
      ]
    }
  } catch {
    attendanceStatuses.value = [
      { status_code: 'present', label: 'มา',      color: '#67C23A' },
      { status_code: 'late',    label: 'สาย',     color: '#E6A23C' },
      { status_code: 'absent',  label: 'ขาด',     color: '#F56C6C' },
      { status_code: 'leave',   label: 'ลา',      color: '#909399' },
      { status_code: 'sick',    label: 'ลาป่วย',  color: '#909399' }
    ]
  }
}

// ─── When log is selected ──────────────────────────────────────────────────────
async function onLogChange() {
  if (!selectedLogId.value) return
  loadingStudents.value = true
  try {
    const log = todayLogs.value.find(l => (l.log_id || l.id) === selectedLogId.value)
    if (!log) return
    const classId = log.class_id
    let list = studentCacheByClass.value[classId]
    if (!list) {
      list = await getStudents(classId, { activeOnly: true })
      studentCacheByClass.value = {
        ...studentCacheByClass.value,
        [classId]: list
      }
    }
    students.value = list

    // Pre-fill from existing attendance, or default to 'present'
    const existingAtt = log.attendance || {}
    students.value.forEach(s => {
      attendance[s.student_id] = existingAtt[s.student_id] || 'present'
    })
  } catch (e) {
    ElMessage.error('โหลดรายชื่อนักเรียนไม่สำเร็จ: ' + e.message)
  } finally {
    loadingStudents.value = false
  }
}

function onDateChange() { loadTodayLogs() }

function setAttendance(studentId, statusCode) {
  attendance[studentId] = statusCode
}

function countStatus(code) {
  return students.value.filter(s => attendance[s.student_id] === code).length
}

function resetAll() {
  students.value.forEach(s => { attendance[s.student_id] = 'present' })
}

async function submitAttendance() {
  if (!selectedLogId.value || !students.value.length) return
  saving.value = true
  try {
    const attendanceMap = {}
    students.value.forEach(s => {
      attendanceMap[s.student_id] = attendance[s.student_id] || 'present'
    })
    await recordAttendanceBulk({
      teachingLogId: selectedLogId.value,
      attendanceMap,
      statusSettings: attendanceStatuses.value,
      students: students.value
    })
    ElMessage.success('บันทึกการเช็คชื่อเรียบร้อยแล้ว')
    await loadTodayLogs()
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadTodayLogs(), loadStatuses()])
})
</script>
