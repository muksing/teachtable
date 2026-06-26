<template>
  <div class="exam-list">
    <h2 class="section-title">📋 ตารางสอบ</h2>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>กำลังโหลด...</p>
    </div>

    <template v-else>
      <!-- Tab bar -->
      <div class="tab-bar">
        <button
          v-for="tab in tabs" :key="tab.key"
          class="tab-btn"
          :class="{ 'tab-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="tab-label">{{ tab.icon }} {{ tab.label }}</span>
          <span v-if="tabCount(tab.key)" class="tab-count">{{ tabCount(tab.key) }}</span>
        </button>
      </div>

      <!-- กำลังเปิดสอบ -->
      <template v-if="activeTab === 'open'">
        <div v-if="!openExams.length" class="empty-state">
          <div class="empty-icon">📭</div>
          <p>ไม่มีการสอบที่เปิดอยู่ตอนนี้</p>
        </div>
        <div v-else class="exam-cards">
          <div v-for="exam in openExams" :key="exam.id" class="exam-card" :class="`card-${cardState(exam)}`">
            <div class="state-strip" :class="`strip-${cardState(exam)}`">
              <span class="strip-icon">{{ stateIcon(exam) }}</span>
              <span class="strip-label">{{ stateLabel(exam) }}</span>
              <span v-if="mySession(exam.id)?.score != null && mySession(exam.id)?.status === 'submitted'"
                class="strip-score">{{ mySession(exam.id).score }}/{{ mySession(exam.id).max_score }} คะแนน</span>
            </div>
            <div class="card-body">
              <div class="subject-chip">{{ exam.subject_name }}</div>
              <div class="exam-title">{{ exam.title }}</div>
              <div class="exam-info">
                <span>📅 {{ fmtDate(exam.exam_date) }}</span>
                <span>🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}</span>
                <span>⏱ {{ exam.duration_minutes }} นาที</span>
              </div>
            </div>
            <div class="card-foot">
              <el-button
                v-if="canEnter(exam)"
                type="primary" style="width:100%"
                @click="$router.push(`/student/exams/${exam.id}`)"
              >{{ mySession(exam.id) ? '▶ เข้าห้องสอบต่อ' : '▶ เข้าห้องสอบ' }}</el-button>

              <el-button
                v-else-if="mySession(exam.id)?.status === 'in_progress'"
                type="success" style="width:100%"
                @click="$router.push(`/student/exams/${exam.id}`)"
              >📝 ทำข้อสอบต่อ</el-button>

              <div v-else-if="mySession(exam.id)?.status === 'pending_approval'" class="foot-wait">
                <span class="pulse-dot"></span>
                <span>รอครูอนุมัติ</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- กำลังจะมาถึง -->
      <template v-else-if="activeTab === 'upcoming'">
        <div v-if="!upcomingExams.length" class="empty-state">
          <div class="empty-icon">🗓</div>
          <p>ไม่มีการสอบที่กำลังจะมาถึง</p>
        </div>
        <div v-else class="exam-cards">
          <div v-for="exam in upcomingExams" :key="exam.id" class="exam-card card-upcoming">
            <div class="state-strip strip-upcoming">
              <span class="strip-icon">🕐</span>
              <span class="strip-label">เริ่มสอบใน</span>
              <span class="strip-countdown">{{ countdownText(exam) }}</span>
            </div>
            <div class="card-body">
              <div class="subject-chip chip-upcoming">{{ exam.subject_name }}</div>
              <div class="exam-title">{{ exam.title }}</div>
              <div class="exam-info">
                <span>📅 {{ fmtDate(exam.exam_date) }}</span>
                <span>🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}</span>
                <span>⏱ {{ exam.duration_minutes }} นาที</span>
              </div>
            </div>
            <div class="card-foot">
              <div class="foot-wait foot-upcoming">
                <span class="pulse-dot dot-purple"></span>
                <span>รอถึงเวลา {{ exam.start_time?.slice(0,5) }} น.</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ประวัติการสอบ -->
      <template v-else-if="activeTab === 'history'">
        <div v-if="!historyExams.length" class="empty-state">
          <div class="empty-icon">📜</div>
          <p>ยังไม่มีประวัติการสอบ</p>
        </div>
        <div v-else class="exam-cards">
          <div v-for="exam in historyExams" :key="exam.id" class="history-card">
            <div class="history-header">
              <span class="subject-chip chip-history">{{ exam.subject_name }}</span>
              <span class="history-date">📅 {{ fmtDate(exam.exam_date) }}</span>
            </div>
            <div class="history-body">
              <div class="exam-title">{{ exam.title }}</div>
              <div class="exam-info">
                <span>🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}</span>
                <span>⏱ {{ exam.duration_minutes }} นาที</span>
              </div>

              <!-- ส่งแล้ว: แสดงคะแนน -->
              <div v-if="mySession(exam.id)?.status === 'submitted'" class="score-row">
                <template v-if="mySession(exam.id).score != null">
                  <div class="score-block">
                    <span class="score-num">{{ mySession(exam.id).score }}</span>
                    <span class="score-sep">/</span>
                    <span class="score-max">{{ mySession(exam.id).max_score }}</span>
                    <span class="score-unit">คะแนน</span>
                  </div>
                  <div class="score-pct-chip" :class="pctClass(mySession(exam.id))">
                    {{ Math.round((mySession(exam.id).score / mySession(exam.id).max_score) * 100) }}%
                  </div>
                </template>
                <div v-else class="score-pending">⏳ รอครูตรวจคะแนน</div>
              </div>

              <!-- ไม่มี session / หมดเวลา -->
              <div v-else class="ended-label">🏁 หมดเวลาสอบ</div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useExam } from '@/composables/useExam'
