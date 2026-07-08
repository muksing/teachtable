<template>
  <AppLayout>
    <div class="exam-create-page">
      <div class="page-header">
        <el-button text @click="$router.back()">← กลับ</el-button>
        <h2>{{ isEdit ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบใหม่' }}</h2>
      </div>

      <!-- Step 1: Choose subject from timetable -->
      <div v-if="!isEdit && !subjectConfirmed" class="step-card">
        <div class="step-title">📚 เลือกวิชาที่ต้องการสอบ</div>
        <p class="step-sub">วิชาที่คุณสอนในเทอมนี้</p>

        <div v-if="loadingAssign" class="loading-msg">กำลังโหลดวิชา...</div>

        <div v-else-if="!subjectOptions.length" class="empty-assign">
          ไม่พบวิชาที่ได้รับมอบหมายในเทอมนี้
        </div>

        <div v-else class="subject-grid">
          <div
            v-for="s in subjectOptions"
            :key="s.subject_code"
            class="subject-card"
            :class="{ 'subject-selected': selectedSubjectCode === s.subject_code }"
            @click="selectSubject(s)"
          >
            <div class="subject-code">{{ s.subject_code }}</div>
            <div class="subject-name">{{ s.subject_name }}</div>
            <div class="subject-classes">
              <el-tag v-for="c in s.class_ids" :key="c" size="small" type="info">{{ c }}</el-tag>
            </div>
          </div>
        </div>

        <div class="step-actions" v-if="selectedSubjectCode">
          <el-button type="primary" size="large" @click="confirmSubject">
            ใช้วิชานี้ →
          </el-button>
        </div>
      </div>

      <!-- Step 2: Exam details form -->
      <el-card v-else class="form-card">
        <!-- Subject summary chip (non-edit) -->
        <div v-if="!isEdit" class="subject-summary">
          <span class="summary-badge">📚 {{ form.subjectName }} ({{ form.subjectCode }})</span>
          <el-button text size="small" @click="subjectConfirmed = false; selectedSubjectCode = ''">เปลี่ยนวิชา</el-button>
        </div>

        <el-form :model="form" label-position="top" v-loading="loading">

          <!-- Edit mode: manual subject fields -->
          <el-row v-if="isEdit" :gutter="16">
            <el-col :span="12">
              <el-form-item label="วิชา *">
                <el-input v-model="form.subjectName" placeholder="ชื่อวิชา" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="รหัสวิชา">
                <el-input v-model="form.subjectCode" placeholder="เช่น MATH101" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="ชื่อการสอบ *">
            <el-input v-model="form.title" placeholder="เช่น สอบปลายภาค ภาคเรียนที่ 1" />
          </el-form-item>

          <el-form-item label="คำชี้แจง / คำอธิบาย">
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="คำชี้แจงสำหรับนักเรียน (ถ้ามี)" />
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="วันที่สอบ *">
                <el-date-picker v-model="form.examDate" type="date" format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="เวลาเริ่ม *">
                <el-time-picker v-model="form.startTime" format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="เวลาสิ้นสุด *">
                <el-time-picker v-model="form.endTime" format="HH:mm" value-format="HH:mm:ss" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="เวลาทำข้อสอบ (นาที)">
                <el-input-number v-model="form.durationMinutes" :min="5" :max="300" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="ทุจริตเกิน X ครั้ง → ล็อก">
                <el-input-number v-model="form.violationLimit" :min="1" :max="10" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="สุ่มลำดับข้อสอบ">
                <el-switch v-model="form.shuffleQuestions" active-text="เปิด" inactive-text="ปิด" />
              </el-form-item>
            </el-col>
          </el-row>

          <!-- Class selection (auto-populated for non-edit, manual for edit) -->
          <el-form-item label="ห้องเรียนที่เข้าสอบ *">
            <div class="class-picker">
              <el-tag
                v-for="c in availableClasses"
                :key="c"
                :type="form.classIds.includes(c) ? 'primary' : 'info'"
                class="class-tag"
                @click="toggleClass(c)"
                style="cursor:pointer; user-select:none"
              >{{ c }}</el-tag>
            </div>
            <div class="class-hint" v-if="availableClasses.length">
              คลิกเพื่อเลือก/ยกเลิก ห้องเรียน (เลือกแล้ว {{ form.classIds.length }} ห้อง)
            </div>
            <div v-if="!availableClasses.length" style="color:#94a3b8;font-size:12px">กำลังโหลดห้องเรียน...</div>
          </el-form-item>

          <div class="form-actions">
            <el-button @click="$router.back()">ยกเลิก</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">
              {{ isEdit ? '💾 บันทึกการแก้ไข' : '➡ บันทึกและออกข้อสอบ' }}
            </el-button>
          </div>
        </el-form>
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useExam } from '@/composables/useExam'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'
import { supabase } from '@/supabase/client'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const schoolStore = useSchoolStore()
const { saveExam, getExamById } = useExam()
const { slotTable } = useTimetableSource()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const loadingAssign = ref(false)

// Step 1 state
const subjectConfirmed = ref(false)
const selectedSubjectCode = ref('')
// Map: subject_code → { subject_code, subject_name, class_ids[] }
const subjectMap = ref({})
const subjectOptions = computed(() => Object.values(subjectMap.value))
const availableClasses = ref([])

const form = reactive({
  subjectName: '',
  subjectCode: '',
  title: '',
  description: '',
  examDate: '',
  startTime: '08:00:00',
  endTime: '10:00:00',
  durationMinutes: 60,
  violationLimit: 3,
  shuffleQuestions: true,
  classIds: [],
})

const isAdmin = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))

function selectSubject(s) {
  selectedSubjectCode.value = s.subject_code
}

