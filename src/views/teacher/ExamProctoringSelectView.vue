<template>
  <AppLayout>
    <div class="proctor-select-page">

      <!-- Hero -->
      <div class="page-hero">
        <div>
          <h1>👁 คุมสอบ</h1>
          <p>เลือกห้องเรียนที่ต้องการเข้าคุมสอบ</p>
        </div>
        <el-button v-if="selectedClass" text style="color:#fff" @click="selectedClass = ''">
          ← เปลี่ยนห้อง
        </el-button>
      </div>

      <div v-if="loading" class="loading-box">กำลังโหลด...</div>

      <!-- Step 1: เลือกห้อง -->
      <template v-else-if="!selectedClass">
        <div class="step-label">เลือกห้องเรียน</div>
        <div v-if="!classes.length" class="empty-box">ไม่พบห้องเรียน</div>
        <div v-else class="class-grid">
          <div
            v-for="c in classes" :key="c"
            class="class-card"
            @click="selectClass(c)"
          >
            <div class="class-name">{{ c }}</div>
            <div class="class-exam-count" v-if="examCountByClass[c]">
              {{ examCountByClass[c] }} วิชา
            </div>
          </div>
        </div>
      </template>

      <!-- Step 2: วิชาของห้องที่เลือก -->
      <template v-else>
        <div class="room-header">
          <div class="room-badge">ห้อง {{ selectedClass }}</div>
          <div class="room-sub">คลิกวิชาที่ต้องการเข้าคุมสอบ</div>
        </div>

        <div v-if="!roomExams.length" class="empty-box">
          ไม่พบข้อสอบสำหรับห้อง {{ selectedClass }}
        </div>

        <div v-else class="exam-cards">
          <div
            v-for="exam in roomExams"
            :key="exam.id"
            class="exam-card"
            :class="cardClass(exam)"
          >
            <!-- State banner -->
            <div class="card-banner" :class="bannerClass(exam)">
              <span class="banner-icon">{{ bannerIcon(exam) }}</span>
              <span class="banner-label">{{ bannerLabel(exam) }}</span>
              <span v-if="!isActive(exam) && !isEnded(exam)" class="banner-countdown">
                {{ countdownText(exam) }}
              </span>
              <div v-if="isActive(exam)" class="live-dot-wrap">
                <span class="live-dot"></span><span class="live-text">LIVE</span>
              </div>
            </div>

            <!-- Body -->
            <div class="card-body">
              <div class="subject-badge" :class="badgeClass(exam)">{{ exam.subject_name }}</div>
              <div class="exam-title">{{ exam.title }}</div>
              <div class="exam-meta">
                <span>📅 {{ fmtDate(exam.exam_date) }}</span>
                <span>🕐 {{ exam.start_time?.slice(0,5) }} – {{ exam.end_time?.slice(0,5) }}</span>
                <span>⏱ {{ exam.duration_minutes }} นาที</span>
              </div>

              <!-- Session counts -->
              <div class="session-row" v-if="counts[exam.id]">
                <span class="cnt pending">⏳ รอ {{ counts[exam.id].pending }}</span>
                <span class="cnt active">📝 สอบ {{ counts[exam.id].active }}</span>
                <span class="cnt done">✅ ส่ง {{ counts[exam.id].done }}</span>
                <span class="cnt locked" v-if="counts[exam.id].locked">🔒 ล็อก {{ counts[exam.id].locked }}</span>
              </div>
            </div>

            <!-- Action button -->
            <div class="card-foot">
              <el-button
                v-if="isActive(exam)"
                type="primary" style="width:100%"
                @click="$router.push(`/teacher/exams/${exam.id}/proctor`)"
              >👁 เข้าคุมสอบ</el-button>

              <el-button
                v-else-if="isEnded(exam)"
                plain style="width:100%"
                @click="$router.push(`/teacher/exams/${exam.id}/proctor`)"
              >📊 ดูผลสอบ / ตรวจ</el-button>

              <div v-else class="upcoming-foot">
                <div class="upcoming-pulse-wrap">
                  <span class="upcoming-dot"></span>
                  <span>ยังไม่ถึงเวลา</span>
                </div>
                <el-button plain size="small" @click="$router.push(`/teacher/exams/${exam.id}/proctor`)">
                  เข้าห้องรอ
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useExam } from '@/composables/useExam'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/supabase/client'

