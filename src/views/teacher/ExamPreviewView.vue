<template>
  <div class="preview-shell">

    <!-- Top bar -->
    <div class="preview-topbar">
      <div class="preview-topbar-left">
        <el-button size="small" plain @click="$router.back()">← แก้ไขข้อสอบ</el-button>
        <span class="preview-badge">👁 PREVIEW</span>
        <span class="subject-chip">{{ exam?.subject_name }}</span>
        <span class="exam-name">{{ exam?.title }}</span>
      </div>
      <div class="preview-topbar-right">
        <span class="q-counter">ข้อ {{ currentIdx + 1 }} / {{ questions.length }}</span>
        <el-switch v-model="showAnswer" active-text="แสดงเฉลย" inactive-text="ซ่อนเฉลย" style="margin-left:12px" />
        <div v-if="showAnswer" class="score-chip">
          ✅ ถูก {{ correctCount }} / {{ autoGradeCount }} ข้อ ({{ totalGained }}/{{ totalMax }} คะแนน)
        </div>
        <div class="timer-box">⏱ {{ fmtTime(timeLeft) }}</div>
      </div>
    </div>

    <!-- Question number strip -->
    <div class="q-strip">
      <button
        v-for="(q, i) in questions" :key="q.id"
        class="q-num-btn"
        :class="qNumClass(i, q)"
        @click="goto(i)"
      >{{ i + 1 }}</button>
    </div>

    <!-- Question area -->
    <div class="q-area" v-if="questions.length">
      <div class="q-card">
        <div class="q-meta-row">
          <span class="q-number">ข้อ {{ currentIdx + 1 }}</span>
          <span class="q-type-badge">{{ typeLabel(current.question_type) }}</span>
          <span class="q-points">{{ current.points ?? 1 }} คะแนน</span>
        </div>

        <div class="q-text">{{ current.question_text }}</div>
        <img v-if="current.question_image" :src="fixImg(current.question_image)" class="q-image" />

        <!-- ปรนัย / หลายตัวเลือก -->
        <div v-if="['choice','multi'].includes(current.question_type)" class="mc-options">
          <div
            v-for="(ch, ci) in parsedChoices" :key="ci"
            class="mc-option"
            :class="mcOptionClass(ci)"
            @click="toggleChoice(ci)"
          >
            <span class="opt-letter">{{ choiceLabels[ci] }}</span>
            <span class="opt-text">{{ ch.text }}</span>
            <img v-if="ch.image" :src="fixImg(ch.image)" class="opt-img" />
            <span v-if="showAnswer && isChoiceCorrect(ci)" class="opt-tick">✅</span>
            <span v-if="showAnswer && isChoiceWrong(ci)" class="opt-cross">❌</span>
          </div>
        </div>

        <!-- ถูก/ผิด -->
        <div v-else-if="current.question_type === 'truefalse'" class="tf-options">
          <div class="tf-btn" :class="tfClass('true')"  @click="ans.text = 'true'">✔ ถูก</div>
          <div class="tf-btn" :class="tfClass('false')" @click="ans.text = 'false'">✘ ผิด</div>
          <div v-if="showAnswer" class="tf-answer-hint">
            เฉลย: <strong>{{ current.correct_answer === 'true' ? 'ถูก' : 'ผิด' }}</strong>
          </div>
        </div>

        <!-- เติมคำ -->
        <div v-else-if="current.question_type === 'fill'" class="fill-wrap">
          <el-input v-model="ans.text" placeholder="พิมพ์คำตอบที่นี่..." clearable />
          <div v-if="showAnswer" class="fill-model-answer">
            เฉลย: <strong>{{ current.correct_answer }}</strong>
            <span v-if="ans.text" class="fill-match-label" :class="isFillMatch() ? 'match-ok' : 'match-miss'">
              {{ isFillMatch() ? '✅ ใกล้เคียง' : '❌ ต่างกัน' }}
            </span>
          </div>
        </div>

        <!-- จับคู่ -->
        <div v-else-if="current.question_type === 'match'" class="match-wrap">
          <div v-for="(pair, pi) in parsedMatchPairs" :key="pi" class="match-pair">
            <span class="match-left">
              <img v-if="pair.leftImage" :src="fixImg(pair.leftImage)" style="height:32px;border-radius:5px;margin-right:4px;vertical-align:middle" />
              {{ pair.left }}
            </span>
            <span class="match-arrow">↔</span>
            <span class="match-right">
              <img v-if="pair.rightImage" :src="fixImg(pair.rightImage)" style="height:32px;border-radius:5px;margin-right:4px;vertical-align:middle" />
              {{ pair.right }}
            </span>
          </div>
          <div v-if="showAnswer" class="fill-model-answer">เฉลย: จับคู่ตามลำดับที่แสดง (ระบบให้ Partial Credit)</div>
        </div>

        <!-- จัดกลุ่ม -->
        <div v-else-if="current.question_type === 'group'" class="group-preview">
          <div class="group-preview-groups">
            <span v-for="(g, gi) in parsedChoices" :key="gi" class="group-preview-chip">{{ g.text }}</span>
          </div>
          <div v-for="(pair, pi) in parsedMatchPairs" :key="pi" class="match-pair">
            <span class="match-left">
              <img v-if="pair.leftImage" :src="fixImg(pair.leftImage)" style="height:32px;border-radius:5px;margin-right:4px;vertical-align:middle" />
              {{ pair.left }}
            </span>
            <span class="match-arrow">→</span>
            <span class="match-right" v-if="showAnswer">{{ parsedChoices[parseInt(pair.right)]?.text || '?' }}</span>
            <span class="match-right" v-else style="color:#94a3b8">?</span>
          </div>
        </div>

        <!-- อัตนัย -->
        <div v-else-if="current.question_type === 'essay'" class="essay-wrap">
          <el-input v-model="ans.text" type="textarea" :rows="4" placeholder="พิมพ์คำตอบที่นี่..." />
          <div v-if="showAnswer && current.correct_answer" class="essay-model-answer">
            <strong>แนวคำตอบ:</strong> {{ current.correct_answer }}
          </div>
        </div>

        <!-- Answer result banner -->
        <div v-if="showAnswer" class="answer-result" :class="resultClass()">
          {{ resultText() }}
        </div>
      </div>
    </div>

    <div v-else class="q-area empty-preview">
      <div style="font-size:48px">📭</div>
      <p>ยังไม่มีข้อสอบ กรุณาเพิ่มข้อสอบก่อน</p>
    </div>

    <!-- Bottom bar -->
    <div class="preview-bottom-bar">
      <el-button :disabled="currentIdx === 0" @click="prev">← ก่อนหน้า</el-button>
      <el-button plain size="small" @click="resetAnswers">🔄 ล้างคำตอบ</el-button>
      <el-button v-if="currentIdx < questions.length - 1" type="primary" @click="next">ถัดไป →</el-button>
      <el-button v-else type="warning" plain @click="$router.back()">✔ กลับแก้ไข</el-button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useExam } from '@/composables/useExam'
