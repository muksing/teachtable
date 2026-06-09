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
          <div class="stat-value text-white">{{ totalRows.toLocaleString() }}</div>
          <div class="stat-label text-white/80">แถวข้อมูลรวม</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">
          <div class="stat-value text-white">{{ terms.length }}</div>
          <div class="stat-label text-white/80">เทอมที่มีข้อมูล</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#10b981,#059669)">
          <div class="stat-value text-white">{{ currentTerm }}</div>
          <div class="stat-label text-white/80">เทอมปัจจุบัน</div>
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
          <el-table-column label="ตารางสอน" align="center" width="100">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.timetable_slots ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="กิจกรรม" align="center" width="90">
            <template #default="{ row }">
              <span class="text-gray-700 font-medium">{{ row.counts?.activity_bookings ?? '...' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="แถวรวม" align="center" width="100">
            <template #default="{ row }">
              <span class="font-bold" :style="{ color: row.totalRows > 5000 ? '#dc2626' : '#15803d' }">
                {{ row.totalRows?.toLocaleString() ?? '...' }}
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
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useSchoolStore } from '@/stores/school'
import { useAuthStore } from '@/stores/auth'

const schoolStore = useSchoolStore()
const authStore = useAuthStore()

const schoolId = computed(() => authStore.schoolId)
const currentTerm = computed(() => schoolStore.currentTerm || '2568_1')

const loading = ref(false)
const creating = ref(false)
const cloning = ref(false)

const terms = ref([])
const showCreateDialog = ref(false)
const showCloneDialog = ref(false)

const newTermId = ref('')
const cloneFrom = ref('')
const cloneSource = ref('')
const cloneTarget = ref('')
const newTermIdForClone = ref('')

// Tables that can be cloned (mapped to Supabase tables)
const CLONE_COLS = [
  { key: 'teachers',          label: '👨‍🏫 ครู',           defaultOn: false },
  { key: 'classes',           label: '🏫 ห้องเรียน',      defaultOn: true  },
  { key: 'subjects',          label: '📚 วิชา',           defaultOn: true  },
  { key: 'rooms',             label: '🚪 ห้อง/Lab',       defaultOn: true  },
  { key: 'students',          label: '👨‍🎓 นักเรียน',     defaultOn: true  },
  { key: 'timetable_slots',   label: '📅 ตารางสอน',       defaultOn: false },
  { key: 'activity_bookings', label: '🎯 กิจกรรม',        defaultOn: false },
]
const cloneCollections = reactive(CLONE_COLS.map(c => ({ ...c, selected: c.defaultOn })))

// ── Stats ─────────────────────────────────────────────────────────────────
const totalRows = computed(() => terms.value.reduce((s, t) => s + (t.totalRows || 0), 0))

// ── Load terms ──────────────────────────────────────────────────────────
async function loadTerms() {
  loading.value = true
  const sid = schoolId.value
  if (!sid) { loading.value = false; return }

  try {
    // Discover distinct term_ids from all term-scoped tables
    const tables = ['teachers','classes','subjects','rooms','students','timetable_slots','activity_bookings']
    const termIdSet = new Set([currentTerm.value])

    // Also load from academic_terms table if it exists
    const { data: academicTerms } = await supabase
      .from('academic_terms')
      .select('term_id')
      .eq('school_id', sid)
    if (academicTerms) academicTerms.forEach(r => termIdSet.add(r.term_id))

    // Collect term_ids from each table
    await Promise.all(tables.map(async tbl => {
      try {
        const { data } = await supabase
          .from(tbl)
          .select('term_id')
          .eq('school_id', sid)
          .limit(500)
        if (data) data.forEach(r => r.term_id && termIdSet.add(r.term_id))
      } catch { /* ignore if table doesn't have term_id */ }
    }))

    // Count rows per term
    const list = []
    for (const termId of termIdSet) {
      const counts = await countTermRows(termId, sid)
      const totalRows = Object.values(counts).reduce((s, v) => s + v, 0)
      list.push({ id: termId, counts, totalRows })
    }
    list.sort((a, b) => b.id.localeCompare(a.id))
    terms.value = list
  } catch (e) {
    if (!terms.value.length) {
      terms.value = [{ id: currentTerm.value, counts: {}, totalRows: 0 }]
    }
    ElMessage.warning('โหลดข้อมูลบางส่วนไม่ครบ: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function countTermRows(termId, sid) {
  const tables = ['teachers','classes','subjects','rooms','students','timetable_slots','activity_bookings']
  const counts = {}
  await Promise.all(tables.map(async tbl => {
    try {
      const { count } = await supabase
        .from(tbl)
        .select('*', { count: 'exact', head: true })
        .eq('school_id', sid)
        .eq('term_id', termId)
      counts[tbl] = count || 0
    } catch { counts[tbl] = 0 }
  }))
  return counts
}

// ── Create Term ───────────────────────────────────────────────────────
function openCreateDialog() {
  showCreateDialog.value = true
  cloneFrom.value = ''
  newTermId.value = ''
  cloneCollections.forEach(c => { c.selected = c.defaultOn })
}

async function createTerm() {
  if (!newTermId.value.trim()) return ElMessage.warning('กรุณากรอกรหัสเทอม')
  const targetId = newTermId.value.trim()

  if (terms.value.find(t => t.id === targetId)) return ElMessage.warning(`เทอม ${targetId} มีอยู่แล้ว`)

  creating.value = true
  try {
    // Register term in academic_terms table
    await supabase.from('academic_terms').upsert({
      school_id: schoolId.value,
      term_id: targetId,
      created_at: new Date().toISOString(),
      created_by: authStore.profile?.uid || 'system',
    }, { onConflict: 'school_id,term_id' })

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

// ── Clone ─────────────────────────────────────────────────────────────
function openCloneDialog(termId) {
  cloneSource.value = termId
  cloneTarget.value = ''
  newTermIdForClone.value = ''
  cloneCollections.forEach(c => { c.selected = c.defaultOn })
  showCloneDialog.value = true
}

async function doClone() {
  let targetId = cloneTarget.value
  if (targetId === '__new__') {
    if (!newTermIdForClone.value.trim()) return ElMessage.warning('กรุณากรอกรหัสเทอมใหม่')
    targetId = newTermIdForClone.value.trim()
    await supabase.from('academic_terms').upsert({
      school_id: schoolId.value,
      term_id: targetId,
      created_at: new Date().toISOString(),
    }, { onConflict: 'school_id,term_id' })
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
  const sid = schoolId.value
  const selectedTables = cloneCollections.filter(c => c.selected).map(c => c.key)
  for (const tbl of selectedTables) {
    try {
      const { data } = await supabase
        .from(tbl)
        .select('*')
        .eq('school_id', sid)
        .eq('term_id', fromTerm)
      if (!data || !data.length) continue

      // Prepare rows for target term (strip id to get new auto-ids, update term_id)
      const rows = data.map(row => {
        const { id, created_at, updated_at, ...rest } = row
        return {
          ...rest,
          term_id: toTerm,
          school_id: sid,
          cloned_from: fromTerm,
          cloned_at: new Date().toISOString(),
        }
      })

      // Insert in chunks of 200
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const { error } = await supabase.from(tbl).insert(chunk)
        if (error) throw new Error(`${tbl}: ${error.message}`)
      }
    } catch (e) {
      console.warn(`Clone ${tbl} failed:`, e.message)
    }
  }
}

// ── Set Active Term ───────────────────────────────────────────────────
async function setActiveTerm(termId) {
  await ElMessageBox.confirm(
    `เปลี่ยนเทอมปัจจุบันเป็น "${termId}" ?\n\n✅ ข้อมูลทุกเทอมยังอยู่ครบ ไม่ได้ลบ\n📌 ระบบจะเปลี่ยนไปอ่าน/เขียนข้อมูลของเทอม "${termId}" เท่านั้น`,
    'ยืนยันเปลี่ยนเทอม', { confirmButtonText: 'เปลี่ยน', cancelButtonText: 'ยกเลิก', type: 'warning' }
  )
  const parts = termId.split('_')
  const year = parseInt(parts[0]) || 0
  const semester = parseInt(parts[1]) || 1

  const sid = schoolId.value
  const { data: schoolData } = await supabase.from('schools').select('settings').eq('id', sid).single()
  const settings = schoolData?.settings || {}
  const extraInfo = year > 0 ? { year, semester, current_term: termId } : { current_term: termId }

  await supabase.from('schools').update({
    settings: { ...settings, ...extraInfo }
  }).eq('id', sid)

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
    const sid = schoolId.value
    const tables = ['teachers','classes','subjects','rooms','students','timetable_slots','activity_bookings']
    const wb = XLSX.utils.book_new()
    for (const tbl of tables) {
      const { data } = await supabase.from(tbl).select('*').eq('school_id', sid).eq('term_id', termId)
      if (!data || !data.length) continue
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, tbl.substring(0, 31))
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
    const sid = schoolId.value
    const tables = ['teachers','classes','subjects','rooms','students',
      'timetable_slots','activity_bookings','teach_actuals','behavior_logs','attendance_records']

    for (const tbl of tables) {
      const { error } = await supabase.from(tbl).delete().eq('school_id', sid).eq('term_id', termId)
      if (error) console.warn(`Delete ${tbl}/${termId}:`, error.message)
    }

    // Remove from academic_terms
    await supabase.from('academic_terms').delete().eq('school_id', sid).eq('term_id', termId)

    ElMessage.success(`ลบเทอม ${termId} เรียบร้อย`)
    await loadTerms()
  } catch (e) {
    ElMessage.error('ลบไม่สำเร็จ: ' + e.message)
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
