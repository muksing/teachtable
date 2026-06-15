<template>
  <AppLayout>
    <div class="be-page" v-loading="pageLoading">

      <!-- Header -->
      <div class="be-header mb-5">
        <div>
          <h1 class="be-title">📝 บันทึกคะแนนความประพฤตินักเรียน</h1>
          <p class="be-sub">เลือกนักเรียนได้หลายห้อง · บันทึกพร้อมกันทีเดียว</p>
        </div>
      </div>

      <div class="be-grid">

        <!-- ── LEFT: เลือกนักเรียน ──────────────────────────────── -->
        <el-card shadow="never" class="be-card">
          <template #header>
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="be-card-title">👥 เลือกนักเรียน</span>
              <div class="flex gap-2" v-if="selectedClassId">
                <el-button size="small" plain @click="selectAllInClass">เลือกทั้งหมด</el-button>
                <el-button size="small" plain @click="deselectAllInClass">ไม่เลือก</el-button>
              </div>
            </div>
          </template>

          <!-- Class selector -->
          <div class="mb-3">
            <div class="text-xs text-gray-500 mb-1">🏫 ห้องเรียน</div>
            <el-select
              v-model="selectedClassId"
              placeholder="เลือกห้องเพื่อแสดงรายชื่อ"
              clearable filterable style="width:100%"
              @change="onClassChange"
            >
              <el-option
                v-for="cls in classes"
                :key="cls.class_id"
                :label="cls.class_name || cls.class_id"
                :value="cls.class_id"
              />
            </el-select>
          </div>

          <!-- Search -->
          <div class="mb-2">
            <el-input v-model="studentSearch" placeholder="🔍 ค้นหาชื่อ หรือ รหัส..." clearable />
          </div>

          <!-- Student list (current class) -->
          <div class="be-student-list" v-loading="loadingStudents">
            <div v-if="!selectedClassId" class="be-list-empty">
              เลือกห้องเรียนเพื่อแสดงรายชื่อนักเรียน
            </div>
            <div v-else-if="filteredStudents.length === 0 && !loadingStudents" class="be-list-empty">
              ไม่พบนักเรียน
            </div>
            <div
              v-for="s in filteredStudents"
              :key="s.student_id"
              class="be-stu-row"
              :class="{ 'be-stu-selected': isSelected(s.student_id) }"
              @click="toggleStudent(s)"
            >
              <div class="be-stu-check">
                <span v-if="isSelected(s.student_id)" class="be-check-on">✓</span>
                <span v-else class="be-check-off" />
              </div>
              <div class="be-stu-info">
                <div class="be-stu-name">{{ s.student_name }}</div>
                <div class="be-stu-id">{{ s.student_id }}</div>
              </div>
            </div>
          </div>

          <!-- Selected students summary (all classes) -->
          <div v-if="selectedStudents.length" class="be-selected-panel mt-3">
            <div class="be-sel-head">
              <span class="be-sel-count">✅ เลือกแล้ว {{ selectedStudents.length }} คน</span>
              <span v-if="selectedClassCount > 1" class="be-sel-rooms">· {{ selectedClassCount }} ห้อง</span>
              <el-button text type="danger" size="small" class="ml-auto" @click="selectedStudents = []">ล้างทั้งหมด</el-button>
            </div>
            <div class="be-sel-chips">
              <el-tag
                v-for="stu in selectedStudents"
                :key="stu.student_id"
                closable
                size="small"
                @close="removeSelected(stu)"
                class="be-sel-chip"
              >{{ stu.student_name }}</el-tag>
            </div>
          </div>
        </el-card>

        <!-- ── RIGHT: พฤติกรรม + รูปภาพ ───────────────────────── -->
        <div class="be-right-col">

          <!-- คะแนนความประพฤติทั่วไป -->
          <el-card shadow="never" class="be-card mb-4">
            <template #header>
              <span class="be-card-title">📚 คะแนนความประพฤติทั่วไป</span>
            </template>

            <div v-if="loadingSettings" class="text-center text-gray-400 py-4 text-sm">กำลังโหลด...</div>
            <div v-else>
              <!-- ComboBox แยก + และ - -->
              <div class="flex gap-2">
                <!-- ➕ เพิ่มคะแนน -->
                <div class="flex-1">
                  <div class="text-xs font-semibold text-green-600 mb-1">➕ เพิ่มคะแนน</div>
                  <el-select
                    v-model="selectedPosId"
                    placeholder="เลือกรายการ..."
                    filterable clearable style="width:100%"
                    @change="onPosChange"
                    @clear="onPosChange(null)"
                  >
                    <el-option
                      v-for="s in posSettings"
                      :key="s.setting_id || s.id"
                      :label="`${s.label} (+${s.points_default})`"
                      :value="s.setting_id || s.id"
                    >
                      <span class="flex justify-between w-full">
                        <span>{{ s.label }}</span>
                        <span class="text-green-600 font-semibold ml-2">+{{ s.points_default }}</span>
                      </span>
                    </el-option>
                  </el-select>
                </div>
                <!-- ➖ ลดคะแนน -->
                <div class="flex-1">
                  <div class="text-xs font-semibold text-red-500 mb-1">➖ ลดคะแนน</div>
                  <el-select
                    v-model="selectedNegId"
                    placeholder="เลือกรายการ..."
                    filterable clearable style="width:100%"
                    @change="onNegChange"
                    @clear="onNegChange(null)"
                  >
                    <el-option
                      v-for="s in negSettings"
                      :key="s.setting_id || s.id"
                      :label="`${s.label} (${s.points_default})`"
                      :value="s.setting_id || s.id"
                    >
                      <span class="flex justify-between w-full">
                        <span>{{ s.label }}</span>
                        <span class="text-red-500 font-semibold ml-2">{{ s.points_default }}</span>
                      </span>
                    </el-option>
                  </el-select>
                </div>
              </div>

              <!-- Score adjust + note -->
              <div v-if="selectedSetting" class="be-score-preview mt-4">
                <span class="be-score-label">คะแนนที่ใช้:</span>
                <span :class="pointsChange >= 0 ? 'be-score-pos' : 'be-score-neg'">
                  {{ pointsChange >= 0 ? '+' : '' }}{{ pointsChange }}
                </span>
                <el-input-number
                  v-model="pointsChange"
                  :min="selectedSetting?.points_min ?? -100"
                  :max="selectedSetting?.points_max ?? 100"
                  size="small" style="width:120px; margin-left:10px"
                />
              </div>
            </div>
          </el-card>

          <!-- หมายเหตุ -->
          <el-card shadow="never" class="be-card mb-4">
            <template #header>
              <span class="be-card-title">📝 หมายเหตุ</span>
            </template>
            <el-input
              v-model="note"
              type="textarea"
              :rows="2"
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)..."
            />
          </el-card>

          <!-- รูปภาพ -->
          <el-card shadow="never" class="be-card mb-4">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="be-card-title">📷 รูปภาพประกอบ</span>
                <span class="text-xs text-gray-400">จำเป็น 1 รูป · สูงสุด 3 รูป</span>
              </div>
            </template>

            <div class="be-img-list">
              <label
                v-for="i in 3"
                :key="i"
                class="be-img-slot"
                :class="{ 'be-img-filled': imageFiles[i-1] }"
              >
                <input type="file" accept="image/*" style="display:none" @change="e => onImageChange(e, i-1)" />
                <div v-if="imageFiles[i-1]" class="be-img-preview">
                  <img :src="imagePreviews[i-1]" class="be-img-thumb" />
                  <button class="be-img-remove" @click.prevent="removeImage(i-1)">✕</button>
                </div>
                <div v-else class="be-img-placeholder">
                  <span class="be-img-icon">📸</span>
                  <span class="be-img-label">{{ i === 1 ? 'รูปที่ 1 *' : `รูปที่ ${i}` }}</span>
                </div>
              </label>
            </div>

            <div v-if="!gasUploadUrl || !gdriveFolderId" class="text-xs text-amber-600 mt-2">
              ⚠ ยังไม่ได้ตั้งค่า GAS Upload URL หรือ Google Drive Folder ID — รูปจะไม่ถูกอัพโหลด
            </div>
          </el-card>

          <!-- Submit -->
          <el-button
            type="primary"
            size="large"
            style="width:100%;font-size:15px;font-weight:700;height:48px"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ submitting ? 'กำลังบันทึก...' : `💾 บันทึก (${selectedStudents.length} คน)` }}
          </el-button>
          <div v-if="!canSubmit && !submitting" class="text-xs text-gray-400 text-center mt-1">
            <span v-if="!selectedStudents.length">เลือกนักเรียนอย่างน้อย 1 คน · </span>
            <span v-if="!selectedSettingId">เลือกประเภทพฤติกรรม · </span>
            <span v-if="!imageFiles[0]">แนบรูปภาพอย่างน้อย 1 รูป</span>
          </div>

          <el-alert
            v-if="resultMsg"
            :type="resultType"
            :title="resultMsg"
            show-icon
            :closable="true"
            @close="resultMsg = ''"
            class="mt-3"
          />
        </div>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useSchoolStore } from '@/stores/school'
