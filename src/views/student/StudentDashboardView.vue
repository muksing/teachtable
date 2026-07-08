<template>
  <div>
    <!-- ── Announcements ──────────────────────────────── -->
    <AnnSlideshow :items="announcements">
      <template #footer>
        <router-link to="/student/announcements" class="ann-see-all">ดูประกาศทั้งหมด ›</router-link>
      </template>
    </AnnSlideshow>

    <!-- ── Profile card ─────────────────────────────────── -->
    <div class="profile-card">
      <router-link to="/student/profile" class="avatar-wrap">
        <img v-if="photoUrl" :src="fixPhotoUrl(photoUrl)" class="profile-avatar" @error="avatarErr = true" />
        <div v-else class="profile-avatar-placeholder">{{ initials }}</div>
        <div class="avatar-edit-badge">✏️</div>
      </router-link>
      <div class="profile-info">
        <div class="profile-prefix">{{ session.prefix }}</div>
        <div class="profile-name">
          <span class="name-first">{{ session.first_name }}</span>
          <span class="name-last">{{ session.last_name }}</span>
        </div>
        <div class="profile-meta">{{ session.student_code }} · ห้อง {{ session.class_id }}</div>
        <div class="profile-term">{{ termLabel }}</div>
      </div>
    </div>

    <!-- ── Check-in strip ───────────────────────────────── -->
    <router-link to="/student/checkin" class="checkin-strip" :class="todayCheckin ? 'strip--done' : 'strip--idle'">
      <span class="strip-icon">{{ todayCheckin ? '✅' : '🏫' }}</span>
      <span class="strip-text">
        {{ todayCheckin ? `เช็คอินแล้ว ${formatCheckinTime(todayCheckin.checkin_time)}` : 'เช็คอินเข้าโรงเรียน' }}
      </span>
      <span class="strip-arrow">›</span>
    </router-link>

    <!-- ── Behavior scores ──────────────────────────────── -->
    <div class="section-card" @click="$router.push('/student/behavior')">
      <div class="sc-label">⭐ คะแนนพฤติกรรมรวม</div>
      <div class="sc-score">{{ session.total_behavior_score ?? 0 }}</div>
      <div class="sc-chips">
        <span class="sc-chip sc-chip--g">ทั่วไป {{ session.general_behavior_score ?? 0 }}</span>
        <span class="sc-chip sc-chip--a">มาเรียน {{ session.attendance_behavior_score ?? 0 }}</span>
        <span class="sc-chip sc-chip--l">ในห้อง {{ session.learning_behavior_score ?? 0 }}</span>
      </div>
    </div>

    <!-- ── BMI quick card ───────────────────────────────── -->
    <div v-if="latestHealth" class="bmi-card" @click="$router.push('/student/health')">
      <div class="bmi-left">
        <div class="bmi-label">BMI ล่าสุด</div>
        <div class="bmi-value">{{ latestHealth.bmi }}</div>
        <div class="bmi-result" :style="{ color: bmiColor(latestHealth.bmi) }">{{ bmiLabel(latestHealth.bmi) }}</div>
      </div>
      <div class="bmi-right">
        <div class="bmi-detail">น้ำหนัก {{ latestHealth.weight }} กก.</div>
        <div class="bmi-detail">ส่วนสูง {{ latestHealth.height }} ซม.</div>
        <div class="bmi-date">{{ formatDate(latestHealth.recorded_date) }}</div>
      </div>
      <div class="bmi-arrow">›</div>
    </div>

    <!-- ── Quick menu ───────────────────────────────────── -->
    <div class="menu-grid">
      <router-link to="/student/health" class="menu-card menu-card--health">
        <div class="menu-icon">💪</div>
        <div class="menu-label">สุขภาพ &<br>การเติบโต</div>
        <div class="menu-sub">ติดตามน้ำหนัก ส่วนสูง BMI</div>
      </router-link>
      <router-link to="/student/good-deeds" class="menu-card menu-card--deeds">
        <div class="menu-icon">🌟</div>
        <div class="menu-label">บันทึก<br>ความดี</div>
        <div class="menu-sub">จดจำสิ่งดีๆ ที่ทำ</div>
      </router-link>
      <router-link to="/student/gratitude" class="menu-card menu-card--gratitude">
        <div class="menu-icon">🙏</div>
        <div class="menu-label">ฉันอยาก<br>ขอบคุณ</div>
        <div class="menu-sub">ชื่นชมสิ่งดีรอบตัว</div>
      </router-link>
      <router-link to="/student/attendance" class="menu-card menu-card--scores">
        <div class="menu-icon">📊</div>
        <div class="menu-label">สรุป<br>รายวิชา</div>
        <div class="menu-sub">เวลาเรียน &amp; คะแนนเก็บ</div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { fixPhotoUrl } from '@/composables/useStudentUpload'
import { useCheckin } from '@/composables/useCheckin'
import AnnSlideshow from '@/components/AnnSlideshow.vue'

const announcements = ref([])

async function loadAnnouncements() {
  const { school_id } = (studentStore.session || {})
  if (!school_id) return
  try {
    const { data, error } = await supabase.rpc('get_school_announcements_public', {
      p_school_id: String(school_id),
      p_target:    'student',
    })
    if (error) { console.warn('[announcements]', error.message); return }
    announcements.value = Array.isArray(data) ? data : (data ? [data] : [])
  } catch (e) { console.warn('[announcements]', e) }
}


const studentStore = useStudentStore()
const { todayCheckin, loadTodayCheckin } = useCheckin()

const session  = computed(() => studentStore.session || {})
const avatarErr = ref(false)

const photoUrl = computed(() => {
  if (avatarErr.value) return ''
  return session.value.photo_url || ''
})
const initials = computed(() => (session.value.first_name || '?').charAt(0))

