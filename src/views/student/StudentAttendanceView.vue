<template>
  <div>
    <h2 class="page-title">📊 สรุปรายวิชา</h2>

    <div class="intro-card">
      <div class="intro-icon">📅</div>
      <div class="intro-text">
        <div class="intro-heading">เวลาเรียนคือความรับผิดชอบ</div>
        <div class="intro-body">ดูภาพรวมการมาเรียนและคะแนนเก็บของแต่ละวิชา เพื่อเตือนใจให้มาเรียนสม่ำเสมอ การมาเรียนครบสะท้อนถึงความรับผิดชอบและส่งผลต่อผลการเรียนโดยตรง</div>
      </div>
    </div>

    <div v-if="loading" class="center-text">กำลังโหลด...</div>
    <template v-else>
      <!-- สรุปรวมทุกวิชา -->
      <div class="total-card">
        <div class="total-title">สรุปการมาเรียนทั้งหมด</div>
        <div class="total-grid">
          <div class="total-cell c-attend"><div class="tc-num">{{ grand.attend }}</div><div class="tc-lbl">มาเรียน</div></div>
          <div class="total-cell c-late">  <div class="tc-num">{{ grand.late   }}</div><div class="tc-lbl">มาสาย</div></div>
          <div class="total-cell c-sick">  <div class="tc-num">{{ grand.sick   }}</div><div class="tc-lbl">ลาป่วย</div></div>
          <div class="total-cell c-leave"> <div class="tc-num">{{ grand.leave  }}</div><div class="tc-lbl">ลากิจ</div></div>
          <div class="total-cell c-absent"><div class="tc-num">{{ grand.absent }}</div><div class="tc-lbl">ขาดเรียน</div></div>
          <div class="total-cell c-all">   <div class="tc-num">{{ grand.all    }}</div><div class="tc-lbl">ทั้งหมด</div></div>
        </div>
      </div>

      <!-- รายวิชา -->
      <div v-if="!subjects.length" class="empty-card">
        <div class="empty-icon">📋</div>
        <div class="empty-text">ยังไม่มีข้อมูล</div>
      </div>

      <div v-for="sub in subjects" :key="sub.subject_id" class="subject-card">
        <!-- Header: ชื่อวิชา + ครู -->
        <div class="sub-header">
          <div class="sub-name">{{ sub.name }}</div>
          <div class="sub-meta">
            <span class="sub-code">{{ sub.subject_id }}</span>
            <span v-if="sub.teacher" class="sub-teacher">👨‍🏫 {{ sub.teacher }}</span>
          </div>
        </div>

        <!-- เวลาเรียน -->
        <div class="sub-section-label">เวลาเรียน</div>
        <div v-if="sub.all === 0" class="no-data">ยังไม่มีข้อมูล</div>
        <div v-else>
          <div class="attend-chips">
            <div class="chip c-attend"><span class="chip-num">{{ sub.attend }}</span><span class="chip-lbl">มาเรียน</span></div>
            <div class="chip c-late">  <span class="chip-num">{{ sub.late   }}</span><span class="chip-lbl">มาสาย</span></div>
            <div class="chip c-sick">  <span class="chip-num">{{ sub.sick   }}</span><span class="chip-lbl">ลาป่วย</span></div>
            <div class="chip c-leave"> <span class="chip-num">{{ sub.leave  }}</span><span class="chip-lbl">ลากิจ</span></div>
            <div class="chip c-absent"><span class="chip-num">{{ sub.absent }}</span><span class="chip-lbl">ขาดเรียน</span></div>
            <div class="chip c-all">   <span class="chip-num">{{ sub.all    }}</span><span class="chip-lbl">ทั้งหมด</span></div>
          </div>
          <div class="attend-bar-track">
            <div class="attend-bar-fill" :style="{ width: attendPct(sub) + '%' }"></div>
          </div>
          <div class="attend-pct-label">มาเรียน {{ attendPct(sub) }}%</div>
        </div>

        <!-- คะแนนเก็บ -->
        <div class="sub-section-label" style="margin-top:14px">คะแนนเก็บ</div>
        <div v-if="!sub.hasScores" class="no-data">ยังไม่มีข้อมูล</div>
        <div v-else>
          <div class="scores-row">
            <div
              v-for="i in numUnits"
              :key="i"
              class="score-chip"
              :class="sub.scores['u'+i] !== null && sub.scores['u'+i] !== undefined && sub.scores['u'+i] !== '' ? 'sc-filled' : 'sc-empty'"
            >
              <div class="sc-lbl">ครั้ง {{ i }}<br><span class="sc-max">/{{ maxScores[i-1] || 20 }}</span></div>
              <div class="sc-val">
                {{ sub.scores['u'+i] !== null && sub.scores['u'+i] !== undefined && sub.scores['u'+i] !== '' ? sub.scores['u'+i] : '—' }}
              </div>
            </div>
          </div>
          <div class="score-total-row">
            คะแนนรวม <strong>{{ sub.totalScore }}</strong> / {{ sub.totalMax }}
            <span class="pass-tag" :class="sub.passed ? 'pass-tag--pass' : 'pass-tag--warn'">
              {{ sub.passed ? 'ผ่าน' : 'ยังไม่ผ่าน' }}
            </span>
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
const session = computed(() => studentStore.session || {})

