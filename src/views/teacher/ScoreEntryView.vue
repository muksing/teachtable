<template>
  <AppLayout>
    <div class="score-page">

      <!-- ── Title ── -->
      <div class="score-title-bar">
        <div>
          <h1 class="score-title">📝 บันทึกคะแนนเก็บรายหน่วย</h1>
          <p class="score-sub">เลือกวิชา/ห้อง แล้วกรอกคะแนน · วางจาก Excel ได้เลย</p>
        </div>
      </div>

      <!-- ── Selectors ── -->
      <el-card shadow="never" class="mb-4" style="border-radius:14px">
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <div class="text-xs text-gray-500 mb-1 font-medium">📚 วิชา / ห้อง</div>
            <el-select
              v-model="selectedKey"
              placeholder="เลือกวิชาและห้องเรียน"
              filterable style="min-width:280px"
              :loading="loadingAssign"
              @change="onSelectionChange"
            >
              <el-option
                v-for="a in assignments"
                :key="a.key"
                :label="`${a.subject_name} — ${a.class_id}`"
                :value="a.key"
              />
            </el-select>
          </div>

          <div v-if="selectedKey" class="flex items-end gap-2">
            <template v-if="isAdmin">
              <div>
                <div class="text-xs text-gray-500 mb-1">จำนวนหน่วย</div>
                <el-input-number v-model="numUnits" :min="1" :max="8" :step="1" size="small"
                  controls-position="right" style="width:90px" @change="onConfigChange" />
              </div>
              <div v-for="u in numUnits" :key="u">
                <div class="text-xs text-gray-500 mb-1">สูงสุดหน่วย{{ u }}</div>
                <el-input-number
                  v-model="maxScores[u-1]"
                  :min="1" :max="200" size="small"
                  controls-position="right" style="width:80px"
                  @change="onConfigChange"
                />
              </div>
            </template>
            <template v-else>
              <div v-for="u in numUnits" :key="u" class="text-center">
                <div class="text-xs text-gray-400 mb-1">หน่วย {{ u }}</div>
                <div class="text-sm font-semibold text-gray-600 px-3 py-1 bg-gray-50 rounded border border-gray-200">
                  /{{ maxScores[u-1] }}
                </div>
              </div>
            </template>
          </div>

          <div v-if="selectedKey" class="flex items-end gap-2 ml-auto">
            <el-tag type="info" size="small" class="mr-1">
              คะแนนเต็มรวม: {{ totalMaxScore }}
            </el-tag>
            <el-button type="primary" :loading="saving" :disabled="!students.length" @click="saveScores">
              💾 บันทึก
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- ── Hint ── -->
      <div v-if="selectedKey && students.length" class="score-hint">
        <span>⌨️ Tab/Shift+Tab: ซ้าย/ขวา &nbsp;·&nbsp; Enter/↑↓: ขึ้น/ลง &nbsp;·&nbsp; Ctrl+C: คัดลอก &nbsp;·&nbsp; Ctrl+V: วาง (รองรับ Excel)</span>
      </div>

      <!-- ── Empty state ── -->
      <el-empty v-if="!selectedKey" description="เลือกวิชาและห้องเรียนเพื่อเริ่มกรอกคะแนน" />
      <el-empty v-else-if="!loadingStudents && !students.length" description="ไม่พบนักเรียนในห้องนี้" />

      <!-- ── Spreadsheet ── -->
      <div
        v-if="selectedKey && students.length"
        class="score-grid-wrap"
        ref="gridWrapRef"
        @mouseup="isDragging = false"
        @paste.prevent="handlePaste"
        @keydown.ctrl.c.prevent="handleCopy"
        tabindex="-1"
      >
        <div v-if="loadingStudents" class="flex justify-center py-8">
          <el-icon class="is-loading" size="28"><Loading /></el-icon>
        </div>

        <table v-else class="score-grid" @selectstart.prevent>
          <thead>
            <tr>
              <th class="sg-th sg-th-fixed" style="width:40px">ที่</th>
              <th class="sg-th sg-th-fixed" style="width:90px">รหัส</th>
              <th class="sg-th sg-th-fixed" style="min-width:160px;text-align:left">ชื่อ–สกุล</th>
              <th
                v-for="u in numUnits" :key="u"
                class="sg-th sg-th-score"
                @click="selectCol(u-1)"
                style="cursor:pointer"
                title="คลิกเลือกทั้งคอลัมน์"
              >
                หน่วย {{ u }}<br />
                <span class="text-gray-400 font-normal text-xs">/{{ maxScores[u-1] }}</span>
              </th>
              <th class="sg-th sg-th-score" style="background:#f8fafc">รวม</th>
              <th class="sg-th sg-th-score" style="background:#f8fafc">%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(stu, ri) in students"
              :key="stu.student_id"
              :class="{ 'sg-row-selected': isRowSelected(ri) }"
              @click.self="selectRow(ri)"
            >
              <td class="sg-td sg-td-fixed text-center text-gray-500">{{ stu.seat_number || ri+1 }}</td>
              <td class="sg-td sg-td-fixed text-center text-gray-500 text-xs">{{ stu.student_id }}</td>
              <td class="sg-td sg-td-fixed">{{ stu.prefix }}{{ stu.name }} {{ stu.surname }}</td>

              <td
                v-for="ci in numUnits" :key="ci"
                class="sg-td-score"
                :class="{ 'cell-active': activeCell.r===ri && activeCell.c===ci-1, 'cell-sel': isInSel(ri, ci-1) }"
                @mousedown.prevent="startSel($event, ri, ci-1)"
                @mouseover="extendSel(ri, ci-1)"
              >
                <input
                  :ref="el => setCellRef(ri, ci-1, el)"
                  v-model="grid[stu.student_id][`u${ci}`]"
                  class="sg-input"
                  :class="{ 'sg-input-active': activeCell.r===ri && activeCell.c===ci-1 }"
                  @focus="onFocus(ri, ci-1)"
                  @keydown="handleKeydown($event, ri, ci-1)"
                  @input="clampCell(stu.student_id, ci)"
                  @blur="clampCell(stu.student_id, ci)"
                  autocomplete="off"
                  inputmode="decimal"
                />
              </td>

              <td class="sg-td-score sg-td-total">{{ getTotal(stu.student_id) }}</td>
              <td
                class="sg-td-score sg-td-pct"
                :class="getPct(stu.student_id) < passPct ? 'pct-fail' : 'pct-pass'"
              >
                {{ getPct(stu.student_id) }}%
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="sg-foot" colspan="3">เฉลี่ยทั้งห้อง</td>
              <td v-for="u in numUnits" :key="u" class="sg-foot sg-foot-score">
                {{ colAvg(u-1) }}
              </td>
              <td class="sg-foot sg-foot-score">{{ classAvgTotal }}</td>
              <td class="sg-foot sg-foot-score">{{ classAvgPct }}%</td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()

