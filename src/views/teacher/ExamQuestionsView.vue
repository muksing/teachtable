<template>
  <AppLayout>
    <div class="eq-page">
      <!-- Header -->
      <div class="eq-header">
        <el-button text @click="$router.push('/teacher/exams')">← รายการสอบ</el-button>
        <div class="eq-header-center" v-if="exam">
          <h2>{{ exam.subject_name }} — {{ exam.title }}</h2>
          <span class="eq-meta">📅 {{ fmtDate(exam.exam_date) }} &nbsp;⏱ {{ exam.duration_minutes }} นาที &nbsp;📊 คะแนนรวม {{ totalPoints }} คะแนน</span>
        </div>
        <div class="eq-header-right">
          <el-button @click="handleExportTemplate" size="small">📥 เทมเพลต Excel</el-button>
          <el-button @click="triggerExcelImport" size="small" :loading="importing">📤 นำเข้า Excel</el-button>
          <el-button
            type="warning" size="small"
            :disabled="!questions.length"
            @click="$router.push(`/teacher/exams/${examId}/preview`)"
          >👁 Preview / ทดลองทำ</el-button>
          <el-button type="primary" @click="openAdd">+ เพิ่มข้อสอบ</el-button>
        </div>
        <input ref="excelInputRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onExcelFile" />
      </div>

      <!-- Question list -->
      <div v-loading="loading" class="eq-list">
        <div v-if="!questions.length && !loading" class="eq-empty">
          ยังไม่มีข้อสอบ กดปุ่ม "+ เพิ่มข้อสอบ" เพื่อเริ่มออกข้อสอบ
        </div>
        <div
          v-for="(q, idx) in questions" :key="q.id"
          class="eq-item"
          :class="`eq-type-${q.question_type}`"
        >
          <div class="eq-item-num">{{ idx + 1 }}</div>
          <div class="eq-item-body">
            <div class="eq-item-type-badge">{{ typeLabelMap[q.question_type] || q.question_type }}</div>
            <div class="eq-item-text">{{ q.question_text || '(ยังไม่มีคำถาม)' }}</div>
            <img v-if="q.question_image" :src="fixPhotoUrl(q.question_image)" class="eq-item-img" />
          </div>
          <div class="eq-item-pts">{{ q.points }} คะแนน</div>
          <div class="eq-item-actions">
            <el-button size="small" @click="openEdit(q)">แก้ไข</el-button>
            <el-popconfirm title="ลบข้อนี้?" confirm-button-type="danger" confirm-button-text="ลบ" cancel-button-text="ยกเลิก" @confirm="handleDelete(q)">
              <template #reference><el-button size="small" type="danger" plain>ลบ</el-button></template>
            </el-popconfirm>
          </div>
        </div>
      </div>

      <!-- Question Editor Dialog -->
      <el-dialog v-model="dialogVisible" :title="editingQ?.id ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบ'" width="680px" destroy-on-close>
        <el-form v-if="editingQ" :model="editingQ" label-position="top">

          <el-row :gutter="12">
            <el-col :span="16">
              <el-form-item label="ประเภทข้อสอบ">
                <el-select v-model="editingQ.question_type" style="width:100%" @change="onTypeChange">
                  <el-option v-for="t in questionTypes" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="คะแนน">
                <el-input-number v-model="editingQ.points" :min="0.5" :step="0.5" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <!-- Question text -->
          <el-form-item label="คำถาม *">
            <el-input v-model="editingQ.question_text" type="textarea" :rows="3" placeholder="พิมพ์คำถามที่นี่..." />
          </el-form-item>

          <!-- Question image -->
          <el-form-item label="ภาพประกอบคำถาม (ถ้ามี)">
            <div class="img-upload-row">
              <el-button size="small" :loading="uploadingQImg" @click="triggerUpload('q')">
                {{ editingQ.question_image ? '🔄 เปลี่ยนภาพ' : '📷 เพิ่มภาพ' }}
              </el-button>
              <el-button v-if="editingQ.question_image" size="small" type="danger" plain @click="editingQ.question_image = ''">ลบภาพ</el-button>
              <img v-if="editingQ.question_image" :src="fixPhotoUrl(editingQ.question_image)" class="preview-img" />
            </div>
          </el-form-item>

          <!-- ปรนัย / multi -->
          <template v-if="['choice','multi'].includes(editingQ.question_type)">
            <el-form-item :label="editingQ.question_type === 'multi' ? 'ตัวเลือก (เลือกได้หลายข้อ — คั่นด้วย , เช่น a,b)' : 'ตัวเลือก'">
              <div v-for="(ch, ci) in editingQ.choices" :key="ci" class="choice-row">
                <span class="choice-label">{{ choiceLabels[ci] }}</span>
                <el-input v-model="ch.text" placeholder="ข้อความตัวเลือก" size="small" style="flex:1" />
                <el-button size="small" :loading="uploadingChoiceImg === ci" @click="triggerUpload('choice', ci)">📷</el-button>
                <img v-if="ch.image" :src="fixPhotoUrl(ch.image)" class="choice-img" />
                <el-radio v-if="editingQ.question_type === 'choice'" v-model="editingQ.correct_answer" :label="choiceLabels[ci]" />
                <el-checkbox v-else v-model="multiCorrect" :label="choiceLabels[ci]" />
                <el-button size="small" circle @click="editingQ.choices.splice(ci,1)" v-if="editingQ.choices.length > 2">✕</el-button>
              </div>
              <el-button size="small" plain @click="addChoice" v-if="editingQ.choices.length < 6">+ เพิ่มตัวเลือก</el-button>
            </el-form-item>
          </template>

          <!-- ถูก/ผิด -->
          <template v-if="editingQ.question_type === 'truefalse'">
            <el-form-item label="คำตอบที่ถูกต้อง">
              <el-radio-group v-model="editingQ.correct_answer">
                <el-radio label="true">✅ ถูก</el-radio>
                <el-radio label="false">❌ ผิด</el-radio>
              </el-radio-group>
            </el-form-item>
          </template>

          <!-- เติมคำ -->
          <template v-if="editingQ.question_type === 'fill'">
            <el-form-item label="คำตอบที่ถูกต้อง (ระบบตรวจอัตโนมัติ)">
              <el-input v-model="editingQ.correct_answer" placeholder="พิมพ์คำตอบ..." />
            </el-form-item>
          </template>

          <!-- จับคู่ -->
          <template v-if="editingQ.question_type === 'match'">
            <el-form-item label="คู่คำตอบ (ซ้าย ↔ ขวา)">
              <div v-for="(pair, pi) in editingQ.match_pairs" :key="pi" class="match-row-v2">
                <!-- decoy: left is empty — right-side only -->
                <template v-if="!pair.left && !pair.leftImage && pair._decoy">
                  <div class="match-decoy-badge">ตัวลวง</div>
                  <div class="match-side" style="flex:1">
                    <el-input v-model="pair.right" placeholder="ข้อความตัวลวง (ด้านขวา)" size="small" />
                    <el-button size="small" :loading="uploadingChoiceImg === `mr${pi}`" @click="triggerUpload('matchRight', pi)">📷</el-button>
                    <img v-if="pair.rightImage" :src="fixPhotoUrl(pair.rightImage)" class="choice-img" />
                  </div>
                </template>
                <!-- real pair -->
                <template v-else>
                  <div class="match-side">
                    <el-input v-model="pair.left" placeholder="ด้านซ้าย" size="small" />
                    <el-button size="small" :loading="uploadingChoiceImg === `ml${pi}`" @click="triggerUpload('matchLeft', pi)">📷</el-button>
                    <img v-if="pair.leftImage" :src="fixPhotoUrl(pair.leftImage)" class="choice-img" />
                  </div>
                  <span style="color:#94a3b8;padding:0 4px;font-weight:700">↔</span>
                  <div class="match-side">
                    <el-input v-model="pair.right" placeholder="ด้านขวา" size="small" />
                    <el-button size="small" :loading="uploadingChoiceImg === `mr${pi}`" @click="triggerUpload('matchRight', pi)">📷</el-button>
                    <img v-if="pair.rightImage" :src="fixPhotoUrl(pair.rightImage)" class="choice-img" />
                  </div>
                </template>
                <el-button size="small" circle @click="editingQ.match_pairs.splice(pi,1)" v-if="editingQ.match_pairs.length > 2">✕</el-button>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <el-button size="small" plain @click="editingQ.match_pairs.push({left:'',right:'',leftImage:'',rightImage:''})">+ เพิ่มคู่</el-button>
                <el-button size="small" plain type="warning" @click="editingQ.match_pairs.push({left:'',right:'',leftImage:'',rightImage:'',_decoy:true})">+ เพิ่มตัวลวง (ด้านขวาเท่านั้น)</el-button>
              </div>
            </el-form-item>
          </template>

          <!-- จัดกลุ่ม -->
          <template v-if="editingQ.question_type === 'group'">
            <el-form-item label="กลุ่ม (2–4 กลุ่ม)">
              <div v-for="(ch, ci) in editingQ.choices" :key="ci" class="choice-row">
                <span class="choice-label" style="color:#db2777">{{ ci+1 }}</span>
                <el-input v-model="ch.text" :placeholder="`ชื่อกลุ่ม ${ci+1}`" size="small" style="flex:1" />
                <el-button size="small" circle @click="editingQ.choices.splice(ci,1)" v-if="editingQ.choices.length > 2">✕</el-button>
              </div>
              <el-button size="small" plain @click="editingQ.choices.push({text:''})" v-if="editingQ.choices.length < 4">+ เพิ่มกลุ่ม</el-button>
            </el-form-item>
            <el-form-item label="รายการที่ต้องจัดกลุ่ม">
              <div v-for="(pair, pi) in editingQ.match_pairs" :key="pi" class="match-row">
                <el-button size="small" :loading="uploadingChoiceImg === `gi${pi}`" @click="triggerUpload('groupItem', pi)">📷</el-button>
                <img v-if="pair.leftImage" :src="fixPhotoUrl(pair.leftImage)" class="choice-img" />
                <el-input v-model="pair.left" placeholder="ชื่อรายการ" size="small" style="flex:1" />
                <el-select v-model="pair.right" size="small" style="width:130px" placeholder="กลุ่ม">
                  <el-option v-for="(g, gi) in editingQ.choices" :key="gi" :label="g.text || `กลุ่ม ${gi+1}`" :value="String(gi)" />
                </el-select>
                <el-button size="small" circle @click="editingQ.match_pairs.splice(pi,1)" v-if="editingQ.match_pairs.length > 2">✕</el-button>
              </div>
              <el-button size="small" plain @click="editingQ.match_pairs.push({left:'',right:'0',leftImage:''})">+ เพิ่มรายการ</el-button>
            </el-form-item>
          </template>

          <!-- อัตนัย -->
          <template v-if="editingQ.question_type === 'essay'">
            <el-alert type="info" :closable="false" description="ข้อสอบอัตนัย — ครูตรวจให้คะแนนเองหลังสอบ" />
          </template>

        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">💾 บันทึก</el-button>
        </template>
      </el-dialog>

      <!-- Hidden file input -->
      <input ref="fileInputRef" type="file" accept="image/*" style="display:none" @change="onFileChange" />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useExam } from '@/composables/useExam'