import { useStudentStore } from '@/stores/student'

const router = useRouter()
const studentStore = useStudentStore()
const { getExamsForStudent, getMySession } = useExam()

const loading = ref(false)
const exams = ref([])
const sessions = ref({})
let timer = null

const activeTab = ref('open')
const tabs = [
  { key: 'open',     icon: '🟢', label: 'กำลังเปิดสอบ' },
  { key: 'upcoming', icon: '🕐', label: 'กำลังจะมาถึง' },
  { key: 'history',  icon: '📜', label: 'ประวัติการสอบ' },
]

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : ''
}

function getWindow(exam) {
  const base = new Date(exam.exam_date)
  const [sh, sm] = (exam.start_time || '00:00').split(':')
  const [eh, em] = (exam.end_time   || '23:59').split(':')
  const start = new Date(base); start.setHours(+sh, +sm, 0)
  const end   = new Date(base); end.setHours(+eh, +em, 0)
  return { start, end }
}

function timeStatus(exam) {
  const now = new Date(); const { start, end } = getWindow(exam)
  if (now < start) return 'upcoming'
  if (now > end)   return 'ended'
  return 'open'
}

function mySession(examId) { return sessions.value[examId] || null }

function cardState(exam) {
  const sess = mySession(exam.id)
  if (sess?.status === 'locked')           return 'locked'
  if (sess?.status === 'submitted')        return 'submitted'
  if (sess?.status === 'in_progress')      return 'active'
  if (sess?.status === 'pending_approval') return 'pending'
  return timeStatus(exam)
}

function stateIcon(exam) {
  const m = { locked:'🔒', submitted:'✅', active:'📝', pending:'⏳', open:'🟢', ended:'🏁', upcoming:'🕐' }
  return m[cardState(exam)] || ''
}

function stateLabel(exam) {
  const m = {
    locked:'ถูกล็อก', submitted:'ส่งแล้ว', active:'กำลังสอบอยู่',
    pending:'รอครูอนุมัติ', open:'เปิดสอบแล้ว', ended:'หมดเวลา', upcoming:'กำลังจะมาถึง',
  }
  return m[cardState(exam)] || ''
}

function canEnter(exam) {
  if (timeStatus(exam) !== 'open') return false
  const sess = mySession(exam.id)
  return !sess || sess.status === 'pending_approval'
}

