<template>
  <div class="msg-shell">

    <!-- LEFT: teacher / convo list -->
    <div class="msg-sidebar" :class="{ 'msg-sidebar--hidden': activeTeacherId }">
      <div class="sidebar-head">
        <div class="sidebar-title">💬 ข้อความหาครู</div>
        <input v-model="search" class="sidebar-search" placeholder="🔍 ค้นหาชื่อครู..." />
      </div>

      <div class="sidebar-body">
        <!-- Recent convos -->
        <template v-if="!search && recentConvos.length">
          <div class="list-label">📬 สนทนาล่าสุด</div>
          <div v-for="c in recentConvos" :key="'r_' + c.teacher_id"
            class="list-item" :class="{ 'list-item--active': activeTeacherId === c.teacher_id, 'list-item--unread': c.unread > 0 }"
            @click="openConvo(c.teacher_id, c.teacher_name, c.teacher_photo)">
            <div class="list-avatar convo-avatar">
              <img v-if="c.teacher_photo" :src="fixPhotoUrl(c.teacher_photo)" class="list-avatar-img" />
              <span v-else>{{ initial(c.teacher_name) }}</span>
            </div>
            <div class="list-info">
              <div class="list-name">{{ c.teacher_name }}</div>
              <div class="list-preview">{{ c.last_content || '📎' }}</div>
            </div>
            <span v-if="c.unread > 0" class="unread-badge">{{ c.unread }}</span>
          </div>
          <div class="list-divider"></div>
        </template>

        <!-- All teachers -->
        <div class="list-label">👩‍🏫 ครูทั้งหมด</div>
        <div v-if="teachersError" class="err-box">⚠️ {{ teachersError }}</div>
        <div v-if="teachersLoading" class="hint-text">กำลังโหลด...</div>
        <template v-else>
          <div v-if="!filteredTeachers.length" class="hint-text">
            {{ search ? 'ไม่พบ "' + search + '"' : 'ยังไม่มีข้อมูลครู' }}
          </div>
          <div v-for="t in filteredTeachers" :key="t.teacher_code"
            class="list-item" :class="{ 'list-item--active': activeTeacherId === t.teacher_code }"
            @click="openConvo(t.teacher_code, t.full_name, t.photo_url)">
            <div class="list-avatar teacher-avatar">
              <img v-if="t.photo_url" :src="fixPhotoUrl(t.photo_url)" class="list-avatar-img" />
              <span v-else>{{ initial(t.full_name) }}</span>
            </div>
            <div class="list-info">
              <div class="list-name">{{ t.full_name }}</div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- RIGHT: chat panel -->
    <div class="msg-chat" :class="{ 'msg-chat--visible': activeTeacherId }">
      <!-- empty state (desktop) -->
      <div v-if="!activeTeacherId" class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-text">เลือกครูที่ต้องการส่งข้อความ</div>
      </div>

      <template v-else>
        <!-- chat header -->
        <div class="chat-header">
          <button class="back-btn" @click="closeConvo">‹</button>
          <div class="header-avatar">
            <img v-if="activeTeacherPhoto" :src="fixPhotoUrl(activeTeacherPhoto)" class="header-avatar-img" />
            <span v-else>{{ initial(activeTeacherName) }}</span>
          </div>
          <div class="header-name">{{ activeTeacherName }}</div>
        </div>

        <!-- bubbles -->
        <div class="chat-bubbles" ref="bubblesRef">
          <div v-if="msgsLoading" class="hint-text center">กำลังโหลด...</div>
          <div v-if="!msgsLoading && !messages.length" class="hint-text center">
            เริ่มการสนทนากับ {{ activeTeacherName }}
          </div>

          <template v-for="m in messages" :key="m.id">
            <!-- date separator -->
            <div v-if="m._showDate" class="date-sep">{{ m._dateLabel }}</div>
            <div class="bubble-row" :class="m.sender === 'student' ? 'bubble-row--me' : ''">
              <div v-if="m.sender === 'teacher'" class="bubble-avatar">
                <img v-if="activeTeacherPhoto" :src="fixPhotoUrl(activeTeacherPhoto)" class="bubble-avatar-img" />
                <span v-else>{{ initial(activeTeacherName) }}</span>
              </div>
              <div class="bubble" :class="m.sender === 'student' ? 'bubble--me' : 'bubble--them'">
                <div v-if="m.content" class="bubble-text">{{ m.content }}</div>
                <!-- attachments -->
                <div v-if="m.attachments?.length" class="att-grid">
                  <template v-for="(att, ai) in m.attachments" :key="ai">
                    <img v-if="att.type === 'image'" :src="fixPhotoUrl(att.url)" class="att-img"
                      @click="viewPhoto(att.url)" />
                    <div v-else-if="att.type === 'video'" class="att-vid-wrap">
                      <a :href="att.url" target="_blank" class="att-vid-link">▶ เล่นวิดีโอ</a>
                    </div>
                    <a v-else :href="att.url" target="_blank" class="att-file">
                      📄 {{ att.name || 'ไฟล์แนบ' }}
                    </a>
                  </template>
                </div>
                <div class="bubble-meta">
                  <span class="bubble-time">{{ fmtTime(m.created_at) }}</span>
                  <span v-if="m.sender === 'student'" class="read-tick"
                    :class="m.read_by_teacher ? 'read-tick--read' : ''">
                    {{ m.read_by_teacher ? '✓✓' : '✓' }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- pending attachments preview -->
        <div v-if="pendingAttachments.length" class="pending-bar">
          <div v-for="(a, i) in pendingAttachments" :key="i" class="pending-item">
            <img v-if="a.type === 'image'" :src="a.preview" class="pending-thumb" />
            <div v-else-if="a.type === 'video'" class="pending-file-box">
              <span>🎬</span><span class="pending-fname">{{ shortName(a.file.name) }}</span>
            </div>
            <div v-else class="pending-file-box">
              <span>📄</span><span class="pending-fname">{{ shortName(a.file.name) }}</span>
            </div>
            <button class="del-att" @click="pendingAttachments.splice(i, 1)">✕</button>
          </div>
        </div>

        <!-- input bar -->
        <div class="chat-input-bar">
          <label class="attach-btn" title="แนบไฟล์ภาพ วิดีโอ PDF" :class="{ disabled: sending }">
            📎
            <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple style="display:none"
              @change="onAttach" :disabled="sending" />
          </label>
          <textarea v-model="msgText" class="chat-input" rows="1"
            placeholder="พิมพ์ข้อความ..."
            @keydown.enter.exact.prevent="sendMsg"
            @input="autoResize"
            ref="textareaRef"></textarea>
          <button class="send-btn"
            :disabled="sending || (!msgText.trim() && !pendingAttachments.length)"
            @click="sendMsg">
            <span v-if="sending">⏳</span>
            <span v-else>ส่ง ›</span>
          </button>
        </div>
      </template>
    </div>

    <!-- fullscreen photo viewer -->
    <div v-if="fullPhoto" class="photo-overlay" @click="fullPhoto = ''">
      <img :src="fullPhoto" class="photo-full" @click.stop />
      <button class="photo-close" @click="fullPhoto = ''">✕</button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { uploadViaGAS, fixPhotoUrl } from '@/composables/useStudentUpload'

const studentStore   = useStudentStore()
const session        = computed(() => studentStore.session || {})

const search             = ref('')
const teachers           = ref([])
const teachersLoading    = ref(false)
const teachersError      = ref('')
const recentConvos       = ref([])
const activeTeacherId    = ref(null)
const activeTeacherName  = ref('')
const activeTeacherPhoto = ref('')
const messages           = ref([])
const msgsLoading        = ref(false)
const msgText            = ref('')
const sending            = ref(false)
const pendingAttachments = ref([])
const fullPhoto          = ref('')
const bubblesRef         = ref(null)
const textareaRef        = ref(null)
let   msgChannel         = null
let   globalChannel      = null

const filteredTeachers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return teachers.value
  return teachers.value.filter(t => t.full_name.toLowerCase().includes(q))
})

