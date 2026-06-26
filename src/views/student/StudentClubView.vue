<template>
  <div>
    <h2 class="page-title">🎯 กิจกรรมชุมนุม</h2>

    <div v-if="!myClubs.length" class="empty-card">
      <div class="empty-icon">🎪</div>
      <div>ยังไม่มีข้อมูลชุมนุมในภาคเรียนนี้</div>
    </div>

    <div v-for="club in myClubs" :key="club.club_id" class="club-card">
      <div class="club-header">
        <div class="club-name">{{ club.name }}</div>
        <div v-if="club.type === 'special'" class="club-badge">พิเศษ</div>
      </div>
      <div class="club-teacher">ครูที่ปรึกษา: {{ club.teacher_name || '-' }}</div>

      <!-- Evaluation result -->
      <div v-if="myEval(club)" class="eval-row" :class="myEval(club).result === 'ผ่าน' ? 'eval--pass' : 'eval--fail'">
        {{ myEval(club).result === 'ผ่าน' ? '✅ ผ่าน' : '❌ ไม่ผ่าน' }}
        <span v-if="myEval(club).note" class="eval-note"> — {{ myEval(club).note }}</span>
      </div>

      <!-- Attendance summary bar -->
      <div class="club-summary">
        <div class="club-summary-text">
          เข้าร่วม <strong>{{ mySessionCount(club) }}</strong> / {{ totalSessions(club) }} ครั้ง
        </div>
        <div class="club-bar-track">
          <div class="club-bar-fill" :style="{ width: clubPct(club) + '%' }"></div>
        </div>
      </div>

      <!-- Sessions attendance -->
      <div class="sessions-header">รายละเอียดแต่ละครั้ง</div>
      <div class="sessions-list">
        <div v-for="(session, sid) in club.sessions" :key="sid" class="session-row">
          <div class="session-status" :class="sessionStatusClass(session)">
            {{ myAttendStatus(session) }}
          </div>
          <div class="session-info">
            <div class="session-topic">{{ session.topic || `ครั้งที่ ${session.session_number}` }}</div>
            <div class="session-date">{{ formatDate(session.session_date) }}</div>
          </div>
        </div>
        <div v-if="!Object.keys(club.sessions || {}).length" class="empty-text">ยังไม่มีการบันทึกกิจกรรม</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const session = computed(() => studentStore.session || {})

const myClubs = computed(() => {
  const clubs = session.value.clubs || {}
  const studentId = session.value.student_code
  return Object.values(clubs).filter(club =>
    club.members && Object.prototype.hasOwnProperty.call(club.members, studentId)
  )
})

function myEval(club) {
  const id = session.value.student_code
  return club.evaluations?.[id] || null
}

function myAttendStatus(sess) {
  const id = session.value.student_code
  return sess.attendance?.[id]?.status || '-'
}

function sessionStatusClass(sess) {
  const st = myAttendStatus(sess)
  if (st.includes('มาเรียน')) return 'st--attend'
  if (st.includes('มาสาย')) return 'st--late'
  if (st.includes('ลาป่วย')) return 'st--sick'
  if (st.includes('ลากิจ')) return 'st--leave'
  if (st.includes('ขาด') || st.includes('โดด')) return 'st--absent'
  return ''
}

function mySessionCount(club) {
  const id = session.value.student_code
  return Object.values(club.sessions || {}).filter(s => {
    const st = s.attendance?.[id]?.status || ''
    return st.includes('มาเรียน') || st.includes('มาสาย')
  }).length
}

function totalSessions(club) {
  return Object.keys(club.sessions || {}).length
}

function clubPct(club) {
  const total = totalSessions(club)
  if (!total) return 0
  return Math.round((mySessionCount(club) / total) * 100)
}

function formatDate(d) {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt)) return d
  const day = String(dt.getDate()).padStart(2, '0')
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const year = dt.getFullYear() + 543
  return `${day}/${month}/${year}`
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 16px; }
.empty-card {
  background: white; border-radius: 16px; padding: 40px 20px;
  text-align: center; color: #9ca3af; font-size: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
}
.empty-icon { font-size: 40px; margin-bottom: 10px; }
.empty-text { text-align: center; color: #9ca3af; font-size: 13px; padding: 10px 0; }

.club-card {
  background: white; border-radius: 16px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 14px;
}
.club-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.club-name { font-size: 16px; font-weight: 800; color: #1e1b4b; flex: 1; }
.club-badge { background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
.club-teacher { font-size: 13px; color: #6b7280; margin-bottom: 10px; }
.club-summary { margin-bottom: 12px; }
.club-summary-text { font-size: 13px; color: #374151; margin-bottom: 6px; }
.club-bar-track { height: 8px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
.club-bar-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6, #6366f1); border-radius: 99px; transition: width .4s; }

.eval-row {
  border-radius: 8px; padding: 8px 12px; font-size: 13px;
  font-weight: 700; margin-bottom: 12px;
}
.eval--pass  { background: #dcfce7; color: #166534; }
.eval--fail  { background: #fef2f2; color: #b91c1c; }
.eval-note { font-weight: 400; }

.sessions-header { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 8px; }
.sessions-list { display: flex; flex-direction: column; gap: 6px; }
.session-row { display: flex; align-items: center; gap: 10px; }
.session-status {
  font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 6px; white-space: nowrap;
}
.st--attend  { background: #dcfce7; color: #166534; }
.st--late    { background: #fef9c3; color: #854d0e; }
.st--sick    { background: #dbeafe; color: #1e40af; }
.st--leave   { background: #ede9fe; color: #5b21b6; }
.st--absent  { background: #fef2f2; color: #b91c1c; }
.session-info { flex: 1; }
.session-topic { font-size: 13px; font-weight: 600; color: #374151; }
.session-date { font-size: 11px; color: #9ca3af; }
</style>