import { fixPhotoUrl } from '@/composables/useStudentUpload'

function fixImg(url) { return url ? fixPhotoUrl(url) : '' }

const route = useRoute()
const examId = route.params.id
const { getExamById, getQuestions } = useExam()

const exam = ref(null)
const questions = ref([])
const currentIdx = ref(0)
const showAnswer = ref(false)
const timeLeft = ref(0)
let timerInterval = null

const choiceLabels = ['A','B','C','D','E','F']

// per-question answers: { [id]: { selected: Set<number>|null, text: string } }
const answersMap = reactive({})

const current = computed(() => questions.value[currentIdx.value] || {})

// reactive shortcut to current question's answer
const ans = computed(() => {
  const id = current.value.id
  if (!id) return { selected: new Set(), text: '' }
  if (!answersMap[id]) answersMap[id] = { selected: new Set(), text: '' }
  return answersMap[id]
})

const parsedChoices = computed(() => {
  const c = current.value.choices
  if (!c) return []
  try { return typeof c === 'string' ? JSON.parse(c) : c } catch { return [] }
})

const parsedMatchPairs = computed(() => {
  const m = current.value.match_pairs
  if (!m) return []
  try { return typeof m === 'string' ? JSON.parse(m) : m } catch { return [] }
})

function typeLabel(t) {
  const m = { choice:'ปรนัย', multi:'หลายตัวเลือก', truefalse:'ถูก/ผิด', fill:'เติมคำ', essay:'อัตนัย', match:'จับคู่', group:'จัดกลุ่ม' }
  return m[t] || t
}

