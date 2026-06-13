<template>
  <AppLayout>
    <div class="tad-page" v-loading="loadingPage" element-loading-text="กำลังโหลด...">

      <!-- ── Top bar ─────────────────────────────────────────────────── -->
      <div class="tad-topbar">
        <el-button plain size="small" class="tad-back-btn" @click="$router.back()">← กลับ</el-button>
        <div class="tad-topbar-title">
          📝 คาบ {{ ta?.period }} · {{ ta?.class_name || ta?.class_id }} · {{ formatDate(ta?.date) }}
          <el-tag v-if="ta?.is_filled" type="success" size="small" style="margin-left:8px;vertical-align:middle">✓ บันทึกแล้ว</el-tag>
        </div>
        <el-button type="success" size="small" :loading="saving" class="tad-save-btn" @click="saveAll">
          💾 บันทึก
        </el-button>
      </div>

      <!-- ── Teaching info card ────────────────────────────────────────── -->
      <div class="tad-info-card mb-4">

        <!-- ─ ตามแผน ─────────────────────────────────────────── -->
        <div class="tad-plan-row">
          <div class="tad-plan-label">ตามแผน</div>
          <div class="tad-plan-body">
            <div class="tad-subject-code">{{ ta?.subject_plan_id || '—' }}</div>
            <div class="tad-subject-name-text">{{ ta?.subject_name || '—' }}</div>
          </div>
          <div v-if="ta?.teacher_plan_name" class="tad-plan-teacher">
            <div class="tad-plan-teacher-name">{{ ta.teacher_plan_name }}</div>
          </div>
        </div>

        <!-- ─ สอนจริง / ผู้บันทึก ─────────────────────────────── -->
        <div class="tad-actual-row">
          <div class="tad-plan-label tad-actual-label">สอนจริง</div>

          <!-- dropdown เลือกวิชาจริง -->
          <div class="tad-actual-body">
            <el-select
              v-model="form.subject_actual_id"
              filterable
              :disabled="!isSubstitute"
              placeholder="— ไม่เลือก (สอนวิชาตามแผน) —"
              class="w-full tad-select"
            >
              <!-- รายการแรก: ไม่เลือก -->
              <el-option value="" label="— ไม่เลือก (สอนวิชาตามแผน) —" />
              <el-option
                v-for="s in substituteSubjectOptions"
                :key="s.subject_code"
                :label="`${s.subject_code} — ${s.name}`"
                :value="s.subject_code"
              />
            </el-select>
            <div v-if="subjectActualTeacherName" class="tad-sub-teacher-name mt-1">
              👤 ครูเจ้าของวิชา: <strong>{{ subjectActualTeacherName }}</strong>
            </div>
            <div v-if="!isSubstitute" class="text-xs text-gray-400 mt-1">
              {{ ta?.slot_type === 'homeroom' ? 'สอนร่วม (คาบที่ปรึกษา/กิจกรรม)' : 'สอนเองตามแผน' }}
            </div>
          </div>

          <!-- badge สอนแทน (แสดงเมื่อตรวจได้ว่าไม่ใช่ครูประจำ) -->
          <el-tag v-if="isSubstitute" type="warning" size="large" class="tad-sub-badge">สอนแทน</el-tag>
        </div>

        <el-form label-position="top" size="small" class="mt-4 tad-form">
          <el-form-item label="หัวข้อที่สอน *">
            <el-input v-model="form.topic" placeholder="กรอกหัวข้อที่สอนในคาบนี้" class="tad-input" />
          </el-form-item>
          <el-form-item label="ประเภทกิจกรรม">
            <el-select v-model="form.activity_type" class="w-full tad-select">
              <el-option v-for="t in ACTIVITY_TYPES" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="หมายเหตุ">
            <el-input v-model="form.note" type="textarea" :rows="2" placeholder="หมายเหตุ (ถ้ามี)" class="tad-input" />
          </el-form-item>
        </el-form>
      </div>

      <!-- ── Photos card — BELOW form ──────────────────────────────────── -->
      <div class="tad-photos-card mb-4">
        <div class="tad-photos-title">📷 ภาพการสอน (เลือกได้สูงสุด 3 ภาพ)</div>
        <div class="tad-photos-grid">
          <div v-for="n in [0,1,2]" :key="n" class="tad-photo-slot">
            <div class="tad-photo-num">ภาพที่ {{ n + 1 }}</div>
            <!-- Preview: pending base64 > existing URL -->
            <div class="tad-photo-preview-box" @click="triggerPhotoPick(n)">
              <img
                v-if="photoBase64s[n] || photoUrls[n]"
                :src="photoBase64s[n] || fixPhotoUrl(photoUrls[n])"
                class="tad-photo-preview-img"
                @error="e => e.target.style.display='none'"
              />
              <div v-else class="tad-photo-empty">
                <span class="text-3xl">🖼</span>
                <span class="text-xs mt-1 text-indigo-400">คลิกเลือกภาพ</span>
              </div>
            </div>
            <div class="flex gap-2 mt-2">
              <el-button size="small" class="tad-pick-btn flex-1" @click="triggerPhotoPick(n)">
                📁 เลือก
              </el-button>
              <el-button
                v-if="photoBase64s[n] || photoUrls[n]"
                size="small" type="danger" plain
                @click="clearPhoto(n)"
              >✕</el-button>
            </div>
            <input
              :ref="el => photoInputRefs[n] = el"
              type="file" accept="image/*" class="hidden"
              @change="e => onPhotoSelected(n, e)"
            />
          </div>
        </div>
        <div v-if="uploadingPhotos" class="text-xs text-indigo-400 mt-2 text-center">
          ⏳ กำลังอัพโหลดภาพ...
        </div>
      </div>

      <!-- ── Summary bar ────────────────────────────────────────────────── -->
      <div class="tad-summary-bar mb-4">
        <span class="tad-sum-total">นักเรียน <b>{{ students.length }}</b> คน</span>
        <span class="tad-s-tag tad-s-present">มาเรียน {{ countStatus('มาเรียน') }}</span>
        <span class="tad-s-tag tad-s-late">มาสาย {{ countStatus('มาสาย') }}</span>
        <span class="tad-s-tag tad-s-skip">โดดเรียน {{ countStatus('โดดเรียน') }}</span>
        <span class="tad-s-tag tad-s-leave">ลา {{ countLeave() }}</span>
        <div class="ml-auto flex items-center gap-3">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="table">📑 ตาราง</el-radio-button>
            <el-radio-button value="card">📇 การ์ด</el-radio-button>
          </el-radio-group>
          <el-button size="small" plain class="tad-mark-all-btn" @click="markAllPresent">
            ✓ ทุกคนมาเรียน
          </el-button>
        </div>
      </div>

      <!-- ── Student List (Table View) ────────────────────────────────── -->
      <div v-if="viewMode === 'table'" v-loading="loadingStudents" class="mb-4 bg-white rounded-xl p-2 shadow-sm border border-gray-200 overflow-x-auto">
        <el-empty v-if="!loadingStudents && students.length === 0" description="ไม่พบนักเรียน" :image-size="60" />
        <el-table v-else :data="students" stripe size="small" :header-cell-style="{ background:'#f8fafc', color:'#475569', fontWeight:'700' }">
          <el-table-column type="index" label="ที่" width="50" align="center" />
          <el-table-column label="รูป" width="50" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.photo_url"
                :src="fixPhotoUrl(row.photo_url)"
                :preview-src-list="[fixPhotoUrl(row.photo_url)]"
                :preview-teleported="true"
                fit="cover"
                class="w-7 h-7 rounded-full border border-gray-200 mx-auto block"
                style="cursor:zoom-in"
              >
                <template #error>
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-400 text-xs font-bold">
                    {{ (row.name || '?').charAt(0) }}
                  </div>
                </template>
              </el-image>
              <div v-else class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-400 text-xs font-bold">
                {{ (row.name || '?').charAt(0) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="student_id" label="รหัส" width="90" />
          <el-table-column label="ชื่อ-สกุล" min-width="140">
            <template #default="{ row }">
              <div class="font-medium text-gray-800">{{ row.name }} {{ row.surname }}</div>
            </template>
          </el-table-column>
          <el-table-column label="สถานะ" min-width="280">
            <template #default="{ row }">
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom:0;">
                <button
                  v-for="s in STATUSES"
                  :key="s.key"
                  class="tad-sbtn"
                  style="padding: 4px 6px; font-size: 11px; flex: 1; min-width: 40px;"
                  :class="getRecord(row.student_id).status === s.key ? `tad-sbtn-${s.color}` : 'tad-sbtn-off'"
                  @click="setStatus(row.student_id, s.key)"
                >{{ s.label }}</button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="พฤติกรรม" min-width="260">
            <template #default="{ row }">
              <div v-if="showBehavior(getRecord(row.student_id).status)">
                <div class="tad-beh-chips" style="margin-bottom:4px">
                  <button
                    v-for="beh in learningBeh"
                    :key="beh.id"
                    class="tad-chip"
                    :class="isSelected(row.student_id, beh.id) ? 'tad-chip-on' : 'tad-chip-off'"
                    @click="selectBehavior(row.student_id, beh)"
                  >
                    {{ beh.label }} <span class="tad-chip-pts">{{ beh.points_default }}</span>
                  </button>
                </div>
                <div v-if="getSelectedBehaviors(row.student_id).length > 0" class="flex items-center gap-2">
                  <el-input-number
                    v-model="getSelectedBehaviors(row.student_id)[0].adjusted_score"
                    :min="getSelectedBehaviors(row.student_id)[0].points_min"
                    :max="getSelectedBehaviors(row.student_id)[0].points_max"
                    size="small"
                    controls-position="right"
                    style="width:90px"
                  />
                  <span class="text-xs font-bold" :class="getTotalDeduction(row.student_id) < 0 ? 'text-red-500' : 'text-emerald-600'">
                    สุทธิ: {{ getTotalDeduction(row.student_id) >= 0 ? '+' : '' }}{{ getTotalDeduction(row.student_id) }}
                  </span>
                </div>
                <div v-else class="text-xs font-bold mt-1" :class="getTotalDeduction(row.student_id) < 0 ? 'text-red-500' : 'text-emerald-600'">
                  สุทธิ: {{ getTotalDeduction(row.student_id) >= 0 ? '+' : '' }}{{ getTotalDeduction(row.student_id) }}
                </div>
              </div>
              <!-- แสดงกล่องแก้ไขคะแนนถ้าสถานะนั้นมีผลต่อพฤติกรรมหรือมีคะแนนตั้งต้นไม่เท่ากับ 0 -->
              <div v-else-if="getAttendanceStatus(getRecord(row.student_id).status)?.affects_behavior || getAttendanceStatus(getRecord(row.student_id).status)?.points_default !== 0" class="tad-excused" :style="getAttendancePoints(row.student_id) < 0 ? 'background:#fff1f2;border-color:#fecdd3;' : 'background:#f0fdf4;border-color:#bbf7d0;'" style="margin-bottom:0;padding:4px 8px;">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-xs" :class="getAttendancePoints(row.student_id) < 0 ? 'text-red-500' : 'text-emerald-600'">
                    คะแนนสถานะ:
                  </span>
                  <el-input-number v-model="getRecord(row.student_id).adjusted_attendance_score" :min="getAttendanceStatus(getRecord(row.student_id).status)?.points_min ?? -100" :max="getAttendanceStatus(getRecord(row.student_id).status)?.points_max ?? 100" size="small" controls-position="right" style="width:90px" />
                </div>
              </div>
              <!-- กรณีลา หรือสถานะที่คะแนนเป็น 0 -->
              <div v-else class="tad-excused" style="margin-bottom:0; padding:4px 8px;">
                ✅ ไม่หักคะแนน ({{ getRecord(row.student_id).status }})
              </div>
            </template>
          </el-table-column>
          <el-table-column label="หมายเหตุ" min-width="120">
            <template #default="{ row }">
              <el-input v-model="getRecord(row.student_id).note" size="small" placeholder="หมายเหตุ" />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- ── Student Grid (Card View) ─────────────────────────────────────────────── -->
      <div v-else class="tad-grid" v-loading="loadingStudents">
        <el-empty v-if="!loadingStudents && students.length === 0" description="ไม่พบนักเรียน" :image-size="60" />
        <div
          v-for="(stu, idx) in students"
          :key="stu.student_id"
          class="tad-card"
          :class="cardColorClass(getRecord(stu.student_id).status)"
        >
          <!-- Student header: photo + name -->
          <div class="tad-card-header">
            <div class="tad-card-num">{{ idx + 1 }}</div>
            <div class="tad-card-avatar">
              <el-image
                v-if="stu.photo_url"
                :src="fixPhotoUrl(stu.photo_url)"
                :preview-src-list="[fixPhotoUrl(stu.photo_url)]"
                :preview-teleported="true"
                fit="cover"
                class="w-full h-full rounded-full"
                style="cursor:zoom-in"
              >
                <template #error>
                  <span class="w-full h-full flex items-center justify-center font-bold text-white text-base">
                    {{ (stu.name || '?').charAt(0) }}
                  </span>
                </template>
              </el-image>
              <span v-else class="w-full h-full flex items-center justify-center font-bold text-white text-base">
                {{ (stu.name || '?').charAt(0) }}
              </span>
            </div>
            <div class="tad-card-info">
              <div class="tad-card-name">{{ stu.name }} {{ stu.surname }}</div>
              <div class="tad-card-id">{{ stu.student_id }}</div>
            </div>
          </div>

          <!-- Status buttons 2×3 -->
          <div class="tad-status-grid">
            <button
              v-for="s in STATUSES"
              :key="s.key"
              class="tad-sbtn"
              :class="getRecord(stu.student_id).status === s.key ? `tad-sbtn-${s.color}` : 'tad-sbtn-off'"
              @click="setStatus(stu.student_id, s.key)"
            >{{ s.label }}</button>
          </div>

          <!-- Behavior section: เลือกได้ 1 อย่าง -->
          <div v-if="showBehavior(getRecord(stu.student_id).status)" class="tad-behavior">
            <div class="tad-beh-label">พฤติกรรมการเรียน</div>
            <div class="tad-beh-chips">
              <button
                v-for="beh in learningBeh"
                :key="beh.id"
                class="tad-chip"
                :class="isSelected(stu.student_id, beh.id) ? 'tad-chip-on' : 'tad-chip-off'"
                @click="selectBehavior(stu.student_id, beh)"
              >
                {{ beh.label }}
                <span class="tad-chip-pts">{{ beh.points_default }}</span>
              </button>
            </div>

            <!-- Score input for selected behavior -->
            <div v-if="getSelectedBehaviors(stu.student_id).length > 0" class="tad-score-row">
              <span class="tad-score-lbl">{{ getSelectedBehaviors(stu.student_id)[0].label }}</span>
              <el-input-number
                v-model="getSelectedBehaviors(stu.student_id)[0].adjusted_score"
                :min="getSelectedBehaviors(stu.student_id)[0].points_min"
                :max="getSelectedBehaviors(stu.student_id)[0].points_max"
                size="small"
                controls-position="right"
                style="width:100px"
              />
            </div>

            <!-- คะแนนสุทธิ -->
            <div class="tad-net-score">
              <span class="tad-net-lbl">คะแนนสุทธิ</span>
              <span class="tad-net-val" :class="getTotalDeduction(stu.student_id) < 0 ? 'text-red-500' : 'text-emerald-600'">
                {{ getTotalDeduction(stu.student_id) >= 0 ? '+' : '' }}{{ getTotalDeduction(stu.student_id) }}
              </span>
            </div>
          </div>

          <!-- มีผลต่อคะแนน (ติดลบ หรือบวก หรือ affects_behavior) -->
          <div v-else-if="getAttendanceStatus(getRecord(stu.student_id).status)?.affects_behavior || getAttendanceStatus(getRecord(stu.student_id).status)?.points_default !== 0" class="tad-behavior" :style="getAttendancePoints(stu.student_id) < 0 ? 'background:#fff1f2;border-color:#fecdd3;' : 'background:#f0fdf4;border-color:#bbf7d0;'">
            <div class="tad-score-row" style="border:none;background:transparent;padding:0;">
              <span class="tad-score-lbl" :class="getAttendancePoints(stu.student_id) < 0 ? 'text-red-600' : 'text-emerald-600'">
                คะแนนสถานะ ({{ getRecord(stu.student_id).status }})
              </span>
              <el-input-number v-model="getRecord(stu.student_id).adjusted_attendance_score" :min="getAttendanceStatus(getRecord(stu.student_id).status)?.points_min ?? -100" :max="getAttendanceStatus(getRecord(stu.student_id).status)?.points_max ?? 100" size="small" controls-position="right" style="width:90px" />
            </div>
          </div>
          <!-- ลาป่วย ลากิจ (ไม่หักคะแนน) -->
          <div v-else class="tad-excused">
            ✅ ไม่หักคะแนน ({{ getRecord(stu.student_id).status }})
          </div>

          <!-- Note field -->
          <el-input
            v-model="getRecord(stu.student_id).note"
            :placeholder="'หมายเหตุ ' + stu.name"
            size="small"
            class="mt-2"
          />
        </div>
      </div>

      <!-- Dialog คาบคู่ -->
      <el-dialog v-model="doublePeriodDialog" title="📋 คาบคู่ติดกัน" width="360px" align-center>
        <div class="text-center py-2">
          <div class="text-4xl mb-3">📚</div>
          <p class="font-semibold text-gray-700 mb-1">พบคาบถัดไปที่สอนวิชาเดียวกัน</p>
          <p class="text-sm text-gray-500 mb-4">
            คาบ {{ doublePeriodTarget?.period }} · {{ doublePeriodTarget?.subject_name || doublePeriodTarget?.subject_plan_id }}
          </p>
          <p class="text-sm text-indigo-600">ต้องการบันทึกข้อมูลเดียวกันในคาบนี้ด้วยไหม?</p>
        </div>
        <template #footer>
          <el-button @click="doublePeriodDialog = false">ไม่</el-button>
          <el-button type="primary" :loading="savingDouble" @click="saveDoublePeriod">ใช่ บันทึก 2 คาบ</el-button>
        </template>
      </el-dialog>

      <!-- Bottom save bar -->
      <div class="tad-bottom-bar">
        <span class="text-sm text-gray-500">
          {{ savedAt ? `💾 บันทึกล่าสุด ${savedAt}` : 'ยังไม่บันทึก' }}
        </span>
        <el-button type="success" :loading="saving" @click="saveAll" style="min-width:140px" class="tad-save-bottom-btn">
          💾 บันทึกทั้งหมด
        </el-button>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { supabase } from '@/supabase/client'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'

const route       = useRoute()
const router      = useRouter()
const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { getStudents, getBehaviorSettings, getAttendanceStatuses, getSubjects } = useSchoolDb()

const term = () => schoolStore.currentTerm || '2568_1'
const taId = computed(() => route.params.id)

// ─── Constants ────────────────────────────────────────────────────
const ACTIVITY_TYPES = ['บรรยาย', 'อภิปราย', 'ปฏิบัติ', 'ทดสอบ', 'โครงงาน', 'กิจกรรม', 'อื่นๆ']

const DEFAULT_STATUSES = [
  { status_code: 'B001', label: 'มาเรียน',   color: 'green',  points_default:   0, sort_order: 1 },
  { status_code: 'B002', label: 'มาสาย',     color: 'yellow', points_default:  -2, sort_order: 2 },
  { status_code: 'B003', label: 'โดดเรียน',  color: 'red',    points_default: -15, sort_order: 3 },
  { status_code: 'B004', label: 'ลาป่วย',    color: 'purple', points_default:   0, sort_order: 4 },
  { status_code: 'B005', label: 'ลากิจ',     color: 'blue',   points_default:   0, sort_order: 5 },
  { status_code: 'B006', label: 'ไปราชการ',  color: 'gray',   points_default:   0, sort_order: 6 },
]

// ─── State ────────────────────────────────────────────────────────
const loadingPage     = ref(false)
const loadingStudents = ref(false)
const saving          = ref(false)
const savedAt         = ref('')
const viewMode        = ref('table')

const ta             = ref(null)
const students       = ref([])
const attendanceStatuses = ref([])
const learningBeh    = ref([])
const attendanceBeh  = ref([])
const currentTeacherName = ref('')

const form = ref({
  topic: '', subject_actual_id: '', activity_type: 'บรรยาย', note: '',
  img1: '', img2: '', img3: '',
})

// ─── Subjects & timetable slots (substitute teaching) ────────────
const allSubjects     = ref([])
const classSlots      = ref([])   // timetable slots for this class only (cached)

// helper: ดึง field จาก slot รองรับทั้งรูปแบบ _snapshot และ ไม่มี
function slotSubjectCode(s) { return s.subject_code_snapshot || s.subject_code || '' }
function slotTeacherId(s)   { return s.teacher_id_snapshot   || s.teacher_id   || '' }
function slotTeacherName(s) { return s.teacher_name_snapshot || s.teacher_name || '' }

// ตรวจสอบว่าเป็นสอนแทน: teacher_plan_id ≠ id ของผู้ใช้ปัจจุบัน
// ถ้าไม่มี teacher_plan_id (record เก่า) → ถือว่าสอนเอง (disable dropdown)
const isSubstitute = computed(() => {
  if (ta.value?.slot_type === 'homeroom') return false
  const planned = String(ta.value?.teacher_plan_id || '')
  if (!planned) return false
  const myTeacherId = String(authStore.profile?.teacher_id || '')
  const myUid       = String(authStore.profile?.uid || '')
  return planned !== myTeacherId && planned !== myUid
})

// วิชาของผู้ที่กำลังทำรายการ (ครูสอนแทน) ในห้องนี้
const substituteSubjectOptions = computed(() => {
  const myTeacherId = String(authStore.profile?.teacher_id || authStore.profile?.uid || '')
  const mySlots = myTeacherId
    ? classSlots.value.filter(s => slotTeacherId(s) === myTeacherId)
    : classSlots.value
  const codes = new Set(mySlots.map(slotSubjectCode).filter(Boolean))
  if (!codes.size) {
    // fallback: แสดงทุกวิชาของห้อง
    const allCodes = new Set(classSlots.value.map(slotSubjectCode).filter(Boolean))
    return allSubjects.value.filter(s => !allCodes.size || allCodes.has(s.subject_code))
  }
  return allSubjects.value.filter(s => codes.has(s.subject_code))
})

// ชื่อครูเจ้าของวิชาที่เลือก
const subjectActualTeacherName = computed(() => {
  const code = form.value.subject_actual_id
  if (!code) return ''
  const slot = classSlots.value.find(s => slotSubjectCode(s) === code)
  return slotTeacherName(slot) || ''
})

// ─── Photo state (3 photos) ───────────────────────────────────────
const photoInputRefs = ref([null, null, null])
const photoBase64s   = ref(['', '', ''])   // local preview / pending upload
const photoUrls      = ref(['', '', ''])   // saved URLs from Firestore
const uploadingPhotos = ref(false)

// ─── Per-student records ──────────────────────────────────────────
const studentRecords     = reactive({})
const prevScoreBreakdown = ref({})

// ─── คาบคู่ ──────────────────────────────────────────────────────
const doublePeriodDialog = ref(false)
const doublePeriodTarget = ref(null)   // teach_actual ของคาบถัดไป
const savingDouble       = ref(false)
const lastSavedPayload   = ref(null)   // payload ล่าสุดที่บันทึกสำเร็จ

// ─── Photo helpers ────────────────────────────────────────────────
function fixPhotoUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  let id = ''
  let match = url.match(/[?&]id=([\w-]{20,})/)
  if (match) id = match[1]
  if (!id) {
    match = url.match(/\/d\/([\w-]{20,})/)
    if (match) id = match[1]
  }
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`
  return url
}

// re-compress an existing data URL to smaller size (for storing in DB when no cloud storage)
function compressDataUrlForDB(dataUrl, maxW = 800, maxH = 800, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function compressToBase64(file, maxW = 1200, maxH = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดรูปไม่สำเร็จ')) }
    img.src = url
  })
}

async function loadGasSettings() {
  const schoolId = authStore.schoolId
  if (!schoolId) throw new Error('ไม่พบ schoolId')
  const { data, error } = await supabase
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .single()
  if (error || !data) throw new Error('ไม่พบการตั้งค่า GAS')
  // settings บันทึกไว้ที่ settings.teaching_log_settings (จาก TeachingLogSettingsView)
  const tl = data.settings?.teaching_log_settings || {}
  const gasUrl   = (tl.gas_upload_web_app_url || tl.gas_web_app_url || '').trim()
  const folderId = (tl.gdrive_folder_id || '').trim()
  if (!gasUrl)   throw new Error('กรุณาตั้งค่า GAS Upload Web App URL ในหน้าตั้งค่าบันทึกเข้าสอน')
  if (!folderId) throw new Error('กรุณาตั้งค่า Google Drive Folder ID ในหน้าตั้งค่าบันทึกเข้าสอน')
  return { gasUrl, folderId }
}

async function uploadPhotoViaGAS(fileName, base64DataUrl, folderId, gasUrl) {
  const base64Data = base64DataUrl.split(',')[1]
  const res = await fetch(gasUrl, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ route: 'upload-student-photo', folderId, fileName: fileName + '.jpg', mimeType: 'image/jpeg', base64Data }),
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('GAS ตอบกลับผิดรูปแบบ') }
  if (!data.success) throw new Error(data.error || 'อัพโหลดไม่สำเร็จ')
  return data.url
}

function triggerPhotoPick(index) {
  photoInputRefs.value[index]?.click()
}

async function onPhotoSelected(index, e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  try {
    const dataUrl = await compressToBase64(file)
    photoBase64s.value[index] = dataUrl
  } catch (err) {
    ElMessage.error('ไม่สามารถโหลดรูปภาพ: ' + err.message)
  }
}

function clearPhoto(index) {
  photoBase64s.value[index] = ''
  photoUrls.value[index]    = ''
}

// ─── Helpers ─────────────────────────────────────────────────────
function getRecord(studentId) {
  if (!studentRecords[studentId]) {
    studentRecords[studentId] = { status: 'มาเรียน', selected_behaviors: [], note: '', adjusted_attendance_score: getAttendanceStatus('มาเรียน')?.points_default ?? 0 }
  }
  return studentRecords[studentId]
}

function showBehavior(status) { return ['มาเรียน', 'มาสาย'].includes(status) }
function isExcused(status)    { return ['ลาป่วย', 'ลากิจ', 'ไปราชการ'].includes(status) }

function isSelected(studentId, behaviorId) {
  return getRecord(studentId).selected_behaviors.some(b => b.setting_id === behaviorId)
}

function getSelectedBehaviors(studentId) {
  return getRecord(studentId).selected_behaviors
}

// เลือกได้ 1 อย่าง — คลิกซ้ำเพื่อยกเลิก
function selectBehavior(studentId, beh) {
  const rec = getRecord(studentId)
  const alreadySelected = rec.selected_behaviors.some(b => b.setting_id === beh.id)
  if (alreadySelected) {
    rec.selected_behaviors = []
  } else {
    rec.selected_behaviors = [{
      setting_id:    beh.id,
      label:         beh.label,
      behavior_type: beh.behavior_type,
      points_default: beh.points_default ?? 0,
      points_min:    beh.points_min ?? beh.points_default ?? 0,
      points_max:    beh.points_max ?? 0,
      adjusted_score: beh.points_default ?? 0,
    }]
  }
}

function getLearningPoints(studentId) {
  return getRecord(studentId).selected_behaviors.reduce((sum, b) => {
    return sum + Number(b.adjusted_score ?? b.points_default ?? 0)
  }, 0)
}

function getAttendanceStatus(status) {
  return attendanceStatuses.value.find(item => item.label === status) || null
}

function hasAttendanceScore(statusLabel) {
  const s = getAttendanceStatus(statusLabel)
  if (!s) return false
  return s.affects_behavior || s.points_default !== 0 || s.points_min !== 0 || s.points_max !== 0
}

function getAttendancePoints(studentId) {
  const rec = getRecord(studentId)
  if (rec.adjusted_attendance_score !== undefined) {
    return Number(rec.adjusted_attendance_score)
  }
  const status = getAttendanceStatus(getRecord(studentId).status)
  return Number(status?.points_default || 0)
}

function getTotalDeduction(studentId) {
  return getAttendancePoints(studentId) + getLearningPoints(studentId)
}

function cardColorClass(status) {
  const map = {
    'มาเรียน': 'tad-card-present', 'มาสาย': 'tad-card-late',
    'โดดเรียน': 'tad-card-skip', 'ลาป่วย': 'tad-card-sick',
    'ลากิจ': 'tad-card-leave', 'ไปราชการ': 'tad-card-official',
  }
  return map[status] || 'tad-card-present'
}

function mapStatusColor(color) {
  const m = { green:'present', yellow:'late', red:'skip', purple:'sick', blue:'leave', gray:'official' }
  return m[color] || 'present'
}

const STATUSES = computed(() => {
  const source = attendanceStatuses.value.length ? attendanceStatuses.value : DEFAULT_STATUSES
  return source.slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map(item => ({
      key: item.label, label: item.label,
      color: mapStatusColor(item.color),
      points_default: Number(item.points_default || 0),
    }))
})

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = (d || '').split('-')
  return `${day}/${m}/${y}`
}

// ─── Status / behavior actions ────────────────────────────────────
function setStatus(studentId, status) {
  const rec = getRecord(studentId)
  if (rec.status === status) return
  rec.status = status
  rec.selected_behaviors = []
  rec.adjusted_attendance_score = Number(getAttendanceStatus(status)?.points_default ?? 0)
}

// ─── Summary counts ───────────────────────────────────────────────
function countStatus(status) {
  return students.value.filter(s => getRecord(s.student_id).status === status).length
}
function countLeave() {
  return students.value.filter(s => isExcused(getRecord(s.student_id).status)).length
}
function markAllPresent() {
  students.value.forEach(s => {
    getRecord(s.student_id).status = 'มาเรียน'
    getRecord(s.student_id).selected_behaviors = []
  })
}

// ─── Load ─────────────────────────────────────────────────────────
async function loadPage() {
  loadingPage.value = true
  try {
    const { data: taData, error: taErr } = await supabase
      .from('teach_actuals')
      .select('*')
      .eq('id', taId.value)
      .single()
    if (taErr || !taData) {
      ElMessage.error('ไม่พบข้อมูลคาบสอนนี้')
      router.back()
      return
    }
    // Seed from route query (passed by TeachingLogView) so subject shows immediately
    const q = route.query
    ta.value = {
      ...taData,
      id: taData.id,
      period: taData.period_number,
      class_name: taData.class_id,
      subject_plan_id: taData.subject_id  || q.si  || '',
      subject_name:    taData.subject_id  || q.sn  || '',
      teacher_plan_id:  taData.planned_teacher_id || q.tpi || '',
      teacher_plan_name: taData.planned_teacher_id || q.tpn || '',
      slot_type: taData.slot_type || 'normal',
      // images array → img1/img2/img3
      img1: Array.isArray(taData.images) ? (taData.images[0] || '') : '',
      img2: Array.isArray(taData.images) ? (taData.images[1] || '') : '',
      img3: Array.isArray(taData.images) ? (taData.images[2] || '') : '',
      // student_records stored as jsonb
      student_records: taData.student_records || {},
    }

    const d = ta.value
    form.value = {
      topic:             d.topic || '',
      subject_actual_id: d.actual_teacher_id ? (d.subject_id || '') : '',
      activity_type:     d.activity_type || 'บรรยาย',
      note:              d.note || '',
      img1: d.img1,
      img2: d.img2,
      img3: d.img3,
    }
    photoUrls.value    = [d.img1, d.img2, d.img3]
    photoBase64s.value = ['', '', '']

    const prevRecs = d.student_records || {}

    const loadedStatuses = await getAttendanceStatuses()
    attendanceStatuses.value = loadedStatuses.length ? loadedStatuses : DEFAULT_STATUSES

    const p = authStore.profile
    const teacherCode = p?.teacher_id || p?.teacherId
    if (teacherCode) {
      const { data: tRow } = await supabase
        .from('teachers')
        .select('prefix, first_name, last_name')
        .eq('school_id', authStore.schoolId)
        .eq('teacher_code', teacherCode)
        .limit(1)
        .maybeSingle()
      if (tRow?.first_name) currentTeacherName.value = [tRow.prefix, tRow.first_name, tRow.last_name].filter(Boolean).join(' ')
    }
    if (!currentTeacherName.value) currentTeacherName.value = p?.displayName || p?.display_name || p?.email || ''

    const t = schoolStore.currentTerm || '2568_1'
    const [allBeh, subjects, slotRes] = await Promise.all([
      getBehaviorSettings(),
      getSubjects(),
      supabase.from('timetable_slots')
        .select('*')
        .eq('school_id', authStore.schoolId)
        .eq('term_id', t)
        .eq('class_id', d.class_id)
        .neq('slot_type', 'activity'),
    ])
    learningBeh.value   = allBeh.filter(b => b.behavior_type === 'learning' && b.is_active !== false)
    attendanceBeh.value = allBeh.filter(b => b.behavior_type === 'attendance' && b.is_active !== false)
    allSubjects.value   = subjects
    classSlots.value    = (slotRes.data || []).map(s => ({
      ...s,
      subject_code: s.subject_id || '',
      teacher_id:   s.teacher_id || '',
      teacher_name: s.teacher_name || s.teacher_id || '',
    }))

    // Enrich ta with subject/teacher info from timetable_slots
    // (teach_actuals stores null for these because DB columns were UUID type)
    if (!ta.value.subject_plan_id || !ta.value.teacher_plan_id) {
      const DAYS_ARR = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
      const DAY_TO_NUM = { จันทร์:1, อังคาร:2, พุธ:3, พฤหัสบดี:4, ศุกร์:5, เสาร์:6, อาทิตย์:7 }
      const dayNum = DAY_TO_NUM[DAYS_ARR[new Date(taData.date + 'T00:00:00').getDay()]]
      const planSlot = classSlots.value.find(s =>
        s.period_number === taData.period_number && s.day_of_week === dayNum
      ) || classSlots.value.find(s => s.period_number === taData.period_number)
      if (planSlot) {
        ta.value = {
          ...ta.value,
          subject_plan_id:   planSlot.subject_id   || ta.value.subject_plan_id   || '',
          subject_name:      planSlot.subject_name || planSlot.subject_id         || ta.value.subject_name || '',
          teacher_plan_id:   planSlot.teacher_id   || ta.value.teacher_plan_id   || '',
          teacher_plan_name: planSlot.teacher_name || planSlot.teacher_id         || ta.value.teacher_plan_name || '',
        }
      }
    }

    loadingStudents.value = true
    const studs = await getStudents(d.class_id)
    students.value = studs.filter(s => !s.student_status || s.student_status === 'เรียนอยู่')

    students.value.forEach(s => {
      const prev = prevRecs[s.student_id]
      if (prev) {
        prevScoreBreakdown.value[s.student_id] = {
          attendance: Number(prev.attendance_points || 0),
          learning:   Number(prev.learning_points  || 0),
          total:      Number(prev.total_deduction  || 0),
        }
        studentRecords[s.student_id] = {
          status:             prev.status || 'มาเรียน',
          selected_behaviors: prev.selected_behaviors || [],
          note:               prev.note || '',
          adjusted_attendance_score: Number(prev.attendance_points ?? getAttendanceStatus(prev.status || 'มาเรียน')?.points_default ?? 0)
        }
      } else {
        prevScoreBreakdown.value[s.student_id] = { attendance: 0, learning: 0, total: 0 }
        const defStat = attendanceStatuses.value[0]?.label || 'มาเรียน'
        studentRecords[s.student_id] = { status: defStat, selected_behaviors: [], note: '', adjusted_attendance_score: Number(getAttendanceStatus(defStat)?.points_default ?? 0) }
      }
    })
  } catch (e) {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    loadingPage.value     = false
    loadingStudents.value = false
  }
}

onMounted(loadPage)

// ─── buildPayload: deep-strip Vue Proxy via JSON round-trip ───────
function buildStudentRecordsPayload() {
  // JSON round-trip removes ALL nested Vue Proxy wrappers (toRaw is shallow)
  const deepRaw = JSON.parse(JSON.stringify(toRaw(studentRecords)))
  const rawStudents = toRaw(students.value)
  const result = {}
  for (const stu of rawStudents) {
    const sid = String(stu.student_id)
    const rec = deepRaw[sid] || { status: 'มาเรียน', selected_behaviors: [], note: '' }
    const behs = (rec.selected_behaviors || []).map(b => ({
      setting_id:     String(b.setting_id    || ''),
      label:          String(b.label         || ''),
      behavior_type:  String(b.behavior_type || ''),
      points_default: Number(b.points_default ?? 0),
      adjusted_score: Number(b.adjusted_score ?? b.points_default ?? 0),
    }))
    result[sid] = {
      status:             String(rec.status || 'มาเรียน'),
      selected_behaviors: behs,
      attendance_points:  Number(getAttendancePoints(sid)),
      learning_points:    Number(getLearningPoints(sid)),
      total_deduction:    Number(getTotalDeduction(sid)),
      note:               String(rec.note || ''),
    }
  }
  return result
}

// ─── Save ─────────────────────────────────────────────────────────
async function saveAll() {
  if (!form.value.topic.trim()) {
    ElMessage.warning('กรุณากรอกหัวข้อที่สอนก่อน')
    return
  }
  saving.value = true
  try {
    // 1. อัพโหลดภาพที่รอค้างอยู่
    if (photoBase64s.value.some(b => b)) {
      uploadingPhotos.value = true
      try {
        let gasSettings = null
        try { gasSettings = await loadGasSettings() } catch { /* GAS not configured — fallback to base64 */ }
        for (let i = 0; i < 3; i++) {
          if (!photoBase64s.value[i]) continue
          if (gasSettings) {
            try {
              const fileName = `teaching_${String(taId.value)}_photo${i + 1}`
              photoUrls.value[i] = await uploadPhotoViaGAS(fileName, photoBase64s.value[i], gasSettings.folderId, gasSettings.gasUrl)
              photoBase64s.value[i] = ''
            } catch (err) {
              ElMessage.warning(`อัพโหลดภาพที่ ${i + 1} ไม่สำเร็จ: ${err.message}`)
              // fallback: store compressed base64 in DB
              photoUrls.value[i] = await compressDataUrlForDB(photoBase64s.value[i])
              photoBase64s.value[i] = ''
            }
          } else {
            // ไม่มี GAS — บีบอัดและเก็บ base64 ใน DB โดยตรง
            photoUrls.value[i] = await compressDataUrlForDB(photoBase64s.value[i])
            photoBase64s.value[i] = ''
          }
        }
      } finally {
        uploadingPhotos.value = false
      }
    }

    // 2. เตรียม plain data ทั้งหมด — toRaw() เพื่อลบ Vue Proxy ออก
    const t           = String(term())
    const taIdStr     = String(taId.value)
    const taRaw       = toRaw(ta.value) || {}
    const rawStudents = toRaw(students.value)
    const schoolId    = authStore.schoolId

    const img1 = String(photoUrls.value[0] || '')
    const img2 = String(photoUrls.value[1] || '')
    const img3 = String(photoUrls.value[2] || '')
    form.value.img1 = img1
    form.value.img2 = img2
    form.value.img3 = img3

    const studentRecordsPayload = buildStudentRecordsPayload()

    // 3. คำนวณ delta สำหรับ behavior scores
    // sid = student_code (key ใน UI), dbId = UUID (key ใน DB)
    const needsUpdate = []   // เก็บ UUID สำหรับ query students
    const deltaMap    = {}   // keyed by sid (student_code)

    for (const stu of rawStudents) {
      const sid   = String(stu.student_id)   // student_code เช่น "12334" — ใช้เป็น key ใน UI
      const dbId  = String(stu.id || '')     // UUID — ใช้ filter ใน DB
      const rec   = studentRecordsPayload[sid]
      const attPoints  = rec.attendance_points
      const lrnPoints  = rec.learning_points
      const newTotal   = rec.total_deduction
      const prevRaw    = toRaw(prevScoreBreakdown.value[sid]) || { attendance: 0, learning: 0, total: 0 }
      const deltaAtt   = attPoints - Number(prevRaw.attendance || 0)
      const deltaLrn   = lrnPoints - Number(prevRaw.learning  || 0)
      const deltaTotal = newTotal  - Number(prevRaw.total     || 0)
      deltaMap[sid] = { dbId, attPoints, lrnPoints, newTotal, deltaAtt, deltaLrn, deltaTotal }
      if ((deltaAtt !== 0 || deltaLrn !== 0 || deltaTotal !== 0) && dbId) needsUpdate.push(dbId)
    }

    // 4-5. บันทึก behavior_logs + อัปเดต students scores
    let behaviorErr = null
    try {
      // โหลดคะแนนปัจจุบันของนักเรียนทุกคน (ใช้ UUID)
      const allDbIds = rawStudents.map(s => String(s.id || '')).filter(Boolean)
      const summaryMap = {}
      if (allDbIds.length) {
        const { data: stuRows, error: selErr } = await supabase
          .from('students')
          .select('id, total_behavior_score, attendance_behavior_score, learning_behavior_score')
          .in('id', allDbIds)
        if (selErr) throw selErr
        ;(stuRows || []).forEach(row => {
          summaryMap[String(row.id)] = {
            total_score:      row.total_behavior_score      ?? 0,
            attendance_score: row.attendance_behavior_score ?? 0,
            learning_score:   row.learning_behavior_score   ?? 0,
          }
        })
      }

      // อัปเดต students scores (delta-based — เฉพาะที่เปลี่ยนแปลง)
      for (const stu of rawStudents) {
        const sid  = String(stu.student_id)
        const { dbId, attPoints, lrnPoints, newTotal, deltaAtt, deltaLrn, deltaTotal } = deltaMap[sid]

        if (deltaAtt !== 0 || deltaLrn !== 0 || deltaTotal !== 0) {
          const sumData = summaryMap[dbId] || { total_score: 0, attendance_score: 0, learning_score: 0 }
          const newTotalScore = Number((sumData.total_score      ?? 0) + deltaTotal)
          const newAttScore   = Number((sumData.attendance_score ?? 0) + deltaAtt)
          const newLrnScore   = Number((sumData.learning_score   ?? 0) + deltaLrn)

          const { error: stuErr } = await supabase
            .from('students')
            .update({
              total_behavior_score:      newTotalScore,
              attendance_behavior_score: newAttScore,
              learning_behavior_score:   newLrnScore,
            })
            .eq('id', dbId)
          if (stuErr) throw stuErr

          prevScoreBreakdown.value[sid] = { attendance: attPoints, learning: lrnPoints, total: newTotal }
          summaryMap[dbId] = { total_score: newTotalScore, attendance_score: newAttScore, learning_score: newLrnScore }
        }
      }

      // ลบ behavior_logs เก่าของคาบนี้ แล้ว insert ใหม่
      await supabase.from('behavior_logs').delete().eq('source_id', taIdStr)

      const logRows = []
      const now = new Date().toISOString()
      const taDate = String(taRaw.date || '')

      // ชื่อครูผู้ทำรายการ
      const p = authStore.profile
      const recorderNameStr = currentTeacherName.value || p?.email || ''

      for (const stu of rawStudents) {
        const sid  = String(stu.student_id)
        const dbId = String(stu.id || '')
        const rec  = studentRecordsPayload[sid]
        if (!dbId) continue

        const attPoints = rec.attendance_points
        const lrnPoints = rec.learning_points
        const sumData = summaryMap[dbId] || { attendance_score: 0, learning_score: 0 }

        // label สำหรับ attendance = สถานะการมาเรียน เช่น "มาสาย", "ขาด"
        const attLabel = rec.status || 'เช็คชื่อ'
        // label สำหรับ learning = รายการพฤติกรรมที่เลือก เช่น "ไม่ตั้งใจเรียน, ก่อกวน"
        const lrnLabel = (rec.selected_behaviors || []).map(b => b.label).filter(Boolean).join(', ') || 'พฤติกรรมในห้องเรียน'

        if (attPoints !== 0) {
          logRows.push({
            source_id:                    taIdStr,
            source_type:                  'teach_actual',
            term_id:                      t,
            student_id:                   sid,
            school_id:                    schoolId,
            behavior_type:                'attendance',
            behavior_type_label_snapshot: 'พฤติกรรมในห้องเรียน',
            label_snapshot:               attLabel,
            points_change:                attPoints,
            score_after:                  sumData.attendance_score,
            note:                         String(rec.note || ''),
            recorded_by_name_snapshot:    recorderNameStr,
            date:                         taDate,
            created_at:                   now,
          })
        }
        if (lrnPoints !== 0) {
          logRows.push({
            source_id:                    taIdStr,
            source_type:                  'teach_actual',
            term_id:                      t,
            student_id:                   sid,
            school_id:                    schoolId,
            behavior_type:                'learning',
            behavior_type_label_snapshot: 'พฤติกรรมในห้องเรียน',
            label_snapshot:               lrnLabel,
            points_change:                lrnPoints,
            score_after:                  sumData.learning_score,
            note:                         String(rec.note || ''),
            recorded_by_name_snapshot:    recorderNameStr,
            date:                         taDate,
            created_at:                   now,
          })
        }
      }

      if (logRows.length) {
        const { error: insertErr } = await supabase.from('behavior_logs').insert(logRows)
        if (insertErr) throw insertErr
      }
    } catch (e) {
      behaviorErr = e
    }

    // 6. บันทึก teach_actual
    const taUpdate = {
      topic:           String(form.value.topic || ''),
      activity_type:   String(form.value.activity_type || 'บรรยาย'),
      note:            String(form.value.note || ''),
      images:          [img1, img2, img3].filter(Boolean),
      student_records: studentRecordsPayload,
      record_by_name:  currentTeacherName.value || '',
      is_filled:       true,
      updated_at:      new Date().toISOString(),
    }
    let { error: saveErr } = await supabase.from('teach_actuals').update(taUpdate).eq('id', taIdStr)
    if (saveErr?.message?.match(/column|schema/i)) {
      const { topic, activity_type, images, is_filled, updated_at } = taUpdate
      ;({ error: saveErr } = await supabase.from('teach_actuals').update({ topic, activity_type, images, is_filled, updated_at }).eq('id', taIdStr))
    }
    if (saveErr) throw saveErr

    const now = new Date()
    savedAt.value = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
    if (behaviorErr) {
      ElMessage.warning('⚠️ บันทึกข้อมูลการสอนแล้ว แต่ยังบันทึกคะแนนไม่ได้ — กรุณาเพิ่ม column ใน DB ก่อน')
    } else {
      ElMessage.success('✅ บันทึกเรียบร้อยแล้ว')
    }

    lastSavedPayload.value = {
      topic:           String(form.value.topic || ''),
      activity_type:   String(form.value.activity_type || 'บรรยาย'),
      note:            String(form.value.note || ''),
      student_records: studentRecordsPayload,
      img1, img2, img3,
    }

    // ตรวจสอบคาบคู่ ถ้ามีคาบคู่จะแสดง dialog ก่อนกลับ
    await checkDoublePeriod(taRaw, t)

    // กลับหน้าเลือกคาบ (ถ้าไม่มี dialog คาบคู่)
    if (!doublePeriodDialog.value) {
      setTimeout(() => router.back(), 800)
    }

  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

// ─── คาบคู่ ────────────────────────────────────────────────────────
async function checkDoublePeriod(taRaw, t) {
  try {
    const classId = String(taRaw.class_id || '')
    const date    = String(taRaw.date || '')
    const period  = Number(taRaw.period_number ?? taRaw.period)
    if (!classId || !date) return

    // ใช้ subject_plan_id ที่ enrich จาก timetable_slots (ta.value) แทน subject_id ที่เป็น null ใน DB
    const mySubject = String(ta.value?.subject_plan_id || ta.value?.subject_id || '')

    const { data } = await supabase
      .from('teach_actuals')
      .select('*')
      .eq('term_id', t)
      .eq('class_id', classId)
      .eq('date', date)
      .eq('school_id', authStore.schoolId)

    // หาคาบที่อยู่ติดกัน: prefer period+1 (ถัดไป) ก่อน period-1 (ก่อนหน้า)
    const isValidAdjacent = r => {
      if (r.id === String(taId.value)) return false
      if (Math.abs(Number(r.period_number) - period) !== 1) return false
      if (r.is_filled) return false
      const rSubject = String(r.subject_id || '')
      if (mySubject && rSubject && mySubject !== rSubject) return false
      return true
    }
    const adjacent = (data || []).find(r => Number(r.period_number) === period + 1 && isValidAdjacent(r))
                  || (data || []).find(r => Number(r.period_number) === period - 1 && isValidAdjacent(r))

    if (adjacent) {
      doublePeriodTarget.value = { ...adjacent, period: adjacent.period_number }
      doublePeriodDialog.value = true
    }
  } catch { /* ไม่รบกวน user ถ้าตรวจไม่ได้ */ }
}

async function saveDoublePeriod() {
  if (!doublePeriodTarget.value || !lastSavedPayload.value) return
  savingDouble.value = true
  try {
    const targetId = String(doublePeriodTarget.value.id)
    const payload  = lastSavedPayload.value

    const dblUpdate = {
      topic:           payload.topic,
      activity_type:   payload.activity_type,
      note:            payload.note || '',
      images:          [payload.img1, payload.img2, payload.img3].filter(Boolean),
      student_records: payload.student_records || {},
      is_filled:       true,
      updated_at:      new Date().toISOString(),
    }
    let { error: dblErr } = await supabase.from('teach_actuals').update(dblUpdate).eq('id', targetId)
    if (dblErr?.message?.match(/column|schema/i)) {
      const { topic, activity_type, images, is_filled, updated_at } = dblUpdate
      ;({ error: dblErr } = await supabase.from('teach_actuals').update({ topic, activity_type, images, is_filled, updated_at }).eq('id', targetId))
    }
    if (dblErr) throw dblErr

    ElMessage.success(`✅ บันทึกคาบ ${doublePeriodTarget.value.period} เรียบร้อยแล้ว`)
    doublePeriodDialog.value = false
    setTimeout(() => router.back(), 800)
  } catch (e) {
    ElMessage.error('บันทึกคาบคู่ไม่สำเร็จ: ' + e.message)
  } finally {
    savingDouble.value = false
  }
}
</script>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────── */
.tad-page {
  padding: 16px 20px 100px;
  max-width: 1300px;
  margin: 0 auto;
  background: radial-gradient(circle at 0% 0%, #eef2ff 0%, #f8fafc 50%, #fdf4ff 100%);
  min-height: 100vh;
}

/* ── Top bar ──────────────────────────────────────────────────── */
.tad-topbar {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 16px;
  background: linear-gradient(120deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  border-radius: 16px; padding: 12px 18px;
  box-shadow: 0 8px 24px rgba(99,102,241,0.30);
}
.tad-topbar-title {
  flex: 1; font-size: 17px; font-weight: 700; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tad-back-btn { background: rgba(255,255,255,0.20) !important; border-color: rgba(255,255,255,0.40) !important; color: #fff !important; }
.tad-save-btn { background: #10b981 !important; border-color: #059669 !important; font-weight: 700 !important; }

/* ── Info card ────────────────────────────────────────────────── */
.tad-info-card {
  background: white;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 4px 20px rgba(99,102,241,0.12);
  border: 2px solid #e0e7ff;
}
/* ── Plan / Actual rows ───────────────────────────────────────── */
.tad-plan-row {
  display: flex; align-items: flex-start; gap: 12px;
  background: #eef2ff; border-radius: 12px; padding: 12px 16px;
  border: 2px solid #c7d2fe; margin-bottom: 10px;
}
.tad-actual-row {
  display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap;
  background: #f0fdf4; border-radius: 12px; padding: 12px 16px;
  border: 2px solid #bbf7d0; margin-bottom: 4px;
}
.tad-plan-label {
  font-size: 11px; font-weight: 800; color: #6366f1;
  text-transform: uppercase; letter-spacing: 0.06em;
  white-space: nowrap; padding-top: 3px; min-width: 56px;
}
.tad-actual-label { color: #059669; }
.tad-plan-body { flex: 1; }
.tad-actual-body { flex: 1; }
.tad-actual-own  { flex: 1; }
.tad-plan-teacher {
  text-align: right;
}
.tad-plan-teacher-name { font-size: 13px; font-weight: 700; color: #4338ca; }
.tad-subject-code { font-size: 13px; color: #6366f1; font-weight: 700; }
.tad-subject-name-text { font-size: 20px; font-weight: 800; color: #1e1b4b; line-height: 1.3; }
.tad-sub-badge { margin-left: auto; align-self: center; font-weight: 700; }

.tad-form :deep(.el-form-item__label) { font-weight: 700; color: #4338ca; font-size: 14px; }
.tad-form :deep(.el-input__inner) { font-size: 15px; }
.tad-form :deep(.el-textarea__inner) { font-size: 15px; }
.tad-input :deep(.el-input__wrapper) { border-radius: 8px; border: 1.5px solid #c7d2fe !important; }
.tad-input :deep(.el-input__wrapper):hover { border-color: #6366f1 !important; }
.tad-input :deep(.el-input__wrapper.is-focus) { border-color: #4f46e5 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.15) !important; }
.tad-select :deep(.el-input__wrapper) { border-radius: 8px; border: 1.5px solid #c7d2fe !important; }
.tad-sub-teacher-name { font-size: 13px; color: #059669; margin-top: 6px; padding: 4px 10px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0; }

/* ── Photos card ──────────────────────────────────────────────── */
.tad-photos-card {
  background: white;
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 4px 20px rgba(236,72,153,0.10);
  border: 2px solid #fce7f3;
}
.tad-photos-title {
  font-weight: 700; font-size: 13px; color: #db2777; margin-bottom: 14px;
}
.tad-photos-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
.tad-photo-slot { display: flex; flex-direction: column; }
.tad-photo-num { font-size: 11px; font-weight: 700; color: #9333ea; margin-bottom: 6px; }
.tad-photo-preview-box {
  width: 100%; aspect-ratio: 4/3;
  border-radius: 12px;
  border: 2px dashed #f0abfc;
  overflow: hidden; cursor: pointer;
  background: linear-gradient(135deg, #fdf4ff, #fce7f3);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  transition: border-color 0.15s;
}
.tad-photo-preview-box:hover { border-color: #c026d3; }
.tad-photo-preview-img { width: 100%; height: 100%; object-fit: cover; }
.tad-photo-empty { display: flex; flex-direction: column; align-items: center; color: #c084fc; }
.tad-pick-btn { background: linear-gradient(135deg,#a855f7,#ec4899) !important; border: none !important; color: white !important; font-weight: 600 !important; }

/* ── Summary bar ─────────────────────────────────────────────── */
.tad-summary-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: linear-gradient(135deg, #1e1b4b, #312e81);
  border-radius: 14px; padding: 12px 18px;
  box-shadow: 0 6px 20px rgba(30,27,75,0.25);
}
.tad-sum-total { font-size: 13px; color: rgba(255,255,255,0.80); }
.tad-s-tag {
  padding: 3px 12px; border-radius: 99px;
  font-size: 12px; font-weight: 700;
}
.tad-s-present { background: #22c55e; color: white; }
.tad-s-late    { background: #f59e0b; color: white; }
.tad-s-skip    { background: #ef4444; color: white; }
.tad-s-sick    { background: #a855f7; color: white; }
.tad-s-leave   { background: #3b82f6; color: white; }
.tad-s-official{ background: #64748b; color: white; }
.tad-mark-all-btn { background: rgba(255,255,255,0.15) !important; border-color: rgba(255,255,255,0.35) !important; color: white !important; }

/* ── Student grid ─────────────────────────────────────────────── */
.tad-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 14px;
}

/* ── Student card ─────────────────────────────────────────────── */
.tad-card {
  border-radius: 18px; padding: 14px;
  border: 2.5px solid #e2e8f0; background: white;
  transition: box-shadow 0.15s, transform 0.1s;
}
.tad-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.10); transform: translateY(-1px); }

.tad-card-present  { border-color: #4ade80; background: linear-gradient(160deg,#f0fdf4,white); }
.tad-card-late     { border-color: #fbbf24; background: linear-gradient(160deg,#fffbeb,white); }
.tad-card-skip     { border-color: #f87171; background: linear-gradient(160deg,#fff1f2,white); }
.tad-card-sick     { border-color: #a78bfa; background: linear-gradient(160deg,#f5f3ff,white); }
.tad-card-leave    { border-color: #60a5fa; background: linear-gradient(160deg,#eff6ff,white); }
.tad-card-official { border-color: #34d399; background: linear-gradient(160deg,#ecfdf5,white); }

/* Student card header */
.tad-card-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.tad-card-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: linear-gradient(135deg,#6366f1,#8b5cf6);
  font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  color: white; flex-shrink: 0;
}
.tad-card-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #f472b6, #c084fc);
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(192,132,252,0.40);
  border: 2px solid white;
}
.tad-card-name { font-size: 15px; font-weight: 700; color: #1e293b; line-height: 1.3; }
.tad-card-id   { font-size: 12px; color: #94a3b8; }

/* Status button grid */
.tad-status-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 5px; margin-bottom: 10px;
}
.tad-sbtn {
  padding: 6px 2px; border-radius: 9px; font-size: 13px; font-weight: 600;
  border: 1.5px solid #e2e8f0; background: white; cursor: pointer;
  transition: all 0.12s; color: #64748b;
}
.tad-sbtn:hover { background: #f1f5f9; }
.tad-sbtn-off     { background: white; border-color: #e2e8f0; color: #94a3b8; }
.tad-sbtn-present { background: linear-gradient(135deg,#22c55e,#16a34a); border-color: #16a34a; color: white; }
.tad-sbtn-late    { background: linear-gradient(135deg,#f59e0b,#d97706); border-color: #d97706; color: white; }
.tad-sbtn-skip    { background: linear-gradient(135deg,#ef4444,#dc2626); border-color: #dc2626; color: white; }
.tad-sbtn-sick    { background: linear-gradient(135deg,#8b5cf6,#7c3aed); border-color: #7c3aed; color: white; }
.tad-sbtn-leave   { background: linear-gradient(135deg,#3b82f6,#2563eb); border-color: #2563eb; color: white; }
.tad-sbtn-official{ background: linear-gradient(135deg,#10b981,#059669); border-color: #059669; color: white; }

/* Behavior section */
.tad-behavior {
  background: linear-gradient(135deg,#fafafa,#f5f3ff);
  border: 1.5px solid #ede9fe;
  border-radius: 12px; padding: 10px; margin-bottom: 8px;
}
.tad-beh-label {
  font-size: 10px; font-weight: 800; color: #7c3aed;
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
}

/* Behavior chips — single select */
.tad-beh-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.tad-chip {
  padding: 4px 10px; border-radius: 99px; font-size: 11px;
  font-weight: 600; cursor: pointer; border: 1.5px solid;
  transition: all 0.12s;
}
.tad-chip-off { border-color: #ddd6fe; background: white; color: #5b21b6; }
.tad-chip-off:hover { border-color: #8b5cf6; background: #ede9fe; }
.tad-chip-on  { border-color: #7c3aed; background: linear-gradient(135deg,#7c3aed,#6d28d9); color: white; box-shadow: 0 2px 6px rgba(124,58,237,0.4); }
.tad-chip-pts { font-size: 10px; opacity: 0.85; margin-left: 3px; }

/* Score row */
.tad-score-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0; margin-bottom: 4px;
  background: white; border-radius: 8px; padding: 6px 8px;
  border: 1px solid #ede9fe;
}
.tad-score-lbl { color: #4c1d95; font-weight: 600; font-size: 12px; flex: 1; }

/* Net score */
.tad-net-score {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 8px; padding-top: 6px; border-top: 1.5px solid #ede9fe;
}
.tad-net-lbl { font-size: 11px; font-weight: 700; color: #7c3aed; }
.tad-net-val { font-size: 20px; font-weight: 900; }

/* Excused */
.tad-excused {
  font-size: 12px; color: #059669; background: linear-gradient(135deg,#ecfdf5,#d1fae5);
  border-radius: 10px; padding: 7px 10px; margin-bottom: 8px;
  font-weight: 700; border: 1px solid #a7f3d0;
}

/* ── Bottom save bar ─────────────────────────────────────────── */
.tad-bottom-bar {
  position: fixed; bottom: 0; left: 272px; right: 0;
  background: linear-gradient(135deg, #1e1b4b, #312e81);
  padding: 12px 24px; display: flex; align-items: center;
  justify-content: space-between; z-index: 100;
  box-shadow: 0 -4px 20px rgba(30,27,75,0.25);
}
.tad-bottom-bar .text-sm { color: rgba(255,255,255,0.70); }
.tad-save-bottom-btn { background: linear-gradient(135deg,#10b981,#059669) !important; border: none !important; font-weight: 700 !important; }

@media (max-width: 1023px) {
  .tad-bottom-bar { left: 0; }
  .tad-grid       { grid-template-columns: 1fr 1fr; }
  .tad-page       { padding: 12px 12px 90px; }
  .tad-photos-grid { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
}
@media (max-width: 640px) {
  .tad-grid         { grid-template-columns: 1fr; }
  .tad-photos-grid  { grid-template-columns: 1fr; }
  .tad-topbar       { flex-direction: column; align-items: stretch; text-align: center; }
  .tad-topbar-title { font-size: 14px; }
}
</style>
