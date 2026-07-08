<template>
  <div class="hp-page">
    <div class="hp-header">
      <div class="hp-header-title">🏠 ข้อมูลบ้านของฉัน</div>
      <div class="hp-header-sub">ข้อมูลนี้ครูจะใช้สำหรับการเยี่ยมบ้าน</div>
    </div>

    <div v-if="loading" class="hp-loading">⏳ กำลังโหลด...</div>

    <!-- Toast error -->
    <transition name="hp-toast">
      <div v-if="toastMsg" class="hp-toast" :class="`hp-toast--${toastType}`">
        <span class="hp-toast-icon">{{ toastType === 'error' ? '⚠️' : toastType === 'success' ? '✅' : 'ℹ️' }}</span>
        <span>{{ toastMsg }}</span>
        <button class="hp-toast-close" @click="toastMsg = ''">✕</button>
      </div>
    </transition>

    <!-- Active round banner -->
    <div v-if="!loading && activeRounds.length" class="hp-rounds-banner">
      <div v-for="r in activeRounds" :key="r.id" class="hp-round-card" :class="homeInfoFilled ? 'hp-round-card--done' : 'hp-round-card--pending'">
        <div class="hp-round-icon">{{ homeInfoFilled ? '✅' : '📋' }}</div>
        <div class="hp-round-body">
          <div class="hp-round-name">{{ r.round_name }}</div>
          <div v-if="r.date_end" class="hp-round-deadline">ภายใน {{ fmtRoundDate(r.date_end) }}</div>
          <div class="hp-round-status">
            {{ homeInfoFilled ? 'กรอกข้อมูลบ้านแล้ว ✓' : '⚠️ กรุณากรอกข้อมูลบ้านด้านล่าง' }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="hp-sections">

      <!-- ── พิกัดบ้าน ── -->
      <div class="hp-section">
        <div class="hp-section-title">📍 ที่ตั้งบ้าน</div>
        <div class="hp-location-row">
          <button class="hp-gps-btn" :class="{ 'hp-gps-btn--ok': form.home_lat }" :disabled="gpsLoading" @click="useMyLocation">
            <span v-if="gpsLoading">⏳ กำลังดึง GPS...</span>
            <span v-else-if="form.home_lat">✅ บันทึกพิกัดแล้ว — กดอีกครั้งเพื่ออัปเดต</span>
            <span v-else>🎯 ใช้ตำแหน่งปัจจุบันเป็นที่อยู่บ้าน</span>
          </button>
        </div>
        <div v-if="gpsError" class="hp-gps-err">
          <span>⚠️ {{ gpsError }}</span>
          <div class="hp-gps-err-hint">กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ แล้วลองใหม่</div>
        </div>
        <div v-if="form.home_lat && form.home_lng" class="hp-map-wrap">
          <iframe
            :src="`https://www.openstreetmap.org/export/embed.html?bbox=${form.home_lng-0.004},${form.home_lat-0.003},${form.home_lng+0.004},${form.home_lat+0.003}&layer=mapnik&marker=${form.home_lat},${form.home_lng}`"
            class="hp-map-iframe"
            loading="lazy"
            allowfullscreen
          ></iframe>
          <div class="hp-coord-row">
            <span class="hp-coord">{{ form.home_lat.toFixed(5) }}, {{ form.home_lng.toFixed(5) }}</span>
            <a :href="`https://www.google.com/maps?q=${form.home_lat},${form.home_lng}`"
               target="_blank" class="hp-maps-link">เปิด Google Maps →</a>
          </div>
        </div>
        <div class="hp-field">
          <label class="hp-label">ที่อยู่ (ข้อความ)</label>
          <textarea v-model="form.home_address" class="hp-textarea" rows="3"
            placeholder="เลขที่ ถนน หมู่บ้าน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"></textarea>
        </div>
      </div>

      <!-- ── รายละเอียดบ้าน ── -->
      <div class="hp-section">
        <div class="hp-section-title">🏡 รายละเอียดบ้าน</div>
        <div class="hp-field">
          <label class="hp-label">ประเภทที่อยู่อาศัย</label>
          <div class="hp-chips">
            <button v-for="t in HOUSE_TYPES" :key="t"
              class="hp-chip" :class="{ 'hp-chip--active': form.house_type === t }"
              @click="form.house_type = t">{{ t }}</button>
          </div>
        </div>
        <div class="hp-field">
          <label class="hp-label">รายได้ครัวเรือน (โดยประมาณ)</label>
          <div class="hp-chips">
            <button v-for="inc in INCOME_RANGES" :key="inc"
              class="hp-chip" :class="{ 'hp-chip--active': form.household_income === inc }"
              @click="form.household_income = inc">{{ inc }}</button>
          </div>
        </div>
      </div>

      <!-- ── ภาพบ้าน ── -->
      <div class="hp-section">
        <div class="hp-section-title">📷 ภาพบ้านมุมต่างๆ</div>
        <div class="hp-photos">
          <div v-for="(url, i) in form.photo_urls" :key="i" class="hp-photo-wrap">
            <img :src="url" class="hp-photo" />
            <button class="hp-photo-del" @click="removePhoto(i)">✕</button>
          </div>
          <label class="hp-photo-add">
            <input type="file" accept="image/*" multiple style="display:none" @change="onPhotoFiles" />
            <span class="hp-photo-add-icon">+</span>
            <span class="hp-photo-add-label">เพิ่มภาพ</span>
          </label>
        </div>
        <div v-if="photoUploading" class="hp-upload-progress">กำลังอัปโหลด...</div>
        <div class="text-xs text-gray-400 mt-1">เช่น หน้าบ้าน ห้องนอน ครัว บรรยากาศรอบบ้าน</div>
      </div>

      <!-- ── คนในครอบครัว ── -->
      <div class="hp-section">
        <div class="hp-section-title">👨‍👩‍👧 คนในครอบครัว</div>
        <div v-for="(m, i) in form.family_members" :key="i" class="hp-member">
          <div class="hp-member-top">
            <input v-model="m.name" class="hp-input hp-input--name" placeholder="ชื่อ-นามสกุล" />
            <button class="hp-member-del" @click="removeMember(i)">✕</button>
          </div>
          <div class="hp-member-fields">
            <div class="hp-chips hp-chips--small">
              <button v-for="rel in RELATIONS" :key="rel"
                class="hp-chip hp-chip--sm" :class="{ 'hp-chip--active': m.relation === rel }"
                @click="m.relation = rel">{{ rel }}</button>
            </div>
            <input v-model="m.phone" class="hp-input" placeholder="เบอร์โทร" type="tel" />
            <input v-model="m.occupation" class="hp-input" placeholder="อาชีพ" />
          </div>
        </div>
        <button class="hp-add-member-btn" @click="addMember">+ เพิ่มสมาชิก</button>
      </div>

      <!-- ── บันทึกเพิ่มเติม ── -->
      <div class="hp-section">
        <div class="hp-section-title">📝 บันทึกเพิ่มเติม</div>
        <textarea v-model="form.student_notes" class="hp-textarea" rows="3"
          placeholder="ข้อมูลอื่นๆ ที่อยากให้ครูทราบก่อนเยี่ยมบ้าน เช่น สัตว์เลี้ยง ทางเข้าบ้าน ฯลฯ"></textarea>
      </div>

      <button class="hp-save-btn" :disabled="saving" @click="save">
        {{ saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูลบ้าน' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { useStudentUpload } from '@/composables/useStudentUpload'
import { useHomeVisit } from '@/composables/useHomeVisit'

const studentStore  = useStudentStore()
const { uploadFile } = useStudentUpload()
const { getActiveRoundsForStudent } = useHomeVisit()

const activeRounds   = ref([])
const homeInfoFilled = computed(() => !!(form.home_address || form.home_lat))
const loading        = ref(true)
const saving         = ref(false)
const gpsLoading     = ref(false)
const photoUploading = ref(false)
const gpsError       = ref('')
const toastMsg       = ref('')
const toastType      = ref('error') // 'error' | 'success' | 'info'

let toastTimer = null
function showToast(msg, type = 'error') {
  toastMsg.value  = msg
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 4000)
}

const HOUSE_TYPES    = ['บ้านปูน', 'บ้านไม้', 'บ้านเช่า', 'ห้องเช่า/อพาร์ตเมนต์', 'อื่นๆ']
const INCOME_RANGES  = ['ต่ำกว่า 5,000', '5,000–10,000', '10,000–20,000', '20,000–40,000', 'มากกว่า 40,000']
const RELATIONS      = ['พ่อ', 'แม่', 'ปู่/ย่า', 'ตา/ยาย', 'พี่', 'น้อง', 'ผู้ปกครอง', 'อื่นๆ']

const form = reactive({
  home_lat:        null,
  home_lng:        null,
  home_address:    '',
  house_type:      '',
  household_income: '',
  photo_urls:      [],
  family_members:  [],
  student_notes:   '',
})

function getSession() { return studentStore.session || {} }

async function useMyLocation() {
  if (!navigator.geolocation) { showToast('เบราว์เซอร์นี้ไม่รองรับ GPS'); return }
  gpsError.value   = ''
  gpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      form.home_lat    = parseFloat(pos.coords.latitude.toFixed(6))
      form.home_lng    = parseFloat(pos.coords.longitude.toFixed(6))
      gpsLoading.value = false
    },
    err => {
      gpsLoading.value = false
      if (err.code === 1) gpsError.value = 'ถูกปฏิเสธสิทธิ์ GPS — กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์'
      else gpsError.value = 'ไม่สามารถดึงตำแหน่ง: ' + err.message
    },
    { enableHighAccuracy: true, timeout: 15000 }
  )
}

