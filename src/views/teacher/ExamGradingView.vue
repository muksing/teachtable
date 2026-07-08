<template>
  <AppLayout>
    <div class="grade-page">

      <!-- Header -->
      <div class="grade-hero">
        <div>
          <el-button text style="color:#fff;margin-bottom:4px" @click="$router.push('/teacher/exams')">← รายการสอบ</el-button>
          <h1 v-if="exam">✏️ ตรวจข้อสอบ — {{ exam.subject_name }}</h1>
          <p v-if="exam">{{ exam.title }}</p>
        </div>
        <div class="hero-actions" style="display:flex;gap:8px;align-items:center">
          <div class="graded-counter" v-if="!loading">
            <span class="gc-done">✅ {{ gradedCount }}</span>
            <span class="gc-sep">/</span>
            <span class="gc-total">{{ submittedSessions.length }}</span>
            <span class="gc-lbl">ตรวจแล้ว</span>
          </div>
          <el-button plain style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff"
            @click="handleDownloadScores">📥 Excel</el-button>
        </div>
      </div>

      <!-- Gemini API key -->
      <div class="apikey-bar" v-if="!geminiKey">
        <span>🤖 AI ตรวจข้อสอบ (Gemini)</span>
        <el-input v-model="keyInput" placeholder="AIza..." size="small" style="width:280px" show-password />
        <el-button size="small" type="primary" @click="saveKey">บันทึก</el-button>
        <a href="https://aistudio.google.com/apikey" target="_blank" style="font-size:12px;color:#7c3aed">ขอ Key ฟรี</a>
      </div>
      <div class="apikey-bar apikey-ok" v-else>
        <span>🤖 Gemini API พร้อมใช้งาน</span>
        <el-button size="small" plain @click="clearKey">เปลี่ยน Key</el-button>
      </div>

      <div v-if="loading" class="loading-box">กำลังโหลด...</div>

      <div v-else class="grade-layout">

        <!-- ─── LEFT: Student list panel ─────────────────────────── -->
        <div class="student-panel">
          <div class="sp-head">
            <span>นักเรียนที่ส่งแล้ว</span>
            <span class="sp-count">{{ gradedCount }}/{{ submittedSessions.length }}</span>
          </div>

          <div v-if="!submittedSessions.length" class="sp-empty">ยังไม่มีนักเรียนส่ง</div>

          <div v-for="s in submittedSessions" :key="s.id"
            class="sp-row" :class="{ 'sp-active': selectedSessionId === s.id, 'sp-graded': isFullyGraded(s) }"
            @click="selectedSessionId = s.id">
            <!-- Photo -->
            <div class="sp-photo-wrap">
              <img v-if="s.photo_url" :src="s.photo_url" class="sp-photo" @error="e => e.target.style.display='none'" />
              <div v-else class="sp-photo-ph">{{ (s.first_name || s.student_name || '?')[0] }}</div>
            </div>
            <!-- Info -->
            <div class="sp-info">
              <div class="sp-name">
                <span class="sp-seat">{{ s.seat_number || '—' }}</span>
                {{ s.display_name }}
              </div>
              <div class="sp-meta">ห้อง {{ s.class_id }} · ครั้งที่ {{ s.attempt_number || 1 }}</div>
              <div class="sp-score">{{ s.score ?? '—' }}/{{ s.max_score ?? '—' }} คะแนน</div>
            </div>
            <!-- Status -->
            <div class="sp-badge" :class="isFullyGraded(s) ? 'badge-done' : 'badge-pending'">
              {{ isFullyGraded(s) ? '✅' : '⏳' }}
            </div>
          </div>
        </div>

        <!-- ─── RIGHT: Answer sheet ───────────────────────────────── -->
        <div class="answer-panel">
          <div v-if="!currentSession" class="empty-select">
            <div style="font-size:48px">👈</div>
            <p>เลือกนักเรียนจากด้านซ้ายเพื่อตรวจคำตอบ</p>
          </div>

          <template v-else>
            <!-- Sheet header -->
            <div class="sheet-header">
              <div class="sh-student">
                <img v-if="currentSession.photo_url" :src="currentSession.photo_url"
                  class="sh-photo" @error="e => e.target.style.display='none'" />
                <div v-else class="sh-photo-ph">{{ (currentSession.first_name || '?')[0] }}</div>
                <div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span v-if="currentSession.seat_number" class="sheet-seat">เลขที่ {{ currentSession.seat_number }}</span>
                    <strong style="font-size:15px">{{ currentSession.display_name }}</strong>
                  </div>
                  <div style="font-size:12px;color:#64748b">ห้อง {{ currentSession.class_id }} · ครั้งที่ {{ currentSession.attempt_number || 1 }}</div>
                </div>
              </div>
              <div class="sh-score-block">
                <span class="sh-score-num">{{ pendingTotalScore }}</span>
                <span class="sh-score-sep">/</span>
                <span class="sh-score-max">{{ totalPoints }}</span>
                <span class="sh-score-unit">คะแนน</span>
              </div>
              <el-button type="primary" :loading="savingGrade" @click="handleSaveGrade">💾 บันทึกคะแนน</el-button>
            </div>

            <!-- ── Section 1: ตรวจอัตโนมัติ ── -->
            <div v-if="autoQuestions.length" class="q-section">
              <div class="q-section-head auto-head">
                ✅ ตรวจอัตโนมัติ ({{ autoQuestions.length }} ข้อ ·
                {{ autoQuestions.reduce((s,q) => s + (isCorrect(q) ? Number(q.points) : 0), 0) }}/{{ autoQuestions.reduce((s,q) => s + Number(q.points), 0) }} คะแนน)
              </div>
              <div class="q-list">
                <div v-for="q in autoQuestions" :key="q.id" class="q-grade-card q-auto">
                  <div class="q-grade-num">{{ globalIdx(q) }}</div>
                  <div class="q-grade-body">
                    <div class="q-grade-text">{{ q.question_text }}</div>
                    <div class="answer-row">
                      <span class="label-ans">คำตอบ:</span>
                      <span :class="isCorrect(q) ? 'ans-correct' : 'ans-wrong'">
                        {{ formatAnswer(q, getStudentAnswer(q.id)) || '(ไม่ตอบ)' }}
                        {{ isCorrect(q) ? '✅' : '❌' }}
                      </span>
                    </div>
                    <div class="answer-row">
                      <span class="label-ans">เฉลย:</span>
                      <span class="ans-model">{{ formatAnswer(q, q.correct_answer) }}</span>
                    </div>
                  </div>
                  <div class="q-grade-pts">{{ isCorrect(q) ? q.points : 0 }}/{{ q.points }}</div>
                </div>
              </div>
            </div>

            <!-- ── Section 2: ตรวจเอง ── -->
            <div v-if="manualQuestions.length" class="q-section">
              <div class="q-section-head manual-head">
                <span>✏️ ตรวจเอง ({{ manualQuestions.length }} ข้อ)</span>
                <el-button
                  v-if="geminiKey"
                  size="small" type="primary" plain
                  :loading="aiGradingAll"
                  @click="handleAIGradeAll"
                >🤖 AI ตรวจทั้งหมด</el-button>
                <span v-else style="font-size:11px;color:#94a3b8">ตั้งค่า Gemini Key เพื่อใช้ AI</span>
              </div>
              <div class="q-list">
                <div v-for="q in manualQuestions" :key="q.id" class="q-grade-card q-manual">
                  <div class="q-grade-num">{{ globalIdx(q) }}</div>
                  <div class="q-grade-body">
                    <div class="q-grade-text">{{ q.question_text }}</div>
                    <div class="answer-row">
                      <span class="label-ans">คำตอบนักเรียน:</span>
                      <div class="student-essay">{{ getStudentAnswer(q.id) || '(ไม่ตอบ)' }}</div>
                    </div>
                    <div v-if="q.correct_answer && !['match','group'].includes(q.question_type)" class="answer-row">
                      <span class="label-ans">แนวตอบ:</span>
                      <div class="model-essay">{{ q.correct_answer }}</div>
                    </div>

                    <!-- match visual -->
                    <div v-if="q.question_type === 'match'" class="match-grade-table">
                      <div v-for="(r, ri) in matchPairResults(q)" :key="ri" class="match-grade-row">
                        <span class="mg-idx" :style="{background: r.correct ? '#16a34a' : '#dc2626'}">{{ ri+1 }}</span>
                        <div class="mg-left">
                          <img v-if="r.leftImage" :src="r.leftImage" class="mg-img" />
                          {{ r.left }}
                        </div>
                        <span class="mg-arrow">→</span>
                        <div class="mg-student" :class="r.correct ? 'mg-correct' : 'mg-wrong'">
                          {{ r.studentRight }} {{ r.correct ? '✅' : '❌' }}
                        </div>
                        <div v-if="!r.correct" class="mg-correct-hint">เฉลย: {{ r.correctRight }}</div>
                      </div>
                    </div>

                    <!-- group visual -->
                    <div v-if="q.question_type === 'group'" class="group-grade-table">
                      <div v-for="(r, ri) in groupItemResults(q)" :key="ri" class="group-grade-row">
                        <div class="mg-left">
                          <img v-if="r.leftImage" :src="r.leftImage" class="mg-img" />
                          {{ r.item }}
                        </div>
                        <span class="mg-arrow">→</span>
                        <div class="mg-student" :class="r.correct ? 'mg-correct' : 'mg-wrong'">
                          {{ r.studentGroup }} {{ r.correct ? '✅' : '❌' }}
                        </div>
                        <div v-if="!r.correct" class="mg-correct-hint">เฉลย: {{ r.correctGroup }}</div>
                      </div>
                    </div>

                    <!-- AI result -->
                    <div v-if="aiResults[q.id]" class="ai-suggestion">
                      <div class="ai-badge">🤖 AI แนะนำ: {{ aiResults[q.id].score }}/{{ q.points }} คะแนน</div>
                      <div class="ai-reason">{{ aiResults[q.id].reason }}</div>
                      <el-button size="small" plain @click="applyAI(q.id)">ใช้คะแนนนี้</el-button>
                    </div>
                    <!-- Score input row -->
                    <div class="manual-score-row">
                      <span class="label-ans">คะแนน:</span>
                      <el-input-number v-model="manualScores[q.id]"
                        :min="0" :max="q.points" :step="0.5" size="small" style="width:110px" />
                      <span style="color:#64748b;font-size:12px">/ {{ q.points }}</span>
                      <el-button size="small" plain :loading="aiLoading[q.id]"
                        :disabled="!geminiKey" @click="handleAIGrade(q)">
                        🤖 AI
                      </el-button>
                    </div>
                  </div>
                  <div class="q-grade-pts">{{ manualScores[q.id] ?? '—' }}/{{ q.points }}</div>
                </div>
              </div>
            </div>

            <!-- Save button bottom -->
            <div class="sheet-footer">
              <el-button type="primary" size="large" :loading="savingGrade" @click="handleSaveGrade">
                💾 บันทึกคะแนน ({{ pendingTotalScore }}/{{ totalPoints }} คะแนน)
              </el-button>
            </div>
          </template>
        </div>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useExam } from '@/composables/useExam'