function confirmSubject() {
  const s = subjectMap.value[selectedSubjectCode.value]
  if (!s) return
  form.subjectCode = s.subject_code
  form.subjectName = s.subject_name
  availableClasses.value = [...s.class_ids].sort()
  form.classIds = [...s.class_ids]
  subjectConfirmed.value = true
}

function toggleClass(c) {
  const idx = form.classIds.indexOf(c)
  if (idx >= 0) form.classIds.splice(idx, 1)
  else form.classIds.push(c)
}

async function handleSave() {
  if (!form.subjectName.trim()) { ElMessage.warning('กรุณากรอกชื่อวิชา'); return }
  if (!form.title.trim()) { ElMessage.warning('กรุณากรอกชื่อการสอบ'); return }
  if (!form.examDate) { ElMessage.warning('กรุณาเลือกวันที่สอบ'); return }
  if (!form.startTime || !form.endTime) { ElMessage.warning('กรุณากรอกเวลาสอบ'); return }
  if (!form.classIds.length) { ElMessage.warning('กรุณาเลือกห้องเรียนอย่างน้อย 1 ห้อง'); return }

  saving.value = true
  const res = await saveExam({
    id: isEdit.value ? route.params.id : null,
    schoolId: authStore.schoolId,
    subjectCode: form.subjectCode,
    subjectName: form.subjectName,
    classIds: form.classIds,
    title: form.title,
    description: form.description,
    examDate: form.examDate,
    startTime: form.startTime,
    endTime: form.endTime,
    durationMinutes: form.durationMinutes,
    violationLimit: form.violationLimit,
    shuffleQuestions: form.shuffleQuestions,
    createdBy: authStore.profile?.uid,
    termId: schoolStore.currentTerm || null,
  })
  saving.value = false

  if (!res.success) { ElMessage.error(res.error); return }
  ElMessage.success(isEdit.value ? 'บันทึกแล้ว' : 'สร้างข้อสอบแล้ว')
  const examId = isEdit.value ? route.params.id : res.id
  router.push(`/teacher/exams/${examId}/questions`)
}

async function loadMyAssignments() {
  loadingAssign.value = true
  try {
    const teacherId = authStore.profile?.teacher_id || authStore.profile?.uid
    const termId = schoolStore.currentTerm

    let q = supabase
      .from(slotTable.value)
      .select('class_id, subject_id, subject_name, teacher_id')
      .eq('school_id', authStore.schoolId)
      .eq('term_id', termId)
      .neq('slot_type', 'activity')

    if (!isAdmin.value && teacherId) q = q.eq('teacher_id', teacherId)

    const { data: slots } = await q

    const map = {}
    for (const s of (slots || [])) {
      const code = s.subject_id
      if (!code) continue
      if (!map[code]) {
        map[code] = {
          subject_code: code,
          subject_name: s.subject_name || code,
          class_ids: [],
        }
      }
      if (s.class_id && !map[code].class_ids.includes(s.class_id)) {
        map[code].class_ids.push(s.class_id)
      }
    }
    // sort class_ids inside each subject
    for (const v of Object.values(map)) v.class_ids.sort()
    subjectMap.value = map
  } finally {
    loadingAssign.value = false
  }
}

async function loadAllClasses() {
  const { data } = await supabase.from('classes').select('class_name').eq('school_id', authStore.schoolId).order('class_name')
  availableClasses.value = (data || []).map(c => c.class_name).filter(Boolean)
}

async function loadExam() {
  if (!isEdit.value) return
  loading.value = true
  const res = await getExamById(route.params.id)
  if (res.success) {
    Object.assign(form, {
      subjectName: res.data.subject_name || '',
      subjectCode: res.data.subject_code || '',
      title: res.data.title || '',
      description: res.data.description || '',
      examDate: res.data.exam_date || '',
      startTime: res.data.start_time || '08:00:00',
      endTime: res.data.end_time || '10:00:00',
      durationMinutes: res.data.duration_minutes || 60,
      violationLimit: res.data.violation_limit || 3,
      shuffleQuestions: res.data.shuffle_questions ?? true,
      classIds: res.data.class_ids || [],
    })
    availableClasses.value = [...form.classIds]
    await loadAllClasses()
  }
  loading.value = false
}

onMounted(() => {
  if (isEdit.value) loadExam()
  else loadMyAssignments()
})
</script>

<style scoped>
.exam-create-page { padding: 20px; max-width: 820px; margin: 0 auto; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }

/* Step 1 */
.step-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; }
.step-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
.step-sub { font-size: 13px; color: #64748b; margin: 0 0 16px; }
.loading-msg, .empty-assign { color: #94a3b8; font-size: 13px; padding: 20px 0; }
.subject-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.subject-card {
  border: 2px solid #e2e8f0; border-radius: 14px; padding: 16px; cursor: pointer;
  transition: all .2s; background: #fafafa;
}
.subject-card:hover { border-color: #a78bfa; background: #faf5ff; }
.subject-selected { border-color: #7c3aed !important; background: #ede9fe !important; }
.subject-code { font-size: 11px; font-weight: 700; color: #7c3aed; margin-bottom: 4px; }
.subject-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px; line-height: 1.3; }
.subject-classes { display: flex; flex-wrap: wrap; gap: 4px; }
.step-actions { display: flex; justify-content: flex-end; }

/* Step 2 */
.form-card { border-radius: 16px; }
.subject-summary {
  display: flex; align-items: center; justify-content: space-between;
  background: #ede9fe; border-radius: 10px; padding: 10px 14px; margin-bottom: 18px;
}
.summary-badge { font-weight: 700; color: #7c3aed; font-size: 14px; }
.class-picker { display: flex; flex-wrap: wrap; gap: 8px; }
.class-tag { user-select: none; }
.class-hint { font-size: 11px; color: #94a3b8; margin-top: 6px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
