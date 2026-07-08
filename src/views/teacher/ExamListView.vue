<template>
  <AppLayout>
    <div class="exam-list-page">

      <!-- Hero -->
      <div class="page-hero">
        <div>
          <h1>📋 ระบบสอบ</h1>
          <p>ออกข้อสอบ · กำหนดเวลา · คุมสอบ · ตรวจสอบผล</p>
        </div>
      </div>

      <div v-if="loading" class="loading-box">กำลังโหลด...</div>

      <template v-else>
        <!-- Filter bar -->
        <div class="filter-bar">
          <el-input v-model="filterSearch" placeholder="🔍 ค้นหาวิชา / รหัส" clearable size="small" style="width:200px" />
          <el-select v-model="filterClass" placeholder="ห้องเรียน" clearable size="small" style="width:130px">
            <el-option v-for="c in allClasses" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-if="isAdmin" v-model="filterTeacher" placeholder="ครูผู้สอน" clearable size="small" style="width:180px">
            <el-option v-for="t in allTeachers" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="สถานะข้อสอบ" clearable size="small" style="width:150px">
            <el-option label="มีข้อสอบแล้ว" value="has_exam" />
            <el-option label="ยังไม่มีข้อสอบ" value="no_exam" />
          </el-select>
          <span class="filter-count text-sm text-gray-400">แสดง {{ filteredSubjects.length }} / {{ subjects.length }} วิชา</span>
        </div>

        <div v-if="!filteredSubjects.length" class="empty-box">
          <div style="font-size:40px">📭</div>
          <p>{{ subjects.length ? 'ไม่พบวิชาที่ตรงกับตัวกรอง' : 'ไม่พบวิชาที่ได้รับมอบหมายในเทอมนี้' }}</p>
        </div>

      <div v-else class="subject-sections">
        <div v-for="(s, si) in filteredSubjects" :key="s.key" class="subject-section"
          :class="{ 'section-expanded': isExpanded(s.key) }"
          :style="{ borderLeftColor: subjectColor(si).border, borderLeftWidth: '4px', borderLeftStyle: 'solid' }">

          <!-- Subject header (clickable to expand/collapse) -->
          <div class="subject-header"
            :style="{ background: isExpanded(s.key) ? subjectColor(si).headerBg : '#f8fafc' }"
            @click="toggleSubject(s.key)">
            <div class="subject-left">
              <span class="subject-code-badge" :style="{ background: subjectColor(si).gradient }">{{ s.subject_code }}</span>
              <div>
                <div class="subject-name">{{ s.subject_name }}</div>
                <div class="subject-meta-row">
                  <span v-if="s.teacher_name" class="teacher-chip">👤 {{ s.teacher_name }}</span>
                  <div class="subject-classes">
                    <el-tag v-for="c in s.class_ids" :key="c" size="small" type="info" style="margin-right:4px">{{ c }}</el-tag>
                  </div>
                </div>
              </div>
            </div>

            <!-- Collapsed summary chips -->
            <div class="subject-summary" v-if="!isExpanded(s.key)">
              <span v-if="examsByKey(s).length" class="sum-chip sum-total">
                {{ examsByKey(s).length }} ข้อสอบ
              </span>
              <span v-else class="sum-chip sum-empty">ยังไม่มีข้อสอบ</span>
              <span class="sum-chip sum-active" v-if="activeExamCount(s)">
                🟢 เปิด {{ activeExamCount(s) }}
              </span>
            </div>

            <div class="header-right" @click.stop>
              <el-popconfirm
                v-if="examsByKey(s).length"
                :title="`ลบข้อสอบทั้งหมด ${examsByKey(s).length} ชุดของวิชานี้?`"
                confirm-button-type="danger"
                confirm-button-text="ลบทั้งหมด"
                cancel-button-text="ยกเลิก"
                @confirm="handleDeleteGroup(s)"
              >
                <template #reference>
                  <el-button type="danger" size="small" plain>🗑 ลบทั้งหมด</el-button>
                </template>
              </el-popconfirm>
              <el-button type="primary" size="small" @click="goCreate(s)">+ สร้างข้อสอบ</el-button>
              <span class="expand-arrow" :class="{ 'arrow-open': isExpanded(s.key) }">▼</span>
            </div>
          </div>

          <!-- Exams (shown only when expanded) -->
          <div v-show="isExpanded(s.key)">
            <div v-if="examsByKey(s).length" class="exam-list">
              <div v-for="(exam, ei) in examsByKey(s)" :key="exam.id"
                class="exam-card" :class="examCardClass(exam)"
                :style="examItemStyle(ei, exam)">

                <!-- Type badge + status row -->
                <div class="exam-card-top">
                  <span class="exam-type-badge" :class="exam.exam_type === 'score' ? 'badge-score' : 'badge-scheduled'">
                    {{ exam.exam_type === 'score' ? '📝 เก็บคะแนน' : '📋 สอบในตาราง' }}
                  </span>
                  <span class="exam-anticheat-chip" v-if="exam.anti_cheat === false">🔓 ปิด AntiCheat</span>
                  <span class="exam-active-chip" v-if="!exam.is_active">⛔ ปิดใช้งาน</span>
                  <el-tag :type="statusType(exam)" size="small" style="margin-left:auto">{{ statusLabel(exam) }}</el-tag>
                </div>

                <div class="exam-title">{{ exam.title }}</div>
                <div class="exam-meta">
                  <span>📅 {{ fmtDate(exam.exam_date) }}</span>
                  <span>🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}</span>
                  <span>⏱ {{ exam.duration_minutes }} นาที</span>
                </div>
                <div class="exam-classes">
                  <el-tag v-for="c in (exam.class_ids || [])" :key="c" size="small" type="warning">{{ c }}</el-tag>
                </div>

                <!-- Question summary -->
                <div v-if="qSummary[exam.id]?.total" class="exam-q-summary">
                  <span class="qs-total">📊 {{ qSummary[exam.id].total }} ข้อ</span>
                  <span v-for="(cnt, type) in qSummary[exam.id].types" :key="type" class="qs-type">
                    {{ typeShortLabel[type] || type }} {{ cnt }}
                  </span>
                  <span class="qs-score">รวม {{ qSummary[exam.id].totalPoints }} คะแนน</span>
                </div>
                <div v-else class="exam-no-q">ยังไม่มีข้อสอบ</div>

                <!-- Action buttons -->
                <div class="exam-card-actions">
                  <el-button size="small" type="primary" plain
                    @click="$router.push(`/teacher/exams/${exam.id}/questions`)">📝 ออกข้อสอบ</el-button>
                  <el-button v-if="exam.exam_type === 'score'" size="small" type="success" plain
                    @click="$router.push(`/teacher/exams/${exam.id}/proctor`)">👁 คุมสอบ</el-button>
                  <el-button v-else size="small" plain
                    @click="$router.push('/teacher/proctor')">🗂 คุมสอบในตาราง →</el-button>
                  <el-button size="small" type="warning" plain
                    @click="$router.push(`/teacher/exams/${exam.id}/grade`)">✏️ ตรวจ</el-button>
                  <el-button size="small" plain @click="goEdit(exam, s)">แก้ไข</el-button>
                  <el-button size="small" plain :loading="duplicatingId === exam.id"
                    @click="handleDuplicate(exam)">📋 สำเนา</el-button>
                  <el-popconfirm title="ลบข้อสอบนี้?" confirm-button-type="danger"
                    confirm-button-text="ลบ" cancel-button-text="ยกเลิก" @confirm="handleDelete(exam)">
                    <template #reference>
                      <el-button size="small" type="danger" plain>ลบ</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
            </div>
            <div v-else class="no-exam-hint">
              ยังไม่มีข้อสอบสำหรับวิชานี้ — กด <strong>+ สร้างข้อสอบ</strong> ด้านบน
            </div>
          </div>
        </div>
      </div>
      </template>

      <!-- Create dialog -->
      <el-dialog v-model="createDialog.visible" title="สร้างข้อสอบ" width="580px" :close-on-click-modal="false">
        <div class="dialog-subject-chip">
          <span class="subject-code-badge">{{ createDialog.subjectCode }}</span>
          <span style="font-weight:700;color:#0f172a">{{ createDialog.subjectName }}</span>
          <span style="font-size:12px;color:#64748b">ห้อง: {{ createDialog.classIds.join(', ') }}</span>
        </div>

        <el-form :model="createDialog" label-position="top" style="margin-top:14px">
          <!-- ประเภทข้อสอบ -->
          <el-form-item label="ประเภทข้อสอบ">
            <div class="exam-type-selector">
              <div
                class="type-card"
                :class="{ 'type-active': createDialog.examType === 'score' }"
                @click="createDialog.examType = 'score'"
              >
                <div class="type-icon">📝</div>
                <div class="type-label">เก็บคะแนน</div>
                <div class="type-desc">ครูจัดสอบและคุมสอบเองได้ทันที ไม่ต้องผ่านตาราง</div>
              </div>
              <div
                class="type-card"
                :class="{ 'type-active': createDialog.examType === 'scheduled' }"
                @click="createDialog.examType = 'scheduled'"
              >
                <div class="type-icon">📋</div>
                <div class="type-label">สอบในตาราง</div>
                <div class="type-desc">สอบตามตารางที่กำหนด เข้าคุมสอบผ่านเมนู "คุมสอบในตาราง"</div>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="ชื่อการสอบ *">
            <el-input v-model="createDialog.title" placeholder="เช่น สอบปลายภาค ภาคเรียนที่ 1" />
          </el-form-item>
          <el-form-item label="คำชี้แจง">
            <el-input v-model="createDialog.description" type="textarea" :rows="2" />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="วันที่สอบ *">
                <el-date-picker v-model="createDialog.examDate" type="date"
                  format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="เวลาเริ่ม *">
                <el-time-picker v-model="createDialog.startTime"
                  format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="เวลาสิ้นสุด *">
                <el-time-picker v-model="createDialog.endTime"
                  format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="เวลาทำ (นาที)">
                <el-input-number v-model="createDialog.durationMinutes" :min="5" :max="300" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="ทุจริตเกิน X ครั้ง → ล็อก">
                <el-input-number v-model="createDialog.violationLimit" :min="1" :max="10" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="สุ่มลำดับข้อสอบ">
                <el-switch v-model="createDialog.shuffleQuestions" active-text="เปิด" inactive-text="ปิด" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="ระบบจับทุจริต (AntiCheat)">
                <el-switch v-model="createDialog.antiCheat"
                  active-text="เปิด" inactive-text="ปิด" active-color="#22c55e" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <template #footer>
          <el-button @click="createDialog.visible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleQuickCreate">
            บันทึกและออกข้อสอบ →
          </el-button>
        </template>
      </el-dialog>

      <!-- Edit dialog -->
      <el-dialog v-model="editDialog.visible" title="แก้ไขข้อสอบ" width="580px" :close-on-click-modal="false">
        <div class="dialog-subject-chip">
          <span class="subject-code-badge">{{ editDialog.subjectCode }}</span>
          <span style="font-weight:700;color:#0f172a">{{ editDialog.subjectName }}</span>
        </div>

        <el-form :model="editDialog" label-position="top" style="margin-top:14px">
          <el-form-item label="ประเภทข้อสอบ">
            <div class="exam-type-selector">
              <div class="type-card" :class="{ 'type-active': editDialog.examType === 'score' }"
                @click="editDialog.examType = 'score'">
                <div class="type-icon">📝</div>
                <div class="type-label">เก็บคะแนน</div>
                <div class="type-desc">ครูคุมสอบเองได้ทันที</div>
              </div>
              <div class="type-card" :class="{ 'type-active': editDialog.examType === 'scheduled' }"
                @click="editDialog.examType = 'scheduled'">
                <div class="type-icon">📋</div>
                <div class="type-label">สอบในตาราง</div>
                <div class="type-desc">เข้าคุมสอบผ่านเมนูคุมสอบในตาราง</div>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="ชื่อการสอบ *">
            <el-input v-model="editDialog.title" />
          </el-form-item>
          <el-form-item label="คำชี้แจง">
            <el-input v-model="editDialog.description" type="textarea" :rows="2" />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="วันที่สอบ *">
                <el-date-picker v-model="editDialog.examDate" type="date"
                  format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="เวลาเริ่ม *">
                <el-time-picker v-model="editDialog.startTime"
                  format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="เวลาสิ้นสุด *">
                <el-time-picker v-model="editDialog.endTime"
                  format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="เวลาทำ (นาที)">
                <el-input-number v-model="editDialog.durationMinutes" :min="5" :max="300" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="ทุจริตเกิน X ครั้ง → ล็อก">
                <el-input-number v-model="editDialog.violationLimit" :min="1" :max="10" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="สุ่มลำดับข้อสอบ">
                <el-switch v-model="editDialog.shuffleQuestions" active-text="เปิด" inactive-text="ปิด" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="จับทุจริต (AntiCheat)">
                <el-switch v-model="editDialog.antiCheat"
                  active-text="เปิด" inactive-text="ปิด" active-color="#22c55e" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="สถานะการใช้งาน">
                <el-switch v-model="editDialog.isActive"
                  active-text="เปิด" inactive-text="ปิด"
                  active-color="#22c55e"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <template #footer>
          <el-button @click="editDialog.visible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleEditSave">💾 บันทึก</el-button>
        </template>
      </el-dialog>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useExam } from '@/composables/useExam'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'