import { useSchoolDb } from '@/composables/useSchoolDb'
import { useBehavior } from '@/composables/useBehavior'

const schoolStore = useSchoolStore()
const { getClasses, getStudents, getBehaviorSettings } = useSchoolDb()
const { recordBehavior } = useBehavior()

// ── State ─────────────────────────────────────────────────────
const pageLoading     = ref(false)
const classes         = ref([])
const allStudents     = ref([])   // students of currently-viewed class
const loadingStudents = ref(false)
const behaviorSettings = ref([])
const loadingSettings  = ref(false)

const selectedClassId  = ref('')
const studentSearch    = ref('')
const selectedStudents = ref([])  // across all classes

const selectedSettingId = ref('')
const selectedPosId     = ref('')
const selectedNegId     = ref('')
const selectedSetting   = ref(null)
const pointsChange      = ref(0)
const note              = ref('')

const imageFiles    = ref([null, null, null])
const imagePreviews = ref(['', '', ''])
const submitting    = ref(false)
const resultMsg     = ref('')
const resultType    = ref('success')

const gasUploadUrl   = computed(() => {
  const tl = schoolStore.schoolInfo?.settings?.teaching_log_settings || {}
  return tl.gas_upload_web_app_url || tl.gas_web_app_url || ''
})
const gdriveFolderId = computed(() => {
  const tl = schoolStore.schoolInfo?.settings?.teaching_log_settings || {}
  return tl.gdrive_folder_id || ''
})