function initial(name) { return (name || '?').replace(/^(นาย|นาง|น\.ส\.|นางสาว|เด็กชาย|เด็กหญิง)\s*/, '').charAt(0) || '?' }
function shortName(n) { return n.length > 18 ? n.slice(0, 16) + '…' : n }

function fmtTime(dtStr) {
  if (!dtStr) return ''
  const d = new Date(dtStr)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function fmtDate(dtStr) {
  if (!dtStr) return ''
  const d = new Date(dtStr)
  const y = d.getFullYear() + 543
  return `${d.getDate()}/${d.getMonth()+1}/${y}`
}

function addDateSeparators(msgs) {
  let lastDate = ''
  return msgs.map(m => {
    const dateLabel = fmtDate(m.created_at)
    const showDate  = dateLabel !== lastDate
    lastDate = dateLabel
    return { ...m, _showDate: showDate, _dateLabel: dateLabel }
  })
}

function scrollToBottom() {
  nextTick(() => {
    const el = bubblesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
function viewPhoto(url) { fullPhoto.value = url }

/* ── load teachers ── */
async function loadTeachers() {
  teachersLoading.value = true
  teachersError.value   = ''
  const { school_id } = session.value
  if (!school_id) {
    teachersError.value   = 'ไม่พบข้อมูลโรงเรียน กรุณาล็อกอินใหม่'
    teachersLoading.value = false
    return
  }
  try {
    const { data, error } = await supabase.from('teachers')
      .select('teacher_code, prefix, first_name, last_name, photo_url')
      .eq('school_id', school_id)
      .order('first_name')
    if (error) throw error
    teachers.value = (data || []).map(t => ({
      teacher_code: String(t.teacher_code),
      full_name: `${t.prefix || ''}${t.first_name || ''} ${t.last_name || ''}`.trim(),
      photo_url: t.photo_url || '',
    }))
  } catch (e) {
    teachersError.value = 'โหลดรายชื่อครูไม่สำเร็จ: ' + (e.message || e)
  } finally {
    teachersLoading.value = false
  }
}

/* ── recent convos ── */
async function loadRecentConvos() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  const { data } = await supabase.from('student_messages')
    .select('teacher_id, sender, content, created_at, read_by_student')
    .eq('school_id', school_id).eq('student_code', student_code)
    .order('created_at', { ascending: false }).limit(500)

  const byTeacher = {}
  for (const m of (data || [])) {
    if (!byTeacher[m.teacher_id]) {
      byTeacher[m.teacher_id] = { teacher_id: m.teacher_id, last_content: m.content || '📎', unread: 0 }
    }
    if (m.sender === 'teacher' && !m.read_by_student) byTeacher[m.teacher_id].unread++
  }
  const tMap = {}
  const pMap = {}
  for (const t of teachers.value) {
    tMap[t.teacher_code] = t.full_name
    if (t.photo_url) pMap[t.teacher_code] = t.photo_url
  }
  recentConvos.value = Object.values(byTeacher).map(c => ({
    ...c,
    teacher_name:  tMap[c.teacher_id] || c.teacher_id,
    teacher_photo: pMap[c.teacher_id] || '',
  }))
}

/* ── open conversation ── */
async function openConvo(teacherId, teacherName, teacherPhoto = '') {
  activeTeacherId.value    = teacherId
  activeTeacherName.value  = teacherName
  activeTeacherPhoto.value = teacherPhoto || teachers.value.find(t => t.teacher_code === teacherId)?.photo_url || ''
  messages.value          = []
  msgsLoading.value       = true
  const { school_id, student_code } = session.value

  const { data } = await supabase.from('student_messages').select('*')
    .eq('school_id', school_id).eq('student_code', student_code).eq('teacher_id', teacherId)
    .order('created_at', { ascending: true })
  messages.value  = addDateSeparators(data || [])
  msgsLoading.value = false
  scrollToBottom()

  // mark as read
  await supabase.from('student_messages').update({ read_by_student: true })
    .eq('school_id', school_id).eq('student_code', student_code)
    .eq('teacher_id', teacherId).eq('sender', 'teacher').eq('read_by_student', false)
  const c = recentConvos.value.find(c => c.teacher_id === teacherId)
  if (c) c.unread = 0

  // realtime
  if (msgChannel) supabase.removeChannel(msgChannel)
  msgChannel = supabase
    .channel(`smsg_${school_id}_${student_code}_${teacherId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'student_messages',
      filter: `school_id=eq.${school_id}`,
    }, payload => {
      const m = payload.new
      if (m.student_code !== student_code || m.teacher_id !== activeTeacherId.value) return
      // rebuild separators
      const all = [...messages.value.map(x => ({ ...x, _showDate: undefined, _dateLabel: undefined })), m]
      messages.value = addDateSeparators(all)
      if (m.sender === 'teacher')
        supabase.from('student_messages').update({ read_by_student: true }).eq('id', m.id)
      scrollToBottom()
    }).subscribe()
}

function closeConvo() {
  activeTeacherId.value   = null
  activeTeacherName.value  = ''
  activeTeacherPhoto.value = ''
  messages.value         = []
  pendingAttachments.value = []
  msgText.value          = ''
  if (msgChannel) { supabase.removeChannel(msgChannel); msgChannel = null }
  loadRecentConvos()
}

/* ── attach files ── */
async function onAttach(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  for (const file of files) {
    const isImage = file.type.startsWith('image')
    const isVideo = file.type.startsWith('video')
    let preview = ''
    if (isImage) {
      preview = await new Promise(r => {
        const fr = new FileReader(); fr.onload = ev => r(ev.target.result); fr.readAsDataURL(file)
      })
    }
    pendingAttachments.value.push({
      file, preview,
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
    })
  }
}

/* ── send message ── */
async function sendMsg() {
  if (!msgText.value.trim() && !pendingAttachments.value.length) return
  sending.value = true
  const { school_id, student_code, class_id } = session.value
  try {
    const attachments = []
    for (const att of pendingAttachments.value) {
      const url = await uploadViaGAS(att.file, school_id, `msg_${student_code}`)
      attachments.push({ url, type: att.type, name: att.file.name })
    }
    await supabase.from('student_messages').insert({
      school_id, student_code,
      class_id: class_id || null,
      teacher_id: activeTeacherId.value,
      sender: 'student',
      content: msgText.value.trim() || null,
      attachments: attachments.length ? attachments : [],
      read_by_teacher: false,
    })
    msgText.value = ''
    pendingAttachments.value = []
    if (textareaRef.value) textareaRef.value.style.height = 'auto'
  } catch (e) {
    alert('ส่งไม่สำเร็จ: ' + (e.message || e))
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  await loadTeachers()
  await loadRecentConvos()

  // Realtime: แจ้งเตือนเมื่อครูตอบข้อความ
  const { school_id, student_code } = session.value
  if (school_id && student_code) {
    globalChannel = supabase
      .channel(`student_inbox_${school_id}_${student_code}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'student_messages',
        filter: `school_id=eq.${school_id}`,
      }, payload => {
        const m = payload.new
        if (m.student_code !== student_code || m.sender !== 'teacher') return
        // อัปเดต recent convos badge
        const c = recentConvos.value.find(c => c.teacher_id === m.teacher_id)
        if (c) {
          c.last_content = m.content || '📎'
          if (activeTeacherId.value !== m.teacher_id) c.unread = (c.unread || 0) + 1
        } else {
          const t = teachers.value.find(t => t.teacher_code === m.teacher_id)
          recentConvos.value.unshift({
            teacher_id: m.teacher_id,
            teacher_name: t?.full_name || m.teacher_id,
            teacher_photo: t?.photo_url || '',
            last_content: m.content || '📎',
            unread: activeTeacherId.value !== m.teacher_id ? 1 : 0,
          })
        }
        // เสียง + notification ถ้าไม่ได้เปิดแชทนั้น
        if (activeTeacherId.value !== m.teacher_id) {
          const t = teachers.value.find(t => t.teacher_code === m.teacher_id)
          const tName = t?.full_name || m.teacher_id
          // browser notification ถ้าได้รับ permission
          if (Notification?.permission === 'granted') {
            new Notification(`💬 ข้อความจาก ${tName}`, { body: m.content || '📎', icon: '/favicon.ico' })
          }
        }
      })
      .subscribe()
  }
})
onUnmounted(() => {
  if (msgChannel)    supabase.removeChannel(msgChannel)
  if (globalChannel) supabase.removeChannel(globalChannel)
})
</script>