import { supabase } from '@/supabase/client'

const router = useRouter()
const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { getExams, saveExam, deleteExam, duplicateExam, updateExamSettings } = useExam()
const { slotTable } = useTimetableSource()

const loading = ref(false)
const saving = ref(false)
const duplicatingId = ref(null)
const subjects = ref([])
const exams = ref([])
const qSummary = ref({})
const expandedSubjects = ref(new Set())

// ── Filters ───────────────────────────────────────────────────────────
const filterSearch  = ref('')
const filterClass   = ref('')
const filterTeacher = ref('')
const filterStatus  = ref('') // '' | 'has_exam' | 'no_exam'

const allClasses  = computed(() => [...new Set(subjects.value.flatMap(s => s.class_ids))].sort())
const allTeachers = computed(() => [...new Map(subjects.value.filter(s => s.teacher_name).map(s => [s.teacher_id, s.teacher_name])).entries()].map(([id, name]) => ({ id, name })))

const filteredSubjects = computed(() => {
  return subjects.value.filter(s => {
    if (filterSearch.value) {
      const q = filterSearch.value.toLowerCase()
      if (!s.subject_name.toLowerCase().includes(q) && !s.subject_code.toLowerCase().includes(q)) return false
    }
    if (filterClass.value && !s.class_ids.includes(filterClass.value)) return false
    if (filterTeacher.value && s.teacher_id !== filterTeacher.value) return false
    if (filterStatus.value === 'has_exam' && !examsByKey(s).length) return false
    if (filterStatus.value === 'no_exam'  &&  examsByKey(s).length) return false
    return true
  })
})

