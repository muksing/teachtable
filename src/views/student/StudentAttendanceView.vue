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
          <div class="total-cell c-attend">  <div class="tc-num">{{ grand.attend    }}</div><div class="tc-lbl">มาเรียน</div></div>
          <div class="total-cell c-late">    <div class="tc-num">{{ grand.late      }}</div><div class="tc-lbl">มาสาย</div></div>
          <div class="total-cell c-sick">    <div class="tc-num">{{ grand.sick      }}</div><div class="tc-lbl">ลาป่วย</div></div>
          <div class="total-cell c-leave">   <div class="tc-num">{{ grand.leave     }}</div><div class="tc-lbl">ลากิจ</div></div>
          <div class="total-cell c-absent">  <div class="tc-num">{{ grand.absent    }}</div><div class="tc-lbl">ขาดเรียน</div></div>
          <div class="total-cell c-pending"> <div class="tc-num">{{ grand.notFilled }}</div><div class="tc-lbl">ยังไม่บันทึก</div></div>
          <div class="total-cell c-all">     <div class="tc-num">{{ grand.all       }}</div><div class="tc-lbl">ทั้งหมด</div></div>
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
            <div class="chip c-attend">  <span class="chip-num">{{ sub.attend    }}</span><span class="chip-lbl">มาเรียน</span></div>
            <div class="chip c-late">    <span class="chip-num">{{ sub.late      }}</span><span class="chip-lbl">มาสาย</span></div>
            <div class="chip c-sick">    <span class="chip-num">{{ sub.sick      }}</span><span class="chip-lbl">ลาป่วย</span></div>
            <div class="chip c-leave">   <span class="chip-num">{{ sub.leave     }}</span><span class="chip-lbl">ลากิจ</span></div>
            <div class="chip c-absent">  <span class="chip-num">{{ sub.absent    }}</span><span class="chip-lbl">ขาดเรียน</span></div>
            <div class="chip c-pending"> <span class="chip-num">{{ sub.notFilled }}</span><span class="chip-lbl">ยังไม่บันทึก</span></div>
            <div class="chip c-all">     <span class="chip-num">{{ sub.all       }}</span><span class="chip-lbl">ทั้งหมด</span></div>
          </div>
          <!-- stacked bar: เขียว = มาเรียน+มาสาย / แดง = ลา+ขาด+ยังไม่บันทึก -->
          <div class="attend-bar-track">
            <div class="attend-seg seg-attend" :style="{ width: segPct(sub,'attend') + '%' }"></div>
            <div class="attend-seg seg-absent" :style="{ width: segPct(sub,'absent') + '%' }"></div>
          </div>
          <div class="attend-pct-row">
            <span class="attend-pct-label">
              <span class="pct-attend">มาเรียน {{ attendFilled(sub) }}/{{ sub.all }} คาบ</span>
              <span class="pct-num">{{ attendPct(sub) }}%</span>
            </span>
            <span v-if="sub.all > 0" class="ms-badge" :class="attendPct(sub) < 80 ? 'ms-badge--fail' : 'ms-badge--pass'">
              {{ attendPct(sub) < 80 ? 'มส.' : 'มีสิทธิ์สอบ' }}
            </span>
          </div>
        </div>

        <!-- คะแนนเก็บ (จากครูผู้สอนเท่านั้น) -->
        <div class="sub-section-label" style="margin-top:18px">คะแนนเก็บ</div>
        <div v-if="!sub.hasScores" class="no-data">ยังไม่มีข้อมูล</div>
        <div v-else>
          <div class="scores-row">
            <div
              v-for="i in numUnits"
              :key="i"
              class="score-chip"
              :class="hasScore(sub, i) ? 'sc-filled' : 'sc-empty'"
            >
              <div class="sc-label">ครั้ง {{ i }}</div>
              <div class="sc-val">{{ hasScore(sub, i) ? sub.scores['u'+i] : '—' }}</div>
              <div class="sc-max-lbl">/{{ maxScores[i-1] || 20 }}</div>
              <div class="sc-bar-track">
                <div class="sc-bar-fill"
                  :style="{ width: hasScore(sub,i) ? Math.round(Number(sub.scores['u'+i]) / (maxScores[i-1]||20) * 100) + '%' : '0%' }"
                ></div>
              </div>
            </div>
          </div>
          <div class="score-total-row">
            <div class="score-total-left">
              <span class="score-total-num">{{ sub.totalScore }}</span>
              <span class="score-total-sep">/</span>
              <span class="score-total-max">{{ sub.totalMax }}</span>
              <span class="score-total-lbl">คะแนนรวม</span>
            </div>
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
  const g = { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, notFilled: 0, all: 0 }
  for (const s of subjects.value) {
    g.attend += s.attend; g.late += s.late; g.sick += s.sick
    g.leave  += s.leave;  g.absent += s.absent; g.notFilled += (s.notFilled || 0); g.all += s.all
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

function attendFilled(sub) {
  return sub.attend + sub.late  // เขียว: มาเรียน + มาสาย
}

function absentCount(sub) {
  return (sub.sick || 0) + (sub.leave || 0) + (sub.absent || 0) + (sub.notFilled || 0)
}

function attendPct(sub) {
  if (!sub.all) return 0
  return Math.round((attendFilled(sub) / sub.all) * 100)
}

function segPct(sub, type) {
  if (!sub.all) return 0
  const val = type === 'attend' ? attendFilled(sub) : absentCount(sub)
  return Math.round((val / sub.all) * 100)
}

function hasScore(sub, i) {
  const v = sub.scores['u' + i]
  return v !== null && v !== undefined && v !== ''
}

onMounted(async () => {
  const { school_id, class_id, student_code, current_term } = session.value
  if (!school_id || !student_code) return
  loading.value = true
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    const [actualsRes, slotsRes, subjectsRes, scoresRes, schoolRes, teachersRes] = await Promise.all([
      supabase.from('teach_actuals')
        .select('subject_id, period_number, date, student_records, slot_type, is_filled')
        .eq('school_id', school_id).eq('class_id', class_id)
        .eq('term_id', current_term)
        .lte('date', today)
        .not('slot_type', 'in', '("homeroom","activity")'),
      supabase.from('timetable_slots')
        .select('subject_id, period_number, day_of_week, teacher_id, teacher_name')
        .eq('school_id', school_id).eq('class_id', class_id)
        .eq('term_id', current_term)
        .not('slot_type', 'in', '("homeroom","activity")'),
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

    // 1. slotMap: period_dayNum → { subject_id, teacher_id, teacher_name }
    //    ใช้ตาราง timetable ปัจจุบันเป็น source of truth เพื่อ resolve subject_id ถูกต้อง
    //    แม้ teach_actuals จะมี subject_id เก่า (ก่อนแก้ตาราง) ก็ยังนับถูกห้อง
    const THAI_DAY_ARR = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
    const THAI_DAY_NUM = { จันทร์:1,อังคาร:2,พุธ:3,พฤหัสบดี:4,ศุกร์:5,เสาร์:6,อาทิตย์:7 }
    const slotMap = new Map()          // key = "period_dayNum"
    const slotTeacherMap = new Map()   // subject_id → teacher name
    const canonicalSubjectIds = new Set()
    for (const s of (slotsRes.data || [])) {
      if (!s.subject_id) continue
      canonicalSubjectIds.add(s.subject_id)
      const dayNum = Number(s.day_of_week) || THAI_DAY_NUM[s.day_of_week] || 0
      if (dayNum) slotMap.set(`${s.period_number}_${dayNum}`, s)
      if (!slotTeacherMap.has(s.subject_id)) {
        const name = teacherMap.get(s.teacher_id) || s.teacher_name || ''
        if (name) slotTeacherMap.set(s.subject_id, name)
      }
    }

    // 2. นับคาบ — resolve subject_id จาก timetable ปัจจุบัน ไม่เชื่อค่าใน DB
    const acc = {}
    for (const row of (actualsRes.data || [])) {
      const d = new Date(row.date + 'T00:00:00')
      const dayNum = THAI_DAY_NUM[THAI_DAY_ARR[d.getDay()]] || 0
      const currentSlot = slotMap.get(`${row.period_number}_${dayNum}`)
      const sid = currentSlot?.subject_id || row.subject_id
      if (!sid || !canonicalSubjectIds.has(sid)) continue
      if (!acc[sid]) acc[sid] = { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, notFilled: 0, all: 0 }
      acc[sid].all++
      if (!row.is_filled) {
        acc[sid].notFilled++
      } else {
        const sr = row.student_records || {}
        const myRec = sr[student_code] || {}
        acc[sid][classify(myRec.status)]++
      }
    }

    // 3. แสดงเฉพาะวิชาที่อยู่ใน timetable ของห้องนี้เท่านั้น
    subjects.value = [...canonicalSubjectIds].map(sid => {
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
        ...(acc[sid] || { attend: 0, late: 0, sick: 0, leave: 0, absent: 0, notFilled: 0, all: 0 }),
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
.total-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.total-cell { border-radius: 12px; padding: 12px 6px; text-align: center; }
.tc-num { font-size: 28px; font-weight: 900; line-height: 1; }
.tc-lbl { font-size: 11px; margin-top: 4px; }
.c-attend  { background: #dcfce7; color: #166534; }
.c-late    { background: #fef9c3; color: #854d0e; }
.c-sick    { background: #dbeafe; color: #1e40af; }
.c-leave   { background: #ede9fe; color: #5b21b6; }
.c-absent  { background: #fef2f2; color: #b91c1c; }
.c-pending { background: #f1f5f9; color: #64748b; }
.c-all     { background: #f3f4f6; color: #374151; }

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

.attend-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.chip { border-radius: 10px; padding: 10px 6px; text-align: center; }
.chip-num { display: block; font-size: 24px; font-weight: 900; line-height: 1; }
.chip-lbl { display: block; font-size: 11px; margin-top: 3px; }

.attend-bar-track {
  height: 20px; background: #f1f5f9; border-radius: 99px;
  overflow: hidden; margin-bottom: 8px;
  display: flex;
}
.attend-seg { height: 100%; transition: width .4s; }
.seg-attend { background: linear-gradient(90deg, #16a34a, #22c55e); }
.seg-absent { background: linear-gradient(90deg, #dc2626, #ef4444); }

.attend-pct-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.attend-pct-label { display: flex; align-items: center; gap: 10px; }
.pct-attend { font-size: 15px; font-weight: 700; color: #166534; }
.pct-num    { font-size: 18px; font-weight: 900; color: #1f2937; }
.ms-badge { font-size: 13px; font-weight: 800; padding: 4px 14px; border-radius: 10px; white-space: nowrap; }
.ms-badge--pass { background: #dcfce7; color: #166534; }
.ms-badge--fail { background: #fef2f2; color: #b91c1c; }

.scores-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.score-chip {
  border-radius: 14px; padding: 12px 8px 10px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.sc-filled { background: #f0fdf4; border: 1.5px solid #bbf7d0; }
.sc-empty  { background: #f9fafb; border: 1.5px solid #e5e7eb; }
.sc-label  { font-size: 11px; font-weight: 600; color: #9ca3af; margin-bottom: 2px; }
.sc-val    { font-size: 26px; font-weight: 900; color: #15803d; line-height: 1; }
.sc-empty .sc-val { color: #d1d5db; font-size: 22px; }
.sc-max-lbl { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
.sc-bar-track { width: 100%; height: 5px; background: #e5e7eb; border-radius: 99px; overflow: hidden; margin-top: 2px; }
.sc-bar-fill  { height: 100%; background: linear-gradient(90deg,#16a34a,#22c55e); border-radius: 99px; transition: width .3s; }

.score-total-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #f8fafc; border-radius: 12px; padding: 12px 16px; gap: 8px;
}
.score-total-left { display: flex; align-items: baseline; gap: 4px; }
.score-total-num  { font-size: 28px; font-weight: 900; color: #1f2937; }
.score-total-sep  { font-size: 18px; color: #9ca3af; }
.score-total-max  { font-size: 20px; font-weight: 700; color: #6b7280; }
.score-total-lbl  { font-size: 13px; color: #9ca3af; margin-left: 4px; }
.pass-tag { font-size: 14px; font-weight: 800; padding: 6px 16px; border-radius: 10px; }
.pass-tag--pass { background: #dcfce7; color: #166534; }
.pass-tag--warn { background: #fef9c3; color: #854d0e; }
</style>
