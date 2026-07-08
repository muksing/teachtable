<template>
  <AppLayout>
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">บันทึกพฤติกรรม</h1>

      <!-- Class selector -->
      <el-card class="mb-6">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-sm text-gray-500 mb-1">เลือกห้องเรียน</div>
            <el-select
              v-model="selectedClassId"
              placeholder="เลือกห้อง"
              style="min-width: 200px"
              @change="onClassChange"
            >
              <el-option
                v-for="cls in classes"
                :key="cls.class_id"
                :label="cls.class_name || cls.class_id"
                :value="cls.class_id"
              />
            </el-select>
          </div>
        </div>
      </el-card>

      <div v-if="selectedClassId">
        <!-- Tab: Individual vs Summary -->
        <el-tabs v-model="activeTab">
          <!-- ─── Section A: รายคน ──────────────────────────────────────── -->
          <el-tab-pane label="บันทึกพฤติกรรมรายคน" name="individual">
            <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Left: student selector + behavior cards -->
              <div class="lg:col-span-2">
                <div class="mb-4">
                  <div class="text-sm text-gray-500 mb-1">เลือกนักเรียน</div>
                  <el-select
                    v-model="selectedStudentId"
                    placeholder="เลือกนักเรียน"
                    filterable
                    class="w-full"
                    @change="onStudentChange"
                  >
                    <el-option
                      v-for="s in students"
                      :key="s.student_id"
                      :label="`${s.student_id} - ${s.name} ${s.surname}`"
                      :value="s.student_id"
                    />
                  </el-select>
                </div>

                <div v-if="selectedStudentId" v-loading="loadingSettings">
                  <!-- Behavior settings grouped by type -->
                  <div
                    v-for="(group, type) in groupedSettings"
                    :key="type"
                    class="mb-5"
                  >
                    <div class="font-semibold text-gray-600 mb-2">
                      {{ behaviorTypeLabel(type) }}
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <el-card
                        v-for="setting in group"
                        :key="setting.setting_id || setting.id"
                        shadow="hover"
                        class="cursor-pointer hover:shadow-md transition-shadow"
                        body-style="padding: 12px"
                        @click="openConfirmDialog(setting)"
                      >
                        <div class="text-sm font-medium leading-snug mb-1">
                          {{ setting.label }}
                        </div>
                        <div
                          class="text-lg font-bold"
                          :class="setting.points_default >= 0 ? 'text-green-600' : 'text-red-500'"
                        >
                          {{ setting.points_default >= 0 ? '+' : '' }}{{ setting.points_default }}
                        </div>
                      </el-card>
                    </div>
                  </div>
                </div>

                <el-empty v-else description="เลือกนักเรียนเพื่อบันทึกพฤติกรรม" />
              </div>

              <!-- Right: Recent logs -->
              <div>
                <div class="font-semibold text-gray-600 mb-3">ประวัติล่าสุด (10 รายการ)</div>
                <div v-loading="loadingLogs">
                  <el-empty v-if="!recentLogs.length && !loadingLogs" description="ไม่มีประวัติ" />
                  <div v-else class="space-y-2">
                    <el-card
                      v-for="log in recentLogs"
                      :key="log.log_id || log.id"
                      shadow="never"
                      body-style="padding: 10px"
                      class="border-l-4"
                      :class="log.points_change >= 0 ? 'border-l-green-400' : 'border-l-red-400'"
                    >
                      <div class="text-sm font-medium">{{ log.label_snapshot }}</div>
                      <div class="flex justify-between items-center mt-1">
                        <span class="text-xs text-gray-500">{{ log.date }}</span>
                        <span
                          class="font-bold text-sm"
                          :class="log.points_change >= 0 ? 'text-green-600' : 'text-red-500'"
                        >
                          {{ log.points_change >= 0 ? '+' : '' }}{{ log.points_change }}
                        </span>
                      </div>
                      <div v-if="log.note" class="text-xs text-gray-400 mt-1">{{ log.note }}</div>
                    </el-card>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- ─── Section B: Summary table ──────────────────────────────── -->
          <el-tab-pane label="คะแนนพฤติกรรมนักเรียน" name="summary">
            <div class="mt-4" v-loading="loadingSummary">
              <el-button type="primary" size="small" class="mb-4" @click="loadSummaries" :loading="loadingSummary">
                โหลดคะแนน
              </el-button>
              <el-table :data="summaryData" border stripe :header-cell-style="{ background: '#db2777', color: 'white', fontWeight: '600' }">
                <el-table-column prop="student_id" label="รหัส" width="90" />
                <el-table-column label="ชื่อ-นามสกุล" min-width="150">
                  <template #default="{ row }">{{ row.name }} {{ row.surname }}</template>
                </el-table-column>
                <el-table-column label="รวม" width="80">
                  <template #default="{ row }">
                    <span :class="scoreClass(row.summary?.total_score)">
                      {{ row.summary?.total_score ?? '-' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="ความประพฤติ" width="110">
                  <template #default="{ row }">
                    <span :class="scoreClass(row.summary?.general_score)">
                      {{ row.summary?.general_score ?? '-' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="การมาเรียน" width="100">
                  <template #default="{ row }">
                    <span :class="scoreClass(row.summary?.attendance_score)">
                      {{ row.summary?.attendance_score ?? '-' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="ในห้องเรียน" width="100">
                  <template #default="{ row }">
                    <span :class="scoreClass(row.summary?.learning_score)">
                      {{ row.summary?.learning_score ?? '-' }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <el-empty v-else description="เลือกห้องเรียนเพื่อเริ่มต้น" />

      <!-- Confirm Dialog -->
      <el-dialog
        v-model="confirmVisible"
        title="ยืนยันการบันทึกพฤติกรรม"
        width="420px"
        destroy-on-close
      >
        <div v-if="activeSetting && activeStudent" class="space-y-3">
          <div class="text-gray-700">
            <span class="font-medium">นักเรียน:</span>
            {{ activeStudent.name }} {{ activeStudent.surname }}
          </div>
          <div class="text-gray-700">
            <span class="font-medium">พฤติกรรม:</span>
            {{ activeSetting.label }}
          </div>
          <div class="text-gray-700">
            <span class="font-medium">คะแนน:</span>
            <span
              class="font-bold ml-1"
              :class="activeSetting.points_default >= 0 ? 'text-green-600' : 'text-red-500'"
            >
              {{ activeSetting.points_default >= 0 ? '+' : '' }}{{ activeSetting.points_default }}
            </span>
          </div>
          <div>
            <div class="text-sm text-gray-500 mb-1">หมายเหตุ (ถ้ามี)</div>
            <el-input
              v-model="confirmNote"
              type="textarea"
              :rows="3"
              placeholder="กรอกหมายเหตุ"
            />
          </div>
        </div>

        <template #footer>
          <el-button @click="confirmVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="recordingBehavior" @click="confirmRecord">
            ยืนยัน
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useBehavior } from '@/composables/useBehavior'

const { getClasses, getStudents, getBehaviorSettings, getBehaviorLogs, getBehaviorSummary } = useSchoolDb()
const { recordBehavior } = useBehavior()

// ─── State ─────────────────────────────────────────────────────────────────────
const activeTab        = ref('individual')
const classes          = ref([])
const selectedClassId  = ref(null)
const students         = ref([])
const selectedStudentId = ref(null)
const behaviorSettings = ref([])
const recentLogs       = ref([])
const summaryData      = ref([])

const loadingSettings  = ref(false)
const loadingLogs      = ref(false)
const loadingSummary   = ref(false)
const recordingBehavior = ref(false)

// Confirm dialog
const confirmVisible   = ref(false)
const activeSetting    = ref(null)
const confirmNote      = ref('')

const activeStudent = computed(() =>
  students.value.find(s => s.student_id === selectedStudentId.value)
)

const groupedSettings = computed(() => {
  const groups = {}
  behaviorSettings.value.forEach(s => {
    const t = s.behavior_type || 'general'
    if (!groups[t]) groups[t] = []
    groups[t].push(s)
  })
  return groups
})

function behaviorTypeLabel(type) {
  const labels = {
    general:    'ความประพฤติทั่วไป',
    attendance: 'พฤติกรรมการมาเรียน',
    learning:   'พฤติกรรมในห้องเรียน'
  }
  return labels[type] || type
}

function scoreClass(score) {
  if (score === undefined || score === null) return 'text-gray-400'
  if (score >= 80) return 'text-green-600 font-bold'
  if (score >= 60) return 'text-yellow-500 font-bold'
  return 'text-red-500 font-bold'
}

// ─── Load ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    classes.value = (await getClasses()).filter(c => !c.is_schedule_only)
  } catch (e) {
    ElMessage.error('โหลดห้องเรียนไม่สำเร็จ: ' + e.message)
  }
})

async function onClassChange() {
  selectedStudentId.value = null
  recentLogs.value = []
  behaviorSettings.value = []
  summaryData.value = []
  if (!selectedClassId.value) return
  try {
    const studs = await getStudents(selectedClassId.value, { activeOnly: true })
    students.value = studs
  } catch (e) {
    ElMessage.error('โหลดนักเรียนไม่สำเร็จ: ' + e.message)
  }
}

async function onStudentChange() {
  recentLogs.value = []
  if (!selectedStudentId.value) return
  loadingSettings.value = true
  loadingLogs.value     = true
  try {
    const [settings, logs] = await Promise.all([
      getBehaviorSettings(),
      getBehaviorLogs({ studentId: selectedStudentId.value })
    ])
    behaviorSettings.value = settings.filter(s =>
      ['general', 'learning'].includes(s.behavior_type)
    )
    recentLogs.value = logs.slice(0, 10)
  } catch (e) {
    ElMessage.error('โหลดข้อมูลพฤติกรรมไม่สำเร็จ: ' + e.message)
  } finally {
    loadingSettings.value = false
    loadingLogs.value     = false
  }
}

async function loadSummaries() {
  if (!students.value.length) {
    ElMessage.warning('กรุณาเลือกห้องเรียนก่อน')
    return
  }
  loadingSummary.value = true
  try {
    const rows = await Promise.all(
      students.value.map(async (s) => {
        const summary = await getBehaviorSummary(s.student_id)
        return { ...s, summary }
      })
    )
    summaryData.value = rows
  } catch (e) {
    ElMessage.error('โหลดคะแนนไม่สำเร็จ: ' + e.message)
  } finally {
    loadingSummary.value = false
  }
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────
function openConfirmDialog(setting) {
  activeSetting.value = setting
  confirmNote.value   = ''
  confirmVisible.value = true
}

async function confirmRecord() {
  if (!activeSetting.value || !activeStudent.value) return
  recordingBehavior.value = true
  try {
    await recordBehavior({
      student:      activeStudent.value,
      setting:      activeSetting.value,
      pointsChange: activeSetting.value.points_default,
      note:         confirmNote.value,
      source:       'manual'
    })
    ElMessage.success(`บันทึกพฤติกรรม "${activeSetting.value.label}" เรียบร้อย`)
    confirmVisible.value = false
    // Refresh recent logs
    await onStudentChange()
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    recordingBehavior.value = false
  }
}
</script>
