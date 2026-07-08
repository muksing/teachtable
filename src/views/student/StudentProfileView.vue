<template>
  <div>
    <h2 class="page-title">👤 จัดการโปรไฟล์</h2>

    <!-- Current profile photo -->
    <div class="profile-center">
      <div class="avatar-wrap">
        <img v-if="profileUrl" :src="fixPhotoUrl(profileUrl)" class="profile-avatar" @error="profileUrl = ''" />
        <div v-else class="profile-placeholder">{{ initials }}</div>
        <label class="avatar-cam-btn" title="อัปโหลดรูปโปรไฟล์">
          <input type="file" accept="image/*" style="display:none" @change="onUploadProfile" />
          📷
        </label>
      </div>
      <div class="profile-name">{{ session.prefix }}{{ session.first_name }} {{ session.last_name }}</div>
      <div class="profile-meta">{{ session.student_code }} · ห้อง {{ session.class_id }}</div>
      <div v-if="uploading" class="uploading-text">กำลังอัปโหลด...</div>
    </div>

    <!-- Select from memories -->
    <div v-if="gallery.length" class="section-card">
      <div class="section-title">🖼️ เลือกจากภาพความทรงจำ</div>
      <div class="section-sub">แตะภาพเพื่อตั้งเป็นโปรไฟล์</div>
      <div class="mem-grid">
        <div
          v-for="(url, idx) in gallery"
          :key="idx"
          class="mem-item"
          :class="{ 'mem-item--selected': url === selectedUrl }"
          @click="selectMemory(url)"
        >
          <img :src="fixPhotoUrl(url)" class="mem-img" />
          <div v-if="url === selectedUrl" class="mem-check">✓</div>
        </div>
      </div>
      <button
        v-if="selectedUrl && selectedUrl !== currentSavedUrl"
        class="save-btn"
        :disabled="saving"
        @click="saveProfileFromMemory"
      >
        {{ saving ? 'กำลังบันทึก...' : '✅ บันทึกรูปโปรไฟล์' }}
      </button>
    </div>

    <!-- If no memories yet -->
    <div v-else class="empty-memories">
      <div class="empty-icon">📸</div>
      <div class="empty-text">ยังไม่มีภาพความทรงจำ<br>ไปเพิ่มที่เมนู "ความทรงจำ"</div>
      <router-link to="/student/memories" class="goto-btn">ไปหน้าความทรงจำ →</router-link>
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

const session     = computed(() => studentStore.session || {})
const profileUrl  = ref(session.value.photo_url || '')
const gallery     = ref([])
const selectedUrl = ref(session.value.photo_url || '')
const currentSavedUrl = ref(session.value.photo_url || '')
const uploading   = ref(false)
const saving      = ref(false)

const initials = computed(() => (session.value.first_name || '?').charAt(0))

async function loadData() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  const { data } = await supabase
    .from('students')
    .select('photo_url, photo_gallery')
    .eq('school_id', school_id)
    .eq('student_code', student_code)
    .maybeSingle()
  if (!data) return
  let g = data.photo_gallery || []
  if (!Array.isArray(g)) g = []
  gallery.value = g.filter(Boolean)
  if (data.photo_url) {
    profileUrl.value  = data.photo_url
    selectedUrl.value = data.photo_url
    currentSavedUrl.value = data.photo_url
    studentStore.updatePhotoUrl(data.photo_url)
  }
}

async function onUploadProfile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const { school_id, student_code } = session.value
  uploading.value = true
  try {
    const url = await uploadFile(file, school_id, student_code, 'profile')
    await setProfileUrl(url)
    profileUrl.value  = url
    selectedUrl.value = url
  } catch (err) {
    alert('อัปโหลดไม่สำเร็จ: ' + err.message)
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

function selectMemory(url) {
  selectedUrl.value = url
}

async function saveProfileFromMemory() {
  saving.value = true
  try {
    await setProfileUrl(selectedUrl.value)
    profileUrl.value = selectedUrl.value
    currentSavedUrl.value = selectedUrl.value
  } catch (err) {
    alert('บันทึกไม่สำเร็จ: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function setProfileUrl(url) {
  const { school_id, student_code } = session.value
  const { error } = await supabase
    .from('students')
    .update({ photo_url: url })
    .eq('school_id', school_id)
    .eq('student_code', student_code)
  if (error) throw error
  studentStore.updatePhotoUrl(url)
  currentSavedUrl.value = url
}

onMounted(loadData)
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 20px; }

.profile-center { display: flex; flex-direction: column; align-items: center; margin-bottom: 24px; }
.avatar-wrap { position: relative; margin-bottom: 12px; }
.profile-avatar {
  width: 110px; height: 110px; border-radius: 50%; object-fit: cover;
  border: 3px solid #7c3aed; box-shadow: 0 0 0 5px #ede9fe;
}
.profile-placeholder {
  width: 110px; height: 110px; border-radius: 50%;
  background: #ddd6fe; border: 3px solid #7c3aed;
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; font-weight: 700; color: #6d28d9;
}
.avatar-cam-btn {
  position: absolute; bottom: 4px; right: 4px;
  width: 32px; height: 32px; border-radius: 50%;
  background: #6d28d9; color: white; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.25);
}
.profile-name { font-size: 18px; font-weight: 800; color: #1e1b4b; }
.profile-meta { font-size: 13px; color: #9ca3af; margin-top: 2px; }
.uploading-text { font-size: 13px; color: #6366f1; margin-top: 6px; }

.section-card {
  background: white; border-radius: 16px; padding: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 16px;
}
.section-title { font-size: 15px; font-weight: 700; color: #1e1b4b; margin-bottom: 4px; }
.section-sub { font-size: 12px; color: #9ca3af; margin-bottom: 14px; }

.mem-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;
}
.mem-item {
  position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden;
  cursor: pointer; border: 3px solid transparent; transition: border-color .15s;
}
.mem-item--selected { border-color: #7c3aed; }
.mem-img { width: 100%; height: 100%; object-fit: cover; }
.mem-check {
  position: absolute; inset: 0; background: rgba(109,40,217,.45);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 900; color: white;
}

.save-btn {
  width: 100%; padding: 12px; border: none; border-radius: 12px;
  background: linear-gradient(135deg,#6d28d9,#7c3aed); color: white;
  font-size: 15px; font-weight: 700; cursor: pointer;
}
.save-btn:disabled { opacity: .6; cursor: default; }

.empty-memories {
  text-align: center; padding: 32px 16px;
  background: white; border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
}
.empty-icon { font-size: 40px; margin-bottom: 10px; }
.empty-text { font-size: 14px; color: #9ca3af; line-height: 1.6; margin-bottom: 16px; }
.goto-btn {
  display: inline-block; padding: 10px 24px; border-radius: 99px;
  background: #ede9fe; color: #6d28d9; font-weight: 700; font-size: 14px;
  text-decoration: none;
}
</style>
