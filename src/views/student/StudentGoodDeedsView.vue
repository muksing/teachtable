<template>
  <div>
    <h2 class="page-title">🌟 บันทึกความดี</h2>

    <div class="intro-card">
      <div class="intro-icon">✨</div>
      <div class="intro-text">
        <div class="intro-heading">ระลึกถึงความดีในตัวเอง</div>
        <div class="intro-body">ทุกวันเรามีโอกาสทำสิ่งดีๆ ไม่ว่าจะเล็กหรือใหญ่ การจดบันทึกช่วยให้เราระลึกถึงความดีที่ทำ เห็นคุณค่าในตนเอง และเป็นแรงบันดาลใจให้ทำดีต่อไปทุกวัน</div>
      </div>
    </div>

    <!-- ฟอร์มบันทึก -->
    <div class="form-card">
      <div class="form-title">✍️ บันทึกความดีวันนี้</div>
      <div class="field-wrap">
        <div class="field-lbl-row">
          <label class="field-lbl">เรื่องที่ทำ</label>
          <button class="mic-btn" :class="{ 'mic-btn--active': listeningField === 'title' }" @click="toggleMic('title')" type="button" title="พูดเพื่อพิมพ์">
            {{ listeningField === 'title' ? '🔴' : '🎙️' }}
          </button>
        </div>
        <input v-model="form.title" class="field-input" placeholder="เช่น ช่วยเหลือเพื่อน, เก็บขยะ..." maxlength="100" />
      </div>
      <div class="field-wrap">
        <div class="field-lbl-row">
          <label class="field-lbl">รายละเอียด (ถ้ามี)</label>
          <button class="mic-btn" :class="{ 'mic-btn--active': listeningField === 'detail' }" @click="toggleMic('detail')" type="button" title="พูดเพื่อพิมพ์">
            {{ listeningField === 'detail' ? '🔴' : '🎙️' }}
          </button>
        </div>
        <textarea v-model="form.detail" class="field-textarea" rows="3" placeholder="เล่าให้ฟังหน่อยนะ..." maxlength="500"></textarea>
      </div>
      <div v-if="listeningField" class="mic-hint">🎙️ กำลังฟัง... พูดได้เลย</div>

      <!-- Photo upload -->
      <div class="field-wrap">
        <label class="field-lbl">แนบภาพประกอบ</label>
        <div class="photo-row">
          <div v-for="(url, i) in form.photos" :key="i" class="thumb-wrap">
            <img :src="fixPhotoUrl(url)" class="thumb-img" />
            <button class="thumb-del" @click="removePhoto(i)">✕</button>
          </div>
          <label v-if="form.photos.length < 4" class="add-thumb">
            <input type="file" accept="image/*" style="display:none" multiple @change="onPhotoFiles" />
            <span class="add-thumb-icon">+</span>
          </label>
          <div v-if="uploading" class="upload-msg">กำลังอัปโหลด...</div>
        </div>
      </div>

      <button class="save-btn" :disabled="saving || !form.title.trim()" @click="saveDeed">
        {{ saving ? 'กำลังบันทึก...' : '💾 บันทึก' }}
      </button>
    </div>

    <!-- รายการที่ผ่านมา -->
    <div class="list-section-title">📋 ความดีที่ผ่านมา</div>
    <div v-if="!entries.length" class="empty-text">ยังไม่มีรายการ เริ่มบันทึกความดีได้เลย!</div>

    <div v-for="entry in entries" :key="entry.id" class="entry-card">
      <div class="entry-header">
        <div class="entry-title">🌟 {{ entry.title }}</div>
        <div class="entry-date">{{ formatDatetime(entry.created_at) }}</div>
      </div>
      <div v-if="entry.detail" class="entry-detail">{{ entry.detail }}</div>
      <div v-if="entry.photos && entry.photos.length" class="entry-photos">
        <img v-for="(p, i) in entry.photos" :key="i" :src="fixPhotoUrl(p)" class="entry-photo" @click="viewPhoto(p)" />
      </div>
    </div>

    <!-- Photo fullscreen -->
    <div v-if="viewingPhoto" class="photo-overlay" @click="viewingPhoto = ''">
      <img :src="fixPhotoUrl(viewingPhoto)" class="photo-full" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { useStudentUpload, fixPhotoUrl } from '@/composables/useStudentUpload'
import { useSpeechInput } from '@/composables/useSpeechInput'

const studentStore = useStudentStore()
const { uploadFile } = useStudentUpload()
const { listening, supported, startListening, stopListening } = useSpeechInput()
const session = computed(() => studentStore.session || {})

const entries = ref([])
const saving = ref(false)
const uploading = ref(false)
const viewingPhoto = ref('')
const form = ref({ title: '', detail: '', photos: [] })
const listeningField = ref('')