import { useExamExcel } from '@/composables/useExamExcel'
import { useStudentUpload, fixPhotoUrl } from '@/composables/useStudentUpload'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const { getExamById, getQuestions, saveQuestion, deleteQuestion } = useExam()
const { exportTemplate, importFromExcel } = useExamExcel()
const { uploadFile } = useStudentUpload()

const examId = route.params.id
const exam = ref(null)
const questions = ref([])
const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingQ = ref(null)
const fileInputRef = ref(null)
const excelInputRef = ref(null)
const uploadingQImg = ref(false)
const uploadingChoiceImg = ref(null)
const uploadTarget = ref(null) // 'q' | 'choice'
const uploadChoiceIdx = ref(null)
const multiCorrect = ref([])

const choiceLabels = ['A','B','C','D','E','F']
const typeLabelMap = { choice:'ปรนัย', multi:'หลายตัวเลือก', truefalse:'ถูก/ผิด', fill:'เติมคำ', essay:'อัตนัย', match:'จับคู่', group:'จัดกลุ่ม' }
const questionTypes = [
  { value: 'choice', label: '🔘 ปรนัย (เลือก 1 ข้อ)' },
  { value: 'multi', label: '☑️ หลายตัวเลือก (เลือกได้หลายข้อ)' },
  { value: 'truefalse', label: '✅ ถูก / ผิด' },
  { value: 'fill', label: '✏️ เติมคำในช่องว่าง' },
  { value: 'essay', label: '📝 อัตนัย (เขียนตอบ)' },
  { value: 'match', label: '🔗 จับคู่ (ลากหรือคลิกเชื่อม)' },
  { value: 'group', label: '🗂️ จัดกลุ่ม (คลิกเลือกหมวด)' },
]

