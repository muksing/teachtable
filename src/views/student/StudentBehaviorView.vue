<template>
  <div>
    <h2 class="page-title">⭐ คะแนนพฤติกรรม</h2>

    <!-- Score bars -->
    <div class="section-card">
      <div class="total-row">
        <span class="total-label">คะแนนรวม</span>
        <span class="total-value">{{ session.total_behavior_score ?? 0 }}</span>
      </div>

      <div class="bar-item">
        <div class="bar-meta">
          <span class="bar-label">ทั่วไป</span>
          <span class="bar-val">{{ session.general_behavior_score ?? 0 }}</span>
        </div>
        <div class="bar-track"><div class="bar-fill bar-fill--general" :style="barStyle(session.general_behavior_score)"></div></div>
      </div>
      <div class="bar-item">
        <div class="bar-meta">
          <span class="bar-label">การมาเรียน</span>
          <span class="bar-val">{{ session.attendance_behavior_score ?? 0 }}</span>
        </div>
        <div class="bar-track"><div class="bar-fill bar-fill--attend" :style="barStyle(session.attendance_behavior_score)"></div></div>
      </div>
      <div class="bar-item">
        <div class="bar-meta">
          <span class="bar-label">ในห้องเรียน</span>
          <span class="bar-val">{{ session.learning_behavior_score ?? 0 }}</span>
        </div>
        <div class="bar-track"><div class="bar-fill bar-fill--learn" :style="barStyle(session.learning_behavior_score)"></div></div>
      </div>
    </div>

    <!-- Behavior log timeline -->
    <div class="section-card">
      <div class="section-header">ประวัติการบันทึก</div>
      <div v-if="loading" class="center-text">กำลังโหลด...</div>
      <div v-else-if="!logs.length" class="empty-text">ยังไม่มีประวัติการบันทึกพฤติกรรม</div>
      <div v-else class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-item">
          <div class="log-dot" :class="log.points_change >= 0 ? 'log-dot--pos' : 'log-dot--neg'">
            {{ log.points_change >= 0 ? '+' : '' }}{{ log.points_change }}
          </div>
          <div class="log-body">
            <div class="log-label">{{ log.label || typeLabel(log.behavior_type) }}</div>
            <div v-if="log.note" class="log-note">{{ log.note }}</div>
            <div class="log-date">{{ formatDate(log.date) }} · บันทึกโดย {{ log.recorded_by || '-' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const session = computed(() => studentStore.session || {})
const logs = ref([])
const loading = ref(false)

const TYPE_LABELS = { general: 'ทั่วไป', attendance: 'การมาเรียน', learning: 'ในห้องเรียน' }
function typeLabel(t) { return TYPE_LABELS[t] || t || '-' }

function barStyle(val) {
  const v = Number(val ?? 0)
  const pct = Math.min(100, Math.max(0, v <= 0 ? 0 : (v / 100) * 100))
  return { width: pct + '%' }
}

function formatDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

onMounted(async () => {
  const { school_id, student_code, current_term } = session.value
  if (!school_id || !student_code) return
  loading.value = true
  try {
    const { data } = await supabase
      .from('behavior_logs')
      .select('id, date, behavior_type, points_change, score_after, label, note, recorded_by')
      .eq('school_id', school_id)
      .eq('student_id', student_code)
      .eq('term_id', current_term)
      .order('date', { ascending: false })
      .limit(100)
    logs.value = data || []
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 16px; }
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

.bar-item { margin-bottom: 14px; }
.bar-meta { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.bar-label { color: #6b7280; font-weight: 600; }
.bar-val { font-weight: 700; color: #1f2937; }
.bar-track { height: 10px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 99px; transition: width .4s ease; min-width: 4px; }
.bar-fill--general { background: #8b5cf6; }
.bar-fill--attend  { background: #10b981; }
.bar-fill--learn   { background: #3b82f6; }

.center-text { text-align: center; color: #9ca3af; padding: 20px 0; font-size: 14px; }
.empty-text { text-align: center; color: #9ca3af; padding: 20px 0; font-size: 14px; }

.log-list { display: flex; flex-direction: column; gap: 12px; }
.log-item { display: flex; gap: 12px; align-items: flex-start; }
.log-dot {
  min-width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800;
}
.log-dot--pos { background: #dcfce7; color: #166534; }
.log-dot--neg { background: #fef2f2; color: #b91c1c; }
.log-body { flex: 1; }
.log-label { font-size: 14px; font-weight: 600; color: #1f2937; }
.log-note { font-size: 13px; color: #6b7280; margin-top: 2px; }
.log-date { font-size: 11px; color: #9ca3af; margin-top: 3px; }
</style>