import { useExamExcel } from '@/composables/useExamExcel'

const route = useRoute()
const { getExamById, getQuestions, getSessions, saveManualScores } = useExam()
const { exportScores, gradeWithAI } = useExamExcel()

const examId = route.params.id
const exam = ref(null)
const questions = ref([])
const sessions = ref([])
const loading = ref(false)
const savingGrade = ref(false)
const aiGradingAll = ref(false)
const selectedSessionId = ref(null)
const manualScores = ref({})
const aiResults = ref({})
const aiLoading = ref({})
const keyInput = ref('')
const geminiKey = ref(localStorage.getItem('gemini_api_key') || '')

// ── Computed ────────────────────────────────────────────────────
const submittedSessions = computed(() => sessions.value.filter(s => s.status === 'submitted'))
const currentSession = computed(() => sessions.value.find(s => s.id === selectedSessionId.value) || null)
const totalPoints = computed(() => questions.value.reduce((s, q) => s + Number(q.points || 0), 0))
const autoQuestions   = computed(() => questions.value.filter(q => !needsManual(q)))
const manualQuestions = computed(() => questions.value.filter(q =>  needsManual(q)))

const pendingTotalScore = computed(() => {
  if (!currentSession.value) return 0
  return questions.value.reduce((sum, q) => {
    if (needsManual(q)) return sum + Number(manualScores.value[q.id] || 0)
    return sum + (isCorrect(q) ? Number(q.points) : 0)
  }, 0)
})