const totalPoints = computed(() => questions.value.reduce((s, q) => s + Number(q.points || 0), 0))

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function makeNewQ() {
  return {
    id: null,
    question_type: 'choice',
    question_text: '',
    question_image: '',
    choices: [{ text: '', image: '' }, { text: '', image: '' }, { text: '', image: '' }, { text: '', image: '' }],
    correct_answer: 'A',
    match_pairs: [{ left: '', right: '', leftImage: '', rightImage: '' }, { left: '', right: '', leftImage: '', rightImage: '' }],
    points: 1,
  }
}

function openAdd() { editingQ.value = makeNewQ(); multiCorrect.value = []; dialogVisible.value = true }
function openEdit(q) {
  const rawPairs = q.match_pairs ? (typeof q.match_pairs === 'string' ? JSON.parse(q.match_pairs) : JSON.parse(JSON.stringify(q.match_pairs))) : []
  editingQ.value = {
    ...q,
    choices: q.choices ? (typeof q.choices === 'string' ? JSON.parse(q.choices) : JSON.parse(JSON.stringify(q.choices))) : [],
    match_pairs: rawPairs.map(p => ({ leftImage: '', rightImage: '', ...p, _decoy: !p.left && !p.leftImage && (p.right || p.rightImage) ? true : p._decoy || false })),
  }
  multiCorrect.value = q.question_type === 'multi' ? (q.correct_answer || '').split(',').filter(Boolean) : []
  dialogVisible.value = true
}