const termLabel = computed(() => {
  const s = session.value
  if (s.term_year && s.term_semester) return `ปีการศึกษา ${s.term_year} ภาคเรียนที่ ${s.term_semester}`
  const t = s.current_term || ''
  if (t.includes('_')) { const [y, sm] = t.split('_'); return `ปีการศึกษา ${y} ภาคเรียนที่ ${sm}` }
  return t || ''
})

function formatCheckinTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
}

const latestHealth = ref(null)

function bmiLabel(bmi) {
  if (!bmi) return ''
  if (bmi < 18.5) return 'น้ำหนักน้อย'
  if (bmi < 23)   return 'น้ำหนักปกติ'
  if (bmi < 25)   return 'น้ำหนักเกิน'
  return 'อ้วน'
}
function bmiColor(bmi) {
  if (!bmi) return '#6b7280'
  if (bmi < 18.5) return '#2563eb'
  if (bmi < 23)   return '#16a34a'
  if (bmi < 25)   return '#d97706'
  return '#dc2626'
}
function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${Number(y) + 543}`
}

async function loadLatestHealth() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  const { data } = await supabase
    .from('student_health_records')
    .select('weight, height, bmi, recorded_date')
    .eq('school_id', school_id).eq('student_code', student_code)
    .order('recorded_date', { ascending: false })
    .limit(1).maybeSingle()
  latestHealth.value = data || null
}

onMounted(() => {
  loadLatestHealth()
  loadTodayCheckin()
  loadAnnouncements()
})
</script>

<style scoped>
/* Profile card */
.profile-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 2px 14px rgba(0,0,0,.08);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
  display: block;
  text-decoration: none;
}
.profile-avatar {
  width: 76px; height: 76px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #ede9fe;
  box-shadow: 0 2px 10px rgba(109,40,217,.2);
}
.profile-avatar-placeholder {
  width: 76px; height: 76px;
  border-radius: 50%;
  background: linear-gradient(135deg,#ede9fe,#ddd6fe);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 800; color: #6d28d9;
}
.avatar-edit-badge {
  position: absolute;
  bottom: 2px; right: 2px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #7c3aed;
  color: white;
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid white;
}
.profile-info { flex: 1; min-width: 0; }
.profile-prefix { font-size: 12px; color: #9ca3af; margin-bottom: 1px; }
.profile-name { display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline; }
.name-first { font-size: 20px; font-weight: 900; color: #6d28d9; }
.name-last  { font-size: 20px; font-weight: 900; color: #1e1b4b; }
.profile-meta { font-size: 13px; color: #6b7280; margin-top: 3px; }
.profile-term { font-size: 11px; color: #9ca3af; margin-top: 2px; }

/* Check-in strip */
.checkin-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 16px;
  text-decoration: none;
  margin-bottom: 12px;
  font-weight: 700;
  transition: opacity .15s;
}
.checkin-strip:active { opacity: .85; }
.strip--idle {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  box-shadow: 0 4px 16px rgba(79,70,229,.35);
}
.strip--done {
  background: linear-gradient(135deg, #059669, #10b981);
  color: white;
  box-shadow: 0 4px 16px rgba(5,150,105,.3);
}
.strip-icon { font-size: 22px; }
.strip-text { flex: 1; font-size: 15px; }
.strip-arrow { font-size: 22px; opacity: .7; }

/* Behavior */
.section-card {
  background: white; border-radius: 16px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 12px; cursor: pointer;
}
.sc-label { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
.sc-score { font-size: 44px; font-weight: 900; color: #6366f1; text-align: center; line-height: 1; margin: 4px 0 10px; }
.sc-chips { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.sc-chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; }
.sc-chip--g { background: #ede9fe; color: #5b21b6; }
.sc-chip--a { background: #dcfce7; color: #166534; }
.sc-chip--l { background: #dbeafe; color: #1e40af; }

/* BMI card */
.bmi-card {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border: 1px solid #bbf7d0; border-radius: 16px; padding: 14px 16px;
  display: flex; align-items: center; gap: 14px; margin-bottom: 12px; cursor: pointer;
}
.bmi-left { flex: 1; }
.bmi-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
.bmi-value { font-size: 32px; font-weight: 900; color: #1f2937; line-height: 1; }
.bmi-result { font-size: 13px; font-weight: 700; margin-top: 2px; }
.bmi-right { flex: 1; }
.bmi-detail { font-size: 14px; color: #374151; font-weight: 600; }
.bmi-date { font-size: 11px; color: #9ca3af; margin-top: 4px; }
.bmi-arrow { font-size: 22px; color: #9ca3af; }

/* Announcements */
.ann-see-all { font-size: 13px; color: #7c3aed; font-weight: 700; text-decoration: none; }

/* Quick menu */
.menu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.menu-card {
  border-radius: 16px; padding: 20px 14px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  text-decoration: none; transition: transform .15s;
}
.menu-card:active { transform: scale(.97); }
.menu-icon { font-size: 34px; }
.menu-label { font-size: 13px; font-weight: 700; text-align: center; line-height: 1.4; }
.menu-sub { font-size: 10px; text-align: center; opacity: .75; margin-top: 2px; line-height: 1.3; }
.menu-card--health    { background: linear-gradient(135deg,#bbf7d0,#86efac); color: #166534; }
.menu-card--deeds     { background: linear-gradient(135deg,#fde68a,#fbbf24); color: #92400e; }
.menu-card--gratitude { background: linear-gradient(135deg,#fce7f3,#fbcfe8); color: #9d174d; }
.menu-card--scores    { background: linear-gradient(135deg,#dbeafe,#93c5fd); color: #1e40af; }
</style>