const gradedCount = computed(() => submittedSessions.value.filter(isFullyGraded).length)
const sessionsNeedGrading = computed(() => submittedSessions.value.filter(s => !isFullyGraded(s)))

// ── Helpers ─────────────────────────────────────────────────────
function countStatus(st) { return sessions.value.filter(s => s.status === st).length }
function needsManual(q) { return ['fill', 'essay', 'match', 'group'].includes(q.question_type) }

function getParsed(q, field) {
  const v = q[field]; try { return typeof v === 'string' ? JSON.parse(v) : (v || []) } catch { return [] }
}
function getMatchPairs(q) { return getParsed(q, 'match_pairs') }
function getChoices(q) { return getParsed(q, 'choices') }

const MATCH_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6']
function matchColor(i) { return MATCH_COLORS[i % MATCH_COLORS.length] }

function matchPairResults(q) {
  const student = getStudentAnswer(q.id)
  const pairs = getMatchPairs(q)
  if (!student || !pairs.length) return pairs.map(p => ({ ...p, studentRight: '(ไม่ได้เลือก)', correct: false }))
  const chosen = student.split(',').map(v => v === 'null' ? null : parseInt(v))
  return pairs.map((p, i) => ({
    left: p.left, leftImage: p.leftImage || '',
    studentRight: chosen[i] != null ? (pairs[chosen[i]]?.right || '?') : '(ไม่ได้เลือก)',
    studentRightImage: chosen[i] != null ? (pairs[chosen[i]]?.rightImage || '') : '',
    correctRight: p.right,
    correct: chosen[i] === i,
  }))
}

