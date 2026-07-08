<template>
  <AppLayout>
    <div class="proctor-page">
      <!-- Header -->
      <div class="proctor-hero">
        <div>
          <el-button text style="color:#fff;margin-bottom:4px" @click="$router.push('/teacher/exams')">← รายการสอบ</el-button>
          <h1 v-if="exam">{{ exam.subject_name }} — {{ exam.title }}</h1>
          <div class="proctor-meta" v-if="exam">
            📅 {{ fmtDate(exam.exam_date) }} &nbsp;
            🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }} &nbsp;
            ⏱ {{ exam.duration_minutes }} นาที
          </div>
        </div>
        <div class="proctor-stats">
          <div class="stat-chip waiting">⏳ รออนุมัติ {{ countByStatus('pending_approval') }}</div>
          <div class="stat-chip active">📝 กำลังสอบ {{ countByStatus('in_progress') }}</div>
          <div class="stat-chip done">✅ ส่งแล้ว {{ countByStatus('submitted') }}</div>
          <div class="stat-chip locked">🔒 ล็อก {{ countByStatus('locked') }}</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="proctor-toolbar">
        <el-button v-if="pendingSessions.length" type="success" @click="approveAll" :loading="approvingAll">
          ✅ อนุมัติทั้งหมด ({{ pendingSessions.length }} คน)
        </el-button>
        <div style="flex:1"></div>
        <el-button plain :loading="refreshing" @click="handleManualRefresh">🔄 รีเฟรช</el-button>
        <el-button plain @click="$router.push(`/teacher/exams/${examId}/grade`)">✏️ ตรวจข้อสอบ</el-button>
        <el-button plain @click="handleDownloadScores">📥 โหลดคะแนน Excel</el-button>
      </div>

      <div v-if="!sessions.length" class="empty-state">
        <div style="font-size:48px">👥</div>
        <p>รอนักเรียนเข้าห้องสอบ...</p>
        <p style="font-size:12px;color:#94a3b8">หน้านี้อัปเดตอัตโนมัติแบบ real-time</p>
      </div>

      <!-- Student grid -->
      <div class="student-grid">
        <div
          v-for="s in sessions" :key="s.id"
          class="student-card"
          :class="[`card-${s.status}`, { 'card-alert': !!violationAlerts[s.id] }]"
        >
          <!-- Violation alert banner (แถบด้านบน ไม่บังชื่อ) -->
          <div v-if="violationAlerts[s.id]" class="vio-alert-banner">
            <span class="vio-alert-icon">🚨</span>
            <span class="vio-alert-text">ตรวจพบทุจริต {{ s.violation_count }} ครั้ง!</span>
            <button class="vio-alert-close" @click.stop="dismissAlert(s.id)">✕</button>
          </div>

          <div class="card-photo-wrap">
            <img v-if="s.photo_url" :src="fixPhoto(s.photo_url)" class="card-photo" @error="e => e.target.style.display='none'" />
            <div v-else class="card-photo-placeholder">{{ initials(s) }}</div>
            <div class="card-status-dot" :class="`dot-${s.status}`"></div>
          </div>
          <div class="card-info">
            <div class="card-seat" v-if="s.seat_number">เลขที่ {{ s.seat_number }}</div>
            <div class="card-name">{{ s.display_name }}</div>
            <div class="card-class">ห้อง {{ s.class_id }}</div>
            <div class="card-status-label" :class="`label-${s.status}`">{{ statusLabel(s) }}</div>
            <div v-if="s.violation_count > 0" class="card-violation" :class="{ 'violation-danger': s.violation_count >= exam?.violation_limit }">
              ⚠️ ทุจริต {{ s.violation_count }} ครั้ง
            </div>
            <div v-if="s.status === 'submitted'" class="card-score">
              คะแนน {{ s.score ?? '-' }} / {{ s.max_score ?? '-' }}
            </div>
            <div v-if="(s.attempt_number || 1) > 1" class="card-attempt">ครั้งที่ {{ s.attempt_number }}</div>
          </div>
          <div class="card-actions">
            <!-- pending: อนุมัติ -->
            <el-button
              v-if="s.status === 'pending_approval'"
              type="success" size="small"
              :loading="approvingId === s.id"
              @click="handleApprove(s)"
            >✅ อนุมัติ</el-button>

            <!-- in_progress: ล็อก -->
            <el-button
              v-if="s.status === 'in_progress'"
              type="danger" size="small" plain
              :loading="lockingId === s.id"
              @click="handleLock(s)"
            >🔒 ล็อก</el-button>

            <!-- locked: ปลดล็อก + สอบใหม่ -->
            <template v-if="s.status === 'locked'">
              <el-button
                type="success" size="small"
                :loading="unlockingId === s.id"
                @click="handleUnlock(s)"
              >🔓 ปลดล็อก</el-button>
              <el-button
                type="warning" size="small" plain
                :loading="retakingId === s.id"
                @click="handleRetake(s)"
              >🔄 สอบใหม่</el-button>
            </template>

            <!-- submitted: สอบใหม่ -->
            <el-button
              v-if="s.status === 'submitted'"
              type="info" size="small" plain
              :loading="retakingId === s.id"
              @click="handleRetake(s)"
            >🔄 สอบใหม่</el-button>

            <!-- ลบผลสอบ (ทุก status) -->
            <el-button
              type="danger" size="small" plain
              :loading="deletingId === s.id"
              @click="handleDeleteSession(s)"
            >🗑️ ลบ</el-button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useExam } from '@/composables/useExam'
