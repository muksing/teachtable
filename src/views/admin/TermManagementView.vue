<template>
  <AppLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="header-card mb-6">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-white">📅 จัดการเทอมการศึกษา</h1>
            <p class="text-white/80 text-sm mt-1">สร้าง โคลน ส่งออก และลบข้อมูลตามเทอม</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <el-button @click="showMigrateDialog = true"
              style="background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.4);color:white">
              📦 ย้ายข้อมูลเดิม
            </el-button>
            <el-button type="primary" @click="openCreateDialog"
              style="background:rgba(255,255,255,0.25);border-color:rgba(255,255,255,0.5);color:white;font-weight:600">
              + สร้างเทอมใหม่
            </el-button>
          </div>
        </div>
      </div>

      <!-- Current Term Banner -->
      <el-alert
        :title="`เทอมปัจจุบัน: ${currentTerm}`"
        type="success" show-icon :closable="false" class="mb-6"
        description="เทอมนี้คือที่ข้อมูลทุกหน้าในระบบกำลังอ่านและเขียนอยู่"
      />

      <!-- Quota Summary -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card" style="background:linear-gradient(135deg,#667eea,#764ba2)">
          <div class="stat-value text-white">{{ terms.length }}</div>
          <div class="stat-label text-white/80">เทอมทั้งหมด</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">
          <div class="stat-value text-white">{{ totalDocs.toLocaleString() }}</div>
          <div class="stat-label text-white/80">เอกสารรวม</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
          <div class="stat-value text-white">{{ freeTierLimit.toLocaleString() }}</div>
          <div class="stat-label text-white/80">โควต้า Free Tier</div>
        </div>
        <div class="stat-card" :style="`background:linear-gradient(135deg,${quotaColor})`">
          <div class="stat-value text-white">{{ quotaPct }}%</div>
          <div class="stat-label text-white/80">ใช้โควต้าแล้ว</div>
        </div>
      </div>

      <!-- Terms Table -->
      <el-card style="border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.06)" v-loading="loading">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-bold text-gray-700">รายการเทอม</span>
            <el-button size="small" @click="loadTerms" :loading="loading">🔄 รีเฟรช</el-button>
          </div>
        </template>

        <el-table :data="terms" border stripe
          :header-cell-style="{ background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px' }">
          <el-table-column label="เทอม" prop="id" width="140">
            <template #default="{ row }">
              <span class="font-bold text-indigo-700">{{ row.id }}</span>
              <el-tag v-if="row.id === currentTerm" type="success" size="small" class="ml-2">ปัจจุบัน</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="ครู" align="center" width="80">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.teachers ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ห้องเรียน" align="center" width="90">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.classes ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="วิชา" align="center" width="80">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.subjects ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ห้อง/Lab" align="center" width="90">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.rooms ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="นักเรียน" align="center" width="90">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.students ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ภาระงาน" align="center" width="90">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.assignments ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="ตารางสอน" align="center" width="100">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.timetable_grid ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="กิจกรรม" align="center" width="90">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.activity_booking ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="เอกสารรวม" align="center" width="100">
            <template #default="{ row }">
              <span class="font-bold" :style="{ color: row.totalDocs > 5000 ? '#dc2626' : '#15803d' }">
                {{ row.totalDocs?.toLocaleString() ?? '...' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="จัดการ" width="260" align="center">
            <template #default="{ row }">
              <div class="flex gap-1 justify-center flex-wrap">
                <el-button size="small" type="primary" plain
                  @click="setActiveTerm(row.id)"
                  :disabled="row.id === currentTerm">
                  ✅ ใช้เทอมนี้
                </el-button>
                <el-button size="small" type="success" plain
                  @click="openCloneDialog(row.id)">
                  📋 โคลน
                </el-button>
                <el-button size="small" plain
                  @click="exportTerm(row.id)">
                  📤 Export
                </el-button>
                <el-button size="small" type="danger" plain
                  @click="deleteTerm(row.id)"
                  :disabled="row.id === currentTerm">
                  🗑️ ลบ
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Create Term Dialog -->
      <el-dialog v-model="showCreateDialog" title="สร้างเทอมใหม่" width="400px">
        <el-form label-width="120px">
          <el-form-item label="รหัสเทอม" required>
            <el-input v-model="newTermId" placeholder="เช่น 2569_1" />
            <div class="text-xs text-gray-400 mt-1">รูปแบบ: ปีการศึกษา_เทอม (เช่น 2569_1, 2569_2)</div>
          </el-form-item>
          <el-form-item label="เริ่มต้นจาก">
            <el-select v-model="cloneFrom" placeholder="-- เริ่มเทอมใหม่เปล่า (ค่าเริ่มต้น) --" clearable class="w-full">
              <el-option v-for="t in terms" :key="t.id" :label="t.id" :value="t.id" />
            </el-select>
          </el-form-item>
          <el-alert type="info" :closable="false" class="mb-3">
            ค่าเริ่มต้นคือสร้างเทอมแบบข้อมูลครูว่าง จากนั้นค่อยดึงครูจากเทอมอื่นในหน้าจัดการครู
          </el-alert>
          <div v-if="cloneFrom" class="mb-4 px-2">
            <div class="text-sm font-semibold text-gray-600 mb-2">เลือกข้อมูลที่จะโคลน:</div>
            <div class="grid grid-cols-2 gap-1">
              <el-checkbox v-for="col in cloneCollections" :key="col.key"
                v-model="col.selected" :label="col.label" />
            </div>
          </div>
        </el-form>
        <template #footer>
          <el-button @click="showCreateDialog = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="creating" @click="createTerm">
            {{ cloneFrom ? '📋 สร้างและโคลน' : '✅ สร้างเทอมเปล่า' }}
          </el-button>
        </template>
      </el-dialog>

      <!-- Clone Dialog -->
      <el-dialog v-model="showCloneDialog" title="โคลนเทอม" width="440px">
        <div class="mb-3 text-sm text-gray-600">
          โคลนข้อมูลจาก <strong class="text-indigo-600">{{ cloneSource }}</strong> ไปยัง:
        </div>
        <el-form label-width="100px">
          <el-form-item label="เทอมปลายทาง" required>
            <el-select v-model="cloneTarget" placeholder="เลือกเทอมปลายทาง" class="w-full">
              <el-option v-for="t in terms" :key="t.id" :label="t.id" :value="t.id"
                :disabled="t.id === cloneSource" />
              <el-option label="+ สร้างเทอมใหม่..." value="__new__" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="cloneTarget === '__new__'" label="รหัสเทอม">
            <el-input v-model="newTermIdForClone" placeholder="เช่น 2569_1" />
          </el-form-item>
          <el-form-item label="ข้อมูลที่โคลน">
            <div class="grid grid-cols-2 gap-1 w-full">
              <el-checkbox v-for="col in cloneCollections" :key="col.key"
                v-model="col.selected" :label="col.label" />
            </div>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showCloneDialog = false">ยกเลิก</el-button>
          <el-button type="primary" :loading="cloning" @click="doClone">
            📋 โคลนเดี๋ยวนี้
          </el-button>
        </template>
      </el-dialog>

      <!-- Migrate Dialog -->
      <el-dialog v-model="showMigrateDialog" title="📦 ย้ายข้อมูลเดิม (One-Time Migration)" width="500px">
        <el-alert type="warning" :closable="false" class="mb-4"
          title="ใช้สำหรับโรงเรียนที่มีข้อมูลเดิมอยู่ใน root collections (teachers/, classes/, subjects/, rooms/)">
          <p class="text-sm mt-1">ระบบจะย้ายข้อมูลเดิมทั้งหมดไปยังเทอมปัจจุบัน <strong>{{ currentTerm }}</strong> โดยจะไม่ลบข้อมูลเดิม</p>
        </el-alert>
        <div class="grid grid-cols-2 gap-2">
          <el-checkbox v-for="col in migrateCollections" :key="col.key"
            v-model="col.selected" :label="col.label" />
        </div>
        <template #footer>
          <el-button @click="showMigrateDialog = false">ยกเลิก</el-button>
          <el-button type="warning" :loading="migrating" @click="doMigrate">
            📦 เริ่มย้ายข้อมูล
          </el-button>
        </template>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  getDoc, writeBatch, serverTimestamp
} from 'firebase/firestore'
import { getSchoolDb } from '@/firebase/db'
import { db as rootDb } from '@/firebase/db'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'

const schoolStore = useSchoolStore()
const authStore = useAuthStore()
const db = () => getSchoolDb()
const currentTerm = computed(() => schoolStore.currentTerm || '2568_1')

const loading = ref(false)
const creating = ref(false)
const cloning = ref(false)
const migrating = ref(false)

const terms = ref([])
const showCreateDialog = ref(false)
const showCloneDialog = ref(false)
const showMigrateDialog = ref(false)

const newTermId = ref('')
const cloneFrom = ref('')
const cloneSource = ref('')
const cloneTarget = ref('')
const newTermIdForClone = ref('')

// Collections ที่โคลนได้ (พร้อม default checked)
const CLONE_COLS = [
  { key: 'teachers',                  label: '👨‍🏫 ครู',           defaultOn: false },
  { key: 'classes',                   label: '🏫 ห้องเรียน',      defaultOn: true },
  { key: 'subjects',                  label: '📚 วิชา',           defaultOn: true },
  { key: 'rooms',                     label: '🚪 ห้อง/Lab',       defaultOn: true },
  { key: 'students',                  label: '👨‍🎓 นักเรียน',     defaultOn: true },
  { key: 'teaching_assignments',      label: '📋 ภาระงาน',        defaultOn: true },
  { key: 'attendance_status_settings',label: '✅ สถานะมาเรียน',   defaultOn: true },
  { key: 'behavior_settings',         label: '⭐ ตั้งค่าพฤติกรรม', defaultOn: true },
  { key: 'timetable_grid',            label: '📅 ตารางสอน',       defaultOn: false },
  { key: 'activity_booking',          label: '🎯 กิจกรรม',        defaultOn: false },
  { key: 'activity_supervision',      label: '🧑‍🏫 ครูคุมกิจกรรม', defaultOn: false },
]
const cloneCollections = reactive(CLONE_COLS.map(c => ({ ...c, selected: c.defaultOn })))

const MIGRATE_COLS = [
  { key: 'teachers',  label: '👨‍🏫 ครู',      selected: true },
  { key: 'classes',   label: '🏫 ห้องเรียน',  selected: true },
  { key: 'subjects',  label: '📚 วิชา',       selected: true },
  { key: 'rooms',     label: '🚪 ห้อง/Lab',   selected: true },
]
const migrateCollections = reactive(MIGRATE_COLS)

// ── Quota ─────────────────────────────────────────────────────────────────
const freeTierLimit = 1_000_000
const totalDocs = computed(() => terms.value.reduce((s, t) => s + (t.totalDocs || 0), 0))
const quotaPct = computed(() => Math.round((totalDocs.value / freeTierLimit) * 100))
const quotaColor = computed(() => {
  if (quotaPct.value >= 80) return '#ef4444,#dc2626'
  if (quotaPct.value >= 50) return '#f59e0b,#d97706'
  return '#10b981,#059669'
})

// ── Load terms ──────────────────────────────────────────────────────────
async function loadTerms() {
  loading.value = true
  // เริ่มจาก currentTerm ที่รู้อยู่แล้ว (จาก store) เสมอ — ไม่ขึ้นกับ Firestore list
  const termIds = new Set([currentTerm.value])

  try {
    // เพิ่ม term จาก school_info (อาจต่างจาก store ถ้าเปิดหน้านี้โดยตรง)
    try {
      const schoolSnap = await getDoc(doc(db(), 'school_info', 'main'))
      if (schoolSnap.exists() && schoolSnap.data().current_term) {
        termIds.add(schoolSnap.data().current_term)
      }
    } catch { /* ignore */ }

    // เพิ่ม term ที่มี document จริงใน terms/ collection
    try {
      const termsSnap = await getDocs(collection(db(), 'terms'))
      termsSnap.docs.forEach(d => termIds.add(d.id))
    } catch { /* ignore */ }

    // นับ docs ในแต่ละ term
    const list = []
    for (const termId of termIds) {
      const counts = await countTermCollections(termId)
      const total = Object.values(counts).reduce((s, v) => s + v, 0)
      list.push({ id: termId, counts, totalDocs: total })
    }
    list.sort((a, b) => b.id.localeCompare(a.id))
    terms.value = list
  } catch (e) {
    // fallback: แสดงเฉพาะ currentTerm ที่ไม่มีข้อมูลจำนวน
    if (!terms.value.length) {
      terms.value = [{ id: currentTerm.value, counts: {}, totalDocs: 0 }]
    }
    ElMessage.warning('โหลดข้อมูลบางส่วนไม่ครบ: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function countTermCollections(termId) {
  const cols = ['teachers','classes','subjects','rooms','students',
    'teaching_assignments','timetable_grid','activity_booking','activity_supervision']
  const counts = {}
  await Promise.all(cols.map(async col => {
    try {
      const snap = await getDocs(collection(db(), `terms/${termId}/${col}`))
      counts[col] = snap.size
    } catch {
      counts[col] = 0
    }
  }))
  return counts
}

// ── Create Term ───────────────────────────────────────────────────────
async function createTerm() {
  if (!newTermId.value.trim()) {
    return ElMessage.warning('กรุณากรอกรหัสเทอม')
  }
  const targetId = newTermId.value.trim()

  // ตรวจว่ามีอยู่แล้วหรือไม่
  const existing = terms.value.find(t => t.id === targetId)
  if (existing) {
    return ElMessage.warning(`เทอม ${targetId} มีอยู่แล้ว`)
  }

  creating.value = true
  try {
    // สร้าง term document
    await setDoc(doc(db(), 'terms', targetId), {
      created_at: serverTimestamp(),
      created_by: authStore.profile?.uid || 'system',
    })

    // โคลนถ้าเลือก
    if (cloneFrom.value) {
      await cloneTermData(cloneFrom.value, targetId)
    }

    ElMessage.success(`สร้างเทอม ${targetId} สำเร็จ!`)
    showCreateDialog.value = false
    newTermId.value = ''
    cloneFrom.value = ''
    await loadTerms()
  } catch (e) {
    ElMessage.error('สร้างเทอมไม่สำเร็จ: ' + e.message)
  } finally {
    creating.value = false
  }
}

function openCreateDialog() {
  showCreateDialog.value = true
  cloneFrom.value = ''
  newTermId.value = ''
  cloneCollections.forEach(c => { c.selected = c.defaultOn })
}

// ── Clone ─────────────────────────────────────────────────────────────
function openCloneDialog(termId) {
  cloneSource.value = termId
  cloneTarget.value = ''
  newTermIdForClone.value = ''
  // reset collections to default
  cloneCollections.forEach(c => { c.selected = c.defaultOn })
  showCloneDialog.value = true
}

async function doClone() {
  let targetId = cloneTarget.value
  if (targetId === '__new__') {
    if (!newTermIdForClone.value.trim()) return ElMessage.warning('กรุณากรอกรหัสเทอมใหม่')
    targetId = newTermIdForClone.value.trim()
    // สร้าง term doc
    await setDoc(doc(db(), 'terms', targetId), {
      created_at: serverTimestamp(),
      created_by: authStore.profile?.uid || 'system',
    })
  }
  if (!targetId) return ElMessage.warning('กรุณาเลือกเทอมปลายทาง')
  if (targetId === cloneSource.value) return ElMessage.warning('ต้นทางและปลายทางเป็นเทอมเดียวกัน')

  cloning.value = true
  try {
    await cloneTermData(cloneSource.value, targetId)
    ElMessage.success(`โคลนข้อมูลจาก ${cloneSource.value} → ${targetId} สำเร็จ!`)
    showCloneDialog.value = false
    await loadTerms()
  } catch (e) {
    ElMessage.error('โคลนไม่สำเร็จ: ' + e.message)
  } finally {
    cloning.value = false
  }
}

async function cloneTermData(fromTerm, toTerm) {
  const selectedCols = cloneCollections.filter(c => c.selected).map(c => c.key)
  for (const col of selectedCols) {
    const snap = await getDocs(collection(db(), `terms/${fromTerm}/${col}`))
    if (snap.empty) continue
    // batch write ทีละ 500
    const docs = snap.docs
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db())
      const chunk = docs.slice(i, i + 400)
      chunk.forEach(d => {
        batch.set(doc(db(), `terms/${toTerm}/${col}`, d.id), {
          ...d.data(),
          cloned_from: fromTerm,
          cloned_at: serverTimestamp(),
        })
      })
      await batch.commit()
    }
  }
}

// ── Set Active Term ───────────────────────────────────────────────────
async function setActiveTerm(termId) {
  await ElMessageBox.confirm(
    `เปลี่ยนเทอมปัจจุบันเป็น "${termId}" ?\n\n✅ ข้อมูลทุกเทอมยังอยู่ครบ ไม่ได้ลบ\n📌 ระบบจะเปลี่ยนไปอ่าน/เขียนข้อมูลของเทอม "${termId}" เท่านั้น`,
    'ยืนยันเปลี่ยนเทอม', { confirmButtonText: 'เปลี่ยน', cancelButtonText: 'ยกเลิก', type: 'warning' }
  )
  // parse ปีและภาคเรียนจาก termId เช่น "2568_2" → year=2568, semester=2
  const parts = termId.split('_')
  const year = parseInt(parts[0]) || 0
  const semester = parseInt(parts[1]) || 1
  const extraFields = year > 0 ? { year, semester } : {}

  await setDoc(doc(db(), 'school_info', 'main'), {
    current_term: termId,
    ...extraFields,
    updated_at: serverTimestamp()
  }, { merge: true })

  schoolStore.setCurrentTerm(termId)
  if (year > 0) {
    schoolStore.setSchool({ ...schoolStore.schoolInfo, current_term: termId, year, semester })
  }
  ElMessage.success(`เปลี่ยนเป็นเทอม ${termId} แล้ว`)
  await loadTerms()
}

// ── Export Term ───────────────────────────────────────────────────────
async function exportTerm(termId) {
  try {
    ElMessage.info(`กำลัง export เทอม ${termId}...`)
    const cols = ['teachers','classes','subjects','rooms','students',
      'teaching_assignments','timetable_grid','activity_booking','activity_supervision']
    const wb = XLSX.utils.book_new()
    for (const col of cols) {
      const snap = await getDocs(collection(db(), `terms/${termId}/${col}`))
      if (snap.empty) continue
      const rows = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, col.substring(0, 31))
    }
    XLSX.writeFile(wb, `term_${termId}_${new Date().toISOString().slice(0,10)}.xlsx`)
    ElMessage.success('Export สำเร็จ!')
  } catch (e) {
    ElMessage.error('Export ไม่สำเร็จ: ' + e.message)
  }
}

// ── Delete Term ───────────────────────────────────────────────────────
async function deleteTerm(termId) {
  await ElMessageBox.confirm(
    `ลบเทอม "${termId}" และข้อมูลทั้งหมดภายใน?\nการกระทำนี้ไม่สามารถย้อนกลับได้!`,
    'ยืนยันลบเทอม', {
      confirmButtonText: 'ลบเทอมนี้', cancelButtonText: 'ยกเลิก',
      type: 'error', confirmButtonClass: 'el-button--danger'
    }
  )
  try {
    const cols = ['teachers','classes','subjects','rooms','students',
      'teaching_assignments','timetable_grid','activity_booking',
      'activity_supervision','attendance_status_settings','behavior_settings',
      'teaching_logs','behavior_logs','behavior_summary']
    for (const col of cols) {
      const snap = await getDocs(collection(db(), `terms/${termId}/${col}`))
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db())
        snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
    }
    await deleteDoc(doc(db(), 'terms', termId))
    ElMessage.success(`ลบเทอม ${termId} เรียบร้อย`)
    await loadTerms()
  } catch (e) {
    ElMessage.error('ลบไม่สำเร็จ: ' + e.message)
  }
}