function toggleMic(field) {
  if (!supported) { alert('บราวเซอร์นี้ไม่รองรับการพูด กรุณาใช้ Chrome หรือ Safari'); return }
  if (listeningField.value === field) {
    stopListening()
    listeningField.value = ''
    return
  }
  listeningField.value = field
  startListening(
    text => { form.value[field] = (form.value[field] ? form.value[field] + ' ' : '') + text; listeningField.value = '' },
    err  => { alert(err); listeningField.value = '' }
  )
}

function formatDatetime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear() + 543
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mon}/${year} ${hh}:${mm} น.`
}

async function loadEntries() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  const { data } = await supabase
    .from('student_good_deeds')
    .select('id, title, detail, photos, created_at')
    .eq('school_id', school_id).eq('student_code', student_code)
    .order('created_at', { ascending: false })
    .limit(50)
  entries.value = data || []
}

async function onPhotoFiles(e) {
  const files = [...(e.target.files || [])]
  if (!files.length) return
  uploading.value = true
  try {
    const { school_id, student_code } = session.value
    for (const file of files) {
      if (form.value.photos.length >= 4) break
      const url = await uploadFile(file, school_id, student_code, 'good-deeds')
      form.value.photos.push(url)
    }
  } catch (err) {
    alert('อัปโหลดไม่สำเร็จ: ' + err.message)
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

function removePhoto(i) { form.value.photos.splice(i, 1) }
function viewPhoto(url) { viewingPhoto.value = url }

async function saveDeed() {
  const { school_id, student_code } = session.value
  if (!form.value.title.trim()) return
  saving.value = true
  try {
    await supabase.from('student_good_deeds').insert({
      school_id, student_code,
      class_id: session.value.class_id || null,
      title: form.value.title.trim(),
      detail: form.value.detail.trim() || null,
      photos: form.value.photos.length ? form.value.photos : null,
    })
    form.value = { title: '', detail: '', photos: [] }
    await loadEntries()
  } finally {
    saving.value = false
  }
}

onMounted(loadEntries)
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 12px; }
.intro-card {
  display: flex; gap: 12px; background: linear-gradient(135deg,#fffbeb,#fef3c7);
  border-radius: 14px; padding: 14px; margin-bottom: 14px;
  border-left: 4px solid #f59e0b;
}
.intro-icon { font-size: 28px; flex-shrink: 0; }
.intro-heading { font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 4px; }
.intro-body { font-size: 13px; color: #b45309; line-height: 1.6; }

.form-card {
  background: white; border-radius: 18px; padding: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 16px;
  display: flex; flex-direction: column; gap: 14px;
}
.form-title { font-size: 15px; font-weight: 700; color: #374151; }
.field-wrap { display: flex; flex-direction: column; gap: 6px; }
.field-lbl-row { display: flex; align-items: center; justify-content: space-between; }
.field-lbl { font-size: 13px; font-weight: 600; color: #6b7280; }
.mic-btn {
  background: none; border: none; font-size: 18px; cursor: pointer;
  padding: 2px 6px; border-radius: 8px; transition: background .15s;
}
.mic-btn:hover { background: #fef3c7; }
.mic-btn--active { background: #fef2f2; animation: mic-pulse .8s infinite; }
@keyframes mic-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
.mic-hint { font-size: 13px; color: #ef4444; font-weight: 600; text-align: center; animation: mic-pulse .8s infinite; }
.field-input, .field-textarea {
  padding: 11px 12px; border: 1.5px solid #d1d5db; border-radius: 10px;
  font-size: 15px; font-family: inherit; outline: none; resize: vertical;
}
.field-input:focus, .field-textarea:focus { border-color: #f59e0b; }

.photo-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.thumb-wrap { position: relative; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; cursor: pointer; }
.thumb-del {
  position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.55);
  color: white; border: none; border-radius: 50%; width: 20px; height: 20px;
  font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.add-thumb {
  width: 72px; height: 72px; border-radius: 10px;
  background: #fffbeb; border: 2px dashed #f59e0b;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.add-thumb-icon { font-size: 28px; color: #f59e0b; line-height: 1; }
.upload-msg { font-size: 12px; color: #f59e0b; font-weight: 600; }

.save-btn {
  width: 100%; padding: 13px; background: linear-gradient(135deg,#f59e0b,#fbbf24);
  color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.save-btn:disabled { opacity: .5; cursor: not-allowed; }

.list-section-title { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 10px; }
.empty-text { text-align: center; color: #9ca3af; padding: 30px 0; font-size: 14px; }

.entry-card {
  background: white; border-radius: 16px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 10px;
}
.entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.entry-title { font-size: 16px; font-weight: 700; color: #1f2937; flex: 1; }
.entry-date { font-size: 11px; color: #9ca3af; white-space: nowrap; }
.entry-detail { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 8px; }
.entry-photos { display: flex; gap: 6px; flex-wrap: wrap; }
.entry-photo { width: 72px; height: 72px; border-radius: 8px; object-fit: cover; cursor: pointer; }

.photo-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 999;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.photo-full { max-width: 100%; max-height: 90dvh; border-radius: 12px; object-fit: contain; }
</style>
