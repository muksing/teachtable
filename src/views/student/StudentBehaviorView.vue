<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">⭐ คะแนนพฤติกรรม</h2>
      <button class="refresh-btn" :class="{ spinning: loading }" @click="loadAll" :disabled="loading">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>

    <!-- Score bars -->
    <div class="section-card">
      <div class="total-row">
        <span class="total-label">คะแนนรวม</span>
        <span class="total-value" :class="{ 'score-loading': loading, 'total-pos': scores.total > 0, 'total-neg': scores.total < 0 }">
        {{ scores.total > 0 ? '+' : '' }}{{ scores.total ?? 0 }}
      </span>
      </div>

      <div v-if="scores.carryOver !== 0" class="bar-item">
        <div class="bar-meta">
          <span class="bar-label">คะแนนยกมา</span>
          <span class="bar-val bar-val--carry" :class="scores.carryOver > 0 ? 'bar-val--pos' : 'bar-val--neg'">
            {{ scores.carryOver > 0 ? '+' : '' }}{{ scores.carryOver }}
          </span>
        </div>
      </div>
      <div class="bar-item">
        <div class="bar-meta">
          <span class="bar-label">ทั่วไป</span>
          <span class="bar-val" :class="scores.general > 0 ? 'bar-val--pos' : scores.general < 0 ? 'bar-val--neg' : ''">
            {{ scores.general > 0 ? '+' : '' }}{{ scores.general ?? 0 }}
          </span>
        </div>
        <div class="bar-track"><div class="bar-fill bar-fill--general" :style="barStyle(scores.general)"></div></div>
      </div>
      <div class="bar-item">
        <div class="bar-meta">
          <span class="bar-label">ในห้องเรียน</span>
          <span class="bar-val" :class="scores.classroom > 0 ? 'bar-val--pos' : scores.classroom < 0 ? 'bar-val--neg' : ''">
            {{ scores.classroom > 0 ? '+' : '' }}{{ scores.classroom ?? 0 }}
          </span>
        </div>
        <div class="bar-track"><div class="bar-fill bar-fill--attend" :style="barStyle(scores.classroom)"></div></div>
      </div>
      <div v-if="probationScore !== 0 || logs.some(l => l.behavior_type === 'probation')" class="bar-item bar-item--probation">
        <div class="bar-meta">
          <span class="bar-label">⚠️ ทัณฑ์บน</span>
          <span class="bar-val bar-val--neg">{{ probationScore }}</span>
        </div>
        <div class="bar-track"><div class="bar-fill bar-fill--probation" :style="barStyleNeg(probationScore)"></div></div>
      </div>
    </div>

    <!-- History -->
    <div class="section-card">
      <div class="section-header">ประวัติการบันทึก</div>

      <!-- Filters -->
      <div class="filter-row">
        <div class="filter-tabs">
          <button
            v-for="tab in typeTabs" :key="tab.value"
            class="ftab" :class="{ 'ftab--active': filterType === tab.value }"
            @click="filterType = tab.value"
          >{{ tab.label }}</button>
        </div>
        <div class="date-filters">
          <input type="date" v-model="filterDateFrom" class="date-input" />
          <span class="date-sep">–</span>
          <input type="date" v-model="filterDateTo" class="date-input" />
          <button v-if="filterDateFrom || filterDateTo" class="clear-btn" @click="filterDateFrom=''; filterDateTo=''">✕</button>
        </div>
      </div>

      <!-- Summary for filtered type -->
      <div class="filter-sum">
        รวม <strong>{{ filteredLogs.length }}</strong> รายการ &nbsp;|&nbsp;
        ผลรวม
        <strong :class="filteredSum < 0 ? 'sum--neg' : filteredSum > 0 ? 'sum--pos' : ''">
          {{ filteredSum > 0 ? '+' : '' }}{{ filteredSum }}
        </strong>
      </div>

      <div v-if="loading" class="center-text">กำลังโหลด...</div>
      <div v-else-if="!filteredLogs.length" class="empty-text">ไม่มีรายการในช่วงนี้</div>
      <!-- ทั่วไป: 2 คอลัมน์ เพิ่ม/หัก -->
      <template v-else-if="filterType === 'general'">
        <div class="two-col">
          <div class="col-group">
            <div class="group-header group-header--pos">เพิ่มคะแนน</div>
            <div v-if="!generalPos.length" class="col-empty">—</div>
            <div v-for="log in generalPos" :key="log.id" class="col-item col-item--pos">
              <div class="col-pts">+{{ log.points_change }}</div>
              <div class="col-body">
                <div class="col-label">{{ log.label_snapshot || typeLabel(log.behavior_type) }}</div>
                <div v-if="log.note" class="col-note">{{ log.note }}</div>
                <div v-if="Array.isArray(log.image_urls) && log.image_urls.filter(Boolean).length" class="log-images">
                  <img v-for="(url, i) in log.image_urls.filter(Boolean)" :key="i"
                    :src="fixPhotoUrl(url)" class="log-img" loading="lazy" @click="viewingPhoto = fixPhotoUrl(url)" />
                </div>
                <div class="col-meta">
                  <span class="col-meta-date">{{ log.date ? formatDate(log.date) : '—' }}</span>
                  <span class="col-meta-sep">·</span>
                  <span class="col-meta-name">{{ log.recorded_by_name_snapshot || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="col-group">
            <div class="group-header group-header--neg">หักคะแนน</div>
            <div v-if="!generalNeg.length" class="col-empty">—</div>
            <div v-for="log in generalNeg" :key="log.id" class="col-item col-item--neg">
              <div class="col-pts">{{ log.points_change }}</div>
              <div class="col-body">
                <div class="col-label">{{ log.label_snapshot || typeLabel(log.behavior_type) }}</div>
                <div v-if="log.note" class="col-note">{{ log.note }}</div>
                <div v-if="Array.isArray(log.image_urls) && log.image_urls.filter(Boolean).length" class="log-images">
                  <img v-for="(url, i) in log.image_urls.filter(Boolean)" :key="i"
                    :src="fixPhotoUrl(url)" class="log-img" loading="lazy" @click="viewingPhoto = fixPhotoUrl(url)" />
                </div>
                <div class="col-meta">
                  <span class="col-meta-date">{{ log.date ? formatDate(log.date) : '—' }}</span>
                  <span class="col-meta-sep">·</span>
                  <span class="col-meta-name">{{ log.recorded_by_name_snapshot || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ทั้งหมด / ในห้องเรียน -->
      <div v-else class="log-list">
        <div v-for="log in filteredLogs" :key="log.id" class="log-item">
          <div class="log-dot" :class="log.points_change >= 0 ? 'log-dot--pos' : 'log-dot--neg'">
            {{ log.points_change >= 0 ? '+' : '' }}{{ log.points_change }}
          </div>
          <div class="log-body">
            <div class="log-label">{{ log.label_snapshot || typeLabel(log.behavior_type) }}</div>
            <div v-if="log.note" class="log-note">{{ log.note }}</div>
            <div class="log-meta">
              <span class="log-meta-date">{{ log.date ? formatDate(log.date) : '—' }}</span>
              <span class="log-meta-sep">·</span>
              <span class="log-meta-name">{{ log.recorded_by_name_snapshot || '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Photo lightbox -->
      <div v-if="viewingPhoto" class="photo-overlay" @click="viewingPhoto = ''">
        <img :src="fixPhotoUrl(viewingPhoto)" class="photo-full" @click.stop />
        <button class="overlay-close" @click="viewingPhoto = ''">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { fixPhotoUrl } from '@/composables/useStudentUpload'

const studentStore = useStudentStore()
const session = computed(() => studentStore.session || {})
const logs = ref([])
const loading = ref(false)

const filterType     = ref('all')
const filterDateFrom = ref('')
const filterDateTo   = ref('')

const typeTabs = [
  { value: 'all',        label: 'ทั้งหมด' },
  { value: 'general',    label: 'ทั่วไป' },
  { value: 'classroom',  label: 'ในห้องเรียน' },
  { value: 'probation',  label: 'ทัณฑ์บน' },
]

const filteredLogs = computed(() => {
  return logs.value.filter(l => {
    if (filterType.value === 'classroom' && !['attendance','learning'].includes(l.behavior_type)) return false
    if (filterType.value === 'general'   && l.behavior_type !== 'general') return false
    if (filterType.value === 'probation' && l.behavior_type !== 'probation') return false
    if (filterDateFrom.value && l.date && l.date < filterDateFrom.value) return false
    if (filterDateTo.value   && l.date && l.date > filterDateTo.value)   return false
    return true
  })
})

const probationScore = computed(() =>
  logs.value.filter(l => l.behavior_type === 'probation')
    .reduce((s, l) => s + (l.points_change ?? 0), 0)
)

const filteredSum = computed(() =>
  filteredLogs.value.reduce((s, l) => s + (l.points_change ?? 0), 0)
)

const generalPos = computed(() =>
  filteredLogs.value.filter(l => l.behavior_type === 'general' && (l.points_change ?? 0) > 0)
)
const generalNeg = computed(() =>
  filteredLogs.value.filter(l => l.behavior_type === 'general' && (l.points_change ?? 0) < 0)
)

const viewingPhoto = ref('')

const s0 = session.value
const scores = ref({
  total:     (s0.total_behavior_score      ?? 0),
  general:   (s0.general_behavior_score    ?? 0),
  classroom: (s0.attendance_behavior_score ?? 0) + (s0.learning_behavior_score ?? 0),
  carryOver: (s0.behavior_carry_over       ?? 0),
})

const TYPE_LABELS = { general: 'ทั่วไป', attendance: 'ในห้องเรียน', learning: 'ในห้องเรียน', probation: 'ทัณฑ์บน' }
function typeLabel(t) { return TYPE_LABELS[t] || t || '-' }

function barStyle(val) {
  const v = Number(val ?? 0)
  const pct = Math.min(100, Math.max(0, v <= 0 ? 0 : (v / 100) * 100))
  return { width: pct + '%' }
}
function barStyleNeg(val) {
  const v = Math.abs(Number(val ?? 0))
  const pct = Math.min(100, Math.max(0, (v / 50) * 100))
  return { width: pct + '%' }
}

function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

async function loadAll() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  loading.value = true
  try {
    const logQ = supabase
      .from('behavior_logs')
      .select('id, date, behavior_type, points_change, label_snapshot, note, recorded_by_name_snapshot, created_at, term_id, image_urls')
      .eq('school_id', school_id)
      .eq('student_id', student_code)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    const [{ data: stuData }, { data: logData }] = await Promise.all([
      supabase
        .from('students')
        .select('id, total_behavior_score, general_behavior_score, attendance_behavior_score, learning_behavior_score, behavior_carry_over')
        .eq('school_id', school_id)
        .eq('student_code', student_code)
        .maybeSingle(),
      logQ,
    ])

    // บาง log เก็บ student_id เป็น UUID — ดึงเพิ่มด้วย
    let extraLogs = []
    if (stuData?.id && stuData.id !== student_code) {
      const { data: d2 } = await supabase
        .from('behavior_logs')
        .select('id, date, behavior_type, points_change, label_snapshot, note, recorded_by_name_snapshot, created_at, term_id, image_urls')
        .eq('school_id', school_id)
        .eq('student_id', stuData.id)
        .order('date', { ascending: false })
        .limit(200)
      extraLogs = d2 || []
    }

    // รวม + deduplicate ด้วย id
    const seenIds = new Set()
    const allLogs = [...(logData || []), ...extraLogs].filter(l => {
      if (seenIds.has(l.id)) return false
      seenIds.add(l.id)
      return true
    })

    if (stuData) {
      scores.value = {
        total:     stuData.total_behavior_score ?? 0,
        general:   stuData.general_behavior_score ?? 0,
        classroom: (stuData.attendance_behavior_score ?? 0) + (stuData.learning_behavior_score ?? 0),
        carryOver: stuData.behavior_carry_over ?? 0,
      }
      studentStore.refreshScores({
        total_behavior_score:      stuData.total_behavior_score,
        general_behavior_score:    stuData.general_behavior_score,
        attendance_behavior_score: stuData.attendance_behavior_score,
        learning_behavior_score:   stuData.learning_behavior_score,
      })
    }

    allLogs.sort((a, b) => {
      if (!a.date && !b.date) return (a.created_at || '') < (b.created_at || '') ? 1 : -1
      if (!a.date) return 1
      if (!b.date) return -1
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return (a.created_at || '') < (b.created_at || '') ? 1 : -1
    })
    logs.value = allLogs
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0; }
.refresh-btn {
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: #ede9fe; color: #6366f1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .2s;
}
.refresh-btn:hover:not(:disabled) { background: #ddd6fe; }
.refresh-btn:disabled { opacity: .5; cursor: default; }
.refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.score-loading { opacity: .4; }

.section-card {
  background: white; border-radius: 16px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 16px;
}
.section-header { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 14px; }

.total-row {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; margin-bottom: 16px;
}
.total-label { font-size: 15px; font-weight: 700; color: #374151; }
.total-value { font-size: 32px; font-weight: 900; color: #6366f1; }
.total-pos { color: #16a34a; }
.total-neg { color: #dc2626; }

.bar-item { margin-bottom: 14px; }
.bar-meta { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.bar-label { color: #6b7280; font-weight: 600; }
.bar-val { font-weight: 700; color: #1f2937; }
.bar-val--carry { font-size: 14px; }
.bar-val--pos { color: #16a34a; }
.bar-val--neg { color: #dc2626; }
.bar-track { height: 10px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 99px; transition: width .4s ease; min-width: 4px; }
.bar-fill--general   { background: #8b5cf6; }
.bar-fill--attend    { background: #10b981; }
.bar-fill--learn     { background: #3b82f6; }
.bar-fill--probation { background: #ef4444; }
.bar-item--probation { padding: 10px 12px; background: #fff1f2; border-radius: 10px; border: 1px solid #fecaca; margin-top: 4px; }

.center-text { text-align: center; color: #9ca3af; padding: 20px 0; font-size: 14px; }
.empty-text { text-align: center; color: #9ca3af; padding: 20px 0; font-size: 14px; }

.log-list { display: flex; flex-direction: column; gap: 8px; }
.log-item {
  display: flex; gap: 0; align-items: stretch;
  background: #f9fafb; border-radius: 14px; overflow: hidden;
  border: 1px solid #f3f4f6;
  transition: box-shadow .15s;
}
.log-item:active { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.log-dot {
  min-width: 52px; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900; padding: 12px 4px;
  border-radius: 0;
}
.log-dot--pos { background: #dcfce7; color: #15803d; }
.log-dot--neg { background: #fee2e2; color: #dc2626; }
.log-body {
  flex: 1; padding: 10px 12px;
  border-left: 1px solid #f3f4f6;
  display: flex; flex-direction: column; justify-content: center; gap: 2px;
}
.log-label { font-size: 13px; font-weight: 700; color: #1e1b4b; line-height: 1.4; }
.log-note  { font-size: 12px; color: #6b7280; line-height: 1.4; }
.log-meta  { display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
.log-meta-date { font-size: 12px; font-weight: 600; color: #7c3aed; }
.log-meta-sep  { font-size: 11px; color: #d1d5db; }
.log-meta-name { font-size: 12px; color: #6b7280; }

/* Filters */
.filter-row { margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
.filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.ftab {
  padding: 5px 12px; border-radius: 99px; border: 1.5px solid #e5e7eb;
  background: white; color: #6b7280; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all .15s; white-space: nowrap;
}
.ftab--active { background: #6d28d9; color: white; border-color: #6d28d9; }
.date-filters { display: flex; align-items: center; gap: 6px; }
.date-input {
  border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 5px 8px;
  font-size: 12px; color: #374151; outline: none; flex: 1; min-width: 0; width: 0;
}
.date-input:focus { border-color: #7c3aed; }
.date-sep { color: #9ca3af; font-size: 12px; flex-shrink: 0; }
.clear-btn {
  border: none; background: #f3f4f6; color: #6b7280;
  border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.filter-sum {
  font-size: 12px; color: #6b7280; margin-bottom: 12px;
  padding: 8px 12px; background: #f9fafb; border-radius: 8px;
}
.sum--neg { color: #dc2626; }
.sum--pos { color: #16a34a; }

/* 2-column layout */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.col-group { display: flex; flex-direction: column; gap: 6px; }
.group-header {
  font-size: 12px; font-weight: 700; padding: 5px 10px;
  border-radius: 8px; margin-bottom: 2px; text-align: center;
}
.group-header--pos { background: #dcfce7; color: #166534; }
.group-header--neg { background: #fef2f2; color: #b91c1c; }

.col-empty { text-align: center; color: #d1d5db; font-size: 22px; padding: 16px 0; }

.col-item {
  border-radius: 12px; overflow: hidden;
  border: 1px solid transparent;
  display: flex; flex-direction: column;
}
.col-item--pos { background: #f0fdf4; border-color: #bbf7d0; }
.col-item--neg { background: #fff1f2; border-color: #fecaca; }

.col-pts {
  font-size: 18px; font-weight: 900; padding: 8px 10px 4px;
  border-bottom: 1px solid rgba(0,0,0,.05);
}
.col-item--pos .col-pts { color: #15803d; }
.col-item--neg .col-pts { color: #dc2626; }

.col-body { padding: 6px 10px 8px; }
.col-label { font-size: 11px; font-weight: 700; color: #1f2937; line-height: 1.4; }
.col-note  { font-size: 10px; color: #6b7280; margin-top: 2px; line-height: 1.3; }
.col-meta  { display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
.col-meta-date { font-size: 11px; font-weight: 600; color: #7c3aed; }
.col-meta-sep  { font-size: 10px; color: #d1d5db; }
.col-meta-name { font-size: 11px; color: #6b7280; }

/* Log images */
.log-images { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.log-img {
  width: 64px; height: 64px; border-radius: 8px; object-fit: cover;
  border: 1.5px solid #e5e7eb; cursor: pointer; flex-shrink: 0;
  transition: opacity .15s;
}
.log-img:active { opacity: .8; }

/* Photo overlay */
.photo-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,.88); display: flex; align-items: center; justify-content: center;
}
.photo-full { max-width: 95vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }
.overlay-close {
  position: fixed; top: 16px; right: 16px;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,.15); color: white;
  border: none; font-size: 20px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
</style>
