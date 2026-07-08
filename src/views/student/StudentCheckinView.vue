<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">🏫 เช็คอินเข้าโรงเรียน</h2>
    </div>

    <!-- ── นาฬิกา + นับถอยหลัง ─────────────────────────── -->
    <div class="clock-card">
      <div class="clock-time">{{ currentTime }}</div>
      <div v-if="!isLate" class="clock-countdown">
        <span class="countdown-label">อีก</span>
        <span class="countdown-value">{{ countdown }}</span>
        <span class="countdown-label">ก่อนสาย</span>
      </div>
      <div v-else class="clock-late">
        <span class="late-badge">⚠️ เลย 08:00 น. แล้ว</span>
      </div>
    </div>

    <!-- ── Check-in card ──────────────────────────────── -->
    <div class="ci-card" :class="ciCardClass">
      <!-- Done -->
      <template v-if="checkinStatus === 'done' || todayCheckin">
        <div class="ci-done-header">
          <span class="ci-done-badge">✅ เช็คอินแล้ว</span>
          <span class="ci-done-time">{{ formatCheckinTime(todayCheckin?.checkin_time) }}</span>
        </div>
        <div v-if="todayCheckin?.checkin_method === 'selfie_only'" class="ci-no-gps-banner">
          📡 ไม่สามารถดึง GPS ได้ — บันทึกด้วยเซลฟี่เท่านั้น ครูจะตรวจสอบภายหลัง
        </div>
        <div class="ci-done-body">
          <div class="ci-done-selfie-col">
            <img v-if="todayCheckin?.selfie_url" :src="fixPhotoUrl(todayCheckin.selfie_url)" class="ci-done-selfie" />
            <div v-else class="ci-done-no-selfie">📷</div>
          </div>
          <div class="ci-done-info-col">
            <div v-if="todayCheckin?.distance_m != null" class="ci-done-info-row">
              <span class="ci-done-info-label">📍 ระยะจากโรงเรียน</span>
              <span class="ci-done-info-val">{{ todayCheckin.distance_m }} ม.</span>
            </div>
            <div v-if="todayCheckin?.lat" class="ci-done-info-row">
              <span class="ci-done-info-label">Lat</span>
              <span class="ci-done-info-val">{{ Number(todayCheckin.lat).toFixed(5) }}</span>
            </div>
            <div v-if="todayCheckin?.lng" class="ci-done-info-row">
              <span class="ci-done-info-label">Lng</span>
              <span class="ci-done-info-val">{{ Number(todayCheckin.lng).toFixed(5) }}</span>
            </div>
            <a
              v-if="todayCheckin?.lat"
              :href="`https://maps.google.com/?q=${todayCheckin.lat},${todayCheckin.lng}`"
              target="_blank"
              class="ci-done-map-link"
            >🗺️ Google Maps</a>
          </div>
        </div>
        <div v-if="todayCheckin?.lat" ref="ciMapEl" class="ci-done-map"></div>
      </template>

      <!-- Error -->
      <template v-else-if="checkinStatus === 'error'">
        <div class="ci-err-icon">⚠️</div>
        <div class="ci-err-msg">{{ checkinError }}</div>
        <button class="ci-retry-btn" @click="resetCheckin">ลองใหม่</button>
      </template>

      <!-- Selfie step -->
      <template v-else-if="checkinStatus === 'selfie'">
        <div class="ci-title">📸 ถ่ายเซลฟี่เพื่อยืนยัน</div>
        <div class="ci-selfie-preview-wrap">
          <video v-if="!selfieBlob" ref="videoRef" autoplay playsinline muted class="ci-video"></video>
          <canvas ref="canvasRef" style="display:none"></canvas>
          <img v-if="selfiePreview" :src="selfiePreview" class="ci-selfie-preview" />
        </div>

        <!-- Face check result badge (shows after capture) -->
        <div v-if="faceChecking" class="face-checking">
          <span class="face-spinner">⟳</span> กำลังตรวจสอบใบหน้า...
        </div>
        <div v-else-if="faceResult && !faceResult.skipped" class="face-result" :class="faceResult.verified ? 'face-result--ok' : 'face-result--warn'">
          <template v-if="faceResult.noFace">
            ⚠️ ไม่พบใบหน้าในรูป — ครูจะตรวจสอบภายหลัง
          </template>
          <template v-else-if="faceResult.verified">
            ✅ ตรวจสอบใบหน้าผ่าน (ความเหมือน {{ Math.round(faceResult.score * 100) }}%)
          </template>
          <template v-else>
            ⚠️ ใบหน้าไม่ตรงกับโปรไฟล์ ({{ Math.round(faceResult.score * 100) }}%) — ครูจะตรวจสอบภายหลัง
          </template>
        </div>

        <div class="ci-selfie-btns">
          <button v-if="!selfiePreview" class="ci-capture-btn" @click="captureSelfie">📷 ถ่ายรูป</button>
          <template v-else>
            <button class="ci-capture-btn" :disabled="faceChecking" @click="retakeSelfie">🔄 ถ่ายใหม่</button>
            <button class="ci-submit-btn" :disabled="faceChecking" @click="submitWithSelfie">✅ ยืนยันเช็คอิน</button>
          </template>
        </div>
      </template>

      <!-- Idle / Loading -->
      <template v-else>
        <div class="ci-icon">{{ statusIcon }}</div>
        <div class="ci-title">{{ statusTitle }}</div>
        <div v-if="checkinStatus === 'idle'" class="ci-subtitle">ต้องอยู่ในบริเวณโรงเรียน</div>
        <div v-if="checkinStatus !== 'idle'" class="ci-loading-bar">
          <div class="ci-loading-fill" :style="{ width: loadingPct + '%' }"></div>
        </div>
        <button v-if="checkinStatus === 'idle'" class="ci-btn" @click="startCheckin">
          เช็คอินเข้าโรงเรียน
        </button>
      </template>
    </div>

    <!-- ── ประวัติเช็คอิน ───────────────────────────────── -->
    <div class="section-card">
      <div class="section-header">
        ประวัติเช็คอิน
        <span class="history-count">{{ history.length }} รายการ</span>
      </div>

      <div v-if="historyLoading" class="empty-text">กำลังโหลด...</div>
      <div v-else-if="!history.length" class="empty-text">ยังไม่มีประวัติเช็คอิน</div>
      <div v-else class="history-list">
        <div v-for="rec in history" :key="rec.id || rec.date" class="history-item">
          <div class="history-selfie-wrap">
            <img v-if="rec.selfie_url" :src="fixPhotoUrl(rec.selfie_url)" class="history-selfie" @click="viewPhoto(rec.selfie_url)" />
            <div v-else class="history-no-selfie">📷</div>
          </div>
          <div class="history-info">
            <div class="history-date">{{ formatHistoryDate(rec.date) }}</div>
            <div class="history-time">🕐 {{ formatCheckinTime(rec.checkin_time) }}</div>
            <div v-if="rec.distance_m != null" class="history-dist">📍 {{ rec.distance_m }} ม.</div>
            <div v-if="rec.face_verified === true" class="history-face history-face--ok">✅ ใบหน้าตรง</div>
            <div v-else-if="rec.face_verified === false" class="history-face history-face--warn">⚠️ ใบหน้าไม่ตรง</div>
            <div v-if="rec.checkin_method === 'selfie_only'" class="history-face history-face--warn">📡 ไม่มี GPS</div>
          </div>
          <div class="history-dot history-dot--ok">✓</div>
        </div>
      </div>
    </div>

    <!-- Photo lightbox -->
    <div v-if="viewingPhoto" class="photo-overlay" @click="viewingPhoto = ''">
      <img :src="fixPhotoUrl(viewingPhoto)" class="photo-full" @click.stop />
      <button class="overlay-close" @click="viewingPhoto = ''">✕</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { fixPhotoUrl } from '@/composables/useStudentUpload'