const isAdmin = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))

const EXAM_ITEM_COLORS = [
  { bg: '#faf5ff', border: '#7c3aed' },
  { bg: '#eff6ff', border: '#2563eb' },
  { bg: '#fff7ed', border: '#ea580c' },
  { bg: '#f0fdf4', border: '#16a34a' },
  { bg: '#fff1f2', border: '#e11d48' },
  { bg: '#f0fdfa', border: '#0d9488' },
  { bg: '#fefce8', border: '#ca8a04' },
  { bg: '#f5f3ff', border: '#7c3aed' },
]
function examItemStyle(index, exam) {
  if (!exam.is_active) return {}
  const now = new Date(); const { start, end } = getExamWindow(exam)
  if (now >= start && now <= end) return {} // green override handled by class
  const c = EXAM_ITEM_COLORS[index % EXAM_ITEM_COLORS.length]
  return { background: c.bg, borderLeft: `4px solid ${c.border}` }
}

const SUBJECT_COLORS = [
  { gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: '#7c3aed', headerBg: '#faf5ff' },
  { gradient: 'linear-gradient(135deg,#2563eb,#3b82f6)', border: '#2563eb', headerBg: '#eff6ff' },
  { gradient: 'linear-gradient(135deg,#e11d48,#f43f5e)', border: '#e11d48', headerBg: '#fff1f2' },
  { gradient: 'linear-gradient(135deg,#0d9488,#14b8a6)', border: '#0d9488', headerBg: '#f0fdfa' },
  { gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', border: '#d97706', headerBg: '#fffbeb' },
  { gradient: 'linear-gradient(135deg,#16a34a,#22c55e)', border: '#16a34a', headerBg: '#f0fdf4' },
  { gradient: 'linear-gradient(135deg,#ea580c,#f97316)', border: '#ea580c', headerBg: '#fff7ed' },
  { gradient: 'linear-gradient(135deg,#4338ca,#6366f1)', border: '#4338ca', headerBg: '#eef2ff' },
]
function subjectColor(index) { return SUBJECT_COLORS[index % SUBJECT_COLORS.length] }

const typeShortLabel = {
  choice: 'ปรนัย', multi: 'หลายตัวเลือก', truefalse: 'ถูก/ผิด',
  fill: 'เติมคำ', essay: 'อัตนัย', match: 'จับคู่',
}

const createDialog = reactive({
  visible: false,
  examType: 'scheduled',
  antiCheat: true,
  subjectCode: '', subjectName: '', classIds: [],
  title: '', description: '',
  examDate: '', startTime: '08:00:00', endTime: '10:00:00',
  durationMinutes: 60, violationLimit: 3, shuffleQuestions: true,
})

const editDialog = reactive({
  visible: false, examId: null,
  examType: 'scheduled',
  antiCheat: true,
  subjectCode: '', subjectName: '', classIds: [],
  title: '', description: '',
  examDate: '', startTime: '', endTime: '',
  durationMinutes: 60, violationLimit: 3, shuffleQuestions: true,
  isActive: true,
})

function isExpanded(key) { return expandedSubjects.value.has(key) }
function toggleSubject(key) {
  const s = expandedSubjects.value
  s.has(key) ? s.delete(key) : s.add(key)
  expandedSubjects.value = new Set(s)
}

// match exams ที่ตรงกับ subject_code + class_ids overlap (ไม่ใช้แค่ subject_code เพียงอย่างเดียว
// เพราะวิชาเดียวกันอาจมีครูต่างกันสอนต่างห้อง → แยก card กัน)
function examsByKey(s) {
  return exams.value.filter(e => {
    if ((e.subject_code || '') !== s.subject_code) return false
    const examClasses = Array.isArray(e.class_ids) ? e.class_ids
      : (() => { try { return JSON.parse(e.class_ids || '[]') } catch { return [] } })()
    return s.class_ids.some(c => examClasses.includes(c))
  }).sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || ''))
}