function onTypeChange(type) {
  if (!editingQ.value) return
  if (type === 'choice' || type === 'multi') {
    if (!editingQ.value.choices?.length)
      editingQ.value.choices = [{ text:'',image:'' },{ text:'',image:'' },{ text:'',image:'' },{ text:'',image:'' }]
    editingQ.value.correct_answer = 'A'
  }
  if (type === 'truefalse') editingQ.value.correct_answer = 'true'
  if (type === 'match') {
    if (!editingQ.value.match_pairs?.length)
      editingQ.value.match_pairs = [{ left:'',right:'',leftImage:'',rightImage:'' },{ left:'',right:'',leftImage:'',rightImage:'' }]
  }
  if (type === 'group') {
    if (!editingQ.value.choices?.length)
      editingQ.value.choices = [{ text:'กลุ่ม 1' },{ text:'กลุ่ม 2' }]
    if (!editingQ.value.match_pairs?.length)
      editingQ.value.match_pairs = [{ left:'',right:'0',leftImage:'' },{ left:'',right:'0',leftImage:'' }]
  }
}

function addChoice() {
  if (!editingQ.value.choices) editingQ.value.choices = []
  editingQ.value.choices.push({ text: '', image: '' })
}

function triggerUpload(target, idx = null) {
  uploadTarget.value = target
  uploadChoiceIdx.value = idx
  fileInputRef.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  const target = uploadTarget.value
  const idx = uploadChoiceIdx.value
  if (target === 'choice') uploadingChoiceImg.value = idx
  else uploadingQImg.value = true
  try {
    const url = await uploadFile(file, authStore.schoolId, 'exam', 'exam_imgs')
    if (target === 'choice') editingQ.value.choices[idx].image = url
    else if (target === 'matchLeft') editingQ.value.match_pairs[idx].leftImage = url
    else if (target === 'matchRight') editingQ.value.match_pairs[idx].rightImage = url
    else if (target === 'groupItem') editingQ.value.match_pairs[idx].leftImage = url
    else editingQ.value.question_image = url
  } catch (err) {
    ElMessage.error('อัปโหลดภาพไม่สำเร็จ: ' + err.message)
  } finally {
    uploadingQImg.value = false
    uploadingChoiceImg.value = null
  }
}

async function handleSave() {
  if (!editingQ.value.question_text?.trim() && editingQ.value.question_type !== 'essay') {
    ElMessage.warning('กรุณาพิมพ์คำถาม'); return
  }
  saving.value = true
  try {
    let correctAnswer = editingQ.value.correct_answer || null
    if (editingQ.value.question_type === 'multi') correctAnswer = multiCorrect.value.join(',')
    if (editingQ.value.question_type === 'match') {
      // correct_answer = global indices of each left item's correct right (decoys skipped on left)
      const leftItems = editingQ.value.match_pairs.map((p, i) => ({ p, i })).filter(({ p }) => p.left || p.leftImage)
      correctAnswer = leftItems.map(({ i }) => i).join(',')
    }
    if (editingQ.value.question_type === 'group') correctAnswer = editingQ.value.match_pairs.map(p => p.right || '0').join(',')

    const res = await saveQuestion({
      id: editingQ.value.id || null,
      examId,
      schoolId: authStore.schoolId,
      orderNum: editingQ.value.id ? questions.value.findIndex(q => q.id === editingQ.value.id) + 1 : questions.value.length + 1,
      questionType: editingQ.value.question_type,
      questionText: editingQ.value.question_text || '',
      questionImage: editingQ.value.question_image || null,
      choices: editingQ.value.choices || [],
      correctAnswer,
      matchPairs: editingQ.value.match_pairs || [],
      points: editingQ.value.points || 1,
    })
    if (!res.success) { ElMessage.error(res.error); return }
    ElMessage.success(editingQ.value.id ? 'แก้ไขแล้ว' : 'เพิ่มข้อสอบแล้ว')
    dialogVisible.value = false
    await loadQuestions()
  } finally {
    saving.value = false
  }
}

