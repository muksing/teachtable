<template>
  <AppLayout>
    <div class="imp-page">

      <!-- Header -->
      <div class="imp-header">
        <h1 class="imp-title">📥 นำเข้าข้อมูลบันทึกเข้าสอน</h1>
        <p class="imp-sub">อัพโหลด Excel ที่ Export จากระบบเดิม (Firebase) — ต้องมี 2 Sheet: <b>teach_logs</b> และ <b>student_attendance</b></p>
      </div>

      <!-- Step 1: Upload -->
      <el-card class="imp-card mb-4">
        <template #header><span class="imp-card-title">① เลือกไฟล์ Excel</span></template>

        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls"
          :on-change="onFileChange"
          :on-remove="onFileRemove"
          drag
          style="width:100%"
        >
          <el-icon style="font-size:48px;color:#94a3b8"><i-ep-upload-filled /></el-icon>
          <div style="margin-top:8px;font-size:14px;color:#64748b">
            ลากไฟล์มาวางที่นี่ หรือ <span style="color:#0284c7;font-weight:600">คลิกเพื่อเลือกไฟล์</span>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px">รองรับ .xlsx เท่านั้น</div>
        </el-upload>

        <div v-if="fileInfo" class="mt-3 p-3 rounded-xl" style="background:#f0fdf4;border:1px solid #86efac">
          <span style="font-weight:700;color:#15803d">✅ {{ fileInfo.name }}</span>
          <span style="color:#64748b;font-size:12px;margin-left:8px">({{ (fileInfo.size/1024).toFixed(0) }} KB)</span>
        </div>
      </el-card>

      <!-- Step 2: Validate + Preview -->
      <el-card v-if="parsed" class="imp-card mb-4">
        <template #header><span class="imp-card-title">② ตรวจสอบข้อมูล</span></template>

        <!-- Summary -->
        <div class="imp-summary-grid mb-4">
          <div class="imp-sum-box" :class="sheetInfo.logs.ok ? 'imp-sum--green' : 'imp-sum--red'">
            <div class="imp-sum-num">{{ sheetInfo.logs.count }}</div>
            <div class="imp-sum-lbl">Sheet: teach_logs</div>
            <div class="imp-sum-sub">{{ sheetInfo.logs.ok ? '✅ โครงสร้างถูกต้อง' : '❌ ' + sheetInfo.logs.error }}</div>
          </div>
          <div class="imp-sum-box" :class="sheetInfo.att.ok ? 'imp-sum--green' : 'imp-sum--red'">
            <div class="imp-sum-num">{{ sheetInfo.att.count }}</div>
            <div class="imp-sum-lbl">Sheet: student_attendance</div>
            <div class="imp-sum-sub">{{ sheetInfo.att.ok ? '✅ โครงสร้างถูกต้อง' : '❌ ' + sheetInfo.att.error }}</div>
          </div>
          <div class="imp-sum-box imp-sum--blue">
            <div class="imp-sum-num">{{ uniquePeriods }}</div>
            <div class="imp-sum-lbl">คาบเรียนที่จะ import</div>
            <div class="imp-sum-sub">{{ uniqueDates }} วัน · {{ uniqueClasses }} ห้อง</div>
          </div>
          <div class="imp-sum-box" :class="validationErrors.length ? 'imp-sum--orange' : 'imp-sum--green'">
            <div class="imp-sum-num">{{ validationErrors.length }}</div>
            <div class="imp-sum-lbl">แถวที่มีปัญหา</div>
            <div class="imp-sum-sub">{{ validationErrors.length ? 'ตรวจสอบด้านล่าง' : '✅ ข้อมูลพร้อม import' }}</div>
          </div>
        </div>

        <!-- Validation errors -->
        <div v-if="validationErrors.length" class="mb-4">
          <div class="font-bold text-orange-600 mb-2" style="font-size:13px">⚠️ พบข้อมูลที่ต้องตรวจสอบ (แถวเหล่านี้จะถูกข้าม):</div>
          <el-table :data="validationErrors.slice(0,10)" size="small" border style="border-radius:8px">
            <el-table-column label="Sheet" width="160" prop="sheet" />
            <el-table-column label="แถว" width="60" prop="row" align="center" />
            <el-table-column label="ปัญหา" min-width="250" prop="msg" />
          </el-table>
          <div v-if="validationErrors.length > 10" class="text-xs text-gray-400 mt-1">...และอีก {{ validationErrors.length - 10 }} รายการ</div>
        </div>

        <!-- Preview teach_logs -->
        <div class="mb-1 font-bold text-gray-600" style="font-size:13px">ตัวอย่างข้อมูล teach_logs (5 แถวแรก):</div>
        <el-table :data="logsPreview" size="small" border class="mb-4" style="border-radius:8px">
          <el-table-column prop="date" label="วันที่" width="110" />
          <el-table-column prop="term_id" label="ภาค" width="80" />
          <el-table-column prop="class_id" label="ห้อง" width="90" />
          <el-table-column prop="period_number" label="คาบ" width="60" align="center" />
          <el-table-column prop="slot_type" label="ประเภท" width="90" />
          <el-table-column prop="teacher_name" label="ครู" min-width="140" />
          <el-table-column prop="topic" label="หัวข้อ" min-width="160" />
        </el-table>

        <!-- Preview student_attendance -->
        <div class="mb-1 font-bold text-gray-600" style="font-size:13px">ตัวอย่างข้อมูล student_attendance (5 แถวแรก):</div>
        <el-table :data="attPreview" size="small" border style="border-radius:8px">
          <el-table-column prop="date" label="วันที่" width="110" />
          <el-table-column prop="class_id" label="ห้อง" width="90" />
          <el-table-column prop="period_number" label="คาบ" width="60" align="center" />
          <el-table-column prop="student_code" label="รหัสนักเรียน" width="110" />
          <el-table-column prop="status" label="สถานะ" width="110">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Step 3: Import -->
      <el-card v-if="parsed && sheetInfo.logs.ok && sheetInfo.att.ok" class="imp-card mb-4">
        <template #header><span class="imp-card-title">③ นำเข้าข้อมูล</span></template>

        <div class="mb-4 p-3 rounded-xl" style="background:#fffbeb;border:1px solid #fde68a;font-size:13px">
          ⚠️ ระบบจะ <b>upsert</b> ข้อมูล — ถ้ามีคาบนั้นในระบบแล้วจะ <b>เขียนทับ</b> student_records
          แต่ไม่ลบข้อมูลที่ไม่มีใน Excel
        </div>

        <div class="flex items-center gap-4 flex-wrap">
          <el-button
            type="primary" size="large"
            :loading="importing"
            :disabled="importing || importDone"
            style="min-width:180px;font-size:15px;background:linear-gradient(135deg,#1e3a5f,#0f766e);border:none"
            @click="startImport"
          >
            {{ importing ? `กำลัง import... (${importProgress}%)` : importDone ? '✅ Import เสร็จแล้ว' : '🚀 เริ่ม Import' }}
          </el-button>
          <div v-if="importing || importDone" style="flex:1;min-width:200px">
            <el-progress :percentage="importProgress" :stroke-width="12"
              :status="importDone ? 'success' : undefined" />
          </div>
        </div>

        <!-- Result -->
        <div v-if="importResult" class="mt-4 p-4 rounded-xl" style="background:#f0fdf4;border:1px solid #86efac">
          <div class="font-bold text-green-700 mb-2">✅ Import เสร็จสมบูรณ์</div>
          <div class="text-sm text-gray-700">
            <div>• นำเข้าสำเร็จ: <b>{{ importResult.success }}</b> คาบ</div>
            <div v-if="importResult.skipped">• ข้ามไป (ข้อมูลผิดพลาด): <b>{{ importResult.skipped }}</b> คาบ</div>
          </div>
        </div>
      </el-card>

      <!-- Format guide -->
      <el-card class="imp-card" style="border-left:4px solid #94a3b8">
        <template #header><span class="imp-card-title" style="color:#64748b">📋 รูปแบบ Excel ที่รองรับ</span></template>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <div class="font-bold mb-2">Sheet 1: <code>teach_logs</code></div>
            <table class="imp-guide-table">
              <tr><th>คอลัมน์</th><th>ตัวอย่าง</th></tr>
              <tr><td>date</td><td>2025-11-04</td></tr>
              <tr><td>term_id</td><td>2568_1</td></tr>
              <tr><td>class_id</td><td>ม.1/1</td></tr>
              <tr><td>period_number</td><td>1</td></tr>
              <tr><td>slot_type</td><td>normal / homeroom</td></tr>
              <tr><td>teacher_name</td><td>นายสมชาย ใจดี</td></tr>
              <tr><td>topic</td><td>(ไม่บังคับ)</td></tr>
              <tr><td>activity_type</td><td>(ไม่บังคับ)</td></tr>
              <tr><td>is_filled</td><td>TRUE / FALSE</td></tr>
            </table>
          </div>
          <div>
            <div class="font-bold mb-2">Sheet 2: <code>student_attendance</code></div>
            <table class="imp-guide-table">
              <tr><th>คอลัมน์</th><th>ตัวอย่าง</th></tr>
              <tr><td>date</td><td>2025-11-04</td></tr>
              <tr><td>term_id</td><td>2568_1</td></tr>
              <tr><td>class_id</td><td>ม.1/1</td></tr>
              <tr><td>period_number</td><td>1</td></tr>
              <tr><td>student_code</td><td>1234</td></tr>
              <tr><td>status</td><td>มาเรียน / ขาดเรียน / มาสาย / ลาป่วย / ลากิจ / โดดเรียน</td></tr>
            </table>
          </div>
        </div>
      </el-card>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { read, utils } from 'xlsx'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '@/components/layout/AppLayout.vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// ─── State ────────────────────────────────────────────────────