function matchSuggestedScore(q) {
  const results = matchPairResults(q)
  if (!results.length) return 0
  const correct = results.filter(r => r.correct).length
  return Math.round((correct / results.length) * Number(q.points) * 10) / 10
}

function groupItemResults(q) {
  const student = getStudentAnswer(q.id)
  const pairs = getMatchPairs(q)
  const groups = getChoices(q)
  if (!student || !pairs.length) return pairs.map(p => ({ item: p.left, leftImage: p.leftImage||'', studentGroup: '(ไม่ได้เลือก)', correctGroup: groups[parseInt(p.right)]?.text || '?', correct: false }))
  const chosen = student.split(',').map(v => v === 'null' ? null : parseInt(v))
  return pairs.map((p, i) => ({
    item: p.left, leftImage: p.leftImage || '',
    studentGroup: chosen[i] != null ? (groups[chosen[i]]?.text || '?') : '(ไม่ได้เลือก)',
    correctGroup: groups[parseInt(p.right)]?.text || '?',
    correct: chosen[i] === parseInt(p.right),
  }))
}

function groupSuggestedScore(q) {
  const results = groupItemResults(q)
  if (!results.length) return 0
  const correct = results.filter(r => r.correct).length
  return Math.round((correct / results.length) * Number(q.points) * 10) / 10
}

function isFullyGraded(s) {
  if (s.status !== 'submitted') return false
  if (!manualQuestions.value.length) return s.score != null
  const ms = s.manual_scores || {}
  return manualQuestions.value.every(q => ms[q.id]?.score != null)
}

function globalIdx(q) {
  const i = questions.value.findIndex(x => x.id === q.id)
  return `ข้อ ${i + 1}`
}

function getStudentAnswer(qid) {
  if (!currentSession.value?.answers) return ''
  const ans = (() => {
    try { return typeof currentSession.value.answers === 'string'
      ? JSON.parse(currentSession.value.answers)
      : (currentSession.value.answers || {}) } catch { return {} }
  })()
  return ans[qid] || ''
}

