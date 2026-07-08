<template>
  <div class="ph-page">

    <!-- ── Notification popup (เด้งขึ้นอัตโนมัติเมื่อมีข้อความใหม่) ── -->
    <transition name="notif-slide">
      <div v-if="showNotifPopup && currentNotif" class="pn-overlay" @click.self="skipNotif">
        <div class="pn-sheet">
          <div class="pn-handle"></div>

          <div class="pn-header">
            <span class="pn-badge-new">ใหม่</span>
            <span class="pn-title">📣 ข้อความจากครูที่ปรึกษา</span>
            <span class="pn-counter">{{ notifIndex + 1 }}/{{ unreadNotifs.length }}</span>
          </div>

          <div class="pn-sender">
            👤 {{ currentNotif.sender_name || 'ครูที่ปรึกษา' }}
            <span v-if="currentNotif.class_id" class="pn-class"> · ห้อง {{ currentNotif.class_id }}</span>
          </div>

          <div class="pn-child-tag" v-if="childNameFor(currentNotif.student_code)">
            เรื่อง: {{ childNameFor(currentNotif.student_code) }}
          </div>

          <div class="pn-message">{{ currentNotif.message }}</div>

          <div class="pn-time">{{ formatNotifDate(currentNotif.created_at) }}</div>

          <!-- TTS button -->
          <button class="pn-btn-tts" @click="speakNotif(currentNotif)" :class="{ 'pn-btn-tts--playing': isSpeaking }">
            <span>{{ isSpeaking ? '⏹ หยุดเสียง' : '🔊 ฟังเสียงอ่าน' }}</span>
          </button>

          <div class="pn-actions">
            <button class="pn-btn-skip" @click="skipNotif">ข้าม</button>
            <button class="pn-btn-ok" @click="markReadAndNext">
              ✅ รับทราบ{{ unreadNotifs.length > 1 ? ` (${notifIndex + 1}/${unreadNotifs.length})` : '' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Greeting -->
    <div class="ph-greeting">
      <div class="ph-greet-icon">👋</div>
      <div>
        <div class="ph-greet-name">สวัสดี {{ parentStore.guardianName || 'ผู้ปกครอง' }}</div>
        <div class="ph-greet-sub">บุตรหลานของท่าน {{ parentStore.children.length }} คน</div>
      </div>
      <!-- Unread notification badge -->
      <div v-if="unreadNotifs.length" class="ph-notif-badge" @click="showNotifPopup = true">
        📬 {{ unreadNotifs.length }} ข้อความใหม่
      </div>
    </div>

    <!-- Announcements slideshow -->
    <AnnSlideshow :items="parentAnns">
      <template #footer>
        <router-link to="/parent/announcements" class="ph-ann-see-all">ดูประกาศทั้งหมด ›</router-link>
      </template>
    </AnnSlideshow>

    <!-- Children grid -->
    <div class="ph-grid">
      <div
        v-for="child in parentStore.children"
        :key="child.student_code"
        class="ph-card"
        @click="$router.push({ name: 'ParentChild', params: { code: child.student_code } })"
      >
        <!-- Photo -->
        <div class="ph-photo-wrap">
          <img v-if="child.photo_url" :src="fixPhotoUrl(child.photo_url)" class="ph-photo" @error="e => e.target.style.display='none'" />
          <div v-else class="ph-photo-placeholder">
            {{ (child.name || '?').charAt(0) }}
          </div>
        </div>

        <!-- Info -->
        <div class="ph-name">{{ child.prefix }}{{ child.name }}<br>{{ child.surname }}</div>
        <div class="ph-class">🏫 {{ child.class_id }}</div>
        <div class="ph-seat">เลขที่ {{ child.seat_number }}</div>

        <!-- Behavior score badge -->
        <div class="ph-score-badge" :class="scoreBadgeClass(child.behavior_score)">
          ⭐ {{ child.behavior_score }} คะแนน
        </div>

        <!-- Unread message indicator for this child -->
        <div v-if="unreadCountFor(child.student_code)" class="ph-notif-dot">
          📬 {{ unreadCountFor(child.student_code) }} ข้อความ
        </div>

        <div class="ph-tap-hint">แตะเพื่อดูข้อมูล →</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useParentStore } from '@/stores/parent'
import { supabase } from '@/supabase/client'
import { fixPhotoUrl } from '@/composables/useStudentUpload'
import AnnSlideshow from '@/components/AnnSlideshow.vue'

const parentStore = useParentStore()

// ── Announcements ───────────────────────────────────────────────
const parentAnns = ref([])

async function loadParentAnns() {
  const schoolId = parentStore.schoolId
  if (!schoolId) return
  try {
    const { data, error } = await supabase.rpc('get_school_announcements_public', {
      p_school_id: String(schoolId),
      p_target:    'parent',
    })
    if (error) { console.warn('[announcements]', error.message); return }
    parentAnns.value = Array.isArray(data) ? data : (data ? [data] : [])
  } catch (e) { console.warn('[announcements]', e) }
}

// ── Notifications ──────────────────────────────────────────────
const allNotifs     = ref([])
const showNotifPopup = ref(false)
const notifIndex    = ref(0)
const isSpeaking    = ref(false)

const unreadNotifs = computed(() =>
  allNotifs.value.filter(n => !n.read_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
)

const currentNotif = computed(() => unreadNotifs.value[notifIndex.value] || null)

function childNameFor(studentCode) {
  const child = parentStore.children.find(c => c.student_code === studentCode)
  if (!child) return ''
  return `${child.prefix || ''}${child.name} ${child.surname}`.trim()
}

function unreadCountFor(studentCode) {
  return unreadNotifs.value.filter(n => n.student_code === studentCode).length
}

async function loadNotifications() {
  const codes = parentStore.children.map(c => c.student_code)
  if (!codes.length || !parentStore.schoolId) return
  try {
    const { data } = await supabase
      .from('parent_notifications')
      .select('id, student_code, message, sender_name, class_id, created_at, read_at, tts_at')
      .eq('school_id', parentStore.schoolId)
      .in('student_code', codes)
      .order('created_at', { ascending: false })
      .limit(50)
    allNotifs.value = data || []
    if (unreadNotifs.value.length > 0) {
      notifIndex.value = 0
      showNotifPopup.value = true
    }
  } catch (e) {
    console.error('load notifications:', e)
  }
}

async function markRead(notif) {
  if (!notif || notif.read_at) return
  try {
    await supabase
      .from('parent_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notif.id)
    notif.read_at = new Date().toISOString()
  } catch { /* ignore */ }
}

async function markReadAndNext() {
  stopSpeak()
  await markRead(currentNotif.value)
  if (notifIndex.value + 1 < unreadNotifs.value.length) {
    notifIndex.value++
  } else {
    showNotifPopup.value = false
    notifIndex.value = 0
  }
}

function skipNotif() {
  stopSpeak()
  if (notifIndex.value + 1 < unreadNotifs.value.length) {
    notifIndex.value++
  } else {
    showNotifPopup.value = false
    notifIndex.value = 0
  }
}

// ── TTS ────────────────────────────────────────────────────────
function buildTtsParts(notif) {
  const childName = childNameFor(notif.student_code)
  const sender    = notif.sender_name || 'ครูที่ปรึกษา'
  const parts     = []

  // intro: ชื่อเด็กก่อน แล้วค่อยบอกว่าใครส่ง
  if (childName) parts.push(`แจ้งเรื่อง ${childName}`)
  parts.push(`ข้อความจาก ${sender}`)

  // แตกเนื้อหาที่ขึ้นบรรทัดใหม่ และ/หรือจบประโยค
  const msgLines = (notif.message || '')
    .split(/\r?\n+/)                      // แยกตามบรรทัด
    .flatMap(line =>
      line.split(/(?<=[.!?๚])\s+/)        // แยกตามจุดจบประโยค
    )
    .map(s => s.trim())
    .filter(s => s.length > 0)

  parts.push(...msgLines)
  return parts
}

function speakQueue(parts, index) {
  if (index >= parts.length || !isSpeaking.value) {
    isSpeaking.value = false
    return
  }
  const utter = new SpeechSynthesisUtterance(parts[index])
  utter.lang  = 'th-TH'
  utter.rate  = 0.75     // ช้าลง — เป็นใจความขึ้นมาก
  utter.pitch = 1.0
  utter.onend   = () => setTimeout(() => speakQueue(parts, index + 1), 350)
  utter.onerror = () => { isSpeaking.value = false }
  window.speechSynthesis.speak(utter)
}

function speakNotif(notif) {
  if (!('speechSynthesis' in window)) return
  if (isSpeaking.value) { stopSpeak(); return }

  isSpeaking.value = true
  window.speechSynthesis.cancel()   // ล้าง queue เก่าก่อน
  speakQueue(buildTtsParts(notif), 0)

  // บันทึกว่าเคยฟังแล้ว
  if (!notif.tts_at) {
    supabase.from('parent_notifications')
      .update({ tts_at: new Date().toISOString() })
      .eq('id', notif.id)
      .then(() => { notif.tts_at = new Date().toISOString() })
  }
}

function stopSpeak() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  isSpeaking.value = false
}

// ── Helpers ────────────────────────────────────────────────────
function scoreBadgeClass(score) {
  if (score >= 90) return 'ph-score-green'
  if (score >= 70) return 'ph-score-amber'
  return 'ph-score-red'
}

function formatNotifDate(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(() => {
  loadNotifications()
  loadParentAnns()
})
</script>

<style scoped>
.ph-page {
  padding: 20px 16px 40px;
  max-width: 600px;
  margin: 0 auto;
}

/* Greeting */
.ph-greeting {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #92400e, #b45309);
  border-radius: 20px;
  padding: 20px 22px;
  margin-bottom: 24px;
  box-shadow: 0 6px 20px rgba(146,64,14,0.28);
  flex-wrap: wrap;
}
.ph-greet-icon { font-size: 48px; flex-shrink: 0; }
.ph-greet-name { font-size: 22px; font-weight: 800; color: #fff; }
.ph-greet-sub  { font-size: 16px; color: rgba(255,255,255,0.8); margin-top: 2px; }
.ph-notif-badge {
  margin-left: auto; background: rgba(255,255,255,0.25);
  color: #fff; font-size: 13px; font-weight: 700;
  padding: 6px 14px; border-radius: 99px; cursor: pointer;
  white-space: nowrap;
}

/* Children grid */
/* Announcements */
.ph-ann-see-all { font-size: 13px; color: #b45309; font-weight: 700; text-decoration: none; }

.ph-grid { display: flex; flex-direction: column; gap: 16px; }
.ph-card {
  background: #fff; border-radius: 24px; padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.10); border: 3px solid #e0e7ff;
  cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
}
.ph-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(30,64,175,0.15); border-color: #6366f1; }

.ph-photo-wrap {
  width: 90px; height: 90px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
  background: linear-gradient(135deg, #a78bfa, #6366f1); border: 3px solid #c7d2fe;
}
.ph-photo { width: 100%; height: 100%; object-fit: cover; }
.ph-photo-placeholder {
  width: 100%; height: 100%; display: flex;
  align-items: center; justify-content: center;
  font-size: 36px; font-weight: 900; color: #fff;
}

.ph-info { flex: 1; min-width: 0; }
.ph-name  { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3; flex: 1; min-width: 120px; }
.ph-class { font-size: 18px; color: #3730a3; font-weight: 700; margin-top: 4px; }
.ph-seat  { font-size: 16px; color: #64748b; margin-top: 2px; }

.ph-score-badge { border-radius: 99px; padding: 8px 18px; font-size: 17px; font-weight: 700; flex-shrink: 0; }
.ph-score-green { background: #dcfce7; color: #15803d; }
.ph-score-amber { background: #fef3c7; color: #92400e; }
.ph-score-red   { background: #fee2e2; color: #991b1b; }

.ph-notif-dot {
  width: 100%; font-size: 13px; font-weight: 700;
  color: #4f46e5; background: #ede9fe; border-radius: 8px;
  padding: 5px 12px; margin-top: 4px;
}

.ph-tap-hint { width: 100%; text-align: right; font-size: 15px; color: #6366f1; font-weight: 600; }

/* ── Notification popup ───────────────────────────────────── */
.pn-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 9999;
  display: flex; align-items: flex-end; justify-content: center;
}

.pn-sheet {
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 20px 24px 36px;
  width: 100%; max-width: 600px;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.18);
  max-height: 85vh; overflow-y: auto;
}

.pn-handle {
  width: 44px; height: 5px; background: #d1d5db;
  border-radius: 99px; margin: 0 auto 18px;
}

.pn-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
}
.pn-badge-new {
  background: #ef4444; color: #fff;
  font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 99px;
}
.pn-title   { font-size: 16px; font-weight: 800; color: #1e1b4b; flex: 1; }
.pn-counter { font-size: 12px; color: #94a3b8; font-weight: 600; }

.pn-sender   { font-size: 13px; color: #6366f1; font-weight: 700; margin-bottom: 4px; }
.pn-class    { font-size: 12px; color: #9ca3af; }
.pn-child-tag {
  display: inline-block; background: #ede9fe; color: #4f46e5;
  font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 8px;
  margin-bottom: 12px;
}

.pn-message {
  background: #f8fafc; border-left: 4px solid #6366f1;
  border-radius: 0 12px 12px 0; padding: 14px 16px;
  font-size: 15px; line-height: 1.7; color: #1e293b;
  white-space: pre-wrap; margin-bottom: 10px;
}

.pn-time { font-size: 12px; color: #94a3b8; margin-bottom: 16px; }

.pn-btn-tts {
  width: 100%; padding: 13px; border-radius: 14px; border: none;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  color: #fff; font-size: 16px; font-weight: 700;
  cursor: pointer; margin-bottom: 12px; transition: opacity 0.2s;
}
.pn-btn-tts--playing { background: linear-gradient(135deg, #dc2626, #b91c1c); }
.pn-btn-tts:active { opacity: 0.8; }

.pn-actions { display: flex; gap: 10px; }
.pn-btn-skip {
  flex: 1; padding: 12px; border-radius: 12px;
  border: 2px solid #e2e8f0; background: #f8fafc;
  font-size: 15px; font-weight: 600; color: #64748b; cursor: pointer;
}
.pn-btn-ok {
  flex: 2; padding: 12px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, #059669, #047857);
  color: #fff; font-size: 15px; font-weight: 800; cursor: pointer;
}
.pn-btn-ok:active { opacity: 0.85; }

/* Transition */
.notif-slide-enter-active, .notif-slide-leave-active { transition: opacity 0.25s; }
.notif-slide-enter-from, .notif-slide-leave-to { opacity: 0; }
.notif-slide-enter-active .pn-sheet, .notif-slide-leave-active .pn-sheet { transition: transform 0.25s; }
.notif-slide-enter-from .pn-sheet, .notif-slide-leave-to .pn-sheet { transform: translateY(100%); }
</style>