async function handleDelete(q) {
  const res = await deleteQuestion(q.id)
  if (res.success) { ElMessage.success('ลบแล้ว'); await loadQuestions() }
  else ElMessage.error(res.error)
}

async function loadQuestions() {
  const res = await getQuestions(examId)
  if (res.success) questions.value = res.data
}

function handleExportTemplate() {
  exportTemplate(exam.value?.title || 'ข้อสอบ')
}

function triggerExcelImport() {
  excelInputRef.value?.click()
}

async function onExcelFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  importing.value = true
  try {
    const parsed = await importFromExcel(file)
    if (!parsed.length) { ElMessage.warning('ไม่พบข้อสอบในไฟล์'); return }
    let imported = 0
    const baseOrder = questions.value.length
    for (const q of parsed) {
      const res = await saveQuestion({
        id: null,
        examId,
        schoolId: authStore.schoolId,
        orderNum: baseOrder + q.order_num,
        questionType: q.question_type,
        questionText: q.question_text,
        questionImage: q.question_image || null,
        choices: q.choices || [],
        correctAnswer: q.correct_answer || null,
        matchPairs: q.match_pairs || [],
        points: q.points || 1,
      })
      if (res.success) imported++
    }
    ElMessage.success(`นำเข้าสำเร็จ ${imported} ข้อ`)
    await loadQuestions()
  } catch (err) {
    ElMessage.error('อ่านไฟล์ไม่สำเร็จ: ' + err.message)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  loading.value = true
  const [examRes] = await Promise.all([getExamById(examId), loadQuestions()])
  if (examRes.success) exam.value = examRes.data
  loading.value = false
})
</script>

<style scoped>
.eq-page { padding: 20px; }
.eq-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.eq-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
  background: linear-gradient(135deg,#6d28d9,#7c3aed); border-radius: 16px; padding: 16px 20px;
}
.eq-header-center { flex: 1; }
.eq-header-center h2 { margin: 0; font-size: 18px; font-weight: 800; color: #fff; }
.eq-meta { font-size: 12px; color: rgba(255,255,255,.8); }
.eq-empty { text-align: center; padding: 60px; color: #94a3b8; }
.eq-list { display: flex; flex-direction: column; gap: 10px; }
.eq-item {
  display: flex; align-items: flex-start; gap: 12px;
  background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px 16px;
  border-left: 4px solid #7c3aed;
}
.eq-type-essay { border-left-color: #0891b2; }
.eq-type-fill { border-left-color: #059669; }
.eq-type-truefalse { border-left-color: #d97706; }
.eq-type-match { border-left-color: #db2777; }
.eq-item-num { width: 28px; height: 28px; border-radius: 50%; background: #7c3aed; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; }
.eq-item-body { flex: 1; }
.eq-item-type-badge { font-size: 11px; color: #7c3aed; font-weight: 700; margin-bottom: 4px; }
.eq-item-text { font-size: 14px; color: #1e293b; white-space: pre-wrap; }
.eq-item-img { max-width: 160px; max-height: 100px; border-radius: 8px; margin-top: 6px; object-fit: contain; }
.eq-item-pts { font-weight: 800; color: #7c3aed; white-space: nowrap; font-size: 13px; }
.eq-item-actions { display: flex; gap: 6px; flex-shrink: 0; }
.choice-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.choice-label { width: 20px; font-weight: 700; color: #7c3aed; }
.choice-img { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; }
.match-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.match-row-v2 { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.match-decoy-badge { font-size: 10px; font-weight: 800; color: #d97706; background: #fef3c7; border-radius: 6px; padding: 2px 8px; white-space: nowrap; flex-shrink: 0; }
.match-side { display: flex; align-items: center; gap: 4px; flex: 1; }
.img-upload-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.preview-img { max-width: 120px; max-height: 80px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; }
</style>