const fileInfo      = ref(null)
const parsed        = ref(false)
const logsRows      = ref([])   // Sheet1 data
const attRows       = ref([])   // Sheet2 data
const validationErrors = ref([])
const importing     = ref(false)
const importProgress = ref(0)
const importDone    = ref(false)
const importResult  = ref(null)

// ─── Computed previews ────────────────────────────────────────
const logsPreview = computed(() => logsRows.value.slice(0, 5))
const attPreview  = computed(() => attRows.value.slice(0, 5))

const sheetInfo = computed(() => {
  const LOG_REQUIRED = ['date','term_id','class_id','period_number']
  const ATT_REQUIRED = ['date','class_id','period_number','student_code','status']

  const logKeys = logsRows.value.length ? Object.keys(logsRows.value[0]) : []
  const attKeys = attRows.value.length  ? Object.keys(attRows.value[0])  : []

  const logMissing = LOG_REQUIRED.filter(k => !logKeys.includes(k))
  const attMissing = ATT_REQUIRED.filter(k => !attKeys.includes(k))

  return {
    logs: {
      count: logsRows.value.length,
      ok: logsRows.value.length > 0 && logMissing.length === 0,
      error: logMissing.length ? `ไม่มีคอลัมน์: ${logMissing.join(', ')}` : '',
    },
    att: {
      count: attRows.value.length,
      ok: attRows.value.length > 0 && attMissing.length === 0,
      error: attMissing.length ? `ไม่มีคอลัมน์: ${attMissing.join(', ')}` : '',
    },
  }
})