function fmtTime(s) {
  if (s <= 0) return '00:00'
  const m = Math.floor(s / 60); const ss = s % 60
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

function goto(i) { currentIdx.value = i }
function prev()  { if (currentIdx.value > 0) currentIdx.value-- }
function next()  { if (currentIdx.value < questions.value.length - 1) currentIdx.value++ }

function initAns(id) {
  if (!answersMap[id]) answersMap[id] = { selected: new Set(), text: '' }
}

function toggleChoice(ci) {
  const id = current.value.id; if (!id) return
  initAns(id)
  if (current.value.question_type === 'choice') {
    answersMap[id].selected = new Set([ci])
  } else {
    const s = answersMap[id].selected
    s.has(ci) ? s.delete(ci) : s.add(ci)
  }
}

// ── Correct answer helpers ──

function correctLetters() {
  const ca = current.value.correct_answer || ''
  return ca.split(',').map(x => x.trim().toUpperCase()).filter(Boolean)
}

function isChoiceCorrect(ci) {
  return correctLetters().includes(choiceLabels[ci])
}

function isChoiceSelected(ci) {
  return ans.value.selected?.has(ci) ?? false
}

function isChoiceWrong(ci) {
  return isChoiceSelected(ci) && !isChoiceCorrect(ci)
}

function isFillMatch() {
  const a = (ans.value.text || '').trim().toLowerCase()
  const m = (current.value.correct_answer || '').trim().toLowerCase()
  return a && m && (a === m || m.includes(a) || a.includes(m))
}

// ── Answer correctness (for score tally) ──

function isCorrect(q) {
  const a = answersMap[q.id]
  if (!a) return false
  const t = q.question_type
  if (t === 'choice') {
    const sel = a.selected?.size ? choiceLabels[[...a.selected][0]] : null
    return sel === (q.correct_answer || '').toUpperCase()
  }
  if (t === 'multi') {
    const selLetters = new Set([...a.selected].map(i => choiceLabels[i]))
    const correctLetters = new Set((q.correct_answer || '').split(',').map(x => x.trim().toUpperCase()))
    return selLetters.size === correctLetters.size && [...selLetters].every(l => correctLetters.has(l))
  }
  if (t === 'truefalse') return a.text === q.correct_answer
  if (t === 'fill') {
    const av = (a.text || '').trim().toLowerCase()
    const mv = (q.correct_answer || '').trim().toLowerCase()
    return av && mv && (av === mv || mv.includes(av) || av.includes(mv))
  }
  return false
}

function isAnswered(q) {
  const a = answersMap[q.id]
  if (!a) return false
  if (['choice','multi'].includes(q.question_type)) return (a.selected?.size ?? 0) > 0
  return !!a.text?.trim()
}

const autoGradeTypes = ['choice','multi','truefalse','fill']

const autoGradeCount = computed(() =>
  questions.value.filter(q => autoGradeTypes.includes(q.question_type)).length
)

const correctCount = computed(() =>
  questions.value.filter(q => autoGradeTypes.includes(q.question_type) && isCorrect(q)).length
)

const totalGained = computed(() =>
  questions.value.reduce((s, q) =>
    autoGradeTypes.includes(q.question_type) && isCorrect(q) ? s + (q.points ?? 1) : s, 0)
)

const totalMax = computed(() => questions.value.reduce((s, q) => s + (q.points ?? 1), 0))

// ── CSS class helpers ──

function qNumClass(i, q) {
  const cls = []
  if (i === currentIdx.value) cls.push('q-current')
  if (isAnswered(q)) cls.push('q-answered')
  if (showAnswer.value && isAnswered(q) && autoGradeTypes.includes(q.question_type)) {
    cls.push(isCorrect(q) ? 'q-correct' : 'q-wrong')
  }
  return cls
}

function mcOptionClass(ci) {
  const selected = isChoiceSelected(ci)
  if (!showAnswer.value) return selected ? 'opt-selected' : ''
  if (isChoiceCorrect(ci)) return 'opt-correct'
  if (isChoiceWrong(ci))   return 'opt-wrong'
  return selected ? 'opt-selected' : ''
}

function tfClass(val) {
  const selected = ans.value.text === val
  if (!showAnswer.value) return selected ? 'tf-selected' : ''
  const correct = val === current.value.correct_answer
  if (selected && correct) return 'tf-correct'
  if (selected && !correct) return 'tf-wrong'
  if (correct) return 'tf-correct-hint'
  return ''
}

function resultClass() {
  const t = current.value.question_type
  if (!autoGradeTypes.includes(t)) return 'result-neutral'
  if (!isAnswered(current.value)) return 'result-neutral'
  return isCorrect(current.value) ? 'result-correct' : 'result-wrong'
}

function resultText() {
  const t = current.value.question_type
  if (t === 'essay') return '📝 อัตนัย: ครูตรวจให้คะแนน'
  if (t === 'match')  return '🔗 จับคู่: ดูเฉลยด้านบน'
  if (t === 'group')  return '🗂️ จัดกลุ่ม: ครูตรวจ (Partial Credit)'
  if (!isAnswered(current.value)) return '— ยังไม่ได้ตอบ —'
  return isCorrect(current.value)
    ? `✅ ถูกต้อง (+${current.value.points ?? 1} คะแนน)`
    : '❌ ผิด (0 คะแนน)'
}

function resetAnswers() {
  for (const q of questions.value) {
    answersMap[q.id] = { selected: new Set(), text: '' }
  }
}

onMounted(async () => {
  const [examRes, qRes] = await Promise.all([getExamById(examId), getQuestions(examId)])
  if (examRes.success) exam.value = examRes.data
  if (qRes.success) {
    questions.value = qRes.data.sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
    for (const q of questions.value) initAns(q.id)
  }
  if (exam.value?.duration_minutes) {
    timeLeft.value = exam.value.duration_minutes * 60
    timerInterval = setInterval(() => { if (timeLeft.value > 0) timeLeft.value-- }, 1000)
  }
})

onUnmounted(() => clearInterval(timerInterval))
</script>

<style scoped>
.preview-shell {
  height: 100dvh; display: flex; flex-direction: column; overflow: hidden; background: #f1f5f9;
}

/* ── Top bar ── */
.preview-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: #1e1b4b; color: #fff;
  flex-shrink: 0; gap: 12px; flex-wrap: wrap;
}
.preview-topbar-left  { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.preview-topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }
.preview-badge {
  background: #f59e0b; color: #fff; font-size: 11px; font-weight: 900;
  border-radius: 6px; padding: 2px 8px; letter-spacing: .5px;
}
.subject-chip {
  background: rgba(255,255,255,.15); border-radius: 8px;
  padding: 3px 10px; font-size: 12px; font-weight: 700;
}
.exam-name { font-size: 13px; font-weight: 600; }
.q-counter { font-size: 12px; color: rgba(255,255,255,.8); }
.score-chip {
  background: #dcfce7; color: #166534; border-radius: 8px;
  padding: 3px 10px; font-size: 12px; font-weight: 700;
}
.timer-box {
  background: rgba(255,255,255,.12); border-radius: 8px; padding: 4px 12px;
  font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: #fde68a;
}