import { useCheckin } from '@/composables/useCheckin'

const studentStore = useStudentStore()
const session = computed(() => studentStore.session || {})

const thaiToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

const { status: checkinStatus, errorMsg: checkinError, todayCheckin, gpsAttempt, performCheckin, loadTodayCheckin } = useCheckin()

// ── Mini map ──────────────────────────────────────────────
const ciMapEl = ref(null)
let _ciMap = null

async function initCiMap() {
  if (!ciMapEl.value || !todayCheckin.value?.lat) return
  if (_ciMap) { _ciMap.remove(); _ciMap = null }
  const { lat, lng } = todayCheckin.value
  _ciMap = L.map(ciMapEl.value, { center: [lat, lng], zoom: 17, zoomControl: true, attributionControl: false })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_ciMap)
  const icon = L.divIcon({ html: '📍', className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
  L.marker([lat, lng], { icon }).addTo(_ciMap)
}

watch(todayCheckin, async (val) => {
  if (val?.lat) { await nextTick(); initCiMap() }
})
onUnmounted(() => { _ciMap?.remove(); _ciMap = null })

// ── Selfie / Camera ───────────────────────────────────────
const videoRef      = ref(null)
const canvasRef     = ref(null)
const selfieBlob    = ref(null)
const selfiePreview = ref('')
let cameraStream    = null

// ── Face check ────────────────────────────────────────────
const faceChecking = ref(false)
const faceResult   = ref(null) // { verified, score, noFace, skipped, error }
let _faceModelsLoaded = false
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

async function runFaceCheck(blob) {
  faceResult.value = null
  const profileUrl = session.value.photo_url
  if (!profileUrl) {
    faceResult.value = { skipped: true }
    return
  }
  faceChecking.value = true
  try {
    const faceapi = (await import('@vladmandic/face-api')).default || await import('@vladmandic/face-api')

    if (!_faceModelsLoaded) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
      ])
      _faceModelsLoaded = true
    }

    // Draw selfie blob onto canvas to pass to face-api
    const bitmap = await createImageBitmap(blob)
    const sc = document.createElement('canvas')
    sc.width = bitmap.width; sc.height = bitmap.height
    sc.getContext('2d').drawImage(bitmap, 0, 0)

    // Load profile photo through CORS proxy
    const proxyUrl = `/api/photo-proxy?url=${encodeURIComponent(fixPhotoUrl(profileUrl))}`
    const profileImg = new Image()
    profileImg.crossOrigin = 'anonymous'
    await new Promise((res, rej) => {
      profileImg.onload = res
      profileImg.onerror = rej
      profileImg.src = proxyUrl
    })

    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })
    const [selfieDetect, profileDetect] = await Promise.all([
      faceapi.detectSingleFace(sc, opts).withFaceLandmarks().withFaceDescriptor(),
      faceapi.detectSingleFace(profileImg, opts).withFaceLandmarks().withFaceDescriptor(),
    ])

    if (!selfieDetect || !profileDetect) {
      faceResult.value = { verified: false, score: 0, noFace: true }
      return
    }

    const distance = faceapi.euclideanDistance(selfieDetect.descriptor, profileDetect.descriptor)
    const verified = distance < 0.5
    const score = Math.max(0, Math.round((1 - distance) * 100) / 100)
    faceResult.value = { verified, score, distance: Math.round(distance * 100) / 100 }
  } catch (e) {
    console.warn('[FaceCheck]', e.message)
    faceResult.value = { skipped: true, error: e.message }
  } finally {
    faceChecking.value = false
  }
}