const uniquePeriods = computed(() => {
  const s = new Set(logsRows.value.filter(r => r.is_filled !== false && String(r.is_filled).toLowerCase() !== 'false')
    .map(r => `${r.date}|${r.class_id}|${r.period_number}`))
  return s.size
})
const uniqueDates   = computed(() => new Set(logsRows.value.map(r => r.date)).size)
const uniqueClasses = computed(() => new Set(logsRows.value.map(r => r.class_id)).size)

// ─── File reading ─────────────────────────────────────────────
function onFileRemove() {
  fileInfo.value = null
  parsed.value   = false
  logsRows.value = []
  attRows.value  = []
  validationErrors.value = []
  importDone.value = false
  importResult.value = null
}

async function onFileChange(file) {
  fileInfo.value = { name: file.name, size: file.size }
  try {
    const buffer = await file.raw.arrayBuffer()
    const wb = read(buffer, { type: 'array', cellDates: false })

    // Find sheets (case-insensitive)
    const findSheet = (name) => wb.SheetNames.find(s => s.toLowerCase() === name.toLowerCase())
    const logSheet  = findSheet('teach_logs')
    const attSheet  = findSheet('student_attendance')

    if (!logSheet) { ElMessage.error('ไม่พบ Sheet ชื่อ "teach_logs" ในไฟล์'); return }
    if (!attSheet) { ElMessage.error('ไม่พบ Sheet ชื่อ "student_attendance" ในไฟล์'); return }

    logsRows.value = utils.sheet_to_json(wb.Sheets[logSheet], { defval: '' })
    attRows.value  = utils.sheet_to_json(wb.Sheets[attSheet], { defval: '' })

    // Normalize: trim strings, convert date serial if needed
    logsRows.value = logsRows.value.map(normalizeLogRow)
    attRows.value  = attRows.value.map(normalizeAttRow)

    validateData()
    parsed.value = true
  } catch (e) {
    ElMessage.error('อ่านไฟล์ไม่สำเร็จ: ' + e.message)
  }
}