const authStore = useAuthStore()
const { getExams } = useExam()

const loading = ref(false)
const allExams = ref([])
const classes = ref([])
const selectedClass = ref('')
const counts = ref({})
let timer = null

// exams for selected room, sorted: active first → upcoming → ended
const roomExams = computed(() => {
  if (!selectedClass.value) return []
  const now = new Date()
  return allExams.value
    .filter(e => e.class_ids.includes(selectedClass.value))
    .sort((a, b) => {
      const wa = getWindow(a); const wb = getWindow(b)
      const aActive = now >= wa.start && now <= wa.end
      const bActive = now >= wb.start && now <= wb.end
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      return (a.exam_date || '').localeCompare(b.exam_date || '')
    })
})

// count exams per class
const examCountByClass = computed(() => {
  const map = {}
  for (const e of allExams.value) {
    for (const c of e.class_ids) {
      map[c] = (map[c] || 0) + 1
    }
  }
  return map
})

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
}

function getWindow(exam) {
  const base = new Date(exam.exam_date)
  const [sh, sm] = (exam.start_time || '00:00').split(':')
  const [eh, em] = (exam.end_time || '23:59').split(':')
  const start = new Date(base); start.setHours(+sh, +sm, 0)
  const end   = new Date(base); end.setHours(+eh, +em, 0)
  return { start, end }
}

function isActive(exam) {
  const now = new Date(); const { start, end } = getWindow(exam)
  return now >= start && now <= end
}

function isEnded(exam) {
  const now = new Date(); const { end } = getWindow(exam)
  return now > end
}

function statusType(exam) {
  if (isActive(exam)) return 'success'
  if (isEnded(exam))  return 'warning'
  return 'info'
}

function statusLabel(exam) {
  if (isActive(exam)) return '🟢 กำลังสอบ'
  if (isEnded(exam))  return 'สอบเสร็จแล้ว'
  return 'ยังไม่ถึงเวลา'
}

function cardClass(exam) {
  if (isActive(exam)) return 'card-active'
  if (isEnded(exam))  return 'card-ended'
  return 'card-upcoming'
}

function bannerClass(exam) {
  if (isActive(exam)) return 'banner-active'
  if (isEnded(exam))  return 'banner-ended'
  return 'banner-upcoming'
}

function bannerIcon(exam) {
  if (isActive(exam)) return '🟢'
  if (isEnded(exam))  return '🏁'
  return '🕐'
}

function bannerLabel(exam) {
  if (isActive(exam)) return 'กำลังสอบอยู่'
  if (isEnded(exam))  return 'สอบเสร็จแล้ว'
  return 'เริ่มสอบใน'
}

function badgeClass(exam) {
  if (isActive(exam)) return 'badge-active'
  if (isEnded(exam))  return 'badge-ended'
  return 'badge-upcoming'
}

