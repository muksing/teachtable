<template>
  <div>
    <h2 class="page-title">📝 คะแนนเก็บรายวิชา</h2>

    <div class="intro-card">
      <div class="intro-icon">🎯</div>
      <div class="intro-text">
        <div class="intro-heading">คะแนนเก็บ — กระตุ้นให้ก้าวต่อ</div>
        <div class="intro-body">ติดตามคะแนนเก็บทุกรายวิชาเพื่อกระตุ้นตนเองให้ตั้งใจเรียน วิชาไหนยังไม่ผ่านเกณฑ์ ยังมีเวลาพัฒนาและปรับปรุงได้ทัน</div>
      </div>
    </div>

    <div v-if="loading" class="center-text">กำลังโหลด...</div>
    <div v-else-if="!records.length" class="empty-card">
      <div class="empty-icon">📋</div>
      <div>ยังไม่มีข้อมูลคะแนนเก็บในภาคเรียนนี้</div>
    </div>
    <div v-else>
      <div v-for="rec in records" :key="rec.subject_code" class="score-card">
        <div class="score-card-header">
          <div>
            <div class="subject-name">{{ rec.subject_name || rec.subject_code }}</div>
            <div class="subject-code">{{ rec.subject_code }}</div>
          </div>
          <div class="total-wrap">
            <div class="total-score">{{ rec.totalScore }}</div>
            <div class="total-max">/ {{ rec.totalMax }}</div>
            <div class="pass-tag" :class="rec.passed ? 'pass-tag--pass' : 'pass-tag--fail'">
              {{ rec.passed ? 'ผ่าน' : 'ไม่ผ่าน' }}
            </div>
          </div>
        </div>

        <!-- progress bar -->
        <div class="score-bar-track">
          <div class="score-bar-fill" :style="{ width: rec.pct + '%', background: rec.passed ? '#10b981' : '#f59e0b' }"></div>
        </div>
        <div class="score-bar-label">{{ rec.pct }}% (เกณฑ์ผ่าน {{ passPct }}%)</div>

        <!-- units grid -->
        <div class="units-grid" :style="{ gridTemplateColumns: `repeat(${Math.min(numUnits, 4)}, 1fr)` }">
          <div
            v-for="i in numUnits"
            :key="i"
            class="unit-cell"
            :class="rec.scores['u' + i] !== null && rec.scores['u' + i] !== undefined && rec.scores['u' + i] !== '' ? 'unit-cell--filled' : 'unit-cell--empty'"
          >
            <div class="unit-key">ครั้ง {{ i }}<span class="unit-max">/{{ maxScores[i-1] || 20 }}</span></div>
            <div class="unit-val">
              {{ rec.scores['u' + i] !== null && rec.scores['u' + i] !== undefined && rec.scores['u' + i] !== '' ? rec.scores['u' + i] : '—' }}
            </div>
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

const records = ref([])
const loading = ref(false)
const numUnits = ref(8)
const maxScores = ref([20, 20, 20, 20, 20, 20, 20, 20])
const passPct = ref(50)

onMounted(async () => {
  const { school_id, class_id, student_code, current_term } = session.value
  if (!school_id || !student_code) return
  loading.value = true
  try {
    const [scoresRes, subjectsRes, schoolRes] = await Promise.all([
      supabase.from('score_records')
        .select('subject_code, scores')
        .eq('school_id', school_id)
        .eq('class_id', class_id)
        .eq('student_id', student_code)
        .eq('term_id', current_term),
      supabase.from('subjects')
        .select('subject_code, name')
        .eq('school_id', school_id),
      supabase.from('schools')
        .select('settings')
        .eq('id', school_id)
        .single(),
    ])

    // โหลด score settings
    const ss = schoolRes.data?.settings?.score_settings || {}
    numUnits.value  = ss.num_units  || 8
    maxScores.value = ss.max_scores || Array(8).fill(20)
    passPct.value   = ss.pass_pct   || 50

    const subjectMap = new Map((subjectsRes.data || []).map(s => [s.subject_code, s.name]))

    records.value = (scoresRes.data || []).map(r => {
      const sc = r.scores || {}
      // คำนวณคะแนนรวมเฉพาะที่มีข้อมูล
      let totalScore = 0
      let totalMax = 0
      for (let i = 1; i <= numUnits.value; i++) {
        const v = sc['u' + i]
        const m = maxScores.value[i - 1] || 20
        if (v !== null && v !== undefined && v !== '') {
          totalScore += Number(v)
          totalMax += m
        }
      }
      const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
      return {
        subject_code: r.subject_code,
        subject_name: subjectMap.get(r.subject_code) || '',
        scores: sc,
        totalScore,
        totalMax,
        pct,
        passed: pct >= passPct.value,
      }
    }).sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || '', 'th'))

  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 12px; }
.intro-card {
  display: flex; gap: 12px; background: linear-gradient(135deg,#f5f3ff,#ede9fe);
  border-radius: 14px; padding: 14px; margin-bottom: 14px;
  border-left: 4px solid #8b5cf6;
}
.intro-icon { font-size: 28px; flex-shrink: 0; }
.intro-heading { font-size: 14px; font-weight: 700; color: #4c1d95; margin-bottom: 4px; }
.intro-body { font-size: 13px; color: #5b21b6; line-height: 1.6; }
.center-text { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 14px; }
.empty-card {
  background: white; border-radius: 16px; padding: 40px 20px;
  text-align: center; color: #9ca3af; font-size: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
}
.empty-icon { font-size: 40px; margin-bottom: 10px; }

.score-card {
  background: white; border-radius: 16px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 12px;
}
.score-card-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 10px;
}
.subject-name { font-size: 15px; font-weight: 800; color: #1f2937; }
.subject-code { font-size: 11px; color: #9ca3af; margin-top: 2px; }

.total-wrap { text-align: right; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.total-score { font-size: 28px; font-weight: 900; color: #1f2937; line-height: 1; }
.total-max { font-size: 13px; color: #9ca3af; }
.pass-tag {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px;
  margin-left: 4px;
}
.pass-tag--pass { background: #dcfce7; color: #166534; }
.pass-tag--fail { background: #fef9c3; color: #854d0e; }

.score-bar-track { height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; margin-bottom: 4px; }
.score-bar-fill { height: 100%; border-radius: 99px; transition: width .4s; }
.score-bar-label { font-size: 11px; color: #9ca3af; margin-bottom: 12px; }

.units-grid { display: grid; gap: 8px; }
.unit-cell { border-radius: 10px; padding: 8px 6px; text-align: center; }
.unit-cell--filled { background: #f0fdf4; }
.unit-cell--empty  { background: #f9fafb; }
.unit-key { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
.unit-max { color: #d1d5db; }
.unit-val { font-size: 18px; font-weight: 700; color: #1f2937; }
.unit-cell--empty .unit-val { color: #d1d5db; }
</style>
