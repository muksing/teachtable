<template>
  <div class="er-wrap">
    <h2 class="er-title">📋 ประวัติการตรวจผล</h2>

    <div v-if="loading" class="er-loading">
      <div class="er-spinner"></div>
      <p>กำลังโหลด...</p>
    </div>

    <template v-else>
      <!-- Summary bar -->
      <div v-if="results.length" class="er-summary">
        <div class="er-sum-card er-sum-total">
          <div class="er-sum-num">{{ results.length }}</div>
          <div class="er-sum-lbl">การสอบทั้งหมด</div>
        </div>
        <div class="er-sum-card er-sum-avg">
          <div class="er-sum-num">{{ avgPct }}%</div>
          <div class="er-sum-lbl">เฉลี่ย</div>
        </div>
        <div class="er-sum-card er-sum-best">
          <div class="er-sum-num">{{ bestPct }}%</div>
          <div class="er-sum-lbl">สูงสุด</div>
        </div>
      </div>

      <!-- Filter by subject -->
      <div v-if="subjects.length > 1" class="er-filter">
        <button
          v-for="s in ['ทั้งหมด', ...subjects]" :key="s"
          class="er-filter-btn"
          :class="{ 'er-filter-btn--active': filter === s }"
          @click="filter = s"
        >{{ s }}</button>
      </div>

      <!-- Empty -->
      <div v-if="!filteredResults.length" class="er-empty">
        <div class="er-empty-icon">📭</div>
        <p>ยังไม่มีผลการสอบ</p>
        <p class="er-empty-sub">ผลจะแสดงหลังจากส่งข้อสอบแล้ว</p>
      </div>

      <!-- Result cards -->
      <div v-else class="er-list">
        <div
          v-for="r in filteredResults"
          :key="r.session_id"
          class="er-card"
          :class="gradeClass(r)"
        >
          <div class="er-card-head">
            <div class="er-card-left">
              <div class="er-subject">{{ r.subject_name || r.exam_title }}</div>
              <div class="er-exam-name">{{ r.exam_title }}</div>
              <div class="er-date">📅 {{ fmtDate(r.exam_date) }}</div>
            </div>
            <div class="er-score-block">
              <div class="er-score-num">{{ r.score }}</div>
              <div class="er-score-max">/ {{ r.max_score }}</div>
              <div class="er-pct" :class="gradeClass(r)">{{ pct(r) }}%</div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="er-bar-wrap">
            <div class="er-bar-fill" :class="gradeClass(r)" :style="{ width: pct(r) + '%' }"></div>
          </div>

          <div class="er-card-foot">
            <span class="er-grade-chip" :class="gradeClass(r)">{{ gradeLabel(r) }}</span>
            <span v-if="r.attempt_number > 1" class="er-attempt">ครั้งที่ {{ r.attempt_number }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const loading = ref(false)
const results = ref([])
const filter  = ref('ทั้งหมด')

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : ''
}

function pct(r) {
  if (!r.max_score) return 0
  return Math.round((r.score / r.max_score) * 100)
}

function gradeClass(r) {
  const p = pct(r)
  if (p >= 80) return 'grade-great'
  if (p >= 70) return 'grade-good'
  if (p >= 60) return 'grade-ok'
  return 'grade-low'
}

function gradeLabel(r) {
  const p = pct(r)
  if (p >= 80) return '🌟 ดีเยี่ยม'
  if (p >= 70) return '✅ ดี'
  if (p >= 60) return '👌 ผ่าน'
  return '❌ ต่ำกว่าเกณฑ์'
}

const subjects = computed(() => {
  const s = new Set()
  results.value.forEach(r => { if (r.subject_name) s.add(r.subject_name) })
  return [...s].sort()
})

const filteredResults = computed(() => {
  if (filter.value === 'ทั้งหมด') return results.value
  return results.value.filter(r => r.subject_name === filter.value)
})

const avgPct = computed(() => {
  if (!results.value.length) return 0
  const sum = results.value.reduce((a, r) => a + pct(r), 0)
  return Math.round(sum / results.value.length)
})

const bestPct = computed(() => {
  if (!results.value.length) return 0
  return Math.max(...results.value.map(pct))
})

async function load() {
  loading.value = true
  const { school_id, student_code } = studentStore.session || {}
  if (!school_id || !student_code) { loading.value = false; return }

  const { data, error } = await supabase
    .from('exam_sessions')
    .select(`
      id,
      exam_id,
      score,
      max_score,
      status,
      attempt_number,
      exams ( title, subject_name, exam_date, school_id )
    `)
    .eq('student_code', student_code)
    .eq('status', 'submitted')
    .order('created_at', { ascending: false })

  if (!error && data) {
    results.value = data
      .filter(s => s.exams?.school_id === school_id)
      .map(s => ({
        session_id:   s.id,
        exam_id:      s.exam_id,
        score:        s.score ?? 0,
        max_score:    s.max_score ?? 0,
        attempt_number: s.attempt_number ?? 1,
        exam_title:   s.exams?.title || '',
        subject_name: s.exams?.subject_name || '',
        exam_date:    s.exams?.exam_date || '',
      }))
  }
  loading.value = false
}