const subjects = ref([])
const loading = ref(false)
const numUnits = ref(8)
const maxScores = ref(Array(8).fill(20))
const passPct = ref(50)

const grand = computed(() => {
  const g = { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, all: 0 }
  for (const s of subjects.value) {
    g.attend += s.attend; g.late += s.late; g.sick += s.sick
    g.leave += s.leave; g.absent += s.absent; g.all += s.all
  }
  return g
})

function classify(status) {
  if (!status) return 'absent'
  if (status.includes('มาสาย')) return 'late'
  if (status.includes('มาเรียน')) return 'attend'
  if (status.includes('ป่วย')) return 'sick'
  if (status.includes('ลากิจ') || status.includes('กิจ') || status.includes('ราชการ')) return 'leave'
  return 'absent'
}

function attendPct(sub) {
  if (!sub.all) return 0
  return Math.round(((sub.attend + sub.late + sub.sick + sub.leave) / sub.all) * 100)
}

onMounted(async () => {
  const { school_id, class_id, student_code, current_term } = session.value
  if (!school_id || !student_code) return
  loading.value = true
  try {
    const [actualsRes, slotsRes, subjectsRes, scoresRes, schoolRes, teachersRes] = await Promise.all([
      supabase.from('teach_actuals')
        .select('subject_id, student_records, slot_type, actual_teacher_id, planned_teacher_id, is_filled')
        .eq('school_id', school_id).eq('class_id', class_id)
        .eq('term_id', current_term)
        .neq('slot_type', 'homeroom'),
      supabase.from('timetable_slots')
        .select('subject_id, teacher_id, teacher_name')
        .eq('school_id', school_id).eq('class_id', class_id)
        .eq('term_id', current_term).neq('slot_type', 'activity'),
      supabase.from('subjects')
        .select('subject_code, name').eq('school_id', school_id),
      supabase.from('score_records')
        .select('subject_code, scores')
        .eq('school_id', school_id).eq('class_id', class_id)
        .eq('student_id', student_code).eq('term_id', current_term),
      supabase.from('schools').select('settings').eq('id', school_id).single(),
      supabase.from('teachers')
        .select('teacher_code, prefix, first_name, last_name').eq('school_id', school_id),
    ])

    // score settings
    const ss = schoolRes.data?.settings?.score_settings || {}
    numUnits.value  = ss.num_units  || 8
    maxScores.value = ss.max_scores || Array(8).fill(20)
    passPct.value   = ss.pass_pct   || 50

    const subjectMap  = new Map((subjectsRes.data  || []).map(s => [s.subject_code, s.name]))
    const teacherMap  = new Map((teachersRes.data   || []).map(t => [t.teacher_code, `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim()]))
    const scoreMap    = new Map((scoresRes.data     || []).map(r => [r.subject_code, r.scores || {}]))

    // หา teacher ต่อ subject จาก timetable_slots
    const slotTeacherMap = new Map()
    for (const s of (slotsRes.data || [])) {
      if (!s.subject_id || slotTeacherMap.has(s.subject_id)) continue
      const name = teacherMap.get(s.teacher_id) || s.teacher_name || ''
      if (name) slotTeacherMap.set(s.subject_id, name)
    }

    // รวม attendance จาก teach_actuals
    const acc = {}
    for (const row of (actualsRes.data || [])) {
      const sid = row.subject_id
      if (!sid) continue
      if (!acc[sid]) acc[sid] = { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, all: 0 }
      acc[sid].all++
      if (!row.is_filled) {
        acc[sid].absent++
      } else {
        const sr = row.student_records || {}
        const myRec = sr[student_code] || {}
        acc[sid][classify(myRec.status)]++
      }
    }

    // รวมทุกอย่างต่อวิชา
    const allSubjectIds = new Set([...Object.keys(acc), ...[...scoreMap.keys()]])
    subjects.value = [...allSubjectIds].map(sid => {
      const scores = scoreMap.get(sid) || {}
      const hasScores = Object.values(scores).some(v => v !== null && v !== undefined && v !== '')
      let totalScore = 0, totalMax = 0
      for (let i = 1; i <= numUnits.value; i++) {
        const v = scores['u' + i]
        const m = maxScores.value[i - 1] || 20
        if (v !== null && v !== undefined && v !== '') { totalScore += Number(v); totalMax += m }
      }
      const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
      return {
        subject_id: sid,
        name: subjectMap.get(sid) || sid,
        teacher: slotTeacherMap.get(sid) || '',
        ...(acc[sid] || { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, all: 0 }),
        scores, hasScores, totalScore, totalMax,
        passed: pct >= passPct.value,
      }
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'))

  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 12px; }
.intro-card {
  display: flex; gap: 12px; background: linear-gradient(135deg,#eff6ff,#dbeafe);
  border-radius: 14px; padding: 14px; margin-bottom: 14px;
  border-left: 4px solid #3b82f6;
}
.intro-icon { font-size: 28px; flex-shrink: 0; }
.intro-heading { font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 4px; }
.intro-body { font-size: 13px; color: #1d4ed8; line-height: 1.6; }
.center-text { text-align: center; color: #9ca3af; padding: 40px 0; }

.total-card {
  background: white; border-radius: 16px; padding: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 16px;
}
.total-title { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 12px; }
.total-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.total-cell { border-radius: 12px; padding: 12px 6px; text-align: center; }
.tc-num { font-size: 28px; font-weight: 900; line-height: 1; }
.tc-lbl { font-size: 12px; margin-top: 4px; }
.c-attend { background: #dcfce7; color: #166534; }
.c-late   { background: #fef9c3; color: #854d0e; }
.c-sick   { background: #dbeafe; color: #1e40af; }
.c-leave  { background: #ede9fe; color: #5b21b6; }
.c-absent { background: #fef2f2; color: #b91c1c; }
.c-all    { background: #f3f4f6; color: #374151; }

.empty-card { background: white; border-radius: 16px; padding: 40px 20px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.07); }
.empty-icon { font-size: 40px; margin-bottom: 10px; }
.empty-text { font-size: 15px; color: #9ca3af; }

.subject-card {
  background: white; border-radius: 18px; padding: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 14px;
}
.sub-header { margin-bottom: 14px; }
.sub-name { font-size: 18px; font-weight: 800; color: #1e1b4b; margin-bottom: 4px; }
.sub-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sub-code { font-size: 12px; background: #f3f4f6; color: #6b7280; padding: 2px 8px; border-radius: 6px; }
.sub-teacher { font-size: 13px; color: #6b7280; }

.sub-section-label { font-size: 13px; font-weight: 700; color: #6366f1; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .5px; }
.no-data { font-size: 14px; color: #9ca3af; padding: 6px 0 4px; font-style: italic; }

.attend-chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.chip { border-radius: 10px; padding: 10px 6px; text-align: center; }
.chip-num { display: block; font-size: 24px; font-weight: 900; line-height: 1; }
.chip-lbl { display: block; font-size: 11px; margin-top: 3px; }

.attend-bar-track { height: 8px; background: #f3f4f6; border-radius: 99px; overflow: hidden; margin-bottom: 4px; }
.attend-bar-fill { height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 99px; transition: width .4s; }
.attend-pct-label { font-size: 12px; color: #6b7280; }

.scores-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.score-chip { border-radius: 10px; padding: 8px 4px; text-align: center; }
.sc-filled { background: #f0fdf4; }
.sc-empty  { background: #f9fafb; }
.sc-lbl { font-size: 10px; color: #9ca3af; line-height: 1.4; margin-bottom: 4px; }
.sc-max { color: #d1d5db; }
.sc-val { font-size: 20px; font-weight: 800; color: #1f2937; }
.sc-empty .sc-val { color: #d1d5db; }

.score-total-row { font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.score-total-row strong { font-size: 18px; color: #1f2937; }
.pass-tag { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 8px; }
.pass-tag--pass { background: #dcfce7; color: #166534; }
.pass-tag--warn { background: #fef9c3; color: #854d0e; }
</style>
