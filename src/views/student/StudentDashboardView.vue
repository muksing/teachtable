<template>
  <div>
    <!-- Photo Gallery -->
    <div class="gallery-intro">
      <div class="gallery-intro-title">📸 ภาพความทรงจำของฉัน</div>
      <div class="gallery-intro-desc">บันทึกภาพช่วงเวลาดีๆ ในวัยเรียน ความทรงจำเหล่านี้จะอยู่กับคุณไปตลอด</div>
    </div>
    <div class="photo-section">
      <div class="gallery-scroll">
        <div
          v-for="(url, idx) in gallery"
          :key="idx"
          class="gallery-item"
          @click="viewPhoto(url)"
        >
          <img :src="fixPhotoUrl(url)" class="gallery-img" />
          <button
            v-if="gallery.length > 1"
            class="delete-btn"
            @click.stop="deletePhoto(idx)"
          >✕</button>
        </div>

        <!-- Add photo button -->
        <label class="add-photo-btn">
          <input type="file" accept="image/*" style="display:none" multiple @change="onPhotoFiles" />
          <span class="add-icon">+</span>
          <span class="add-label">เพิ่มภาพ</span>
        </label>
      </div>
      <div v-if="photoUploading" class="upload-progress">กำลังอัปโหลด...</div>
    </div>

    <!-- Student info -->
    <div class="info-card">
      <div class="student-display-prefix">{{ session.prefix }}</div>
      <div class="student-display-name">
        <span class="name-first">{{ session.first_name }}</span>
        <span class="name-last">{{ session.last_name }}</span>
      </div>
      <div class="student-display-meta">{{ session.student_code }} · ห้อง {{ session.class_id }}</div>
      <div class="student-display-term">{{ termLabel }}</div>
    </div>

    <!-- BMI quick card (ถ้ามี) -->
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

    <!-- Behavior scores -->
    <div class="section-card" @click="$router.push('/student/behavior')">
      <div class="sc-label">⭐ คะแนนพฤติกรรมรวม</div>
      <div class="sc-score">{{ session.total_behavior_score ?? 0 }}</div>
      <div class="sc-chips">
        <span class="sc-chip sc-chip--g">ทั่วไป {{ session.general_behavior_score ?? 0 }}</span>
        <span class="sc-chip sc-chip--a">มาเรียน {{ session.attendance_behavior_score ?? 0 }}</span>
        <span class="sc-chip sc-chip--l">ในห้อง {{ session.learning_behavior_score ?? 0 }}</span>
      </div>
    </div>

    <!-- Quick menu -->
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

    <!-- Photo viewer dialog -->
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

const studentStore = useStudentStore()
const { uploadFile } = useStudentUpload()

const session = computed(() => studentStore.session || {})
const gallery = ref([])
const latestHealth = ref(null)
const photoUploading = ref(false)
const viewingPhoto = ref('')

const fullName = computed(() => {
  const s = session.value
  return [s.prefix, s.first_name, s.last_name].filter(Boolean).join('')
})
const termLabel = computed(() => {
  const t = session.value.current_term || ''
  if (t.includes('_')) { const [y, s] = t.split('_'); return `ปีการศึกษา ${y} ภาคเรียนที่ ${s}` }
  return t || ''
})

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
  return `${day}/${m}/${Number(y)+543}`
}