const schoolId = computed(() => authStore.schoolId)
const termId   = computed(() => schoolStore.currentTerm || '')
const isAdmin  = computed(() => authStore.hasAnyRole(['school_admin', 'admin', 'superadmin']))
const { slotTable } = useTimetableSource()

// ── Assignments ───────────────────────────────────────────────────
const assignments   = ref([])
const loadingAssign = ref(false)
const selectedKey   = ref('')

// ── Score config ──────────────────────────────────────────────────
const numUnits  = ref(8)
const maxScores = ref([20, 20, 20, 20, 20, 20, 20, 20])
const passPct   = ref(50)

const totalMaxScore = computed(() =>
  maxScores.value.slice(0, numUnits.value).reduce((a, b) => a + b, 0)
)

// ── Students + grid ───────────────────────────────────────────────
const students       = ref([])
const loadingStudents = ref(false)
const saving         = ref(false)
const grid           = reactive({})
const cellRefs       = ref([])

// ── Selection state ───────────────────────────────────────────────
const activeCell  = reactive({ r: -1, c: -1 })
const selStart    = ref(null)
const selEnd      = ref(null)
const isDragging  = ref(false)
const gridWrapRef = ref(null)

// ─────────────────────────────────────────────────────────────────

async function loadSettings() {
  const { data } = await supabase.from('schools').select('settings')
    .eq('id', schoolId.value).maybeSingle()
  const ss = data?.settings?.score_settings || {}
  numUnits.value  = ss.num_units  || 8
  maxScores.value = ss.max_scores || [20, 20, 20, 20, 20, 20, 20, 20]
  passPct.value   = ss.pass_pct   || 50
}

