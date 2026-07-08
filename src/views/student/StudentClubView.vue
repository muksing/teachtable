<template>
  <div>
    <h2 class="page-title">🎯 กิจกรรมชุมนุม</h2>

    <div v-if="loading" class="empty-card">
      <div class="empty-icon">⏳</div>
      <div>กำลังโหลด...</div>
    </div>

    <div v-else-if="!clubs.length" class="empty-card">
      <div class="empty-icon">🎪</div>
      <div>ยังไม่มีข้อมูลชุมนุมในภาคเรียนนี้</div>
    </div>

    <div v-for="club in clubs" :key="club.club_id" class="club-card">
      <div class="club-header">
        <div class="club-name">{{ club.name }}</div>
        <div v-if="club.type === 'special'" class="club-badge">พิเศษ</div>
      </div>
      <div class="club-teacher">ครูที่ปรึกษา: {{ club.teacher_name || '-' }}</div>

      <!-- Evaluation result -->
      <div v-if="club.my_eval" class="eval-row" :class="club.my_eval.result === 'ผ่าน' ? 'eval--pass' : 'eval--fail'">
        {{ club.my_eval.result === 'ผ่าน' ? '✅ ผ่าน' : '❌ ไม่ผ่าน' }}
        <span v-if="club.my_eval.note" class="eval-note"> — {{ club.my_eval.note }}</span>
      </div>

      <!-- Attendance summary bar -->
      <div class="club-summary">
        <div class="club-summary-text">
          เข้าร่วม <strong>{{ mySessionCount(club) }}</strong> / {{ club.sessions.length }} ครั้ง
        </div>
        <div class="club-bar-track">
          <div class="club-bar-fill" :style="{ width: clubPct(club) + '%' }"></div>
        </div>
      </div>

      <!-- Sessions attendance -->
      <div class="sessions-header">รายละเอียดแต่ละครั้ง</div>
      <div class="sessions-list">
        <div v-for="session in club.sessions" :key="session.session_id" class="session-row">
          <div class="session-status" :class="sessionStatusClass(session)">
            {{ myAttendStatus(session) }}
          </div>
          <div class="session-info">
            <div class="session-topic">{{ session.topic || `ครั้งที่ ${session.session_number}` }}</div>
            <div class="session-date">{{ formatDate(session.session_date) }}</div>
          </div>
        </div>
        <div v-if="!club.sessions.length" class="empty-text">ยังไม่มีการบันทึกกิจกรรม</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const studentCode  = computed(() => studentStore.session?.student_code || '')
const schoolId     = computed(() => studentStore.session?.school_id    || '')
const currentTerm  = computed(() => studentStore.session?.current_term || '')

const loading = ref(false)
const clubs   = ref([])

async function loadMyClubs() {
  if (!studentCode.value) return
  loading.value = true
  try {
    const membershipsQ = supabase
      .from('club_memberships')
      .select('club_id, eval_result, eval_note')
      .eq('student_id', studentCode.value)
      .eq('school_id', schoolId.value)
    if (currentTerm.value) membershipsQ.eq('term_id', currentTerm.value)
    const { data: memberships } = await membershipsQ

    if (!memberships?.length) { clubs.value = []; return }

    const clubIds = memberships.map(m => m.club_id)
    const [{ data: clubRows }, { data: sessionRows }] = await Promise.all([
      supabase.from('clubs').select('club_id, name, type, teacher_name, is_active').in('club_id', clubIds),
      supabase.from('club_sessions').select('*').in('club_id', clubIds).order('session_number'),
    ])

    const clubMap = Object.fromEntries((clubRows || []).map(c => [c.club_id, c]))
    clubs.value = memberships.map(m => ({
      ...clubMap[m.club_id],
      my_eval:  m.eval_result ? { result: m.eval_result, note: m.eval_note } : null,
      sessions: (sessionRows || []).filter(s => s.club_id === m.club_id),
    })).filter(c => c.club_id)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function myAttendStatus(sess) {
  return sess.attendance?.[studentCode.value]?.status || '-'
}

function sessionStatusClass(sess) {
  const st = myAttendStatus(sess)
  if (st.includes('มาเรียน')) return 'st--attend'
  if (st.includes('มาสาย'))   return 'st--late'
  if (st.includes('ลาป่วย'))  return 'st--sick'
  if (st.includes('ลากิจ'))   return 'st--leave'
  if (st.includes('ขาด') || st.includes('โดด')) return 'st--absent'
  return ''
}

function mySessionCount(club) {
  return club.sessions.filter(s => {
    const st = s.attendance?.[studentCode.value]?.status || ''
    return st.includes('มาเรียน') || st.includes('มาสาย')
  }).length
}

function clubPct(club) {
  const total = club.sessions.length
  if (!total) return 0
  return Math.round((mySessionCount(club) / total) * 100)
}

function formatDate(d) {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt)) return d
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()+543}`
}

onMounted(loadMyClubs)
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