function countdownText(exam) {
  const { start } = getWindow(exam)
  const diff = start - new Date()
  if (diff <= 0) return '0'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h} ชม. ${m} นาที`
  if (m > 0) return `${m} นาที ${s} วิ`
  return `${s} วินาที`
}

function selectClass(c) {
  selectedClass.value = c
  loadSessionCounts()
}

async function loadSessionCounts() {
  const ids = roomExams.value.map(e => e.id)
  if (!ids.length) return
  const { data } = await supabase.from('exam_sessions').select('exam_id, status').in('exam_id', ids)
  if (!data) return
  const map = {}
  for (const s of data) {
    if (!map[s.exam_id]) map[s.exam_id] = { pending: 0, active: 0, done: 0, locked: 0 }
    if (s.status === 'pending_approval') map[s.exam_id].pending++
    else if (s.status === 'in_progress')  map[s.exam_id].active++
    else if (s.status === 'submitted')    map[s.exam_id].done++
    else if (s.status === 'locked')       map[s.exam_id].locked++
  }
  counts.value = map
}

onMounted(async () => {
  loading.value = true
  const [examsRes, classesRes] = await Promise.all([
    getExams(authStore.schoolId),
    supabase.from('classes').select('class_name').eq('school_id', authStore.schoolId).order('class_name'),
  ])
  if (examsRes.success) allExams.value = examsRes.data
  classes.value = (classesRes.data || []).map(c => c.class_name).filter(Boolean)
  loading.value = false
  // refresh countdown every second
  timer = setInterval(() => { allExams.value = [...allExams.value] }, 1000)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.proctor-select-page { padding: 20px; }
.page-hero {
  background: linear-gradient(135deg,#1e1b4b,#4c1d95);
  border-radius: 18px; padding: 20px 24px; color: #fff;
  display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px;
}
.page-hero h1 { margin: 0; font-size: 22px; font-weight: 800; }
.page-hero p  { margin: 4px 0 0; opacity: .8; font-size: 13px; }
.loading-box, .empty-box { text-align: center; padding: 60px; color: #64748b; }

/* Step 1 - class grid */
.step-label { font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; }
.class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
.class-card {
  background: #fff; border: 2px solid #e2e8f0; border-radius: 14px;
  padding: 18px 12px; text-align: center; cursor: pointer; transition: all .15s;
}
.class-card:hover { border-color: #7c3aed; background: #faf5ff; transform: translateY(-2px); }
.class-name { font-size: 18px; font-weight: 800; color: #0f172a; }
.class-exam-count { font-size: 11px; color: #7c3aed; margin-top: 4px; font-weight: 600; }

/* Step 2 - exam cards */
.room-header { margin-bottom: 16px; }
.room-badge {
  display: inline-block; font-size: 20px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg,#7c3aed,#a855f7); border-radius: 12px; padding: 6px 18px;
  margin-bottom: 4px;
}
.room-sub { font-size: 13px; color: #64748b; }
.exam-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

/* ── Card base ── */
.exam-card {
  background: #fff; border: 2px solid #e2e8f0; border-radius: 16px;
  display: flex; flex-direction: column; overflow: hidden; transition: box-shadow .2s;
}
.card-active   { border-color: #22c55e; box-shadow: 0 0 0 4px #bbf7d0; }
.card-ended    { border-color: #d1d5db; }
.card-upcoming { border-color: #c4b5fd; border-style: dashed; }

/* ── Banner ── */
.card-banner {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  font-size: 12px; font-weight: 800; flex-wrap: wrap;
}
.banner-active   { background: #dcfce7; color: #15803d; }
.banner-ended    { background: #f3f4f6; color: #6b7280; }
.banner-upcoming { background: #ede9fe; color: #5b21b6; }
.banner-icon   { font-size: 14px; }
.banner-label  { flex-shrink: 0; }
.banner-countdown { font-weight: 900; color: #7c3aed; }

.live-dot-wrap { display: flex; align-items: center; gap: 5px; margin-left: auto; }
.live-dot {
  width: 9px; height: 9px; border-radius: 50%; background: #16a34a;
  animation: live-pulse 1.2s ease-in-out infinite;
}
.live-text { font-size: 11px; font-weight: 900; color: #15803d; letter-spacing: .5px; }
@keyframes live-pulse {
  0%,100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.5); opacity: .5; }
}

/* ── Card body ── */
.card-body { padding: 12px 14px 8px; display: flex; flex-direction: column; gap: 7px; }

.subject-badge {
  display: inline-block; font-size: 11px; font-weight: 800; border-radius: 8px; padding: 3px 10px;
  color: #fff; align-self: flex-start;
  background: linear-gradient(135deg,#7c3aed,#a855f7);
}
.badge-active   { background: linear-gradient(135deg,#16a34a,#15803d) !important; }
.badge-ended    { background: linear-gradient(135deg,#9ca3af,#6b7280) !important; }
.badge-upcoming { background: linear-gradient(135deg,#7c3aed,#6d28d9) !important; }

.exam-title { font-size: 14px; font-weight: 700; color: #0f172a; }
.card-ended .exam-title { color: #9ca3af; }
.card-ended .exam-meta  { color: #d1d5db; }
.exam-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #475569; }

.session-row { display: flex; gap: 6px; flex-wrap: wrap; }
.cnt { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 8px; }
.cnt.pending { background: #fef3c7; color: #92400e; }
.cnt.active  { background: #dcfce7; color: #166534; }
.cnt.done    { background: #dbeafe; color: #1e40af; }
.cnt.locked  { background: #fee2e2; color: #991b1b; }

/* ── Card foot ── */
.card-foot { padding: 8px 14px 14px; }

.upcoming-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.upcoming-pulse-wrap { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: #5b21b6; }
.upcoming-dot {
  width: 9px; height: 9px; border-radius: 50%; background: #7c3aed; flex-shrink: 0;
  animation: live-pulse 2s ease-in-out infinite;
}
</style>
