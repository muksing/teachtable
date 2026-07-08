<template>
  <div class="page-wrap">
    <h2 class="page-title">🔧 สร้างคาบบันทึกที่หาย</h2>
    <p class="page-sub">สแกนตารางสอนตั้งแต่วันเปิดเรียนถึงวันนี้ และสร้างคาบที่ยังไม่มีใน teach_actuals</p>

    <!-- Settings summary -->
    <el-card class="info-card" shadow="never">
      <div class="info-row">
        <span class="info-label">เทอม</span>
        <strong>{{ termId }}</strong>
      </div>
      <div class="info-row">
        <span class="info-label">วันเปิดเรียน</span>
        <el-date-picker
          v-model="manualTermStart"
          type="date"
          placeholder="เลือกวันเปิดเรียน"
          format="DD/MM/YYYY"
          value-format="YYYY-MM-DD"
          style="width:160px"
        />
        <el-tag v-if="settingsTermStart" type="info" size="small" style="margin-left:8px">
          จากการตั้งค่า: {{ settingsTermStart }}
        </el-tag>
      </div>
      <div class="info-row">
        <span class="info-label">วันนี้</span>
        <strong>{{ today }}</strong>
      </div>
    </el-card>

    <!-- Scan result -->
    <el-card v-if="scanResult" class="result-card" shadow="never">
      <div class="result-grid">
        <div class="result-box result-exists">
          <div class="result-num">{{ scanResult.exists.toLocaleString() }}</div>
          <div class="result-label">มีใน DB แล้ว</div>
        </div>
        <div class="result-box result-missing">
          <div class="result-num">{{ scanResult.missing.toLocaleString() }}</div>
          <div class="result-label">คาบที่หายไป</div>
        </div>
        <div class="result-box result-total">
          <div class="result-num">{{ scanResult.total.toLocaleString() }}</div>
          <div class="result-label">รวมทั้งหมดที่ควรมี</div>
        </div>
      </div>
      <div v-if="scanResult.wrongSubject > 0" class="result-box result-wrong" style="margin-top:12px;padding:10px 16px;border-radius:10px;background:#fef2f2;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px;font-weight:900;color:#dc2626">{{ scanResult.wrongSubject }}</span>
        <span style="color:#dc2626;font-size:13px">คาบที่มีใน DB แต่ subject_id ผิด (จะซ่อมอัตโนมัติ)</span>
      </div>
      <div v-if="scanResult.missing === 0 && scanResult.wrongSubject === 0" style="text-align:center;color:#16a34a;font-weight:600;margin-top:12px">
        ✅ ครบแล้ว ไม่มีคาบที่หาย
      </div>
    </el-card>

    <!-- Progress -->
    <el-card v-if="running" class="progress-card" shadow="never">
      <div class="progress-label">กำลังดำเนินการ... {{ progressCount.toLocaleString() }} / {{ ((scanResult?.missing || 0) + (scanResult?.wrongSubject || 0)).toLocaleString() }}</div>
      <el-progress :percentage="progressPct" :stroke-width="14" status="active" />
    </el-card>

    <!-- Done -->
    <el-alert v-if="doneMsg" :title="doneMsg" type="success" show-icon :closable="false" style="margin-top:16px" />
    <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon :closable="false" style="margin-top:16px" />

    <!-- Actions -->
    <div class="action-row">
      <el-button :loading="scanning" :disabled="running || !termStart" @click="scan" type="primary" plain size="large">
        🔍 สแกนตรวจสอบ
      </el-button>
      <el-button
        v-if="scanResult && (scanResult.missing > 0 || scanResult.wrongSubject > 0)"
        :loading="running" :disabled="scanning"
        @click="generate" type="primary" size="large"
      >
        ⚡ ซ่อม/สร้าง ({{ (scanResult.missing + scanResult.wrongSubject).toLocaleString() }} รายการ)
      </el-button>
    </div>

    <!-- Preview table -->
    <el-card v-if="previewRows.length" class="preview-card" shadow="never">
      <template #header>ตัวอย่างคาบที่จะสร้าง ({{ previewRows.length >= 20 ? '20 รายการแรก' : previewRows.length + ' รายการ' }})</template>
      <el-table :data="previewRows" size="small" stripe>
        <el-table-column prop="date"         label="วันที่"    width="110" />
        <el-table-column prop="class_id"     label="ห้อง"      width="80" />
        <el-table-column prop="period_number" label="คาบ"      width="55" />
        <el-table-column prop="subject_id"   label="วิชา"      min-width="100" />
        <el-table-column prop="teacher_id"   label="ครู"       min-width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { slotTable } = useTimetableSource()

const THAI_DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_DAY_NUM   = { จันทร์:1, อังคาร:2, พุธ:3, พฤหัสบดี:4, ศุกร์:5 }