function countdownText(exam) {
  const { start } = getWindow(exam)
  const diff = start - new Date()
  if (diff <= 0) return ''
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h} ชม. ${m} นาที`
  if (m > 0) return `${m} นาที ${s} วิ`
  return `${s} วินาที`
}

function pctClass(sess) {
  const pct = Math.round((sess.score / sess.max_score) * 100)
  if (pct >= 80) return 'pct-great'
  if (pct >= 60) return 'pct-ok'
  return 'pct-low'
}

// ── Tab grouping ──

const openExams = computed(() =>
  exams.value.filter(e => {
    if (timeStatus(e) !== 'open') return false
    return mySession(e.id)?.status !== 'submitted'
  })
)

const upcomingExams = computed(() =>
  exams.value.filter(e => timeStatus(e) === 'upcoming')
)

const historyExams = computed(() =>
  exams.value
    .filter(e => timeStatus(e) === 'ended' || mySession(e.id)?.status === 'submitted')
    .sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || ''))
)

function tabCount(key) {
  if (key === 'open')     return openExams.value.length || null
  if (key === 'upcoming') return upcomingExams.value.length || null
  if (key === 'history')  return historyExams.value.length || null
  return null
}

async function load() {
  loading.value = true
  const schoolId    = studentStore.session?.school_id
  const classId     = studentStore.session?.class_id
  const studentCode = studentStore.session?.student_code
  const res = await getExamsForStudent(schoolId, classId)
  if (res.success) {
    exams.value = res.data
    for (const exam of res.data) {
      const sr = await getMySession(exam.id, studentCode)
      if (sr.success && sr.data) sessions.value[exam.id] = sr.data
    }
    // auto-switch tab
    if (openExams.value.length)     activeTab.value = 'open'
    else if (upcomingExams.value.length) activeTab.value = 'upcoming'
    else activeTab.value = 'history'
  }
  loading.value = false
}

onMounted(() => {
  load()
  timer = setInterval(() => { exams.value = [...exams.value] }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.exam-list { padding: 16px; }
.section-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 14px; }

/* Loading */
.loading-state { display: flex; flex-direction: column; align-items: center; padding: 48px; color: #64748b; gap: 12px; }
.spinner {
  width: 32px; height: 32px; border: 3px solid #e2e8f0;
  border-top-color: #7c3aed; border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Tabs */
.tab-bar {
  display: flex; gap: 4px; margin-bottom: 16px;
  background: #f1f5f9; border-radius: 14px; padding: 4px;
}
.tab-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 9px 6px; border-radius: 10px; border: none;
  background: transparent; font-size: 12px; font-weight: 700;
  color: #64748b; cursor: pointer; transition: all .15s;
}
.tab-btn:hover { background: rgba(124,58,237,.08); color: #5b21b6; }
.tab-active { background: #fff !important; color: #5b21b6 !important; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
.tab-label { white-space: nowrap; }
.tab-count {
  background: #7c3aed; color: #fff; font-size: 10px; font-weight: 900;
  border-radius: 10px; padding: 1px 7px; min-width: 18px; text-align: center;
}

/* Cards grid */
.exam-cards { display: flex; flex-direction: column; gap: 12px; }
.empty-state { text-align: center; padding: 48px 24px; color: #94a3b8; }
.empty-icon  { font-size: 40px; margin-bottom: 8px; }
.empty-state p { font-size: 14px; margin: 0; }

/* Base card */
.exam-card {
  background: #fff; border-radius: 16px; border: 2px solid #e2e8f0;
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.card-open      { border-color: #4ade80; }
.card-active    { border-color: #16a34a; box-shadow: 0 0 0 3px #bbf7d070; }
.card-pending   { border-color: #fbbf24; }
.card-submitted { border-color: #60a5fa; }
.card-locked    { border-color: #f87171; }
.card-upcoming  { border-color: #c4b5fd; border-style: dashed; }
.card-ended     { border-color: #e2e8f0; }

/* State strip */
.state-strip {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; font-size: 12px; font-weight: 700; flex-wrap: wrap;
}
.strip-open      { background: #dcfce7; color: #15803d; }
.strip-active    { background: #bbf7d0; color: #14532d; }
.strip-pending   { background: #fef3c7; color: #92400e; }
.strip-submitted { background: #dbeafe; color: #1e40af; }
.strip-locked    { background: #fee2e2; color: #991b1b; }
.strip-upcoming  { background: #ede9fe; color: #5b21b6; }
.strip-ended     { background: #f3f4f6; color: #6b7280; }
.strip-icon  { font-size: 15px; }
.strip-label { flex-shrink: 0; }
.strip-score { margin-left: auto; font-weight: 800; font-size: 13px; }
.strip-countdown { font-weight: 900; color: #5b21b6; }

/* Card body */
.card-body { padding: 12px 14px 6px; display: flex; flex-direction: column; gap: 7px; }
.subject-chip {
  display: inline-block; align-self: flex-start;
  font-size: 11px; font-weight: 800; border-radius: 8px; padding: 3px 11px;
  background: linear-gradient(135deg,#7c3aed,#a855f7); color: #fff;
}
.chip-upcoming { background: linear-gradient(135deg,#6d28d9,#7c3aed) !important; }
.chip-history  { background: linear-gradient(135deg,#475569,#64748b) !important; }
.exam-title { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.3; }
.exam-info  { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #64748b; }

/* Card foot */
.card-foot { padding: 10px 14px 14px; }
.foot-wait {
  display: flex; align-items: center; gap: 9px;
  background: #f5f3ff; border-radius: 10px; padding: 10px 14px;
  font-size: 13px; font-weight: 700; color: #6d28d9;
}
.foot-upcoming { background: #f5f3ff; color: #5b21b6; }
.pulse-dot {
  width: 10px; height: 10px; border-radius: 50%; background: #22c55e; flex-shrink: 0;
  animation: pulse 1.4s ease-in-out infinite;
}
.dot-purple { background: #7c3aed; }
@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.35);opacity:.55} }

/* History card */
.history-card {
  background: #fff; border: 2px solid #e2e8f0; border-radius: 16px;
  overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.history-header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  background: #f8fafc; padding: 10px 14px; border-bottom: 1px solid #f1f5f9;
}
.history-date { font-size: 12px; color: #64748b; }
.history-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px; }

/* Score */
.score-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.score-block { display: flex; align-items: baseline; gap: 4px; }
.score-num  { font-size: 34px; font-weight: 900; color: #0f172a; line-height: 1; }
.score-sep  { font-size: 20px; color: #94a3b8; }
.score-max  { font-size: 18px; font-weight: 700; color: #475569; }
.score-unit { font-size: 13px; color: #64748b; margin-left: 2px; }
.score-pct-chip {
  font-size: 14px; font-weight: 900; border-radius: 10px; padding: 4px 14px;
}
.pct-great { background: #dcfce7; color: #15803d; }
.pct-ok    { background: #fef9c3; color: #854d0e; }
.pct-low   { background: #fee2e2; color: #991b1b; }
.score-pending { font-size: 13px; font-weight: 700; color: #92400e; background: #fef3c7; border-radius: 8px; padding: 6px 12px; }
.ended-label   { font-size: 12px; font-weight: 700; color: #9ca3af; background: #f3f4f6; border-radius: 8px; padding: 6px 12px; }
</style>