function activeExamCount(s) {
  const now = new Date()
  return examsByKey(s).filter(e => {
    if (!e.is_active) return false
    const { start, end } = getExamWindow(e)
    return now >= start && now <= end
  }).length
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
}

function getExamWindow(exam) {
  const base = new Date(exam.exam_date)
  const [sh, sm] = (exam.start_time || '00:00').split(':')
  const [eh, em] = (exam.end_time || '23:59').split(':')
  const start = new Date(base); start.setHours(+sh, +sm, 0)
  const end   = new Date(base); end.setHours(+eh, +em, 0)
  return { start, end }
}

function statusType(exam) {
  if (!exam.is_active) return 'info'
  const now = new Date(); const { start, end } = getExamWindow(exam)
  if (now < start) return 'info'
  if (now <= end)  return 'success'
  return 'warning'
}

function statusLabel(exam) {
  if (!exam.is_active) return 'ปิดใช้งาน'
  const now = new Date(); const { start, end } = getExamWindow(exam)
  if (now < start) return 'ยังไม่ถึงเวลา'
  if (now <= end)  return '🟢 กำลังสอบ'
  return 'สอบเสร็จแล้ว'
}

function examCardClass(exam) {
  if (!exam.is_active) return 'card-inactive'
  const now = new Date(); const { start, end } = getExamWindow(exam)
  if (now >= start && now <= end) return 'card-active-exam'
  return ''
}