const today    = new Date().toLocaleDateString('sv-SE')   // YYYY-MM-DD local
const termId   = computed(() => schoolStore.currentTerm || '2568_1')
const settingsObj     = computed(() => schoolStore.settingsObj || {})
const settingsTermStart = computed(() => settingsObj.value.term_start || '')
const manualTermStart = ref('')
const termStart = computed(() => manualTermStart.value || settingsTermStart.value)
const homeroomPeriods = computed(() =>
  settingsObj.value.teaching_log_settings?.homeroom_special_periods || []
)

const scanning      = ref(false)
const running       = ref(false)
const scanResult    = ref(null)
const previewRows   = ref([])
const progressCount = ref(0)
const progressPct   = computed(() => {
  const total = (scanResult.value?.missing || 0) + (scanResult.value?.wrongSubject || 0)
  return total ? Math.round((progressCount.value / total) * 100) : 0
})
const doneMsg  = ref('')
const errorMsg = ref('')

// ─── Paginate helper ───────────────────────────────────────────────
async function paginate(buildQuery) {
  const PAGE = 1000, rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE) break
  }
  return rows
}

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── Build payloads for ALL missing slots ─────────────────────────
async function buildMissingPayloads() {
  const schoolId = authStore.schoolId
  const tid      = termId.value
  const start    = termStart.value
  if (!start) throw new Error('ไม่พบวันเปิดเรียน')

  // 1. โหลด slots
  const slots = await paginate((f, t) =>
    supabase.from(slotTable.value)
      .select('class_id, period_number, subject_id, teacher_id, day_of_week, slot_type')
      .eq('school_id', schoolId).eq('term_id', tid)
      .not('slot_type', 'in', '("activity","manual_lock")')
      .range(f, t)
  )

  // 2. โหลด existing keys รวม subject_id — ถ้า subject_id ไม่ตรง = ถือว่าไม่มี
  const existing = await paginate((f, t) =>
    supabase.from('teach_actuals')
      .select('class_id, date, period_number, subject_id')
      .eq('school_id', schoolId).eq('term_id', tid)
      .gte('date', start).lte('date', today)
      .range(f, t)
  )
  // key พร้อม subject_id — ถ้า subject_id ผิดก็ไม่นับว่ามี
  const existSet     = new Set(existing.map(r => `${r.class_id}|${r.date}|${r.period_number}|${r.subject_id}`))
  // key ไม่มี subject_id — ใช้ตรวจว่า record มีอยู่แต่ subject_id ผิด
  const existSlotSet = new Set(existing.map(r => `${r.class_id}|${r.date}|${r.period_number}`))

  // 3. homeroom period numbers
  const hmPeriods = new Set(homeroomPeriods.value.map(hp => Number(hp.period)).filter(Number.isFinite))

  // 3b. วันหยุดที่ admin กำหนด
  const settingsData = await supabase.from('schools').select('settings').eq('id', schoolId).single()
  const rawHols = settingsData.data?.settings?.teaching_log_settings?.holidays || []
  const holidaySet = new Set(rawHols.map(h => (typeof h === 'string' ? h : h?.date)).filter(Boolean))

  // 4. slots by day — รองรับทั้ง day_of_week เป็นตัวเลขและชื่อวันไทย
  const THAI_DAY_NUM = { จันทร์: 1, อังคาร: 2, พุธ: 3, พฤหัสบดี: 4, ศุกร์: 5, เสาร์: 6, อาทิตย์: 7 }
  const byDay = {}
  for (const s of slots) {
    const d = Number(s.day_of_week) || THAI_DAY_NUM[s.day_of_week] || 0
    if (d) (byDay[d] = byDay[d] || []).push(s)
  }

  // 5. วนทุกวัน — มีแล้ว (ถูก) ข้าม / ไม่มีเลย → insert / มีแต่ subject_id ผิด → update subject เท่านั้น
  const newPayloads   = []  // record ใหม่ที่ยังไม่มีใน DB
  const wrongPayloads = []  // มีใน DB แต่ subject_id ผิด → update subject_id เท่านั้น ไม่แตะ is_filled
  let totalExpected = 0

  for (let d = new Date(start + 'T00:00:00'); localStr(d) <= today; d.setDate(d.getDate() + 1)) {
    const jsDay  = d.getDay()
    const dayNum = THAI_DAY_NUM[THAI_DAY_NAMES[jsDay]]
    if (!dayNum) continue

    const dateStr  = localStr(d)
    if (holidaySet.has(dateStr)) continue  // ข้ามวันหยุด

    const daySlots = byDay[dayNum] || []

    for (const slot of daySlots) {
      if (slot.slot_type === 'homeroom') continue
      const period = Number(slot.period_number)
      if (!Number.isFinite(period)) continue
      if (hmPeriods.has(period)) continue
      totalExpected++
      const key     = `${slot.class_id}|${dateStr}|${period}|${slot.subject_id}`
      const slotKey = `${slot.class_id}|${dateStr}|${period}`
      if (existSet.has(key)) continue  // subject_id ถูกแล้ว → ข้าม

      const base = {
        school_id:          schoolId,
        term_id:            tid,
        class_id:           slot.class_id,
        date:               dateStr,
        period_number:      period,
        subject_id:         slot.subject_id || null,
        planned_teacher_id: slot.teacher_id || null,
        slot_type:          slot.slot_type || 'normal',
      }

      if (existSlotSet.has(slotKey)) {
        // มีใน DB แต่ subject_id ผิด → แก้แค่ subject_id + planned_teacher_id
        wrongPayloads.push(base)
      } else {
        // ไม่มีเลย → insert ใหม่
        newPayloads.push({ ...base, actual_teacher_id: null, is_filled: false })
      }
    }
  }

  const existCount = existSlotSet.size
  const wrongSubject = wrongPayloads.length
  const payloads = [...newPayloads, ...wrongPayloads]
  return { payloads, newPayloads, wrongPayloads, totalExpected, existCount, wrongSubject }
}