async function loadAssignments() {
  loadingAssign.value = true
  try {
    const teacherId = authStore.profile?.teacher_id || authStore.profile?.teacherId

    // Load timetable_slots for this teacher (or all for admin)
    let q = supabase.from(slotTable.value)
      .select('class_id, subject_id, subject_name, teacher_id')
      .eq('school_id', schoolId.value)
      .eq('term_id', termId.value)
      .neq('slot_type', 'activity')

    if (!isAdmin.value && teacherId) q = q.eq('teacher_id', teacherId)

    const { data: slots } = await q

    // Load subjects with credits to filter
    const { data: subjectsList } = await supabase
      .from('subjects').select('subject_code, credits')
      .eq('school_id', schoolId.value).gt('credits', 0)
    const withCredits = new Set((subjectsList || []).map(s => s.subject_code))

    // Deduplicate
    const seen = new Set()
    const result = []
    for (const s of (slots || [])) {
      if (!withCredits.has(s.subject_id)) continue
      const key = `${s.subject_id}__${s.class_id}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ key, subject_code: s.subject_id, subject_name: s.subject_name || s.subject_id, class_id: s.class_id })
    }
    result.sort((a, b) => `${a.class_id}${a.subject_name}`.localeCompare(`${b.class_id}${b.subject_name}`, 'th'))
    assignments.value = result
  } finally {
    loadingAssign.value = false
  }
}

async function onSelectionChange() {
  const asgn = assignments.value.find(a => a.key === selectedKey.value)
  if (!asgn) return
  await loadStudentsAndScores(asgn)
}

async function loadStudentsAndScores(asgn) {
  loadingStudents.value = true
  students.value = []
  cellRefs.value = []

  try {
    const [{ data: stuData }, { data: scoreData }] = await Promise.all([
      supabase.from('students').select('*')
        .eq('school_id', schoolId.value)
        .eq('class_id', asgn.class_id),
      supabase.from('score_records')
        .select('student_id, scores')
        .eq('school_id', schoolId.value)
        .eq('term_id', termId.value)
        .eq('subject_code', asgn.subject_code)
        .eq('class_id', asgn.class_id),
    ])

    const scoreMap = {}
    for (const row of (scoreData || [])) scoreMap[row.student_id] = row.scores

    // Sort by seat_number
    const sorted = (stuData || []).sort((a, b) =>
      (parseInt(a.seat_number) || 999) - (parseInt(b.seat_number) || 999)
    )

    // Build grid
    for (const stu of sorted) {
      const saved = scoreMap[stu.student_code] || {}
      grid[stu.student_code] = reactive({
        u1: saved.u1 ?? '', u2: saved.u2 ?? '', u3: saved.u3 ?? '',
        u4: saved.u4 ?? '', u5: saved.u5 ?? '', u6: saved.u6 ?? '',
        u7: saved.u7 ?? '', u8: saved.u8 ?? '',
      })
    }

    students.value = sorted.map(d => ({
      ...d,
      student_id: d.student_code,
      name: d.first_name,
      surname: d.last_name,
      prefix: d.prefix || '',
    }))

    // Reset selection
    activeCell.r = -1; activeCell.c = -1
    selStart.value = null; selEnd.value = null
  } finally {
    loadingStudents.value = false
  }
}

async function saveScores() {
  const asgn = assignments.value.find(a => a.key === selectedKey.value)
  if (!asgn) return
  saving.value = true
  try {
    const teacherId = authStore.profile?.teacher_id || authStore.profile?.teacherId || ''
    const upserts = students.value.map(stu => ({
      school_id: schoolId.value,
      term_id: termId.value,
      subject_code: asgn.subject_code,
      class_id: asgn.class_id,
      student_id: stu.student_id,
      scores: {
        u1: parseNum(grid[stu.student_id]?.u1),
        u2: parseNum(grid[stu.student_id]?.u2),
        u3: parseNum(grid[stu.student_id]?.u3),
        u4: parseNum(grid[stu.student_id]?.u4),
        u5: parseNum(grid[stu.student_id]?.u5),
        u6: parseNum(grid[stu.student_id]?.u6),
        u7: parseNum(grid[stu.student_id]?.u7),
        u8: parseNum(grid[stu.student_id]?.u8),
      },
      recorded_by: teacherId,
    }))
    const { error } = await supabase.from('score_records')
      .upsert(upserts, { onConflict: 'school_id,term_id,subject_code,class_id,student_id' })
    if (error) throw error
    ElMessage.success('บันทึกคะแนนสำเร็จ')
  } catch (e) {
    ElMessage.error('บันทึกไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function onConfigChange() {
  // Save settings
  const { data: row } = await supabase.from('schools').select('settings')
    .eq('id', schoolId.value).maybeSingle()
  const settings = row?.settings || {}
  settings.score_settings = {
    num_units: numUnits.value,
    max_scores: maxScores.value,
    pass_pct: passPct.value,
  }
  await supabase.from('schools').update({ settings }).eq('id', schoolId.value)
}

// ── Helpers ───────────────────────────────────────────────────────
function parseNum(v) {
  if (v === '' || v == null) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

function getTotal(sid) {
  const s = grid[sid]; if (!s) return 0
  let sum = 0
  for (let u = 1; u <= numUnits.value; u++) {
    const v = parseNum(s[`u${u}`])
    if (v !== null) sum += v
  }
  return Math.round(sum * 100) / 100
}

function getPct(sid) {
  const t = getTotal(sid)
  return totalMaxScore.value ? Math.round(t / totalMaxScore.value * 100) : 0
}

function colAvg(ci) {
  const vals = students.value.map(s => parseNum(grid[s.student_id]?.[`u${ci+1}`])).filter(v => v !== null)
  if (!vals.length) return '—'
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

const classAvgTotal = computed(() => {
  const tots = students.value.map(s => getTotal(s.student_id))
  if (!tots.length) return '—'
  return Math.round(tots.reduce((a, b) => a + b, 0) / tots.length * 10) / 10
})

const classAvgPct = computed(() => {
  const pcts = students.value.map(s => getPct(s.student_id))
  if (!pcts.length) return 0
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
})

// ── Cell refs ─────────────────────────────────────────────────────
function setCellRef(row, col, el) {
  if (!cellRefs.value[row]) cellRefs.value[row] = []
  cellRefs.value[row][col] = el
}

function focusCell(r, c) {
  r = Math.max(0, Math.min(r, students.value.length - 1))
  c = Math.max(0, Math.min(c, numUnits.value - 1))
  nextTick(() => cellRefs.value[r]?.[c]?.focus())
}

function onFocus(r, c) {
  activeCell.r = r; activeCell.c = c
  if (!isDragging.value) {
    selStart.value = { r, c }; selEnd.value = { r, c }
  }
}

function clampCell(sid, ci) {
  const key = `u${ci}`
  const raw = grid[sid]?.[key]
  if (raw === '' || raw == null) return
  const n = parseFloat(String(raw).replace(',', '.'))
  if (isNaN(n)) return
  const max = maxScores.value[ci - 1] ?? 200
  if (n > max) grid[sid][key] = String(max)
  else if (n < 0) grid[sid][key] = '0'
}

// ── Keyboard navigation ───────────────────────────────────────────
function handleKeydown(e, r, c) {
  const { key, shiftKey, ctrlKey } = e
  if (ctrlKey && key.toLowerCase() === 'c') return  // handled at container
  let nr = r, nc = c, handled = true
  if (key === 'Tab')        { nc = shiftKey ? c - 1 : c + 1 }
  else if (key === 'Enter') { nr = r + 1 }
  else if (key === 'ArrowRight') { nc = c + 1 }
  else if (key === 'ArrowLeft')  { nc = c - 1 }
  else if (key === 'ArrowDown')  { nr = r + 1 }
  else if (key === 'ArrowUp')    { nr = r - 1 }
  else { handled = false }

  if (handled) {
    e.preventDefault()
    // Wrap rows when at column boundary
    if (nc < 0 && nr > 0) { nr--; nc = numUnits.value - 1 }
    if (nc >= numUnits.value && nr < students.value.length - 1) { nr++; nc = 0 }
    focusCell(nr, nc)
    selStart.value = { r: nr, c: nc }; selEnd.value = { r: nr, c: nc }
  }
}

// ── Selection ─────────────────────────────────────────────────────
function startSel(e, r, c) {
  if (e.shiftKey) {
    selEnd.value = { r, c }
  } else {
    selStart.value = { r, c }; selEnd.value = { r, c }
    isDragging.value = true
    focusCell(r, c)
  }
}

function extendSel(r, c) {
  if (isDragging.value) selEnd.value = { r, c }
}

function selectRow(r) {
  selStart.value = { r, c: 0 }; selEnd.value = { r, c: numUnits.value - 1 }
}

function selectCol(c) {
  selStart.value = { r: 0, c }; selEnd.value = { r: students.value.length - 1, c }
}

function normSel() {
  const s = selStart.value; const e = selEnd.value
  if (!s || !e) return { r1: -1, c1: -1, r2: -1, c2: -1 }
  return {
    r1: Math.min(s.r, e.r), r2: Math.max(s.r, e.r),
    c1: Math.min(s.c, e.c), c2: Math.max(s.c, e.c),
  }
}

function isInSel(r, c) {
  const { r1, c1, r2, c2 } = normSel()
  return r >= r1 && r <= r2 && c >= c1 && c <= c2
}

function isRowSelected(r) {
  const { r1, r2, c1, c2 } = normSel()
  return r >= r1 && r <= r2 && c1 === 0 && c2 === numUnits.value - 1
}

// ── Paste (Excel TSV) ─────────────────────────────────────────────
function handlePaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text/plain')
  if (!text || activeCell.r < 0) return
  const rows = text.trim().split(/\r?\n/).map(r => r.split('\t'))
  rows.forEach((row, ri) => {
    const stu = students.value[activeCell.r + ri]
    if (!stu) return
    row.forEach((val, ci) => {
      const col = activeCell.c + ci
      if (col >= numUnits.value) return
      const cleaned = val.trim().replace(',', '.')
      const n = parseFloat(cleaned)
      grid[stu.student_id][`u${col + 1}`] = isNaN(n) ? '' : String(Math.min(n, maxScores.value[col] || 200))
    })
  })
  ElMessage.success(`วาง ${rows.length} แถวสำเร็จ`)
}

// ── Copy to clipboard ─────────────────────────────────────────────
function handleCopy() {
  const { r1, c1, r2, c2 } = normSel()
  const lines = []
  for (let r = r1; r <= r2; r++) {
    const stu = students.value[r]; if (!stu) continue
    const cols = []
    for (let c = c1; c <= c2; c++) cols.push(grid[stu.student_id]?.[`u${c + 1}`] ?? '')
    lines.push(cols.join('\t'))
  }
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    ElMessage.success(`คัดลอก ${r2 - r1 + 1} แถว, ${c2 - c1 + 1} คอลัมน์`)
  })
}

// ── Init ──────────────────────────────────────────────────────────
watch(termId, () => { if (termId.value) loadAssignments() }, { immediate: true })
loadSettings()
</script>

<style scoped>
.score-page { padding: 20px 24px; max-width: 100%; }
.score-title-bar { margin-bottom: 20px; }
.score-title { font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 0; }
.score-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }

.score-hint {
  font-size: 12px; color: #6b7280; margin-bottom: 8px;
  background: #f8fafc; padding: 6px 12px; border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.score-grid-wrap {
  overflow-x: auto; border-radius: 12px;
  border: 1px solid #e2e8f0; background: #fff;
  outline: none;
}

.score-grid {
  border-collapse: collapse; width: max-content; min-width: 100%;
  font-size: 13px; font-family: inherit;
}

.sg-th {
  background: #1e3a8a; color: #fff; padding: 8px 10px;
  text-align: center; font-weight: 700; font-size: 12px;
  white-space: nowrap; position: sticky; top: 0; z-index: 2;
}
.sg-th-fixed { position: sticky; top: 0; z-index: 3; }
.sg-th-score { min-width: 70px; }

.sg-td, .sg-td-fixed {
  border: 1px solid #e2e8f0; padding: 3px 8px;
  background: #fff; white-space: nowrap;
}
.sg-td-fixed { background: #f8fafc; }

.sg-td-score {
  border: 1px solid #e2e8f0; padding: 1px;
  text-align: center; position: relative;
}
.sg-td-score.cell-sel { background: #dbeafe; }
.sg-td-score.cell-active { outline: 2px solid #3b82f6; outline-offset: -2px; z-index: 1; }

.sg-input {
  width: 100%; height: 32px; border: none; outline: none;
  text-align: center; background: transparent;
  font-size: 13px; font-family: inherit;
  padding: 0 4px;
}
.sg-input:focus { background: #eff6ff; }
.sg-input-active { background: #eff6ff; }

.sg-td-total, .sg-td-pct {
  border: 1px solid #e2e8f0; padding: 4px 10px;
  text-align: center; font-weight: 700; background: #f8fafc;
  white-space: nowrap;
}
.pct-pass { color: #15803d; }
.pct-fail { color: #dc2626; }

.sg-row-selected { background: #f0f9ff; }

.sg-foot, .sg-foot-score {
  background: #1e3a8a; color: #fff; padding: 5px 10px;
  font-size: 12px; font-weight: 700; text-align: center;
  border: 1px solid #1e40af;
}
</style>