function goCreate(s) {
  Object.assign(createDialog, {
    visible: true, examType: 'scheduled', antiCheat: true,
    subjectCode: s.subject_code, subjectName: s.subject_name, classIds: [...s.class_ids],
    title: '', description: '',
    examDate: '', startTime: '08:00:00', endTime: '10:00:00',
    durationMinutes: 60, violationLimit: 3, shuffleQuestions: true,
  })
}

function goEdit(exam, s) {
  Object.assign(editDialog, {
    visible: true, examId: exam.id,
    examType: exam.exam_type || 'scheduled',
    antiCheat: exam.anti_cheat !== false,
    subjectCode: exam.subject_code || s?.subject_code || '',
    subjectName: exam.subject_name || s?.subject_name || '',
    classIds: exam.class_ids || [],
    title: exam.title || '', description: exam.description || '',
    examDate: exam.exam_date || '', startTime: exam.start_time || '08:00:00',
    endTime: exam.end_time || '10:00:00', durationMinutes: exam.duration_minutes || 60,
    violationLimit: exam.violation_limit || 3, shuffleQuestions: exam.shuffle_questions ?? true,
    isActive: exam.is_active ?? true,
  })
}

async function handleQuickCreate() {
  if (!createDialog.title.trim()) { ElMessage.warning('กรุณากรอกชื่อการสอบ'); return }
  if (!createDialog.examDate)     { ElMessage.warning('กรุณาเลือกวันที่สอบ'); return }
  if (!createDialog.startTime || !createDialog.endTime) { ElMessage.warning('กรุณากรอกเวลา'); return }

  saving.value = true
  const res = await saveExam({
    id: null, schoolId: authStore.schoolId,
    subjectCode: createDialog.subjectCode, subjectName: createDialog.subjectName,
    classIds: createDialog.classIds, title: createDialog.title, description: createDialog.description,
    examDate: createDialog.examDate, startTime: createDialog.startTime, endTime: createDialog.endTime,
    durationMinutes: createDialog.durationMinutes, violationLimit: createDialog.violationLimit,
    shuffleQuestions: createDialog.shuffleQuestions, createdBy: authStore.profile?.uid,
    termId: schoolStore.currentTerm || null,
  })
  saving.value = false
  if (!res.success) { ElMessage.error(res.error); return }
  if (res.id) {
    const r2 = await updateExamSettings(res.id, { examType: createDialog.examType, antiCheat: createDialog.antiCheat })
    if (!r2.success) ElMessage.warning('บันทึกประเภทข้อสอบไม่สำเร็จ: ' + r2.error)
  }
  ElMessage.success('สร้างข้อสอบแล้ว')
  createDialog.visible = false
  await loadExams()
  router.push(`/teacher/exams/${res.id}/questions`)
}