<style scoped>
/* ── shell ── */
.msg-shell {
  display: flex;
  height: calc(100dvh - 130px); /* account for topbar + bottomnav */
  overflow: hidden;
  background: #f8fafc;
  font-family: 'Sarabun', sans-serif;
}

/* ── sidebar ── */
.msg-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: white;
  border-right: 1px solid #e2e8f0;
  overflow: hidden;
}
.sidebar-head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #0f766e, #0d9488);
}
.sidebar-title { font-size: 16px; font-weight: 800; color: white; margin-bottom: 10px; }
.sidebar-search {
  width: 100%; padding: 8px 12px; border: none; border-radius: 10px;
  font-size: 13px; outline: none; font-family: inherit;
  background: rgba(255,255,255,.9);
  box-sizing: border-box;
}
.sidebar-body { flex: 1; overflow-y: auto; padding: 8px 0; }

.list-label {
  font-size: 10px; font-weight: 800; letter-spacing: .06em; color: #94a3b8;
  text-transform: uppercase; padding: 8px 14px 4px;
}
.list-divider { height: 1px; background: #f1f5f9; margin: 8px 0; }
.hint-text { font-size: 13px; color: #9ca3af; padding: 6px 14px; }
.err-box { background: #fef2f2; color: #dc2626; border-radius: 8px; margin: 6px 10px; padding: 8px 10px; font-size: 12px; }

.list-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; cursor: pointer; transition: background .12s;
}
.list-item:hover { background: #f0fdf4; }
.list-item--active { background: #ecfdf5 !important; }
.list-item--unread { background: #fffbeb; }

.list-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 800; color: white; overflow: hidden;
}
.list-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.convo-avatar  { background: linear-gradient(135deg, #0f766e, #1e3a5f); }
.teacher-avatar { background: linear-gradient(135deg, #7c3aed, #4f46e5); }
.list-info { flex: 1; min-width: 0; }
.list-name { font-size: 13px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-preview { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.unread-badge {
  background: #dc2626; color: white; border-radius: 99px;
  min-width: 18px; height: 18px; padding: 0 4px;
  font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* ── chat panel ── */
.msg-chat {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
  background: #f8fafc;
}
.chat-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  color: #cbd5e1;
}
.chat-empty-icon { font-size: 56px; opacity: .4; }
.chat-empty-text { font-size: 14px; font-weight: 600; color: #94a3b8; }

/* chat header */
.chat-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; background: white; border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0; box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.back-btn {
  font-size: 22px; line-height: 1; background: none; border: none;
  cursor: pointer; color: #64748b; padding: 0 4px; display: none;
}
.header-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #0f766e, #1e3a5f);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 800; overflow: hidden; flex-shrink: 0;
}
.header-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.header-name { font-size: 15px; font-weight: 800; color: #1e293b; }

/* bubbles */
.chat-bubbles {
  flex: 1; overflow-y: auto; padding: 16px 16px 8px;
  display: flex; flex-direction: column; gap: 4px;
}
.hint-text.center { text-align: center; padding: 24px; }

.date-sep {
  text-align: center; font-size: 11px; color: #94a3b8;
  background: #e2e8f0; border-radius: 99px; padding: 3px 12px;
  align-self: center; margin: 10px 0 4px;
}

.bubble-row { display: flex; align-items: flex-end; gap: 6px; }
.bubble-row--me { justify-content: flex-end; }
.bubble-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #0f766e, #1e3a5f);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; align-self: flex-end; overflow: hidden;
}
.bubble-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.bubble {
  max-width: 68%; padding: 9px 12px; border-radius: 16px;
  font-size: 14px; line-height: 1.55; word-break: break-word;
}
.bubble--them { background: white; color: #1e293b; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.bubble--me   { background: #0f766e; color: white; border-bottom-right-radius: 4px; }
.bubble-text  { white-space: pre-wrap; }
.att-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.att-img {
  max-width: 180px; max-height: 200px; object-fit: cover;
  border-radius: 10px; cursor: pointer; display: block;
}
.att-vid-wrap { display: inline-block; }
.att-vid-link {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  background: rgba(0,0,0,.12); border-radius: 10px; color: inherit; text-decoration: none;
  font-size: 13px; font-weight: 600;
}
.att-file {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(0,0,0,.08); border-radius: 8px; padding: 4px 10px;
  font-size: 12px; color: inherit; text-decoration: none;
}
.bubble-meta { display: flex; align-items: center; gap: 4px; margin-top: 4px; justify-content: flex-end; }
.bubble-time { font-size: 10px; opacity: .55; }
.read-tick { font-size: 10px; opacity: .55; }
.read-tick--read { opacity: 1; color: #86efac; }
.bubble--them .read-tick--read { color: #0f766e; }

/* pending attachments */
.pending-bar {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 14px;
  background: white; border-top: 1px solid #f1f5f9;
}
.pending-item { position: relative; }
.pending-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; display: block; }
.pending-file-box {
  width: 80px; height: 52px; background: #1e293b; border-radius: 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  font-size: 18px;
}
.pending-fname { font-size: 9px; color: #94a3b8; text-align: center; padding: 0 4px; overflow: hidden; max-width: 76px; }
.del-att {
  position: absolute; top: -5px; right: -5px;
  background: #dc2626; color: white; border: none;
  border-radius: 50%; width: 17px; height: 17px;
  font-size: 9px; cursor: pointer; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}

/* input bar */
.chat-input-bar {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px 14px 12px; background: white;
  border-top: 1px solid #e2e8f0; flex-shrink: 0;
}
.attach-btn {
  font-size: 22px; cursor: pointer; padding: 4px 6px;
  border-radius: 8px; flex-shrink: 0; line-height: 1;
  user-select: none; transition: background .12s;
}
.attach-btn:hover { background: #f1f5f9; }
.attach-btn.disabled { opacity: .4; pointer-events: none; }
.chat-input {
  flex: 1; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 20px;
  font-size: 14px; resize: none; outline: none; font-family: inherit;
  max-height: 120px; overflow-y: auto; line-height: 1.5;
  background: #f8fafc; transition: border-color .15s;
}
.chat-input:focus { border-color: #0f766e; background: white; }
.send-btn {
  padding: 9px 18px; background: #0f766e; color: white; border: none;
  border-radius: 20px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: inherit; flex-shrink: 0; white-space: nowrap;
  transition: background .15s;
}
.send-btn:hover:not(:disabled) { background: #0d6862; }
.send-btn:disabled { opacity: .45; cursor: not-allowed; }

/* photo overlay */
.photo-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.88);
  z-index: 9999; display: flex; align-items: center; justify-content: center;
}
.photo-full { max-width: 92vw; max-height: 88vh; object-fit: contain; border-radius: 10px; }
.photo-close {
  position: fixed; top: 16px; right: 18px; background: rgba(255,255,255,.15);
  border: none; color: white; font-size: 22px; border-radius: 50%;
  width: 38px; height: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}

/* ── MOBILE: toggle panels ── */
@media (max-width: 639px) {
  .msg-shell { height: calc(100dvh - 130px); }
  .msg-sidebar { width: 100%; position: absolute; inset: 0; z-index: 2; transition: transform .22s; }
  .msg-sidebar--hidden { transform: translateX(-100%); }
  .msg-chat { position: absolute; inset: 0; z-index: 3; transform: translateX(100%); transition: transform .22s; }
  .msg-chat--visible { transform: translateX(0); }
  .back-btn { display: block !important; }
}
</style>
