<template>
  <div>
    <h2 class="page-title">📸 ภาพความทรงจำ</h2>
    <p class="page-sub">บันทึกภาพช่วงเวลาดีๆ ในวัยเรียน</p>

    <!-- Gallery grid -->
    <div v-if="gallery.length" class="gallery-grid">
      <div
        v-for="(url, idx) in gallery"
        :key="idx"
        class="gallery-item"
        @click="viewPhoto(url)"
      >
        <img :src="fixPhotoUrl(url)" class="gallery-img" loading="lazy" />
        <button class="delete-btn" @click.stop="deletePhoto(idx)">✕</button>
      </div>
    </div>
    <div v-else-if="!loading" class="empty-state">
      <div class="empty-icon">🖼️</div>
      <div class="empty-text">ยังไม่มีภาพความทรงจำ<br>กดปุ่มด้านล่างเพื่อเพิ่มภาพ</div>
    </div>
    <div v-if="loading" class="loading-text">กำลังโหลด...</div>

    <!-- Upload area -->
    <label class="upload-area">
      <input type="file" accept="image/*" multiple style="display:none" @change="onPhotoFiles" :disabled="uploading" />
      <span class="upload-icon">{{ uploading ? '⏳' : '+' }}</span>
      <span class="upload-label">{{ uploading ? 'กำลังอัปโหลด...' : 'เพิ่มภาพ' }}</span>
    </label>

    <!-- Photo viewer overlay -->
    <div v-if="viewingPhoto" class="photo-overlay" @click="viewingPhoto = ''">
      <img :src="fixPhotoUrl(viewingPhoto)" class="photo-full" @click.stop />
      <button class="overlay-close" @click="viewingPhoto = ''">✕</button>
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
const gallery     = ref([])
const uploading   = ref(false)
const loading     = ref(false)
const viewingPhoto = ref('')

async function loadGallery() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  loading.value = true
  try {
    const { data } = await supabase
      .from('students')
      .select('photo_gallery, photo_url')
      .eq('school_id', school_id)
      .eq('student_code', student_code)
      .single()
    let g = data?.photo_gallery || []
    if (!Array.isArray(g)) g = []
    gallery.value = g.filter(Boolean)
    // ถ้าไม่มีภาพโปรไฟล์ใช้ภาพล่าสุดจาก gallery
    if (!data?.photo_url && gallery.value.length) {
      studentStore.updatePhotoUrl(gallery.value[gallery.value.length - 1])
    }
  } finally {
    loading.value = false
  }
}

async function saveGallery(newGallery) {
  const { school_id, student_code } = session.value
  const { error } = await supabase.rpc('update_student_photo_gallery', {
    p_school_id:   school_id,
    p_student_code: student_code,
    p_gallery:     newGallery,
  })
  if (error) throw error
  gallery.value = newGallery
}

async function onPhotoFiles(e) {
  const files = [...(e.target.files || [])]
  if (!files.length) return
  uploading.value = true
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
    uploading.value = false
    e.target.value = ''
  }
}

async function deletePhoto(idx) {
  if (!confirm('ลบภาพนี้?')) return
  const updated = gallery.value.filter((_, i) => i !== idx)
  try {
    await saveGallery(updated)
  } catch (err) {
    alert('ลบไม่สำเร็จ: ' + err.message)
  }
}

function viewPhoto(url) { viewingPhoto.value = url }

onMounted(loadGallery)
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 4px; }
.page-sub { font-size: 12px; color: #9ca3af; margin: 0 0 16px; }

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.gallery-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
  cursor: pointer;
}
.gallery-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.delete-btn {
  position: absolute; top: 5px; right: 5px;
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(0,0,0,.55); color: white;
  border: none; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; line-height: 1;
}

.empty-state {
  text-align: center; padding: 40px 16px;
  background: white; border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
  margin-bottom: 16px;
}
.empty-icon { font-size: 40px; margin-bottom: 10px; }
.empty-text { font-size: 14px; color: #9ca3af; line-height: 1.7; }
.loading-text { text-align: center; color: #9ca3af; font-size: 14px; padding: 20px; }

.upload-area {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 100%; padding: 20px;
  border: 2.5px dashed #c4b5fd; border-radius: 16px;
  background: #faf5ff; cursor: pointer;
  transition: background .15s;
}
.upload-area:hover { background: #f3e8ff; }
.upload-icon { font-size: 28px; font-weight: 700; color: #7c3aed; line-height: 1; }
.upload-label { font-size: 14px; font-weight: 600; color: #7c3aed; margin-top: 6px; }

/* Photo overlay */
.photo-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,.88);
  display: flex; align-items: center; justify-content: center;
}
.photo-full { max-width: 95vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }
.overlay-close {
  position: fixed; top: 16px; right: 16px;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,.15); color: white;
  border: none; font-size: 20px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
</style>