// Excel อาจส่ง date เป็น serial number หรือ string
function excelDateToStr(val) {
  if (!val) return ''
  if (typeof val === 'number') {
    // Excel serial date → JS Date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().split('T')[0]
  }
  const s = String(val).trim()
  // รองรับ DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return `${yyyy}-${mm}-${dd}`
  }
  return s
}

const VALID_STATUSES = new Set(['มาเรียน','ขาดเรียน','มาสาย','ลาป่วย','ลากิจ','โดดเรียน','ไปราชการ'])

function normalizeLogRow(r) {
  return {
    date:          excelDateToStr(r.date),
    term_id:       String(r.term_id || '').trim(),
    class_id:      String(r.class_id || '').trim(),
    period_number: Number(r.period_number),
    slot_type:     String(r.slot_type || 'normal').trim().toLowerCase() || 'normal',
    teacher_name:  String(r.teacher_name || '').trim(),
    subject_name:  String(r.subject_name || '').trim(),
    topic:         String(r.topic || '').trim() || null,
    activity_type: String(r.activity_type || '').trim() || null,
    is_filled:     String(r.is_filled).toLowerCase() === 'true' || r.is_filled === true || r.is_filled === 1,
  }
}

function normalizeAttRow(r) {
  return {
    date:          excelDateToStr(r.date),
    term_id:       String(r.term_id || '').trim(),
    class_id:      String(r.class_id || '').trim(),
    period_number: Number(r.period_number),
    student_code:  String(r.student_code || '').trim(),
    status:        String(r.status || '').trim(),
  }
}

function validateData() {
  const errs = []

  logsRows.value.forEach((r, i) => {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
      errs.push({ sheet: 'teach_logs', row: i + 2, msg: `date ไม่ถูกต้อง: "${r.date}"` })
    if (!r.class_id)
      errs.push({ sheet: 'teach_logs', row: i + 2, msg: 'class_id ว่าง' })
    if (!r.term_id)
      errs.push({ sheet: 'teach_logs', row: i + 2, msg: 'term_id ว่าง' })
  })

  attRows.value.forEach((r, i) => {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
      errs.push({ sheet: 'student_attendance', row: i + 2, msg: `date ไม่ถูกต้อง: "${r.date}"` })
    if (!r.student_code)
      errs.push({ sheet: 'student_attendance', row: i + 2, msg: 'student_code ว่าง' })
    if (r.status && !VALID_STATUSES.has(r.status))
      errs.push({ sheet: 'student_attendance', row: i + 2, msg: `status ไม่รู้จัก: "${r.status}"` })
  })

  validationErrors.value = errs
}