const ciCardClass = computed(() => ({
  'ci-card--done':  checkinStatus.value === 'done' || todayCheckin.value,
  'ci-card--error': checkinStatus.value === 'error',
  'ci-card--busy':  ['locating','device_check','uploading'].includes(checkinStatus.value),
}))
const statusIcon = computed(() => ({
  idle: '🏫', locating: '📡', device_check: '🔐', uploading: '⬆️',
}[checkinStatus.value] || '🏫'))
const statusTitle = computed(() => {
  if (checkinStatus.value === 'locating') {
    const labels = ['', 'ดึงพิกัด GPS (รอบ 1/3)...', 'ดึงพิกัด GPS (รอบ 2/3)...', 'ใช้สัญญาณเครือข่าย (รอบ 3/3)...']
    return labels[gpsAttempt.value] || 'กำลังดึงพิกัด...'
  }
  return {
    idle: 'เช็คอินเข้าโรงเรียน',
    device_check: 'ตรวจสอบข้อมูล...',
    uploading: 'กำลังบันทึก...',
  }[checkinStatus.value] || ''
})
const loadingPct = computed(() => ({
  locating: 30, device_check: 60, uploading: 85,
}[checkinStatus.value] || 0))

function formatCheckinTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
}

async function startCheckin() {
  checkinStatus.value = 'selfie'
  await openCamera()
}
async function openCamera() {
  // หยุด stream เดิมก่อนเสมอ (ป้องกัน "camera busy" ที่ทำให้จอดำ)
  stopCamera()

  const tryStream = async (constraints) => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const v = videoRef.value
    if (!v) { stream.getTracks().forEach(t => t.stop()); return }
    v.srcObject = stream
    // รอให้วิดีโอโหลดก่อน (ป้องกันจอดำบน iOS และ Android บางรุ่น)
    await new Promise((resolve, reject) => {
      v.onloadedmetadata = resolve
      v.onerror = reject
      setTimeout(reject, 8000) // timeout 8 วิ ถ้า metadata ไม่มา
    })
    await v.play()
    // ตรวจสอบว่าวิดีโอมีขนาดจริง (ป้องกันจอดำที่ stream เปิดแต่ภาพไม่ออก)
    await new Promise((resolve, reject) => {
      let tries = 0
      const check = setInterval(() => {
        if (v.videoWidth > 0 && v.videoHeight > 0) { clearInterval(check); resolve() }
        if (++tries > 20) { clearInterval(check); reject(new Error('video no frame')) }
      }, 200)
    })
    cameraStream = stream
  }

  try {
    // ลอง 1: กล้องหน้า
    await tryStream({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
  } catch {
    try {
      // ลอง 2: ไม่ระบุกล้อง (ให้ระบบเลือกเอง)
      await tryStream({ video: true, audio: false })
    } catch (err) {
      checkinStatus.value = 'error'
      checkinError.value = err?.name === 'NotAllowedError'
        ? 'ไม่อนุญาตให้ใช้กล้อง — กรุณาเปิดสิทธิ์กล้องในเบราว์เซอร์'
        : 'ไม่สามารถเปิดกล้องได้ — ลองปิดแอปอื่นที่ใช้กล้องอยู่แล้วลองใหม่'
    }
  }
}
function captureSelfie() {
  const v = videoRef.value, c = canvasRef.value
  if (!v || !c) return
  const MAX = 500
  const scale = Math.min(MAX / v.videoWidth, MAX / v.videoHeight, 1)
  c.width = Math.round(v.videoWidth * scale)
  c.height = Math.round(v.videoHeight * scale)
  const ctx = c.getContext('2d')
  ctx.save(); ctx.translate(c.width, 0); ctx.scale(-1, 1)
  ctx.drawImage(v, 0, 0, c.width, c.height)
  ctx.restore()
  c.toBlob(async blob => {
    selfieBlob.value    = blob
    selfiePreview.value = URL.createObjectURL(blob)
    stopCamera()
    await runFaceCheck(blob)
  }, 'image/jpeg', 0.80)
}
function retakeSelfie() {
  selfieBlob.value = null; selfiePreview.value = ''
  faceResult.value = null; faceChecking.value = false
  openCamera()
}
function stopCamera() {
  cameraStream?.getTracks().forEach(t => t.stop()); cameraStream = null
}
async function submitWithSelfie() {
  stopCamera()
  await performCheckin(selfieBlob.value)
  // After checkin saved, store face result as optional extra data
  if (faceResult.value && !faceResult.value.skipped) {
    const { school_id, student_code } = session.value
    try {
      await supabase.from('student_checkins')
        .update({
          face_verified: faceResult.value.verified ?? null,
          face_score: faceResult.value.score ?? null,
        })
        .eq('school_id', school_id)
        .eq('student_code', student_code)
        .eq('date', thaiToday())
    } catch { /* columns may not exist yet — non-fatal */ }
  }
}
function resetCheckin() {
  checkinStatus.value = 'idle'; checkinError.value = ''
  selfieBlob.value = null; selfiePreview.value = ''
  faceResult.value = null; faceChecking.value = false
  stopCamera()
}

// ── นาฬิกา + นับถอยหลัง ──────────────────────────────────
const currentTime = ref('')
const countdown   = ref('')
const isLate      = ref(false)

function updateClock() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${h}:${m}:${s}`

  const cutoff = new Date(now)
  cutoff.setHours(8, 0, 0, 0)
  const diff = cutoff - now

  if (diff <= 0) {
    isLate.value = true
    countdown.value = ''
  } else {
    isLate.value = false
    const totalSec = Math.floor(diff / 1000)
    const hh = Math.floor(totalSec / 3600)
    const mm = Math.floor((totalSec % 3600) / 60)
    const ss = totalSec % 60
    countdown.value = hh > 0
      ? `${hh} ชม. ${String(mm).padStart(2,'0')} นาที ${String(ss).padStart(2,'0')} วินาที`
      : `${mm} นาที ${String(ss).padStart(2,'0')} วินาที`
  }
}

let clockTimer = null

// ── History ───────────────────────────────────────────────
const history = ref([])
const historyLoading = ref(false)
const viewingPhoto = ref('')

async function loadHistory() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  historyLoading.value = true
  try {
    const { data } = await supabase
      .from('student_checkins')
      .select('id, date, checkin_time, selfie_url, lat, lng, distance_m, face_verified, face_score')
      .eq('school_id', school_id)
      .eq('student_code', student_code)
      .order('date', { ascending: false })
      .limit(60)
    history.value = data || []
  } finally {
    historyLoading.value = false
  }
}

function formatHistoryDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  const thaiDays = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.']
  const date = new Date(d)
  return `${thaiDays[date.getDay()]} ${day}/${m}/${Number(y) + 543}`
}

function viewPhoto(url) { viewingPhoto.value = url }

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  loadTodayCheckin()
  loadHistory()
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
})
</script>

<style scoped>
.page-header { margin-bottom: 14px; }
.page-title  { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0; }

/* Clock card */
.clock-card {
  background: linear-gradient(135deg, #1e1b4b, #4c1d95);
  border-radius: 20px; padding: 20px 16px; margin-bottom: 12px;
  text-align: center; color: white;
  box-shadow: 0 4px 20px rgba(30,27,75,.35);
}
.clock-time {
  font-size: 48px; font-weight: 900; letter-spacing: 3px;
  font-variant-numeric: tabular-nums; font-family: monospace;
  line-height: 1;
}
.clock-countdown {
  margin-top: 10px; display: flex; align-items: center;
  justify-content: center; gap: 8px; flex-wrap: wrap;
}
.countdown-label { font-size: 14px; opacity: .75; }
.countdown-value {
  font-size: 18px; font-weight: 800;
  background: rgba(255,255,255,.15); border-radius: 10px;
  padding: 2px 12px; font-variant-numeric: tabular-nums;
}
.clock-late { margin-top: 10px; }
.late-badge {
  display: inline-block; background: rgba(239,68,68,.25);
  border: 1.5px solid rgba(239,68,68,.5); border-radius: 99px;
  padding: 4px 16px; font-size: 14px; font-weight: 700; color: #fca5a5;
}

/* Check-in card */
.ci-card {
  margin-bottom: 16px;
  padding: 20px;
  border-radius: 20px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  text-align: center;
  box-shadow: 0 4px 20px rgba(79,70,229,.4);
  transition: all .3s;
}
.ci-card--done  { background: linear-gradient(135deg,#059669,#10b981); box-shadow:0 4px 20px rgba(5,150,105,.4); }
.ci-card--error { background: linear-gradient(135deg,#dc2626,#ef4444); box-shadow:0 4px 20px rgba(220,38,38,.4); }
.ci-card--busy  { opacity:.85; }

.ci-icon    { font-size: 2.5rem; margin-bottom: 6px; }
.ci-title   { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; }
.ci-subtitle{ font-size: .8rem; opacity: .8; margin-bottom: 14px; }

.ci-btn {
  background: rgba(255,255,255,.2); border: 2px solid rgba(255,255,255,.6);
  color: white; padding: 10px 28px; border-radius: 50px;
  font-size: .95rem; font-weight: 600; cursor: pointer; transition: background .2s;
}
.ci-btn:hover { background: rgba(255,255,255,.35); }

.ci-loading-bar  { background:rgba(255,255,255,.25); border-radius:99px; height:6px; margin:12px 0 4px; }
.ci-loading-fill { height:100%; border-radius:99px; background:white; transition:width .5s; }

.ci-done-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:6px; }
.ci-no-gps-banner { background:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:8px 12px; font-size:12px; color:#92400e; margin-bottom:10px; }
.ci-done-badge  { font-size:1rem; font-weight:800; }
.ci-done-time   { font-size:.9rem; opacity:.9; font-weight:600; }
.ci-done-body   { display:flex; gap:12px; align-items:flex-start; margin-bottom:12px; }
.ci-done-selfie-col { flex-shrink:0; }
.ci-done-selfie { width:88px; height:88px; border-radius:14px; object-fit:cover; border:3px solid rgba(255,255,255,.7); }
.ci-done-no-selfie { width:88px; height:88px; border-radius:14px; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; font-size:2rem; }
.ci-done-info-col { flex:1; display:flex; flex-direction:column; gap:6px; }
.ci-done-info-row { display:flex; justify-content:space-between; gap:8px; }
.ci-done-info-label { font-size:.75rem; opacity:.8; }
.ci-done-info-val   { font-size:.75rem; font-weight:700; font-family:monospace; }
.ci-done-map-link   { font-size:.76rem; color:rgba(255,255,255,.9); text-decoration:underline; margin-top:4px; }
.ci-done-map { width:100%; height:180px; border-radius:12px; overflow:hidden; margin-top:4px; }

.ci-err-icon { font-size:2.2rem; margin-bottom:6px; }
.ci-err-msg  { font-size:.9rem; line-height:1.4; margin-bottom:12px; }
.ci-retry-btn {
  background:rgba(255,255,255,.2); border:2px solid rgba(255,255,255,.6);
  color:white; padding:8px 22px; border-radius:50px; font-size:.9rem; cursor:pointer;
}

.ci-selfie-preview-wrap { margin:10px 0; }
.ci-video { width:100%; max-width:280px; border-radius:12px; background:#000; transform:scaleX(-1); }
.ci-selfie-preview { width:100%; max-width:280px; border-radius:12px; }
.ci-selfie-btns { display:flex; gap:10px; justify-content:center; margin-top:10px; flex-wrap:wrap; }
.ci-capture-btn, .ci-submit-btn {
  padding:9px 22px; border-radius:50px; font-size:.9rem; font-weight:600; cursor:pointer; border:2px solid rgba(255,255,255,.6);
}
.ci-capture-btn { background:rgba(255,255,255,.2); color:white; }
.ci-submit-btn  { background:white; color:#059669; border-color:white; }
.ci-capture-btn:disabled, .ci-submit-btn:disabled { opacity:.5; cursor:not-allowed; }

/* Face check */
.face-checking {
  margin: 8px 0 4px; font-size:.85rem; opacity:.85;
  display:flex; align-items:center; justify-content:center; gap:6px;
}
.face-spinner { display:inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }

.face-result {
  margin: 8px 6px 4px; padding: 8px 14px; border-radius: 12px;
  font-size:.82rem; font-weight:600; text-align:center; line-height:1.4;
}
.face-result--ok   { background:rgba(16,185,129,.18); color:#d1fae5; border:1.5px solid rgba(16,185,129,.4); }
.face-result--warn { background:rgba(245,158,11,.18); color:#fef3c7; border:1.5px solid rgba(245,158,11,.5); }

/* History */
.section-card {
  background: white; border-radius: 16px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 12px;
}
.section-header {
  font-size: 14px; font-weight: 700; color: #374151;
  margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;
}
.history-count { font-size: 12px; color: #9ca3af; font-weight: 400; }

.empty-text { text-align:center; color:#9ca3af; padding:20px 0; font-size:14px; }

.history-list { display:flex; flex-direction:column; gap:10px; }
.history-item {
  display:flex; align-items:center; gap:12px;
  padding:10px; background:#f9fafb; border-radius:12px;
}
.history-selfie-wrap { flex-shrink:0; }
.history-selfie {
  width:52px; height:52px; border-radius:10px; object-fit:cover;
  cursor:pointer; border:2px solid #e5e7eb;
}
.history-no-selfie {
  width:52px; height:52px; border-radius:10px;
  background:#e5e7eb; display:flex; align-items:center; justify-content:center; font-size:20px;
}
.history-info { flex:1; }
.history-date { font-size:14px; font-weight:700; color:#1f2937; }
.history-time { font-size:12px; color:#6b7280; margin-top:2px; }
.history-dist { font-size:11px; color:#9ca3af; margin-top:1px; }
.history-face { font-size:10px; font-weight:600; margin-top:2px; }
.history-face--ok   { color:#059669; }
.history-face--warn { color:#d97706; }
.history-dot {
  width:28px; height:28px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:14px; font-weight:800; flex-shrink:0;
}
.history-dot--ok { background:#dcfce7; color:#166534; }

/* Lightbox */
.photo-overlay {
  position:fixed; inset:0; z-index:100;
  background:rgba(0,0,0,.88); display:flex; align-items:center; justify-content:center;
}
.photo-full { max-width:95vw; max-height:90vh; border-radius:8px; object-fit:contain; }
.overlay-close {
  position:fixed; top:16px; right:16px;
  width:40px; height:40px; border-radius:50%;
  background:rgba(255,255,255,.15); color:white;
  border:none; font-size:20px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
}
</style>