// ── Behavior settings — only general type ────────────────────
const generalSettings = computed(() =>
  behaviorSettings.value.filter(s => s.behavior_type === 'general' && s.is_active !== false)
)
const posSettings = computed(() => generalSettings.value.filter(s => (s.points_default || 0) > 0))
const negSettings = computed(() => generalSettings.value.filter(s => (s.points_default || 0) < 0))

// ── Filtered students for current class ──────────────────────
const filteredStudents = computed(() => {
  const q = studentSearch.value.toLowerCase()
  return allStudents.value.filter(s => {
    if (!q) return true
    return s.student_name.toLowerCase().includes(q) || (s.student_id || '').toLowerCase().includes(q)
  })
})

// ── Selected summary ─────────────────────────────────────────
const selectedClassCount = computed(() => {
  const set = new Set(selectedStudents.value.map(s => s.class_id || ''))
  return set.size
})

const canSubmit = computed(() =>
  selectedStudents.value.length > 0 &&
  !!selectedSettingId.value &&
  !!imageFiles.value[0]
)

// ── Student selection ─────────────────────────────────────────
function isSelected(studentId) {
  return selectedStudents.value.some(s => s.student_id === studentId)
}

function toggleStudent(stu) {
  const idx = selectedStudents.value.findIndex(s => s.student_id === stu.student_id)
  if (idx >= 0) selectedStudents.value.splice(idx, 1)
  else selectedStudents.value.push(stu)
}

function removeSelected(stu) {
  const idx = selectedStudents.value.findIndex(s => s.student_id === stu.student_id)
  if (idx >= 0) selectedStudents.value.splice(idx, 1)
}

function selectAllInClass() {
  for (const stu of allStudents.value) {
    if (!isSelected(stu.student_id)) selectedStudents.value.push(stu)
  }
}

function deselectAllInClass() {
  const currentClassIds = new Set(allStudents.value.map(s => s.student_id))
  selectedStudents.value = selectedStudents.value.filter(s => !currentClassIds.has(s.student_id))
}

