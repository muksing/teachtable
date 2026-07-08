<template>
  <AppLayout>
    <div class="ann-page">
      <div class="ann-header">
        <div>
          <h2 class="ann-title">📣 จัดการประกาศประชาสัมพันธ์</h2>
          <p class="ann-sub">
            <span v-if="isAdmin">ดูและจัดการประกาศทั้งหมดของโรงเรียน</span>
            <span v-else>ประกาศของฉัน</span>
          </p>
        </div>
        <el-button type="primary" @click="openForm()">+ สร้างประกาศ</el-button>
      </div>

      <!-- Admin toolbar: filter + bulk actions -->
      <div v-if="isAdmin" class="ann-toolbar">
        <div class="ann-filter-row">
          <label class="ann-select-all">
            <input type="checkbox" :checked="allSelected" :indeterminate.prop="someSelected && !allSelected" @change="toggleSelectAll" />
            <span>เลือกทั้งหมด ({{ filteredList.length }})</span>
          </label>
          <div class="ann-filter-chips">
            <button v-for="f in FILTER_OPTIONS" :key="f.value"
              class="ann-fchip" :class="{ 'ann-fchip--active': filterTarget === f.value }"
              @click="filterTarget = f.value; selected = []">
              {{ f.label }}
            </button>
          </div>
          <div class="ann-filter-chips">
            <button v-for="f in TYPE_FILTERS" :key="f.value"
              class="ann-fchip" :class="{ 'ann-fchip--active': filterType === f.value }"
              @click="filterType = f.value; selected = []">
              {{ f.label }}
            </button>
          </div>
        </div>
        <transition name="bulk-slide">
          <div v-if="selected.length" class="ann-bulk-bar">
            <span class="ann-bulk-count">เลือก {{ selected.length }} รายการ</span>
            <el-button size="small" type="danger" plain :loading="bulkDeleting" @click="bulkDelete">
              🗑️ ลบที่เลือก
            </el-button>
            <el-button size="small" plain @click="selected = []">ยกเลิก</el-button>
          </div>
        </transition>
      </div>

      <!-- List -->
      <div v-if="loading" class="ann-loading">กำลังโหลด...</div>
      <div v-else-if="!filteredList.length" class="ann-empty">ยังไม่มีประกาศ</div>
      <div v-else class="ann-list">
        <div
          v-for="a in filteredList" :key="a.id"
          class="ann-card"
          :class="{ 'ann-card--selected': selected.includes(a.id) }"
        >
          <div class="ann-card-top">
            <label v-if="isAdmin" class="ann-check-wrap" @click.stop>
              <input type="checkbox" :value="a.id" v-model="selected" class="ann-check-input" />
              <span class="ann-check-box"></span>
            </label>
            <div class="ann-targets">
              <span v-for="t in (a.targets || ['teacher'])" :key="t" class="ann-target-chip" :class="`ann-t--${t}`">
                {{ TARGET_LABELS[t] || t }}
              </span>
              <span v-if="a.target_user_ids && a.target_user_ids.length" class="ann-target-chip ann-t--specific">
                🎯 เฉพาะบุคคล
              </span>
              <span class="ann-type-chip" :class="`ann-type--${a.type}`">
                {{ a.type === 'urgent' ? '⚠️ ด่วน' : a.type === 'reminder' ? '🔔 แจ้งเตือน' : 'ℹ️ ทั่วไป' }}
              </span>
            </div>
            <div class="ann-card-actions">
              <el-button size="small" plain @click="openForm(a)">✏️</el-button>
              <el-button size="small" type="danger" plain @click="deleteAnn(a.id)">🗑️</el-button>
            </div>
          </div>

          <div v-if="a.title" class="ann-card-title">{{ a.title }}</div>
          <div class="ann-card-body">{{ a.content }}</div>

          <!-- Images -->
          <div v-if="a.image_urls && a.image_urls.length" class="ann-card-images">
            <img
              v-for="(url, i) in a.image_urls" :key="i"
              :src="url" class="ann-img-thumb"
              @click="lightboxUrl = url"
              @error="e => e.target.style.display='none'"
            />
          </div>

          <div class="ann-card-meta">
            <span class="ann-card-author">{{ a.author_name || 'ไม่ระบุ' }}</span>
            <span class="ann-card-date">{{ fmtDate(a.created_at) }}</span>
            <span v-if="a.expires_at" class="ann-card-exp">หมดอายุ {{ fmtDate(a.expires_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Form dialog -->
      <el-dialog v-model="showForm" :title="editId ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'" width="min(560px,96vw)" destroy-on-close>
        <el-form label-position="top" @submit.prevent>
          <el-form-item label="หัวข้อ (ไม่บังคับ)">
            <el-input v-model="form.title" placeholder="หัวข้อประกาศ" maxlength="120" show-word-limit />
          </el-form-item>

          <el-form-item label="เนื้อหาประกาศ *">
            <el-input
              v-model="form.content"
              type="textarea" :rows="5"
              placeholder="พิมพ์เนื้อหาประกาศที่นี่..."
              maxlength="2000" show-word-limit
            />
          </el-form-item>

          <el-form-item label="ประเภท">
            <el-radio-group v-model="form.type">
              <el-radio-button value="info">ℹ️ ทั่วไป</el-radio-button>
              <el-radio-button value="reminder">🔔 แจ้งเตือน</el-radio-button>
              <el-radio-button value="urgent">⚠️ ด่วน</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="ส่งถึง *">
            <div class="target-checks">
              <label v-for="t in TARGET_OPTIONS" :key="t.value" class="target-check-label">
                <input type="checkbox" :value="t.value" v-model="form.targets" class="target-check-input"
                  @change="onTargetChange" />
                <span class="target-check-box" :class="`ann-t--${t.value}`">{{ t.icon }} {{ t.label }}</span>
              </label>
            </div>
            <div v-if="!form.targets.length" class="target-warn">กรุณาเลือกอย่างน้อย 1 กลุ่ม</div>
          </el-form-item>

          <!-- Individual teacher targeting (only shown when teacher is selected) -->
          <el-form-item v-if="form.targets.includes('teacher')" label="เฉพาะครูบางคน (ถ้าไม่เลือก = ส่งทุกคน)">
            <div class="specific-toggle">
              <label class="specific-check-label">
                <input type="checkbox" v-model="useSpecificTeachers" @change="onToggleSpecific" />
                <span>เลือกเฉพาะบางคน</span>
              </label>
            </div>
            <div v-if="useSpecificTeachers" class="teacher-select-wrap">
              <div v-if="teachersLoading" class="teacher-loading">กำลังโหลดรายชื่อครู...</div>
              <div v-else class="teacher-check-grid">
                <label v-for="t in teacherList" :key="t.teacher_code" class="teacher-check-row">
                  <input type="checkbox" :value="String(t.teacher_code)" v-model="form.target_user_ids" />
                  <span class="teacher-check-name">{{ t.prefix }}{{ t.first_name }} {{ t.last_name }}</span>
                </label>
              </div>
              <div v-if="useSpecificTeachers && !form.target_user_ids.length" class="target-warn">กรุณาเลือกอย่างน้อย 1 คน</div>
            </div>
          </el-form-item>

          <!-- Image upload -->
          <el-form-item label="รูปภาพ / อินโฟกราฟิก">
            <!-- Existing images (edit mode) -->
            <div v-if="form.image_urls.length" class="img-preview-row">
              <div v-for="(url, i) in form.image_urls" :key="url" class="img-preview-item">
                <img :src="url" class="img-preview-thumb" @error="e => e.target.style.opacity='.3'" />
                <button class="img-remove-btn" @click="form.image_urls.splice(i,1)" title="ลบรูป">✕</button>
              </div>
            </div>
            <!-- Pending new images -->
            <div v-if="pendingPreviews.length" class="img-preview-row">
              <div v-for="(url, i) in pendingPreviews" :key="i" class="img-preview-item img-preview-item--new">
                <img :src="url" class="img-preview-thumb" />
                <button class="img-remove-btn" @click="removePending(i)" title="ลบรูป">✕</button>
                <span class="img-new-badge">ใหม่</span>
              </div>
            </div>
            <!-- File input -->
            <label class="img-upload-btn">
              <input type="file" accept="image/*" multiple @change="onFileChange" style="display:none" />
              📎 เพิ่มรูปภาพ
            </label>
            <span class="img-upload-hint">รองรับ JPG, PNG, GIF, WEBP ขนาดไม่เกิน 10MB ต่อรูป</span>
          </el-form-item>

          <el-form-item label="หมดอายุ (ไม่บังคับ)">
            <el-date-picker v-model="form.expires_at" type="datetime" placeholder="ไม่กำหนดวันหมดอายุ" style="width:100%" />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="showForm = false">ยกเลิก</el-button>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!form.content.trim() || !form.targets.length || (useSpecificTeachers && !form.target_user_ids.length)"
            @click="saveAnn"
          >
            {{ editId ? 'บันทึกการแก้ไข' : 'เผยแพร่ประกาศ' }}
          </el-button>
        </template>
      </el-dialog>

      <!-- Lightbox -->
      <div v-if="lightboxUrl" class="ann-lightbox" @click="lightboxUrl = ''">
        <img :src="lightboxUrl" class="ann-lightbox-img" @click.stop />
        <button class="ann-lightbox-close" @click="lightboxUrl = ''">✕</button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isAdmin = computed(() =>
  authStore.roles.some(r => ['school_admin', 'superadmin'].includes(r))
)

const TARGET_LABELS  = { teacher: '👩‍🏫 ครู', student: '🎓 นักเรียน', parent: '👨‍👩‍👧 ผู้ปกครอง' }
const TARGET_OPTIONS = [
  { value: 'teacher', label: 'ครู',       icon: '👩‍🏫' },
  { value: 'student', label: 'นักเรียน',  icon: '🎓' },
  { value: 'parent',  label: 'ผู้ปกครอง', icon: '👨‍👩‍👧' },
]
const FILTER_OPTIONS = [
  { value: 'all',     label: 'ทั้งหมด' },
  { value: 'teacher', label: '👩‍🏫 ครู' },
  { value: 'student', label: '🎓 นักเรียน' },
  { value: 'parent',  label: '👨‍👩‍👧 ผู้ปกครอง' },
]
const TYPE_FILTERS = [
  { value: 'all',      label: 'ทุกประเภท' },
  { value: 'info',     label: 'ℹ️ ทั่วไป' },
  { value: 'reminder', label: '🔔 แจ้งเตือน' },
  { value: 'urgent',   label: '⚠️ ด่วน' },
]

const list          = ref([])
const loading       = ref(false)
const showForm      = ref(false)
const saving        = ref(false)
const editId        = ref(null)
const selected      = ref([])
const bulkDeleting  = ref(false)
const filterTarget  = ref('all')
const filterType    = ref('all')
const lightboxUrl   = ref('')

// Teacher list for individual targeting
const teacherList    = ref([])
const teachersLoading = ref(false)
const useSpecificTeachers = ref(false)

// Image upload state
const pendingFiles    = ref([])
const pendingPreviews = ref([])

const form = ref({
  title: '', content: '', type: 'info',
  targets: ['teacher'], expires_at: null,
  image_urls: [], target_user_ids: [],
})

const filteredList = computed(() => {
  return list.value.filter(a => {
    if (filterTarget.value !== 'all' && !(a.targets || ['teacher']).includes(filterTarget.value)) return false
    if (filterType.value !== 'all' && a.type !== filterType.value) return false
    return true
  })
})

const allSelected  = computed(() => filteredList.value.length > 0 && filteredList.value.every(a => selected.value.includes(a.id)))
const someSelected = computed(() => filteredList.value.some(a => selected.value.includes(a.id)))

function toggleSelectAll() {
  if (allSelected.value) {
    selected.value = selected.value.filter(id => !filteredList.value.find(a => a.id === id))
  } else {
    const toAdd = filteredList.value.map(a => a.id).filter(id => !selected.value.includes(id))
    selected.value = [...selected.value, ...toAdd]
  }
}

function onTargetChange() {
  if (!form.value.targets.includes('teacher')) {
    form.value.target_user_ids = []
    useSpecificTeachers.value = false
  }
}

function onToggleSpecific(e) {
  if (!e.target.checked) form.value.target_user_ids = []
  else loadTeachers()
}

async function loadTeachers() {
  if (teacherList.value.length) return
  teachersLoading.value = true
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('teacher_code, prefix, first_name, last_name')
      .eq('school_id', authStore.schoolId)
      .order('first_name')
    if (error) throw error
    teacherList.value = data || []
  } catch (e) {
    ElMessage.error('โหลดรายชื่อครูไม่สำเร็จ: ' + e.message)
  } finally {
    teachersLoading.value = false
  }
}

function openForm(ann = null) {
  pendingFiles.value = []
  pendingPreviews.value.forEach(u => URL.revokeObjectURL(u))
  pendingPreviews.value = []

  if (ann) {
    editId.value = ann.id
    form.value = {
      title:           ann.title || '',
      content:         ann.content || '',
      type:            ann.type || 'info',
      targets:         ann.targets ? [...ann.targets] : ['teacher'],
      expires_at:      ann.expires_at || null,
      image_urls:      ann.image_urls ? [...ann.image_urls] : [],
      target_user_ids: ann.target_user_ids ? [...ann.target_user_ids] : [],
    }
    useSpecificTeachers.value = form.value.target_user_ids.length > 0
    if (useSpecificTeachers.value) loadTeachers()
  } else {
    editId.value = null
    form.value = { title: '', content: '', type: 'info', targets: ['teacher'], expires_at: null, image_urls: [], target_user_ids: [] }
    useSpecificTeachers.value = false
  }
  showForm.value = true
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Image upload helpers ─────────────────────────────────────────────
function onFileChange(e) {
  const files = Array.from(e.target.files || [])
  files.forEach(f => {
    pendingFiles.value.push(f)
    pendingPreviews.value.push(URL.createObjectURL(f))
  })
  e.target.value = ''
}

function removePending(i) {
  URL.revokeObjectURL(pendingPreviews.value[i])
  pendingFiles.value.splice(i, 1)
  pendingPreviews.value.splice(i, 1)
}

async function uploadImages() {
  const urls = [...form.value.image_urls]
  for (const file of pendingFiles.value) {
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
    const path = `${authStore.schoolId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from('announcements')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (!error) {
      const { data } = supabase.storage.from('announcements').getPublicUrl(path)
      urls.push(data.publicUrl)
    } else {
      ElMessage.warning(`อัปโหลดรูปไม่สำเร็จ: ${file.name}`)
    }
  }
  return urls
}

// ── CRUD ─────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  selected.value = []
  try {
    let q = supabase
      .from('school_announcements')
      .select('id, title, content, type, targets, target_user_ids, image_urls, author_name, author_id, created_at, expires_at')
      .eq('school_id', authStore.schoolId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!isAdmin.value) {
      q = q.eq('author_id', authStore.profile?.uid || '')
    }

    const { data } = await q
    list.value = data || []
  } finally {
    loading.value = false
  }
}

async function saveAnn() {
  if (!form.value.content.trim() || !form.value.targets.length) return
  if (useSpecificTeachers.value && !form.value.target_user_ids.length) return
  saving.value = true
  try {
    const imageUrls = await uploadImages()
    const payload = {
      school_id:       authStore.schoolId,
      author_id:       authStore.profile?.uid || '',
      author_name:     authStore.profile?.displayName || authStore.profile?.name || authStore.profile?.first_name || 'ครู',
      author_role:     'announcer',
      title:           form.value.title.trim(),
      content:         form.value.content.trim(),
      type:            form.value.type,
      targets:         form.value.targets,
      expires_at:      form.value.expires_at || null,
      image_urls:      imageUrls,
      target_user_ids: useSpecificTeachers.value && form.value.target_user_ids.length
                         ? form.value.target_user_ids
                         : null,
    }
    if (editId.value) {
      const { error } = await supabase.from('school_announcements').update(payload).eq('id', editId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('school_announcements').insert(payload)
      if (error) throw error
    }
    ElMessage.success(editId.value ? 'แก้ไขประกาศสำเร็จ' : 'เผยแพร่ประกาศสำเร็จ')
    showForm.value = false
    await load()
  } catch (e) {
    ElMessage.error('เกิดข้อผิดพลาด: ' + (e.message || e))
  } finally {
    saving.value = false
  }
}

async function deleteAnn(id) {
  try {
    await ElMessageBox.confirm('ลบประกาศนี้?', 'ยืนยัน', { type: 'warning', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' })
    const { error } = await supabase.from('school_announcements').delete().eq('id', id)
    if (error) throw error
    ElMessage.success('ลบประกาศแล้ว')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด')
  }
}

async function bulkDelete() {
  if (!selected.value.length) return
  try {
    await ElMessageBox.confirm(
      `ลบ ${selected.value.length} ประกาศที่เลือก?`,
      'ยืนยันลบหลายรายการ',
      { type: 'warning', confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก' }
    )
    bulkDeleting.value = true
    const { error } = await supabase.from('school_announcements').delete().in('id', selected.value)
    if (error) throw error
    ElMessage.success(`ลบ ${selected.value.length} ประกาศแล้ว`)
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('เกิดข้อผิดพลาด')
  } finally {
    bulkDeleting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ann-page { max-width: 800px; margin: 0 auto; padding: 16px; }
.ann-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.ann-title  { font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 0 0 4px; }
.ann-sub    { font-size: 13px; color: #6b7280; margin: 0; }
.ann-loading { text-align: center; color: #9ca3af; padding: 40px; }
.ann-empty   { text-align: center; color: #9ca3af; padding: 60px 20px; font-size: 15px; }

/* Toolbar */
.ann-toolbar { margin-bottom: 14px; }
.ann-filter-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: white; border-radius: 12px; padding: 10px 14px;
  box-shadow: 0 1px 6px rgba(0,0,0,.06); margin-bottom: 8px;
}
.ann-select-all {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: #374151; white-space: nowrap;
}
.ann-select-all input { width: 16px; height: 16px; cursor: pointer; accent-color: #6d28d9; }
.ann-filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.ann-fchip {
  padding: 4px 10px; border-radius: 99px; border: 1.5px solid #e5e7eb;
  background: white; color: #6b7280; font-size: 12px; font-weight: 600; cursor: pointer;
  white-space: nowrap; transition: all .15s;
}
.ann-fchip--active { background: #6d28d9; color: white; border-color: #6d28d9; }

/* Bulk bar */
.ann-bulk-bar {
  display: flex; align-items: center; gap: 10px;
  background: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 10px;
  padding: 8px 14px; margin-bottom: 8px;
}
.ann-bulk-count { font-size: 13px; font-weight: 700; color: #92400e; flex: 1; }
.bulk-slide-enter-active, .bulk-slide-leave-active { transition: all .2s ease; }
.bulk-slide-enter-from, .bulk-slide-leave-to { opacity: 0; transform: translateY(-8px); }

/* Cards */
.ann-list { display: flex; flex-direction: column; gap: 10px; }
.ann-card {
  background: white; border-radius: 14px; padding: 14px 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,.06); border: 2px solid transparent;
  transition: border-color .15s;
}
.ann-card--selected { border-color: #7c3aed; background: #faf5ff; }
.ann-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ann-check-wrap { flex-shrink: 0; display: flex; align-items: center; cursor: pointer; }
.ann-check-input { width: 17px; height: 17px; cursor: pointer; accent-color: #6d28d9; }

.ann-targets { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
.ann-target-chip { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
.ann-t--teacher  { background: #ede9fe; color: #5b21b6; }
.ann-t--student  { background: #dbeafe; color: #1e40af; }
.ann-t--parent   { background: #dcfce7; color: #166534; }
.ann-t--specific { background: #fef3c7; color: #92400e; }
.ann-type-chip   { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
.ann-type--info     { background: #eff6ff; color: #1d4ed8; }
.ann-type--reminder { background: #fff7ed; color: #c2410c; }
.ann-type--urgent   { background: #fef2f2; color: #b91c1c; }

.ann-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
.ann-card-title { font-size: 15px; font-weight: 800; color: #1e1b4b; margin-bottom: 5px; }
.ann-card-body  { font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 8px; white-space: pre-wrap; }
.ann-card-meta  { display: flex; gap: 10px; font-size: 11px; color: #9ca3af; flex-wrap: wrap; margin-top: 8px; }
.ann-card-author { font-weight: 600; color: #6b7280; }
.ann-card-exp   { color: #dc2626; }

/* Card images */
.ann-card-images { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.ann-img-thumb {
  width: 80px; height: 80px; object-fit: cover; border-radius: 8px;
  cursor: pointer; border: 1.5px solid #e5e7eb; transition: transform .15s;
}
.ann-img-thumb:hover { transform: scale(1.05); }

/* Lightbox */
.ann-lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,.85); z-index: 9999;
  display: flex; align-items: center; justify-content: center; cursor: zoom-out;
}
.ann-lightbox-img {
  max-width: 92vw; max-height: 88vh; object-fit: contain;
  border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,.5); cursor: default;
}
.ann-lightbox-close {
  position: absolute; top: 16px; right: 20px;
  background: rgba(255,255,255,.15); border: none; color: white;
  font-size: 24px; width: 40px; height: 40px; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}

/* Target checkboxes in form */
.target-checks { display: flex; gap: 10px; flex-wrap: wrap; }
.target-check-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.target-check-input { display: none; }
.target-check-box {
  padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
  border: 2px solid transparent; cursor: pointer; transition: all .15s; opacity: .5;
}
.target-check-input:checked + .target-check-box { opacity: 1; border-color: currentColor; }
.target-warn { font-size: 12px; color: #dc2626; margin-top: 6px; }

/* Specific teacher targeting */
.specific-toggle { margin-bottom: 10px; }
.specific-check-label {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: #374151;
}
.specific-check-label input { width: 16px; height: 16px; accent-color: #6d28d9; cursor: pointer; }
.teacher-select-wrap {
  background: #f9fafb; border-radius: 10px; padding: 12px;
  border: 1.5px solid #e5e7eb; margin-top: 6px;
}
.teacher-loading { font-size: 13px; color: #9ca3af; }
.teacher-check-grid { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
.teacher-check-row {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 4px 6px; border-radius: 6px; transition: background .1s;
}
.teacher-check-row:hover { background: #ede9fe; }
.teacher-check-row input { width: 15px; height: 15px; accent-color: #6d28d9; cursor: pointer; }
.teacher-check-name { font-size: 13px; color: #374151; }
.teacher-nick { color: #9ca3af; font-size: 12px; }

/* Image upload */
.img-preview-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.img-preview-item { position: relative; }
.img-preview-item--new::after {
  content: ''; position: absolute; inset: 0; border-radius: 8px;
  border: 2px dashed #6d28d9; pointer-events: none;
}
.img-preview-thumb {
  width: 80px; height: 80px; object-fit: cover;
  border-radius: 8px; border: 1.5px solid #e5e7eb; display: block;
}
.img-remove-btn {
  position: absolute; top: -6px; right: -6px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #ef4444; color: white; border: none; font-size: 11px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-weight: 700; line-height: 1;
}
.img-new-badge {
  position: absolute; bottom: 4px; left: 4px;
  background: #6d28d9; color: white; font-size: 10px; font-weight: 700;
  padding: 1px 5px; border-radius: 4px;
}
.img-upload-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; background: #f3f4f6; border-radius: 8px;
  font-size: 13px; font-weight: 600; color: #374151; cursor: pointer;
  border: 1.5px dashed #d1d5db; transition: all .15s;
}
.img-upload-btn:hover { background: #ede9fe; border-color: #7c3aed; color: #5b21b6; }
.img-upload-hint { font-size: 11px; color: #9ca3af; margin-left: 10px; }
</style>