function isCorrect(q) {
  const student = getStudentAnswer(q.id)
  if (!student) return false
  const correct = q.correct_answer || ''
  if (q.question_type === 'truefalse') return student === correct
  if (q.question_type === 'choice') return student.toUpperCase() === correct.toUpperCase()
  if (q.question_type === 'fill') return student.trim().toLowerCase() === correct.trim().toLowerCase()
  if (q.question_type === 'multi') {
    const a = student.split(',').map(x => x.trim().toUpperCase()).sort()
    const c = correct.split(',').map(x => x.trim().toUpperCase()).sort()
    return JSON.stringify(a) === JSON.stringify(c)
  }
  return false
}

function formatAnswer(q, val) {
  if (!val) return ''
  if (q.question_type === 'truefalse') return val === 'true' ? 'ถูก' : 'ผิด'
  return val
}

// ── Gemini key ──────────────────────────────────────────────────
function saveKey() {
  if (!keyInput.value.trim()) return
  geminiKey.value = keyInput.value.trim()
  localStorage.setItem('gemini_api_key', geminiKey.value)
  keyInput.value = ''
  ElMessage.success('บันทึก API Key แล้ว')
}

function clearKey() {
  geminiKey.value = ''
  localStorage.removeItem('gemini_api_key')
}

// ── Watch session change ─────────────────────────────────────────
watch(currentSession, (s) => {
  manualScores.value = {}
  aiResults.value = {}
  if (!s) return
  const saved = s.manual_scores || {}
  for (const q of questions.value) {
    if (!needsManual(q)) continue
    if (saved[q.id]?.score != null) {
      manualScores.value[q.id] = saved[q.id].score
      if (saved[q.id]?.reason) aiResults.value[q.id] = saved[q.id]
    } else if (q.question_type === 'match') {
      const sug = matchSuggestedScore(q)
      manualScores.value[q.id] = sug
      if (getMatchPairs(q).length) aiResults.value[q.id] = { score: sug, reason: `ถูกต้อง ${matchPairResults(q).filter(r=>r.correct).length}/${getMatchPairs(q).length} คู่ (แนะนำอัตโนมัติ)` }
    } else if (q.question_type === 'group') {
      const sug = groupSuggestedScore(q)
      manualScores.value[q.id] = sug
      if (getMatchPairs(q).length) aiResults.value[q.id] = { score: sug, reason: `จัดกลุ่มถูก ${groupItemResults(q).filter(r=>r.correct).length}/${getMatchPairs(q).length} รายการ (แนะนำอัตโนมัติ)` }
    } else {
      manualScores.value[q.id] = null
    }
  }
})

// ── AI grading ───────────────────────────────────────────────────
async function handleAIGrade(q) {
  aiLoading.value[q.id] = true
  try {
    const result = await gradeWithAI(q.question_text, q.correct_answer || '', getStudentAnswer(q.id), q.points)
    aiResults.value[q.id] = result
    manualScores.value[q.id] = Math.min(result.score, q.points)
  } catch (err) {
    if (err.message === 'NO_KEY') ElMessage.warning('กรุณาตั้งค่า Gemini API Key ก่อน')
    else ElMessage.error('AI ตรวจไม่สำเร็จ: ' + err.message)
  } finally {
    aiLoading.value[q.id] = false
  }
}

async function handleAIGradeAll() {
  if (!manualQuestions.value.length) return
  aiGradingAll.value = true
  let ok = 0, fail = 0
  for (let i = 0; i < manualQuestions.value.length; i++) {
    const q = manualQuestions.value[i]
    // match/group already have auto partial-credit suggestion, skip AI
    if (['match', 'group'].includes(q.question_type)) { ok++; continue }
    aiLoading.value[q.id] = true
    try {
      const result = await gradeWithAI(q.question_text, q.correct_answer || '', getStudentAnswer(q.id), q.points)
      aiResults.value[q.id] = result
      manualScores.value[q.id] = Math.min(result.score, q.points)
      ok++
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        ElMessage.warning('Gemini rate limit — รอ 15 วินาทีแล้วลองใหม่...')
      }
      fail++
    } finally {
      aiLoading.value[q.id] = false
    }
    if (i < manualQuestions.value.length - 1) {
      await new Promise(r => setTimeout(r, 4500))
    }
  }
  aiGradingAll.value = false
  if (fail) ElMessage.warning(`AI ตรวจได้ ${ok}/${manualQuestions.value.length} ข้อ (ล้มเหลว ${fail} ข้อ)`)
  else ElMessage.success(`AI ตรวจครบ ${ok} ข้อ — กรุณาตรวจสอบและบันทึกคะแนน`)
}