// ── Behavior selection ────────────────────────────────────────
function applySettingById(id) {
  if (!id) {
    selectedSettingId.value = ''
    selectedSetting.value = null
    pointsChange.value = 0
    return
  }
  const s = generalSettings.value.find(x => (x.setting_id || x.id) === id)
  if (s) {
    selectedSettingId.value = id
    selectedSetting.value = s
    pointsChange.value = s.points_default || 0
  }
}

function onPosChange(id) {
  if (id) selectedNegId.value = ''
  applySettingById(id || null)
}

function onNegChange(id) {
  if (id) selectedPosId.value = ''
  applySettingById(id || null)
}

// ── Class change — keep existing selection from other classes ─
async function onClassChange() {
  if (!selectedClassId.value) {
    allStudents.value = []
    return
  }
  loadingStudents.value = true
  try {
    const raw = await getStudents(selectedClassId.value)
    allStudents.value = raw.map(s => ({
      ...s,
      student_name: s.student_name || `${s.prefix||''}${s.name||''} ${s.surname||''}`.trim(),
      class_id: s.class_id || selectedClassId.value,
    }))
  } catch {
    ElMessage.error('โหลดนักเรียนไม่สำเร็จ')
  } finally {
    loadingStudents.value = false
  }
}

// ── Image handling ────────────────────────────────────────────
function onImageChange(e, index) {
  const file = e.target.files?.[0]
  if (!file) return
  imageFiles.value = imageFiles.value.map((f, i) => i === index ? file : f)
  const reader = new FileReader()
  reader.onload = () => {
    imagePreviews.value = imagePreviews.value.map((p, i) => i === index ? reader.result : p)
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function removeImage(index) {
  imageFiles.value    = imageFiles.value.map((f, i) => i === index ? null : f)
  imagePreviews.value = imagePreviews.value.map((p, i) => i === index ? '' : p)
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadImages() {
  if (!gasUploadUrl.value) return []
  const urls = []
  for (let i = 0; i < imageFiles.value.length; i++) {
    const file = imageFiles.value[i]
    if (!file) continue
    try {
      const base64 = await toBase64(file)
      const fileName = `behavior_${Date.now()}_${i + 1}`
      const res = await fetch(gasUploadUrl.value, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          route: 'upload-student-photo',
          folderId: gdriveFolderId.value,
          fileName: fileName + '.jpg',
          mimeType: 'image/jpeg',
          base64Data: base64.split(',')[1],
        }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { continue }
      if (data.url) urls.push({ name: file.name, url: data.url })
    } catch { /* continue */ }
  }
  return urls
}

// ── Submit ────────────────────────────────────────────────────
async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  resultMsg.value  = ''
  try {
    const imageUrls = await uploadImages()

    for (const stu of selectedStudents.value) {
      await recordBehavior({
        student: { student_id: stu.student_id, class_id: stu.class_id || selectedClassId.value },
        setting: selectedSetting.value,
        pointsChange: pointsChange.value,
        note: note.value,
        source: 'manual',
        image_urls: imageUrls,
      })
    }

    resultMsg.value  = `✅ บันทึกพฤติกรรม ${selectedStudents.value.length} คน เรียบร้อยแล้ว`
    resultType.value = 'success'

    selectedStudents.value  = []
    note.value              = ''
    imageFiles.value        = [null, null, null]
    imagePreviews.value     = ['', '', '']
    selectedSettingId.value = ''
    selectedPosId.value     = ''
    selectedNegId.value     = ''
    selectedSetting.value   = null
    pointsChange.value      = 0
  } catch (e) {
    resultMsg.value  = 'บันทึกไม่สำเร็จ: ' + e.message
    resultType.value = 'error'
  } finally {
    submitting.value = false
  }
}

// ── Mount ─────────────────────────────────────────────────────
onMounted(async () => {
  pageLoading.value = true
  try {
    const [cls, settings] = await Promise.all([getClasses(), getBehaviorSettings()])
    classes.value          = cls
    behaviorSettings.value = settings
  } catch {
    ElMessage.error('โหลดข้อมูลไม่สำเร็จ')
  } finally {
    pageLoading.value = false
  }
})
</script>

<style scoped>
.be-page   { padding: 24px; max-width: 1100px; margin: 0 auto; }
.be-title  { font-size: 22px; font-weight: 800; color: #1e293b; }
.be-sub    { font-size: 12px; color: #94a3b8; margin-top: 2px; }

.be-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 20px;
  align-items: start;
}
@media (max-width: 768px) { .be-grid { grid-template-columns: 1fr; } }

.be-card       { border-radius: 14px; }
.be-card-title { font-weight: 700; color: #1e293b; font-size: 14px; }
.be-right-col  { display: flex; flex-direction: column; }

/* Student list */
.be-student-list {
  max-height: 380px; overflow-y: auto;
  border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc;
}
.be-list-empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }

.be-stu-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; cursor: pointer;
  border-bottom: 1px solid #f1f5f9; transition: background .12s;
}
.be-stu-row:last-child { border-bottom: none; }
.be-stu-row:hover { background: #eff6ff; }
.be-stu-selected { background: #e0e7ff !important; }

.be-stu-check { flex-shrink: 0; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.be-check-on  {
  width: 20px; height: 20px; border-radius: 6px;
  background: #4f46e5; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900;
}
.be-check-off {
  width: 20px; height: 20px; border-radius: 6px;
  border: 2px solid #cbd5e1; display: block;
}
.be-stu-name { font-size: 13px; font-weight: 600; color: #1e293b; }
.be-stu-id   { font-size: 11px; color: #94a3b8; }

/* Selected panel */
.be-selected-panel { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 12px; }
.be-sel-head       { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.be-sel-count      { font-size: 13px; font-weight: 700; color: #15803d; }
.be-sel-rooms      { font-size: 12px; color: #64748b; }
.be-sel-chips      { display: flex; flex-wrap: wrap; gap: 5px; }
.be-sel-chip       { max-width: 130px; overflow: hidden; text-overflow: ellipsis; }

/* Behavior buttons */
.be-beh-sect-label { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
.be-beh-pos        { color: #15803d; }
.be-beh-neg        { color: #dc2626; }
.be-beh-btns       { display: flex; flex-wrap: wrap; gap: 8px; }

.be-beh-btn {
  display: inline-flex; flex-direction: column; align-items: center;
  padding: 7px 14px; border-radius: 10px; cursor: pointer;
  border: 2px solid transparent; transition: all .15s;
  background: #f8fafc; font-family: inherit;
}
.be-beh-btn-pos {
  border-color: #bbf7d0; color: #166534;
}
.be-beh-btn-pos:hover { background: #dcfce7; border-color: #4ade80; }
.be-beh-btn-active-pos {
  background: #16a34a !important; border-color: #16a34a !important;
  color: #fff !important;
}
.be-beh-btn-neg {
  border-color: #fca5a5; color: #991b1b;
}
.be-beh-btn-neg:hover { background: #fee2e2; border-color: #f87171; }
.be-beh-btn-active-neg {
  background: #dc2626 !important; border-color: #dc2626 !important;
  color: #fff !important;
}
.be-beh-btn-label { font-size: 12px; font-weight: 600; }
.be-beh-btn-pts   { font-size: 14px; font-weight: 900; margin-top: 1px; }

/* Score preview */
.be-score-preview {
  display: flex; align-items: center; gap: 8px;
  background: #f8fafc; border-radius: 10px; padding: 8px 12px;
}
.be-score-label { font-size: 13px; color: #64748b; font-weight: 600; }
.be-score-pos   { font-size: 18px; font-weight: 900; color: #16a34a; }
.be-score-neg   { font-size: 18px; font-weight: 900; color: #dc2626; }

/* Image slots */
.be-img-list { display: flex; gap: 12px; flex-wrap: wrap; }
.be-img-slot {
  width: 110px; height: 110px; border-radius: 12px;
  border: 2px dashed #cbd5e1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden; transition: border-color .15s;
  background: #f8fafc;
}
.be-img-slot:hover { border-color: #6366f1; background: #eef2ff; }
.be-img-filled { border-color: #6366f1; border-style: solid; }

.be-img-preview  { width: 100%; height: 100%; position: relative; }
.be-img-thumb    { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
.be-img-remove   {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(0,0,0,0.55); color: #fff;
  border: none; cursor: pointer; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
}
.be-img-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.be-img-icon  { font-size: 24px; }
.be-img-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-align: center; }
</style>