async function handleEditSave() {
  if (!editDialog.title.trim()) { ElMessage.warning('กรุณากรอกชื่อการสอบ'); return }
  if (!editDialog.examDate)     { ElMessage.warning('กรุณาเลือกวันที่สอบ'); return }

  saving.value = true
  const res = await saveExam({
    id: editDialog.examId, schoolId: authStore.schoolId,
    subjectCode: editDialog.subjectCode, subjectName: editDialog.subjectName,
    classIds: editDialog.classIds, title: editDialog.title, description: editDialog.description,
    examDate: editDialog.examDate, startTime: editDialog.startTime, endTime: editDialog.endTime,
    durationMinutes: editDialog.durationMinutes, violationLimit: editDialog.violationLimit,
    shuffleQuestions: editDialog.shuffleQuestions, createdBy: authStore.profile?.uid,
    termId: schoolStore.currentTerm || null,
  })
  saving.value = false
  if (!res.success) { ElMessage.error(res.error); return }
  const r2 = await updateExamSettings(editDialog.examId, {
    examType: editDialog.examType,
    isActive: editDialog.isActive,
    antiCheat: editDialog.antiCheat,
  })
  if (!r2.success) { ElMessage.error('บันทึกการตั้งค่าไม่สำเร็จ: ' + r2.error); return }
  ElMessage.success('บันทึกแล้ว')
  editDialog.visible = false
  await loadExams()
}

async function handleDelete(exam) {
  const res = await deleteExam(exam.id, authStore.schoolId)
  if (res.success) { ElMessage.success('ลบแล้ว'); await loadExams() }
  else ElMessage.error(res.error)
}

async function handleDeleteGroup(s) {
  const list = examsByKey(s)
  if (!list.length) return
  let failed = 0
  for (const exam of list) {
    const res = await deleteExam(exam.id, authStore.schoolId)
    if (!res.success) failed++
  }
  if (failed) ElMessage.warning(`ลบไม่สำเร็จ ${failed} รายการ`)
  else ElMessage.success(`ลบข้อสอบ ${list.length} ชุดเรียบร้อย`)
  await loadExams()
}