function applyAI(qid) {
  const r = aiResults.value[qid]
  if (r) manualScores.value[qid] = r.score
}

// ── Save grades ──────────────────────────────────────────────────
async function handleSaveGrade() {
  if (!currentSession.value) return
  savingGrade.value = true
  try {
    const payload = {}
    for (const q of questions.value) {
      if (needsManual(q)) {
        payload[q.id] = {
          score: manualScores.value[q.id] ?? 0,
          reason: aiResults.value[q.id]?.reason || 'ครูตรวจ',
        }
      }
    }
    const res = await saveManualScores(currentSession.value.id, payload, pendingTotalScore.value)
    if (res.success) {
      ElMessage.success('บันทึกคะแนนแล้ว')
      const idx = sessions.value.findIndex(s => s.id === currentSession.value.id)
      if (idx >= 0) sessions.value[idx] = { ...sessions.value[idx], score: pendingTotalScore.value, manual_scores: payload }
    } else ElMessage.error(res.error)
  } finally {
    savingGrade.value = false
  }
}

function handleDownloadScores() {
  exportScores(sessions.value, questions.value, exam.value?.title || 'ข้อสอบ')
}

onMounted(async () => {
  loading.value = true
  const [examRes, questionsRes, sessionsRes] = await Promise.all([
    getExamById(examId), getQuestions(examId), getSessions(examId)
  ])
  if (examRes.success) exam.value = examRes.data
  if (questionsRes.success) questions.value = questionsRes.data
  if (sessionsRes.success) sessions.value = sessionsRes.data
  loading.value = false
})
</script>

<style scoped>
.grade-page { padding: 20px; display: flex; flex-direction: column; gap: 14px; }