import { useExamExcel } from '@/composables/useExamExcel'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/supabase/client'
import { fixPhotoUrl } from '@/composables/useStudentUpload'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { getExamById, getQuestions, getSessions, approveSession, lockSession, unlockSession, allowRetake, deleteSession } = useExam()
const { exportScores } = useExamExcel()

const examId = route.params.id
const exam = ref(null)
const questions = ref([])
const sessions = ref([])
const approvingId = ref(null)
const approvingAll = ref(false)
const lockingId = ref(null)
const unlockingId = ref(null)
const retakingId = ref(null)
const deletingId = ref(null)
const violationAlerts = ref({})   // { [sessionId]: true }  — ไม่มี timer แล้ว
const refreshing = ref(false)
let realtimeChannel = null
let pollInterval = null

const pendingSessions = computed(() => sessions.value.filter(s => s.status === 'pending_approval'))
const countByStatus = (st) => sessions.value.filter(s => s.status === st).length

function fixPhoto(url) { return fixPhotoUrl(url) }
function initials(s) {
  if (s.first_name) return (s.first_name || '?').slice(0, 2)
  return (s.student_name || s.student_code || '?').slice(0, 2)
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '' }

function statusLabel(s) {
  const m = { pending_approval: '⏳ รออนุมัติ', in_progress: '📝 กำลังสอบ', submitted: '✅ ส่งแล้ว', locked: '🔒 ถูกล็อก' }
  return m[s.status] || s.status
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getShuffledIds() {
  const ids = questions.value.map(q => q.id)
  return exam.value?.shuffle_questions ? shuffleArray(ids) : ids
}

async function handleApprove(session) {
  approvingId.value = session.id
  const res = await approveSession(session.id, authStore.profile?.uid || 'proctor', getShuffledIds())
  if (res.success) ElMessage.success(`อนุมัติ ${session.student_name} แล้ว`)
  else ElMessage.error(res.error)
  approvingId.value = null
}

async function approveAll() {
  approvingAll.value = true
  for (const s of pendingSessions.value) {
    await approveSession(s.id, authStore.profile?.uid || 'proctor', getShuffledIds())
  }
  ElMessage.success(`อนุมัติ ${pendingSessions.value.length} คนแล้ว`)
  approvingAll.value = false
}

async function handleLock(session) {
  lockingId.value = session.id
  const res = await lockSession(session.id, authStore.profile?.uid || 'proctor')
  if (res.success) ElMessage.warning(`ล็อก ${session.student_name} แล้ว`)
  else ElMessage.error(res.error)
  lockingId.value = null
}

async function handleUnlock(session) {
  unlockingId.value = session.id
  const res = await unlockSession(session.id)
  if (res.success) ElMessage.success(`ปลดล็อก ${session.display_name || session.student_name} แล้ว — นักเรียนสอบต่อได้`)
  else ElMessage.error(res.error)
  unlockingId.value = null
}

async function handleRetake(session) {
  const name = session.display_name || session.student_name || session.student_code
  const nextAttempt = (session.attempt_number || 1) + 1
  try {
    await ElMessageBox.confirm(
      `เปิดให้ ${name} สอบใหม่ครั้งที่ ${nextAttempt}?\nนักเรียนจะต้องรออนุมัติอีกครั้งก่อนเริ่มสอบ`,
      'ยืนยันเปิดสอบใหม่',
      { confirmButtonText: '🔄 เปิดสอบใหม่', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
  } catch { return }
  retakingId.value = session.id
  const res = await allowRetake(session.id)
  retakingId.value = null
  if (res.success) ElMessage.success(`${name} สอบใหม่ได้แล้ว (ครั้งที่ ${nextAttempt}) — รอนักเรียนเข้าห้องสอบ`)
  else ElMessage.error(res.error)
}

async function handleDeleteSession(session) {
  const name = session.display_name || session.student_name || session.student_code
  const attempt = session.attempt_number > 1 ? ` (ครั้งที่ ${session.attempt_number})` : ''
  try {
    await ElMessageBox.confirm(
      `ลบผลสอบของ ${name}${attempt} ออกจากระบบ?\nข้อมูลจะหายถาวร ไม่สามารถกู้คืนได้`,
      'ยืนยันลบผลสอบ',
      { confirmButtonText: '🗑️ ลบ', cancelButtonText: 'ยกเลิก', type: 'error' }
    )
  } catch { return }
  deletingId.value = session.id
  const res = await deleteSession(session.id)
  deletingId.value = null
  if (res.success) {
    sessions.value = sessions.value.filter(s => s.id !== session.id)
    ElMessage.success(`ลบผลสอบของ ${name}${attempt} แล้ว`)
  } else ElMessage.error(res.error)
}

function handleDownloadScores() {
  exportScores(sessions.value, questions.value, exam.value?.title || 'ข้อสอบ')
}

function triggerViolationAlert(sessionId) {
  violationAlerts.value = { ...violationAlerts.value, [sessionId]: true }
}

function dismissAlert(sessionId) {
  const alerts = { ...violationAlerts.value }
  delete alerts[sessionId]
  violationAlerts.value = alerts
}

function updateSession(updated) {
  const idx = sessions.value.findIndex(s => s.id === updated.id)
  if (idx >= 0) {
    const prev = sessions.value[idx]
    // ตรวจจับการทุจริตใหม่
    if ((updated.violation_count || 0) > (prev.violation_count || 0)) {
      triggerViolationAlert(updated.id)
    }
    // ปิด alert อัตโนมัติเมื่อนักเรียนกลับเข้าสอบหรือครูล็อก/ส่งแล้ว
    const autoClose = ['locked', 'submitted']
    if (autoClose.includes(updated.status) && violationAlerts.value[updated.id]) {
      dismissAlert(updated.id)
    }
    sessions.value[idx] = { ...prev, ...updated }
  } else {
    sessions.value.push(updated)
  }
}

function subscribeRealtime() {
  realtimeChannel = supabase
    .channel(`proctor-${examId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_sessions', filter: `exam_id=eq.${examId}` },
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') updateSession(payload.new)
      })
    .subscribe()
}

async function refreshSessions() {
  const res = await getSessions(examId)
  if (res.success) {
    for (const s of res.data) updateSession(s)
  }
}

async function handleManualRefresh() {
  refreshing.value = true
  const [examRes, sessionsRes] = await Promise.all([
    getExamById(examId), getSessions(examId),
  ])
  if (examRes.success) exam.value = examRes.data
  if (sessionsRes.success) {
    // sync list: add/update; remove sessions deleted from DB
    const dbIds = new Set(sessionsRes.data.map(s => s.id))
    sessions.value = sessions.value.filter(s => dbIds.has(s.id))
    for (const s of sessionsRes.data) updateSession(s)
  }
  refreshing.value = false
  ElMessage.success('โหลดข้อมูลใหม่แล้ว')
}

onMounted(async () => {
  const [examRes, questionsRes, sessionsRes] = await Promise.all([
    getExamById(examId), getQuestions(examId), getSessions(examId)
  ])
  if (examRes.success) exam.value = examRes.data
  if (questionsRes.success) questions.value = questionsRes.data
  if (sessionsRes.success) sessions.value = sessionsRes.data
  subscribeRealtime()
  // polling fallback every 4s in case Realtime subscription doesn't fire
  pollInterval = setInterval(refreshSessions, 4000)
})

onUnmounted(() => {
  realtimeChannel?.unsubscribe()
  clearInterval(pollInterval)
})
</script>

<style scoped>
.proctor-page { padding: 20px; }
.proctor-hero {
  background: linear-gradient(135deg,#1e1b4b,#4c1d95);
  border-radius: 18px; padding: 22px 24px; color: #fff;
  display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px;
}
.proctor-hero h1 { margin: 0; font-size: 20px; font-weight: 800; }
.proctor-meta { font-size: 12px; opacity: .8; margin-top: 4px; }
.proctor-stats { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.stat-chip { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-align: center; }
.stat-chip.waiting { background: #fef3c7; color: #92400e; }
.stat-chip.active { background: #dcfce7; color: #166534; }
.stat-chip.done { background: #dbeafe; color: #1e40af; }
.stat-chip.locked { background: #fee2e2; color: #991b1b; }
.proctor-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.empty-state { text-align: center; padding: 60px; color: #64748b; }
.student-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.student-card {
  position: relative;
  background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 16px;
  display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
  transition: border-color .2s;
}
.card-pending_approval { border-color: #fcd34d; }
.card-in_progress { border-color: #86efac; }
.card-submitted { border-color: #93c5fd; }
.card-locked { border-color: #fca5a5; background: #fff5f5; }
.card-photo-wrap { position: relative; }
.card-photo { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; }
.card-photo-placeholder {
  width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg,#7c3aed,#a855f7);
  color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800;
}
.card-status-dot {
  position: absolute; bottom: 2px; right: 2px;
  width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff;
}
.dot-pending_approval { background: #f59e0b; }
.dot-in_progress { background: #22c55e; }
.dot-submitted { background: #3b82f6; }
.dot-locked { background: #ef4444; }
.card-seat { font-size: 10px; font-weight: 900; color: #7c3aed; background: #ede9fe; border-radius: 6px; padding: 1px 7px; }
.card-name { font-weight: 700; font-size: 13px; color: #0f172a; }
.card-class { font-size: 11px; color: #64748b; }
.card-status-label { font-size: 12px; font-weight: 600; }
.label-pending_approval { color: #b45309; }
.label-in_progress { color: #166534; }
.label-submitted { color: #1e40af; }
.label-locked { color: #991b1b; }
.card-violation { font-size: 11px; color: #dc2626; font-weight: 700; }
.violation-danger { animation: pulse-red 1s ease-in-out infinite; }
.card-score { font-size: 13px; font-weight: 700; color: #0284c7; }
.card-attempt { font-size: 10px; font-weight: 800; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 1px 7px; }
.card-actions { display: flex; flex-direction: column; gap: 5px; width: 100%; }

/* ── Violation alert ───────────────────────────────────────────── */
.card-alert {
  animation: card-flash 0.7s ease-in-out infinite alternate;
  border-color: #ef4444 !important;
}
@keyframes card-flash {
  from { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  to   { box-shadow: 0 0 16px 5px rgba(239,68,68,0.5); }
}

/* แถบแจ้งเตือนด้านบนการ์ด — ไม่บังชื่อ/รูป */
.vio-alert-banner {
  width: calc(100% + 32px); margin: -16px -16px 8px -16px;
  background: #dc2626; border-radius: 14px 14px 0 0;
  display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  animation: banner-blink 0.5s ease-in-out infinite alternate;
}
.vio-alert-icon { font-size: 15px; flex-shrink: 0; }
.vio-alert-text {
  flex: 1; font-size: 12px; font-weight: 800; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vio-alert-close {
  background: rgba(255,255,255,0.25); border: none; border-radius: 50%;
  width: 20px; height: 20px; font-size: 11px; color: #fff; font-weight: 900;
  cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.vio-alert-close:hover { background: rgba(255,255,255,0.45); }
@keyframes banner-blink {
  from { background: #dc2626; }
  to   { background: #991b1b; }
}

@keyframes pulse-red {
  0%,100% { color: #dc2626; }
  50% { color: #f87171; }
}
</style>