async function handleDuplicate(exam) {
  duplicatingId.value = exam.id
  const res = await duplicateExam(exam.id, authStore.schoolId, authStore.profile?.uid)
  duplicatingId.value = null
  console.log('[duplicate]', res)
  if (!res.success) { ElMessage.error(res.error); return }
  if (!res.id) { ElMessage.error('สำเนาสำเร็จแต่ไม่ได้ ID ใหม่'); return }
  ElMessage.success('สำเนาข้อสอบแล้ว')
  await loadExams()
  router.push(`/teacher/exams/${res.id}/questions`)
}

async function loadExams() {
  const teacherUid = isAdmin.value ? null : (authStore.profile?.uid || null)
  const res = await getExams(authStore.schoolId, teacherUid)
  if (!res.success) return
  exams.value = res.data

  // Load question summaries for all exams in one query
  const ids = res.data.map(e => e.id)
  if (!ids.length) return
  const { data: qRows } = await supabase
    .from('exam_questions').select('exam_id, question_type, points').in('exam_id', ids)
  const map = {}
  for (const row of qRows || []) {
    if (!map[row.exam_id]) map[row.exam_id] = { total: 0, types: {}, totalPoints: 0 }
    map[row.exam_id].total++
    map[row.exam_id].types[row.question_type] = (map[row.exam_id].types[row.question_type] || 0) + 1
    map[row.exam_id].totalPoints += Number(row.points || 0)
  }
  qSummary.value = map
}

async function loadSubjects() {
  const teacherId = authStore.profile?.teacher_id || authStore.profile?.uid
  const termId = schoolStore.displayTerm || schoolStore.currentTerm

  // อ่านจาก teaching_assignments (source of truth) แทน timetable_slots
  // DB column ชื่อ subject_id (เก็บรหัสวิชา text เช่น ท20201) ไม่ใช่ subject_code
  let q = supabase
    .from('teaching_assignments')
    .select('class_id, subject_id, subject_name, teacher_id, teacher_name')
    .eq('school_id', authStore.schoolId)
    .eq('term_id', termId)

  if (!isAdmin.value && teacherId) q = q.eq('teacher_id', teacherId)

  const { data: rows, error: rowsErr } = await q
  if (rowsErr) console.error('[ExamList] loadSubjects error:', rowsErr.message)
  const map = {}
  for (const s of (rows || [])) {
    const code = s.subject_id; if (!code) continue
    const key = `${code}__${s.teacher_id || ''}`
    if (!map[key]) map[key] = {
      key,
      subject_code: code,
      subject_name: s.subject_name || code,
      teacher_id:   s.teacher_id   || '',
      teacher_name: s.teacher_name || '',
      class_ids: [],
    }
    if (s.class_id && !map[key].class_ids.includes(s.class_id)) map[key].class_ids.push(s.class_id)
  }
  for (const v of Object.values(map)) v.class_ids.sort()
  subjects.value = Object.values(map).sort((a, b) => {
    const sc = a.subject_name.localeCompare(b.subject_name, 'th')
    return sc !== 0 ? sc : a.teacher_name.localeCompare(b.teacher_name, 'th')
  })
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadSubjects(), loadExams()])
  loading.value = false
  // auto-expand first subject
  if (subjects.value.length) {
    expandedSubjects.value = new Set([subjects.value[0].key])
  }
})
</script>