/* Hero */
.grade-hero {
  background: linear-gradient(135deg,#0f172a,#1e3a5f);
  border-radius: 18px; padding: 22px 24px; color: #fff;
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
}
.grade-hero h1 { margin: 0; font-size: 20px; font-weight: 800; }
.grade-hero p  { margin: 4px 0 0; opacity: .8; font-size: 13px; }
.graded-counter { display: flex; align-items: baseline; gap: 3px; background: rgba(255,255,255,.12); border-radius: 10px; padding: 6px 12px; }
.gc-done  { font-size: 18px; font-weight: 900; color: #4ade80; }
.gc-sep   { font-size: 14px; color: rgba(255,255,255,.5); }
.gc-total { font-size: 18px; font-weight: 900; color: #fff; }
.gc-lbl   { font-size: 11px; color: rgba(255,255,255,.6); margin-left: 4px; }

/* API Key bar */
.apikey-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:#f5f3ff; border-radius:10px; padding:10px 14px; font-size:13px; }
.apikey-ok  { background:#f0fdf4; }

.loading-box { text-align:center; padding:60px; color:#64748b; }

/* Layout */
.grade-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; min-height: 60vh; }
@media (max-width: 768px) { .grade-layout { grid-template-columns: 1fr; } }

/* ─── Student panel ──────────────────────────────────────────── */
.student-panel {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  overflow: hidden; display: flex; flex-direction: column;
  max-height: 80vh; position: sticky; top: 16px;
}
.sp-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  font-size: 13px; font-weight: 800; color: #0f172a; flex-shrink: 0;
}
.sp-count { font-size: 12px; font-weight: 700; color: #7c3aed; background: #ede9fe; border-radius: 8px; padding: 2px 8px; }
.sp-empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }

.sp-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background .1s;
  flex-shrink: 0;
}
.sp-row:hover { background: #f5f3ff; }
.sp-row:last-child { border-bottom: none; }
.sp-active { background: #ede9fe !important; border-left: 3px solid #7c3aed; }
.sp-graded { opacity: .75; }

.sp-photo-wrap { flex-shrink: 0; }
.sp-photo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; }
.sp-photo-ph {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg,#7c3aed,#a855f7); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800;
}
.sp-info { flex: 1; min-width: 0; }
.sp-name { font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; }
.sp-seat { font-size: 10px; font-weight: 900; background: #ede9fe; color: #5b21b6; border-radius: 5px; padding: 0 5px; flex-shrink: 0; }
.sp-meta  { font-size: 10px; color: #94a3b8; margin-top: 1px; }
.sp-score { font-size: 11px; font-weight: 700; color: #475569; }
.sp-badge { font-size: 16px; flex-shrink: 0; }
.badge-done    { opacity: 1; }
.badge-pending { opacity: .6; }

/* ─── Answer panel ───────────────────────────────────────────── */
.answer-panel { display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.empty-select { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: #94a3b8; gap: 12px; }
.empty-select p { font-size: 14px; }

/* Sheet header */
.sheet-header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px;
}
.sh-student { display: flex; align-items: center; gap: 12px; }
.sh-photo { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; }
.sh-photo-ph {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg,#7c3aed,#a855f7); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800;
}
.sheet-seat { font-size: 11px; font-weight: 900; color: #7c3aed; background: #ede9fe; border-radius: 6px; padding: 1px 8px; }
.sh-score-block { display: flex; align-items: baseline; gap: 3px; }
.sh-score-num  { font-size: 32px; font-weight: 900; color: #0284c7; line-height: 1; }
.sh-score-sep  { font-size: 18px; color: #94a3b8; }
.sh-score-max  { font-size: 20px; font-weight: 700; color: #475569; }
.sh-score-unit { font-size: 13px; color: #64748b; margin-left: 3px; }

/* Section headers */
.q-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
.q-section-head {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  padding: 10px 16px; font-size: 13px; font-weight: 800; gap: 8px;
}
.auto-head   { background: #f0fdf4; color: #15803d; border-bottom: 1px solid #bbf7d0; }
.manual-head { background: #fef3c7; color: #92400e; border-bottom: 1px solid #fde68a; }

/* Q cards */
.q-list { display: flex; flex-direction: column; }
.q-grade-card {
  display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
}
.q-grade-card:last-child { border-bottom: none; }
.q-auto   { background: #fff; }
.q-manual { background: #fffbeb; }
.q-grade-num { font-size: 11px; font-weight: 900; color: #64748b; background: #f1f5f9; border-radius: 6px; padding: 2px 8px; flex-shrink: 0; margin-top: 2px; }
.q-grade-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.q-grade-text { font-size: 14px; font-weight: 600; color: #0f172a; }
.q-grade-pts { font-size: 13px; font-weight: 800; color: #0f172a; white-space: nowrap; min-width: 48px; text-align: right; }

.answer-row { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
.label-ans { font-size: 11px; font-weight: 800; color: #64748b; white-space: nowrap; margin-top: 2px; }
.ans-correct { color: #15803d; font-weight: 700; font-size: 13px; }
.ans-wrong   { color: #dc2626; font-weight: 700; font-size: 13px; }
.ans-model   { color: #0284c7; font-weight: 700; font-size: 13px; }
.student-essay { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #0f172a; white-space: pre-wrap; }
.model-essay   { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #1e40af; white-space: pre-wrap; }

.ai-suggestion { background: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.ai-badge  { font-size: 13px; font-weight: 800; color: #0369a1; }
.ai-reason { font-size: 12px; color: #475569; }

/* ── Match/Group grade display ────────────────────────────────── */
.match-grade-table, .group-grade-table { display: flex; flex-direction: column; gap: 6px; }
.match-grade-row, .group-grade-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.mg-idx { min-width: 22px; height: 22px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; flex-shrink: 0; }
.mg-left { font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 4px; }
.mg-img  { width: 32px; height: 32px; object-fit: cover; border-radius: 5px; }
.mg-arrow { color: #94a3b8; font-weight: 700; }
.mg-student { font-weight: 700; }
.mg-correct { color: #16a34a; }
.mg-wrong   { color: #dc2626; }
.mg-correct-hint { font-size: 11px; color: #64748b; background: #f0fdf4; border-radius: 5px; padding: 1px 7px; }

.manual-score-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.sheet-footer { padding: 12px 0 4px; display: flex; justify-content: flex-end; }
</style>