// ── Migrate old root data ──────────────────────────────────────────────
async function doMigrate() {
  await ElMessageBox.confirm(
    `ย้ายข้อมูลจาก root collections ไปยังเทอม "${currentTerm.value}"?\n(ข้อมูลเดิมจะไม่ถูกลบ)`,
    'ยืนยันย้ายข้อมูล', { confirmButtonText: 'ย้ายข้อมูล', cancelButtonText: 'ยกเลิก', type: 'warning' }
  )
  migrating.value = true
  try {
    // สร้าง term document ถ้าไม่มี (แก้ปัญหา term แสดง 0)
    await setDoc(doc(db(), 'terms', currentTerm.value), {
      created_at: serverTimestamp(),
      created_by: authStore.profile?.uid || 'system',
    }, { merge: true })

    let total = 0
    for (const col of migrateCollections) {
      if (!col.selected) continue
      const snap = await getDocs(collection(db(), col.key))
      if (snap.empty) continue
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db())
        snap.docs.slice(i, i + 400).forEach(d => {
          batch.set(
            doc(db(), `terms/${currentTerm.value}/${col.key}`, d.id),
            { ...d.data(), migrated_from_root: true, migrated_at: serverTimestamp() }
          )
        })
        await batch.commit()
        total += Math.min(400, snap.docs.length - i)
      }
    }
    ElMessage.success(`ย้ายข้อมูล ${total} รายการ เข้าเทอม ${currentTerm.value} สำเร็จ!`)
    showMigrateDialog.value = false
    await loadTerms()
  } catch (e) {
    ElMessage.error('ย้ายข้อมูลไม่สำเร็จ: ' + e.message)
  } finally {
    migrating.value = false
  }
}

onMounted(loadTerms)
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(102,126,234,0.4);
}
.stat-card {
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.stat-value { font-size: 1.75rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.8rem; margin-top: 4px; }
</style>
