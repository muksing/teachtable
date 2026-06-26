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
      <div v-if="scanResult.missing === 0" style="text-align:center;color:#16a34a;font-weight:600;margin-top:12px">
        ✅ ครบแล้ว ไม่มีคาบที่หาย
      </div>
    </el-card>

    <!-- Progress -->
    <el-card v-if="running" class="progress-card" shadow="never">
      <div class="progress-label">กำลังสร้าง... {{ progressCount.toLocaleString() }} / {{ scanResult?.missing.toLocaleString() }}</div>
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
        v-if="scanResult && scanResult.missing > 0"
        :loading="running" :disabled="scanning"
        @click="generate" type="primary" size="large"
      >
        ⚡ สร้างคาบที่หาย ({{ scanResult.missing.toLocaleString() }} คาบ)
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
const progressPct   = computed(() =>
  scanResult.value?.missing ? Math.round((progressCount.value / scanResult.value.missing) * 100) : 0
)
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

  // 2. โหลด existing keys
  const existing = await paginate((f, t) =>
    supabase.from('teach_actuals')
      .select('class_id, date, period_number')
      .eq('school_id', schoolId).eq('term_id', tid)
      .gte('date', start).lte('date', today)
      .range(f, t)
  )
  const existSet = new Set(existing.map(r => `${r.class_id}|${r.date}|${r.period_number}`))

  // 3. homeroom period numbers
  const hmPeriods = new Set(homeroomPeriods.value.map(hp => Number(hp.period)).filter(Number.isFinite))

  // 4. slots by day
  const byDay = {}
  for (const s of slots) {
    const d = Number(s.day_of_week)
    ;(byDay[d] = byDay[d] || []).push(s)
  }

  // 5. วนทุกวัน
  const payloads = []
  let totalExpected = 0

  for (let d = new Date(start + 'T00:00:00'); localStr(d) <= today; d.setDate(d.getDate() + 1)) {
    const jsDay  = d.getDay()
    const dayNum = THAI_DAY_NUM[THAI_DAY_NAMES[jsDay]]
    if (!dayNum) continue  // เสาร์-อาทิตย์

    const dateStr  = localStr(d)
    const daySlots = byDay[dayNum] || []

    for (const slot of daySlots) {
      if (slot.slot_type === 'homeroom') continue
      const period = Number(slot.period_number)
      if (!Number.isFinite(period)) continue
      if (hmPeriods.has(period)) continue
      totalExpected++
      const key = `${slot.class_id}|${dateStr}|${period}`
      if (existSet.has(key)) continue
      payloads.push({
        school_id:          schoolId,
        term_id:            tid,
        class_id:           slot.class_id,
        date:               dateStr,
        period_number:      period,
        planned_teacher_id: slot.teacher_id || null,
        actual_teacher_id:  null,
        subject_id:         slot.subject_id || null,
        is_filled:          false,
        slot_type:          slot.slot_type || 'normal',
      })
    }
  }

  return { payloads, totalExpected, existCount: existSet.size }
}

// ─── Scan ──────────────────────────────────────────────────────────
async function scan() {
  scanning.value = true
  scanResult.value = null
  previewRows.value = []
  doneMsg.value = ''
  errorMsg.value = ''
  try {
    const { payloads, totalExpected, existCount } = await buildMissingPayloads()
    scanResult.value = {
      total:   totalExpected,
      exists:  existCount,
      missing: payloads.length,
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
    const { payloads } = await buildMissingPayloads()
    const CHUNK = 400
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const { error } = await supabase.from('teach_actuals')
        .upsert(payloads.slice(i, i + CHUNK), {
          onConflict: 'school_id,term_id,class_id,date,period_number',
          ignoreDuplicates: true,
        })
      if (error) throw error
      progressCount.value = Math.min(i + CHUNK, payloads.length)
    }
    doneMsg.value = `✅ สร้างสำเร็จ ${payloads.length.toLocaleString()} คาบ`
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