// ─── Scan ──────────────────────────────────────────────────────────
async function scan() {
  scanning.value = true
  scanResult.value = null
  previewRows.value = []
  doneMsg.value = ''
  errorMsg.value = ''
  try {
    const { payloads, totalExpected, existCount, wrongSubject } = await buildMissingPayloads()
    scanResult.value = {
      total:        totalExpected,
      exists:       existCount,
      missing:      payloads.length - wrongSubject,
      wrongSubject: wrongSubject,
    }
    previewRows.value = payloads.slice(0, 20).map(p => ({
      date:          p.date,
      class_id:      p.class_id,
      period_number: p.period_number,
      subject_id:    p.subject_id || '(homeroom)',
      teacher_id:    p.planned_teacher_id || '-',
    }))
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    scanning.value = false
  }
}

// ─── Generate ──────────────────────────────────────────────────────
async function generate() {
  running.value = true
  progressCount.value = 0
  doneMsg.value = ''
  errorMsg.value = ''
  try {
    const { newPayloads, wrongPayloads } = await buildMissingPayloads()
    const CHUNK = 400

    // 1. Insert คาบใหม่ที่ยังไม่มีใน DB
    for (let i = 0; i < newPayloads.length; i += CHUNK) {
      const { error } = await supabase.from('teach_actuals')
        .upsert(newPayloads.slice(i, i + CHUNK), {
          onConflict: 'school_id,term_id,class_id,date,period_number',
          ignoreDuplicates: true,
        })
      if (error) throw error
      progressCount.value = Math.min(i + CHUNK, newPayloads.length)
    }

    // 2. แก้ subject_id ที่ผิด — update เฉพาะ subject_id + planned_teacher_id ไม่แตะ is_filled / student_records
    for (let i = 0; i < wrongPayloads.length; i += CHUNK) {
      const chunk = wrongPayloads.slice(i, i + CHUNK)
      await Promise.all(chunk.map(p =>
        supabase.from('teach_actuals')
          .update({ subject_id: p.subject_id, planned_teacher_id: p.planned_teacher_id })
          .eq('school_id', p.school_id).eq('term_id', p.term_id)
          .eq('class_id', p.class_id).eq('date', p.date).eq('period_number', p.period_number)
      ))
      progressCount.value = newPayloads.length + Math.min(i + CHUNK, wrongPayloads.length)
    }

    doneMsg.value = `✅ เสร็จ — สร้างใหม่ ${newPayloads.length} คาบ, ซ่อม subject_id ${wrongPayloads.length} คาบ`
    scanResult.value = null
    previewRows.value = []
  } catch (e) {
    errorMsg.value = e.message
    ElMessage.error(e.message)
  } finally {
    running.value = false
  }
}

onMounted(() => {
  // ถ้า settings มี term_start ให้ pre-fill แล้ว scan เลย
  if (settingsTermStart.value) {
    manualTermStart.value = settingsTermStart.value
    scan()
  }
})
</script>

<style scoped>
.page-wrap  { max-width: 760px; margin: 0 auto; padding: 24px 16px 60px; font-family: 'Sarabun', sans-serif; }
.page-title { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.page-sub   { color: #64748b; margin: 0 0 20px; font-size: 14px; }

.info-card  { margin-bottom: 16px; }
.info-row   { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
.info-row:last-child { border-bottom: none; }
.info-label { width: 100px; color: #64748b; flex-shrink: 0; }

.result-card  { margin-bottom: 16px; }
.result-grid  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.result-box   { text-align: center; padding: 16px 8px; border-radius: 10px; }
.result-num   { font-size: 28px; font-weight: 900; }
.result-label { font-size: 12px; color: #64748b; margin-top: 4px; }
.result-exists  { background: #f0fdf4; }
.result-exists .result-num  { color: #16a34a; }
.result-missing { background: #fff7ed; }
.result-missing .result-num { color: #ea580c; }
.result-total   { background: #eff6ff; }
.result-total .result-num   { color: #2563eb; }

.progress-card  { margin-bottom: 16px; }
.progress-label { font-size: 14px; margin-bottom: 8px; font-weight: 600; }

.action-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.preview-card { margin-top: 8px; }
</style>