<style scoped>
.exam-list-page { padding: 20px; }
.page-hero {
  background: linear-gradient(135deg,#7c3aed,#a855f7);
  border-radius: 18px; padding: 22px 24px; color: #fff; margin-bottom: 20px;
}
.page-hero h1 { margin: 0; font-size: 22px; font-weight: 800; }
.page-hero p  { margin: 4px 0 0; opacity: .85; font-size: 13px; }
.loading-box, .empty-box { text-align: center; padding: 60px; color: #64748b; }

.filter-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin-bottom: 16px; padding: 12px 16px;
  background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;
}
.filter-count { margin-left: auto; white-space: nowrap; }

.subject-sections { display: flex; flex-direction: column; gap: 16px; }
.subject-section {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.04);
  border-left-width: 4px !important;
}
.subject-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; gap: 12px;
  cursor: pointer; user-select: none; transition: background .15s, filter .15s;
}
.subject-header:hover { filter: brightness(.96); }
.section-expanded .subject-header { border-bottom: 1px solid #e2e8f0; }

.subject-summary { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sum-chip { font-size: 11px; font-weight: 700; border-radius: 8px; padding: 2px 9px; }
.sum-total { background: #ede9fe; color: #5b21b6; }
.sum-empty { background: #f1f5f9; color: #94a3b8; }
.sum-active { background: #dcfce7; color: #15803d; }

.header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.expand-arrow {
  font-size: 11px; color: #94a3b8; transition: transform .2s; display: inline-block;
}
.arrow-open { transform: rotate(180deg); }
.subject-left { display: flex; align-items: center; gap: 12px; }
.subject-code-badge {
  color: #fff;
  font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 8px;
  white-space: nowrap; flex-shrink: 0;
}
.subject-name { font-size: 15px; font-weight: 700; color: #0f172a; }
.subject-meta-row { margin-top: 4px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.teacher-chip {
  font-size: 11px; font-weight: 600; color: #475569;
  background: #f1f5f9; border-radius: 6px; padding: 1px 8px; white-space: nowrap;
}
.subject-classes { display: flex; flex-wrap: wrap; gap: 4px; }

/* ── Exam card ── */
.exam-list { display: flex; flex-direction: column; gap: 0; }
.exam-card {
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
  display: flex; flex-direction: column; gap: 8px;
  transition: background .12s;
}
.exam-card:last-child { border-bottom: none; }
.exam-card:hover { background: #fafbff; }
.card-active-exam { background: #f0fdf4; border-left: 3px solid #22c55e; }
.card-inactive { background: #fafafa; }

.exam-card-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.exam-type-badge {
  font-size: 11px; font-weight: 800; border-radius: 8px; padding: 3px 10px;
}
.badge-score     { background: #fef3c7; color: #92400e; }
.badge-scheduled { background: #ede9fe; color: #5b21b6; }
.exam-active-chip {
  font-size: 11px; font-weight: 700; background: #fee2e2; color: #991b1b;
  border-radius: 8px; padding: 2px 8px;
}
.exam-anticheat-chip {
  font-size: 11px; font-weight: 700; background: #fef9c3; color: #854d0e;
  border-radius: 8px; padding: 2px 8px;
}

.exam-title { font-size: 14px; font-weight: 700; color: #0f172a; }
.card-inactive .exam-title { color: #9ca3af; }

.exam-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: #475569; }
.card-inactive .exam-meta { color: #d1d5db; }

.exam-classes { display: flex; flex-wrap: wrap; gap: 3px; }

/* ── Question summary ── */
.exam-q-summary {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  background: #f8fafc; border-radius: 8px; padding: 6px 10px;
  font-size: 11px; font-weight: 700;
}
.qs-total { color: #0f172a; }
.qs-type  { background: #e2e8f0; color: #475569; border-radius: 6px; padding: 1px 7px; }
.qs-score { margin-left: auto; color: #7c3aed; }
.exam-no-q { font-size: 11px; color: #94a3b8; font-style: italic; }

/* ── Actions ── */
.exam-card-actions { display: flex; flex-wrap: wrap; gap: 6px; }

.no-exam-hint {
  padding: 18px 20px; font-size: 13px; color: #94a3b8; text-align: center;
}

/* ── Dialog ── */
.dialog-subject-chip {
  display: flex; align-items: center; gap: 10px; background: #ede9fe;
  border-radius: 10px; padding: 10px 14px; flex-wrap: wrap;
}

/* ── Exam type selector ── */
.exam-type-selector { display: flex; gap: 10px; }
.type-card {
  flex: 1; border: 2px solid #e2e8f0; border-radius: 12px; padding: 14px 12px;
  cursor: pointer; transition: all .15s; text-align: center; background: #f8fafc;
}
.type-card:hover { border-color: #a78bfa; background: #faf5ff; }
.type-active { border-color: #7c3aed; background: #ede9fe; }
.type-icon  { font-size: 24px; margin-bottom: 4px; }
.type-label { font-size: 13px; font-weight: 800; color: #0f172a; }
.type-desc  { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4; }
.type-active .type-label { color: #5b21b6; }
</style>