/* ── Strip ── */
.q-strip {
  display: flex; align-items: center; gap: 6px;
  background: #fff; border-bottom: 1px solid #e2e8f0;
  padding: 5px 12px; flex-shrink: 0; overflow-x: auto; height: 44px;
}
.q-num-btn {
  min-width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid #e2e8f0;
  background: #f8fafc; font-size: 12px; font-weight: 700;
  cursor: pointer; color: #475569; transition: all .12s; flex-shrink: 0;
}
.q-num-btn.q-current  { border-color: #7c3aed; background: #ede9fe; color: #5b21b6; }
.q-num-btn.q-answered { border-color: #94a3b8; background: #e2e8f0; color: #334155; }
.q-num-btn.q-correct  { border-color: #22c55e; background: #dcfce7; color: #15803d; }
.q-num-btn.q-wrong    { border-color: #f87171; background: #fee2e2; color: #991b1b; }

/* ── Area ── */
.q-area { flex: 1; overflow-y: auto; padding: 16px 20px 12px; }
.empty-preview {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; color: #64748b; gap: 8px;
}
.q-card {
  background: #fff; border-radius: 16px; padding: 20px 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08); max-width: 800px;
  margin: 0 auto; display: flex; flex-direction: column; gap: 14px;
}
.q-meta-row { display: flex; align-items: center; gap: 10px; }
.q-number { font-size: 13px; color: #94a3b8; font-weight: 700; }
.q-type-badge {
  font-size: 11px; font-weight: 700; background: #ede9fe; color: #5b21b6;
  border-radius: 6px; padding: 2px 8px;
}
.q-points { margin-left: auto; font-size: 12px; font-weight: 700; color: #7c3aed; }
.q-text { font-size: 16px; font-weight: 600; color: #0f172a; line-height: 1.6; white-space: pre-wrap; }
.q-image { max-width: 100%; border-radius: 10px; max-height: 280px; object-fit: contain; background: #f8fafc; }

/* ── MC ── */
.mc-options { display: flex; flex-direction: column; gap: 8px; }
.mc-option {
  display: flex; align-items: center; gap: 12px; padding: 11px 14px;
  border: 2px solid #e2e8f0; border-radius: 12px; cursor: pointer;
  transition: all .12s; background: #f8fafc;
}
.mc-option:hover   { border-color: #a78bfa; background: #f5f3ff; }
.opt-selected      { border-color: #7c3aed; background: #ede9fe; }
.opt-correct       { border-color: #22c55e !important; background: #dcfce7 !important; }
.opt-wrong         { border-color: #f87171 !important; background: #fee2e2 !important; }
.opt-letter {
  width: 26px; height: 26px; border-radius: 50%; background: #e2e8f0;
  color: #475569; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; flex-shrink: 0;
}
.opt-text { flex: 1; font-size: 14px; }
.opt-img  { max-height: 48px; border-radius: 6px; }
.opt-tick, .opt-cross { font-size: 16px; }

/* ── True/False ── */
.tf-options { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.tf-btn {
  flex: 1; min-width: 120px; padding: 14px 20px; border: 2px solid #e2e8f0;
  border-radius: 12px; text-align: center; font-size: 16px; font-weight: 800;
  cursor: pointer; transition: all .12s; background: #f8fafc; color: #475569;
}
.tf-btn:hover    { border-color: #a78bfa; background: #f5f3ff; }
.tf-selected     { border-color: #7c3aed; background: #ede9fe; color: #5b21b6; }
.tf-correct      { border-color: #22c55e; background: #dcfce7; color: #166534; }
.tf-wrong        { border-color: #f87171; background: #fee2e2; color: #991b1b; }
.tf-correct-hint { border-color: #86efac; background: #f0fdf4; color: #166534; }
.tf-answer-hint  { font-size: 13px; color: #475569; font-weight: 600; }

/* ── Fill / Essay / Match ── */
.fill-wrap, .essay-wrap, .match-wrap, .group-preview { display: flex; flex-direction: column; gap: 10px; }
.group-preview-groups { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.group-preview-chip { background: #ede9fe; color: #5b21b6; font-size: 12px; font-weight: 700; border-radius: 8px; padding: 3px 12px; }
.fill-model-answer {
  font-size: 13px; color: #475569; background: #f0fdf4;
  border-radius: 8px; padding: 8px 12px;
}
.fill-match-label { margin-left: 8px; font-weight: 700; }
.match-ok   { color: #16a34a; }
.match-miss { color: #dc2626; }
.essay-model-answer {
  font-size: 13px; color: #475569; background: #fffbeb;
  border-radius: 8px; padding: 8px 12px; border-left: 3px solid #fbbf24;
}
.match-pair { display: flex; align-items: center; gap: 12px; font-size: 14px; padding: 6px 0; }
.match-left  { flex: 1; font-weight: 600; }
.match-arrow { color: #7c3aed; font-weight: 700; }
.match-right { flex: 1; color: #475569; }

/* ── Result banner ── */
.answer-result {
  font-size: 13px; font-weight: 700;
  border-radius: 8px; padding: 8px 14px; text-align: center;
}
.result-correct { background: #dcfce7; color: #15803d; }
.result-wrong   { background: #fee2e2; color: #991b1b; }
.result-neutral { background: #f1f5f9; color: #64748b; }

/* ── Bottom bar ── */
.preview-bottom-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; background: #fff; border-top: 2px solid #e2e8f0; flex-shrink: 0;
}
</style>