async function onPhotoFiles(e) {
  const files = [...(e.target.files || [])]
  if (!files.length) return
  photoUploading.value = true
  const { school_id, student_code } = getSession()
  try {
    for (const file of files) {
      const path = `home-photos/${school_id}/${student_code}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('student-photos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('student-photos').getPublicUrl(path)
      form.photo_urls.push(data.publicUrl)
    }
  } catch (err) { showToast('อัปโหลดไม่สำเร็จ: ' + err.message) }
  finally { photoUploading.value = false; e.target.value = '' }
}

function removePhoto(i) { form.photo_urls.splice(i, 1) }

function addMember() {
  form.family_members.push({ name: '', relation: '', phone: '', occupation: '' })
}
function removeMember(i) { form.family_members.splice(i, 1) }

async function load() {
  const { school_id, student_code } = getSession()
  if (!school_id || !student_code) { loading.value = false; return }
  const { data } = await supabase
    .from('student_home_info')
    .select('*')
    .eq('school_id', school_id)
    .eq('student_code', student_code)
    .maybeSingle()
  if (data) {
    form.home_lat        = data.home_lat        || null
    form.home_lng        = data.home_lng        || null
    form.home_address    = data.home_address    || ''
    form.house_type      = data.house_type      || ''
    form.household_income = data.household_income || ''
    form.photo_urls      = Array.isArray(data.photo_urls) ? data.photo_urls : []
    form.family_members  = Array.isArray(data.family_members) ? data.family_members : []
    form.student_notes   = data.student_notes   || ''
  }
  loading.value = false
  // Load active visit rounds for this student's class
  const classId = getSession().class_id
  if (classId) {
    try { activeRounds.value = await getActiveRoundsForStudent(classId) } catch {}
  }
}

async function save() {
  const { school_id, student_code } = getSession()
  if (!school_id || !student_code) return
  saving.value = true
  try {
    const payload = {
      school_id, student_code,
      home_lat:        form.home_lat,
      home_lng:        form.home_lng,
      home_address:    form.home_address,
      house_type:      form.house_type,
      household_income: form.household_income,
      photo_urls:      form.photo_urls,
      family_members:  form.family_members,
      student_notes:   form.student_notes,
      updated_at:      new Date().toISOString(),
      updated_by:      'student',
    }
    const { error } = await supabase
      .from('student_home_info')
      .upsert([payload], { onConflict: 'school_id,student_code' })
    if (error) throw error
    showToast('บันทึกข้อมูลบ้านเรียบร้อย', 'success')
  } catch (e) {
    showToast('เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(load)

function fmtRoundDate(d) {
  return d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
}
</script>

<style scoped>
.hp-page    { background:#f8f9ff; min-height:100vh; padding-bottom:80px; }
.hp-header  { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; padding:24px 20px 20px; }
.hp-header-title { font-size:1.25rem; font-weight:700; }
.hp-header-sub   { font-size:.85rem; opacity:.8; margin-top:4px; }
.hp-loading { text-align:center; padding:40px; color:#6b7280; }

.hp-rounds-banner { padding:12px 16px 0; display:flex; flex-direction:column; gap:8px; }
.hp-round-card { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border-radius:14px; border:1.5px solid; }
.hp-round-card--pending { background:#fef3c7; border-color:#f59e0b; }
.hp-round-card--done    { background:#d1fae5; border-color:#10b981; }
.hp-round-icon { font-size:1.2rem; flex-shrink:0; margin-top:2px; }
.hp-round-body { flex:1; min-width:0; }
.hp-round-name { font-weight:700; font-size:.9rem; color:#1f2937; }
.hp-round-deadline { font-size:.76rem; color:#6b7280; margin-top:2px; }
.hp-round-status { font-size:.8rem; font-weight:600; margin-top:4px; color:#065f46; }
.hp-round-card--pending .hp-round-status { color:#b45309; }
.hp-sections { padding:16px; display:flex; flex-direction:column; gap:14px; }
.hp-section  { background:white; border-radius:16px; padding:18px; box-shadow:0 2px 10px rgba(0,0,0,.06); }
.hp-section-title { font-weight:700; color:#4f46e5; margin-bottom:12px; font-size:.95rem; }

.hp-gps-btn {
  width:100%; padding:12px; border-radius:12px; font-size:.9rem; font-weight:600;
  background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; border:none; cursor:pointer;
}
.hp-gps-btn--ok { background:linear-gradient(135deg,#059669,#10b981); }
.hp-gps-btn:disabled { opacity:.7; cursor:not-allowed; }
.hp-map-wrap   { margin:10px 0 4px; border-radius:14px; overflow:hidden; border:2px solid #c4b5fd; }
.hp-map-iframe { width:100%; height:220px; border:none; display:block; }
.hp-coord-row  { display:flex; align-items:center; gap:10px; padding:8px 10px; background:#faf5ff; }
.hp-coord     { font-size:.8rem; color:#6b7280; font-family:monospace; }
.hp-maps-link { font-size:.8rem; color:#4f46e5; text-decoration:underline; }

.hp-field    { margin-bottom:12px; }
.hp-label    { display:block; font-size:.82rem; color:#374151; font-weight:600; margin-bottom:6px; }
.hp-input    { width:100%; padding:8px 12px; border:1px solid #e5e7eb; border-radius:10px; font-size:.9rem; }
.hp-input--name { margin-bottom:6px; }
.hp-textarea { width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; font-size:.9rem; resize:vertical; }

.hp-chips       { display:flex; flex-wrap:wrap; gap:6px; }
.hp-chips--small { gap:4px; }
.hp-chip        { padding:6px 12px; border-radius:50px; border:1.5px solid #d1d5db; font-size:.82rem; background:white; cursor:pointer; color:#374151; transition:.2s; }
.hp-chip--sm    { padding:4px 9px; font-size:.78rem; }
.hp-chip--active { background:#4f46e5; border-color:#4f46e5; color:white; }

.hp-photos      { display:flex; flex-wrap:wrap; gap:10px; }
.hp-photo-wrap  { position:relative; }
.hp-photo       { width:80px; height:80px; object-fit:cover; border-radius:10px; }
.hp-photo-del   { position:absolute; top:-6px; right:-6px; width:22px; height:22px; border-radius:50%; background:#ef4444; color:white; border:none; font-size:.7rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.hp-photo-add   { width:80px; height:80px; border:2px dashed #c4b5fd; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; color:#7c3aed; }
.hp-photo-add-icon  { font-size:1.4rem; line-height:1; }
.hp-photo-add-label { font-size:.7rem; }
.hp-upload-progress { font-size:.82rem; color:#6366f1; margin-top:6px; }

.hp-member         { background:#f9fafb; border-radius:12px; padding:12px; margin-bottom:10px; }
.hp-member-top     { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
.hp-member-del     { width:26px; height:26px; border-radius:50%; background:#fecaca; color:#dc2626; border:none; font-size:.75rem; cursor:pointer; flex-shrink:0; }
.hp-member-fields  { display:flex; flex-direction:column; gap:6px; }
.hp-add-member-btn { width:100%; padding:10px; border:2px dashed #c4b5fd; border-radius:12px; color:#7c3aed; font-weight:600; font-size:.9rem; background:white; cursor:pointer; margin-top:4px; }

.hp-save-btn {
  width:100%; padding:14px; border-radius:16px; font-size:1rem; font-weight:700;
  background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; border:none; cursor:pointer;
  box-shadow:0 4px 16px rgba(79,70,229,.4);
}
.hp-save-btn:disabled { opacity:.65; cursor:not-allowed; }

/* GPS inline error */
.hp-gps-err      { margin-top:8px; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:10px 12px; }
.hp-gps-err      { font-size:.85rem; color:#b91c1c; }
.hp-gps-err-hint { font-size:.78rem; color:#9b1c1c; margin-top:4px; }

/* Toast */
.hp-toast {
  position:fixed; top:16px; left:50%; transform:translateX(-50%);
  z-index:9999; min-width:260px; max-width:90vw;
  display:flex; align-items:center; gap:10px;
  padding:12px 16px; border-radius:14px;
  font-size:.88rem; font-weight:500;
  box-shadow:0 6px 24px rgba(0,0,0,.18);
}
.hp-toast--error   { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
.hp-toast--success { background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; }
.hp-toast--info    { background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; }
.hp-toast-icon  { font-size:1.1rem; flex-shrink:0; }
.hp-toast-close { margin-left:auto; background:none; border:none; font-size:.9rem; cursor:pointer; opacity:.6; color:inherit; }
.hp-toast-enter-active, .hp-toast-leave-active { transition:all .25s; }
.hp-toast-enter-from, .hp-toast-leave-to { opacity:0; transform:translateX(-50%) translateY(-8px); }
</style>