// ─── Import ───────────────────────────────────────────────────
async function startImport() {
  if (importing.value) return

  try {
    await ElMessageBox.confirm(
      `ยืนยันนำเข้า ${uniquePeriods.value} คาบเรียน จาก ${uniqueClasses.value} ห้อง ${uniqueDates.value} วัน?\n\nคาบที่มีอยู่แล้วในระบบจะถูกเขียนทับ student_records`,
      'ยืนยัน Import',
      { confirmButtonText: 'เริ่ม Import', cancelButtonText: 'ยกเลิก', type: 'warning' }
    )
  } catch {
    return
  }

  importing.value   = true
  importProgress.value = 0
  importDone.value  = false
  importResult.value = null

  try {
    const schoolId = authStore.schoolId

    // Build student_records map: key = `date|class_id|period_number`
    const attMap = new Map()
    for (const r of attRows.value) {
      if (!r.student_code || !r.status || !VALID_STATUSES.has(r.status)) continue
      const key = `${r.date}|${r.class_id}|${r.period_number}`
      if (!attMap.has(key)) attMap.set(key, {})
      attMap.get(key)[r.student_code] = { status: r.status }
    }

    // Filter only filled logs
    const filledLogs = logsRows.value.filter(r =>
      r.is_filled && r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.class_id && r.term_id
    )

    const CHUNK = 200
    let success = 0
    let skipped = 0

    for (let i = 0; i < filledLogs.length; i += CHUNK) {
      const chunk = filledLogs.slice(i, i + CHUNK)

      const payloads = chunk.map(r => {
        const key = `${r.date}|${r.class_id}|${r.period_number}`
        const student_records = attMap.get(key) || null
        return {
          school_id:       schoolId,
          term_id:         r.term_id,
          class_id:        r.class_id,
          date:            r.date,
          period_number:   Number(r.period_number),
          slot_type:       r.slot_type || 'normal',
          teacher_plan_name: r.teacher_name || '',
          subject_plan_id: null,
          actual_teacher_id: null,
          planned_teacher_id: null,
          topic:           r.topic || null,
          activity_type:   r.activity_type || null,
          is_filled:       true,
          student_records: student_records,
          updated_at:      new Date().toISOString(),
        }
      })

      const { error } = await supabase
        .from('teach_actuals')
        .upsert(payloads, {
          onConflict: 'school_id,term_id,class_id,date,period_number',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error('Import chunk error:', error)
        skipped += chunk.length
      } else {
        success += chunk.length
      }

      importProgress.value = Math.round(((i + chunk.length) / filledLogs.length) * 100)
    }

    importResult.value = { success, skipped }
    importDone.value   = true
    ElMessage.success(`Import เสร็จสมบูรณ์: ${success} คาบ`)
  } catch (e) {
    ElMessage.error('Import ผิดพลาด: ' + e.message)
  } finally {
    importing.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function statusTagType(status) {
  if (status === 'มาเรียน') return 'success'
  if (status === 'มาสาย') return 'warning'
  if (status === 'ขาดเรียน' || status === 'โดดเรียน') return 'danger'
  if (status === 'ลาป่วย' || status === 'ลากิจ') return 'info'
  return ''
}
</script>

<style scoped>
.imp-page {
  padding: 20px 24px 48px;
  max-width: 1100px;
  margin: 0 auto;
}

.imp-header {
  background: linear-gradient(135deg,#1e3a5f,#0f766e);
  border-radius: 18px; padding: 20px 24px; margin-bottom: 20px;
  box-shadow: 0 6px 24px rgba(30,58,95,0.2);
}
.imp-title { font-size: 22px; font-weight: 800; color: white; }
.imp-sub   { font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 4px; }

.imp-card { border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.imp-card-title { font-size: 15px; font-weight: 800; color: #1e3a5f; }

/* Summary grid */
.imp-summary-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 12px;
}
@media (max-width: 800px) { .imp-summary-grid { grid-template-columns: repeat(2,1fr); } }

.imp-sum-box { border-radius: 12px; padding: 14px; text-align: center; border: 2px solid transparent; }
.imp-sum--green  { background:#dcfce7; border-color:#86efac; }
.imp-sum--red    { background:#fee2e2; border-color:#fca5a5; }
.imp-sum--blue   { background:#dbeafe; border-color:#93c5fd; }
.imp-sum--orange { background:#ffedd5; border-color:#fdba74; }

.imp-sum-num { font-size: 26px; font-weight: 900; }
.imp-sum--green  .imp-sum-num { color:#15803d; }
.imp-sum--red    .imp-sum-num { color:#dc2626; }
.imp-sum--blue   .imp-sum-num { color:#1d4ed8; }
.imp-sum--orange .imp-sum-num { color:#c2410c; }
.imp-sum-lbl { font-size: 11px; font-weight: 700; color: #475569; margin-top: 3px; }
.imp-sum-sub { font-size: 11px; color: #64748b; margin-top: 2px; }

/* Guide table */
.imp-guide-table { width:100%; border-collapse:collapse; font-size:12px; }
.imp-guide-table th { background:#f1f5f9; padding:4px 8px; text-align:left; border:1px solid #e2e8f0; font-weight:700; }
.imp-guide-table td { padding:4px 8px; border:1px solid #e2e8f0; color:#374151; }
.imp-guide-table tr:nth-child(even) td { background:#f8fafc; }

code { background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px; color:#0f766e; }
</style>