onMounted(load)
</script>

<style scoped>
.er-wrap { padding-bottom: 24px; }
.er-title {
  font-size: 18px; font-weight: 800; color: #1e1b4b; margin-bottom: 16px;
}

/* Loading */
.er-loading { display: flex; flex-direction: column; align-items: center; padding: 40px 0; gap: 12px; color: #7c3aed; }
.er-spinner {
  width: 36px; height: 36px; border-radius: 50%;
  border: 3px solid #e9d5ff; border-top-color: #7c3aed; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Summary */
.er-summary {
  display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px;
}
.er-sum-card {
  border-radius: 14px; padding: 12px; text-align: center;
}
.er-sum-total { background: linear-gradient(135deg,#ede9fe,#ddd6fe); }
.er-sum-avg   { background: linear-gradient(135deg,#dbeafe,#bfdbfe); }
.er-sum-best  { background: linear-gradient(135deg,#dcfce7,#bbf7d0); }
.er-sum-num { font-size: 22px; font-weight: 900; color: #1e1b4b; }
.er-sum-lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }

/* Filter */
.er-filter {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;
}
.er-filter-btn {
  padding: 5px 14px; border-radius: 99px; font-size: 12px; font-weight: 700;
  border: 1.5px solid #ddd6fe; background: white; color: #7c3aed; cursor: pointer;
  transition: all .15s;
}
.er-filter-btn--active {
  background: #7c3aed; color: white; border-color: #7c3aed;
}

/* Empty */
.er-empty { text-align: center; padding: 40px 0; color: #9ca3af; }
.er-empty-icon { font-size: 48px; margin-bottom: 8px; }
.er-empty-sub { font-size: 12px; margin-top: 4px; }

/* Result cards */
.er-list { display: flex; flex-direction: column; gap: 12px; }
.er-card {
  background: white; border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  border-left: 5px solid #e5e7eb;
}
.er-card.grade-great { border-left-color: #10b981; }
.er-card.grade-good  { border-left-color: #3b82f6; }
.er-card.grade-ok    { border-left-color: #f59e0b; }
.er-card.grade-low   { border-left-color: #ef4444; }

.er-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.er-card-left { flex: 1; min-width: 0; }
.er-subject { font-size: 11px; font-weight: 700; color: #7c3aed; letter-spacing: .3px; margin-bottom: 2px; }
.er-exam-name { font-size: 14px; font-weight: 800; color: #1e1b4b; }
.er-date { font-size: 11px; color: #6b7280; margin-top: 4px; }

.er-score-block { text-align: center; flex-shrink: 0; }
.er-score-num { font-size: 28px; font-weight: 900; color: #1e1b4b; line-height: 1; }
.er-score-max { font-size: 11px; color: #9ca3af; }
.er-pct { font-size: 13px; font-weight: 800; margin-top: 2px; }
.er-pct.grade-great { color: #059669; }
.er-pct.grade-good  { color: #2563eb; }
.er-pct.grade-ok    { color: #d97706; }
.er-pct.grade-low   { color: #dc2626; }

/* Bar */
.er-bar-wrap {
  height: 6px; background: #f3f4f6; border-radius: 99px;
  margin: 10px 0 8px; overflow: hidden;
}
.er-bar-fill {
  height: 100%; border-radius: 99px; transition: width .6s ease;
}
.er-bar-fill.grade-great { background: linear-gradient(90deg,#10b981,#34d399); }
.er-bar-fill.grade-good  { background: linear-gradient(90deg,#3b82f6,#60a5fa); }
.er-bar-fill.grade-ok    { background: linear-gradient(90deg,#f59e0b,#fcd34d); }
.er-bar-fill.grade-low   { background: linear-gradient(90deg,#ef4444,#fca5a5); }

.er-card-foot { display: flex; align-items: center; gap: 8px; }
.er-grade-chip {
  display: inline-block; padding: 3px 10px; border-radius: 99px;
  font-size: 11px; font-weight: 700;
}
.er-grade-chip.grade-great { background: #dcfce7; color: #15803d; }
.er-grade-chip.grade-good  { background: #dbeafe; color: #1d4ed8; }
.er-grade-chip.grade-ok    { background: #fef3c7; color: #92400e; }
.er-grade-chip.grade-low   { background: #fee2e2; color: #b91c1c; }

.er-attempt { font-size: 11px; color: #9ca3af; }
</style>