async function loadGallery() {
  const { school_id, student_code, photo_url } = session.value
  if (!school_id || !student_code) return
  const { data } = await supabase
    .from('students')
    .select('photo_gallery, photo_url')
    .eq('school_id', school_id)
    .eq('student_code', student_code)
    .single()
  let g = data?.photo_gallery || []
  if (!Array.isArray(g)) g = []
  if (!g.length && (data?.photo_url || photo_url)) {
    g = [data?.photo_url || photo_url]
  }
  gallery.value = g.filter(Boolean)
  // ภาพล่าสุด (ท้ายสุดของ array) เป็นโปรไฟล์
  const latest = gallery.value[gallery.value.length - 1]
  if (latest) studentStore.updatePhotoUrl(latest)
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

async function saveGallery(newGallery) {
  const { school_id, student_code } = session.value
  const { error } = await supabase.rpc('update_student_photo_gallery', {
    p_school_id: school_id,
    p_student_code: student_code,
    p_gallery: newGallery,
  })
  if (error) {
    alert('บันทึกไม่สำเร็จ: ' + error.message + '\n\nกรุณาแจ้งผู้ดูแลระบบรัน SQL สร้าง update_student_photo_gallery')
    return
  }
  gallery.value = newGallery
  const latest = newGallery[newGallery.length - 1]
  if (latest) studentStore.updatePhotoUrl(latest)
}

async function onPhotoFiles(e) {
  const files = [...(e.target.files || [])]
  if (!files.length) return
  photoUploading.value = true
  try {
    const { school_id, student_code } = session.value
    const urls = []
    for (const file of files) {
      const url = await uploadFile(file, school_id, student_code, 'gallery')
      urls.push(url)
    }
    await saveGallery([...gallery.value, ...urls])
  } catch (err) {
    alert('อัปโหลดไม่สำเร็จ: ' + err.message)
  } finally {
    photoUploading.value = false
    e.target.value = ''
  }
}

async function deletePhoto(idx) {
  if (gallery.value.length <= 1) return
  if (!confirm('ลบภาพนี้?')) return
  const updated = gallery.value.filter((_, i) => i !== idx)
  await saveGallery(updated)
}

function viewPhoto(url) { viewingPhoto.value = url }

onMounted(() => {
  loadGallery()
  loadLatestHealth()
})
</script>

<style scoped>
/* Photo gallery */
.photo-section { margin-bottom: 14px; }
.gallery-scroll {
  display: flex; gap: 10px; overflow-x: auto;
  padding-bottom: 4px; scrollbar-width: none;
}
.gallery-scroll::-webkit-scrollbar { display: none; }
.gallery-item {
  position: relative; flex-shrink: 0;
  width: 100px; height: 100px; border-radius: 14px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
.gallery-img { width: 100%; height: 100%; object-fit: cover; cursor: pointer; }
.delete-btn {
  position: absolute; top: 4px; right: 4px;
  background: rgba(0,0,0,.55); color: white; border: none;
  border-radius: 50%; width: 22px; height: 22px; font-size: 11px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}

.add-photo-btn {
  flex-shrink: 0; width: 100px; height: 100px; border-radius: 14px;
  background: rgba(99,102,241,.1); border: 2px dashed #6366f1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; gap: 4px;
}
.add-icon { font-size: 28px; color: #6366f1; line-height: 1; }
.add-label { font-size: 12px; color: #6366f1; font-weight: 600; }
.upload-progress { font-size: 13px; color: #6366f1; text-align: center; margin-top: 6px; }

/* Gallery intro */
.gallery-intro { margin-bottom: 8px; }
.gallery-intro-title { font-size: 15px; font-weight: 700; color: #1e1b4b; }
.gallery-intro-desc { font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.5; }

/* Info card */
.info-card {
  background: white; border-radius: 16px; padding: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 12px; text-align: center;
}
.student-display-prefix { font-size: 14px; color: #6b7280; margin-bottom: 2px; }
.student-display-name { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.name-first { font-size: 24px; font-weight: 900; color: #6366f1; }
.name-last  { font-size: 24px; font-weight: 900; color: #1e1b4b; }
.student-display-meta { font-size: 14px; color: #6b7280; margin-top: 4px; }
.student-display-term { font-size: 12px; color: #9ca3af; margin-top: 2px; }

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
.menu-card--health   { background: linear-gradient(135deg,#bbf7d0,#86efac); color: #166534; }
.menu-card--deeds    { background: linear-gradient(135deg,#fde68a,#fbbf24); color: #92400e; }
.menu-card--gratitude{ background: linear-gradient(135deg,#fce7f3,#fbcfe8); color: #9d174d; }
.menu-card--scores   { background: linear-gradient(135deg,#dbeafe,#93c5fd); color: #1e40af; }

/* Photo overlay */
.photo-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 999;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.photo-full { max-width: 100%; max-height: 90dvh; border-radius: 12px; object-fit: contain; }
</style>
