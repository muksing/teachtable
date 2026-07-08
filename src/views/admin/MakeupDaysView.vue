<template>
  <AppLayout>
    <div class="md-page">

      <!-- ══ Hero ══ -->
      <div class="md-hero">
        <div class="md-hero-left">
          <div class="md-hero-icon">📆</div>
          <div>
            <h1 class="md-title">วันเรียนชดเชย</h1>
            <p class="md-sub">กำหนดวันชดเชย · ระบบสร้าง teach_actuals อัตโนมัติตามตารางวันที่อ้างอิง</p>
          </div>
        </div>
        <button class="md-btn-create" @click="openCreate">+ กำหนดวันชดเชยใหม่</button>
      </div>

      <!-- ══ Summary ══ -->
      <div class="md-summary-row">
        <div class="md-sc md-sc--blue">
          <div class="md-sc-icon">📅</div>
          <div class="md-sc-num">{{ makeupDays.length }}</div>
          <div class="md-sc-label">ทั้งหมด</div>
        </div>
        <div class="md-sc md-sc--green">
          <div class="md-sc-icon">✅</div>
          <div class="md-sc-num">{{ makeupDays.filter(d => d.actuals_generated).length }}</div>
          <div class="md-sc-label">สร้างคาบแล้ว</div>
        </div>
        <div class="md-sc md-sc--amber">
          <div class="md-sc-icon">⏳</div>
          <div class="md-sc-num">{{ makeupDays.filter(d => !d.actuals_generated && d.makeup_date >= today).length }}</div>
          <div class="md-sc-label">รอสร้างคาบ</div>
        </div>
      </div>

      <!-- ══ List ══ -->
      <div v-if="!makeupDays.length && !loading" class="md-empty">
        <div style="font-size:3rem">📆</div>
        <div class="md-empty-text">ยังไม่มีวันเรียนชดเชย</div>
      </div>

      <div v-loading="loading" class="md-list">
        <div v-for="item in makeupDays" :key="item.id" class="md-card">
          <div class="md-card-left">
            <div class="md-day-badge" :class="item.actuals_generated ? 'done' : 'pending'">
              <div class="md-day-num">{{ dayOf(item.makeup_date) }}</div>
              <div class="md-day-month">{{ monthOf(item.makeup_date) }}</div>
            </div>
            <div>
              <div class="md-card-title">
                {{ fmtDateThai(item.makeup_date) }}
                <span class="md-card-dayname">({{ jsDateDayName(item.makeup_date) }})</span>
              </div>
              <div class="md-card-ref">
                ใช้ตารางวัน <b>{{ DAY_NAMES[item.reference_day] }}</b>
              </div>
              <div class="md-card-reason" v-if="item.reason">📝 {{ item.reason }}</div>
              <div class="md-card-by">บันทึกโดย {{ item.created_by || '—' }}</div>
            </div>
          </div>
          <div class="md-card-right">
            <span v-if="item.actuals_generated" class="md-badge md-badge--green">✅ สร้างคาบแล้ว</span>
            <span v-else class="md-badge md-badge--amber">⏳ ยังไม่สร้างคาบ</span>
            <div class="md-card-actions">
              <button v-if="!item.actuals_generated" class="md-btn-gen" @click="generateActuals(item)" :disabled="generating === item.id">
                {{ generating === item.id ? '⏳...' : '⚡ สร้าง teach_actuals' }}
              </button>
              <button class="md-btn-del" @click="deleteItem(item)">🗑</button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ══ Create Dialog ══ -->
    <el-dialog v-model="createDialog" width="600px" :close-on-click-modal="false" class="md-dialog">
      <template #header>
        <div class="md-dlg-header">
          <span>📆</span>
          <div>
            <div class="md-dlg-title">กำหนดวันเรียนชดเชย</div>
            <div class="md-dlg-sub">ระบบจะสร้าง teach_actuals จากตารางของวันที่อ้างอิง</div>
          </div>
        </div>
      </template>

      <div class="md-form">

        <div class="md-section md-section--blue">
          <div class="md-section-label">📅 วันที่และตารางอ้างอิง</div>
          <div class="md-field-row">
            <div class="md-field">
              <label class="md-label">วันที่ชดเชย <span class="req">*</span></label>
              <el-date-picker v-model="form.makeup_date" type="date" value-format="YYYY-MM-DD"
                style="width:100%" placeholder="เลือกวันที่" />
              <div v-if="form.makeup_date" class="md-field-hint">
                {{ fmtDateThai(form.makeup_date) }} ({{ jsDateDayName(form.makeup_date) }})
              </div>
            </div>
            <div class="md-field">
              <label class="md-label">ใช้ตารางวัน <span class="req">*</span></label>
              <el-select v-model="form.reference_day" style="width:100%" placeholder="เลือกวัน" @change="loadPreview">
                <el-option v-for="(name, num) in DAY_NAMES" :key="num" :label="name" :value="Number(num)" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="md-section md-section--amber">
          <div class="md-section-label">📝 รายละเอียด</div>
          <div class="md-field">
            <label class="md-label">เหตุผล / หมายเหตุ</label>
            <el-input v-model="form.reason" type="textarea" :rows="2"
              placeholder="เช่น ชดเชยวันหยุดนักขัตฤกษ์ / ชดเชยวันที่ 12 กรกฎาคม..." />
          </div>
        </div>

        <!-- Preview -->
        <div v-if="preview.loaded" class="md-section md-section--green">
          <div class="md-section-label">👁 ตัวอย่างคาบที่จะสร้าง</div>
          <div v-if="preview.loading" class="md-preview-loading">⏳ กำลังโหลด...</div>
          <div v-else>
            <div class="md-preview-stats">
              <span class="md-prev-badge">📚 {{ preview.totalSlots }} คาบ</span>
              <span class="md-prev-badge">🏫 {{ preview.classCount }} ห้อง</span>
              <span class="md-prev-badge">👨‍🏫 {{ preview.teacherCount }} ครู</span>
            </div>
            <div class="md-preview-table-wrap">
              <table class="md-preview-table">
                <thead><tr><th>ห้อง</th><th>คาบ</th><th>วิชา</th><th>ครู</th></tr></thead>
                <tbody>
                  <tr v-for="(r,i) in preview.rows" :key="i">
                    <td>{{ r.class_id }}</td>
                    <td>{{ r.period_number }}</td>
                    <td>{{ r.subject_id || '—' }}</td>
                    <td>{{ r.teacher_id || '—' }}</td>
                  </tr>
                  <tr v-if="preview.totalSlots > 15">
                    <td colspan="4" class="md-preview-more">... และอีก {{ preview.totalSlots - 15 }} คาบ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="md-announce-toggle">
          <el-checkbox v-model="form.sendAnnouncement">📣 ส่งประกาศแจ้งเตือนครูทุกคน</el-checkbox>
        </div>

      </div>

      <template #footer>
        <div class="md-dlg-footer">
          <button class="md-btn-cancel" @click="createDialog=false">ยกเลิก</button>
          <button class="md-btn-preview" :disabled="!form.reference_day || preview.loading" @click="loadPreview">
            🔍 ดูตัวอย่าง
          </button>
          <button class="md-btn-save" :disabled="saving || !form.makeup_date || !form.reference_day" @click="saveItem">
            {{ saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกและสร้างคาบ' }}
          </button>
        </div>
      </template>
    </el-dialog>

  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'
import { useTimetableSource } from '@/composables/useTimetableSource'
import AppLayout from '@/components/layout/AppLayout.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const authStore   = useAuthStore()
const schoolStore = useSchoolStore()
const { slotTable } = useTimetableSource()
const schoolId    = () => authStore.schoolId
const today = new Date().toLocaleDateString('sv-SE')

const DAY_NAMES = { 1:'จันทร์', 2:'อังคาร', 3:'พุธ', 4:'พฤหัสบดี', 5:'ศุกร์', 6:'เสาร์' }
const THAI_DAY_NUM = { จันทร์:1, อังคาร:2, พุธ:3, พฤหัสบดี:4, ศุกร์:5, เสาร์:6, อาทิตย์:7 }
const JS_DAY_NAMES = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

// ── State ──
const loading    = ref(false)
const saving     = ref(false)
const generating = ref(null)
const makeupDays = ref([])
const createDialog = ref(false)

const form = ref({
  makeup_date: '',
  reference_day: null,
  reason: '',
  sendAnnouncement: true,
})

const preview = ref({ loaded: false, loading: false, rows: [], totalSlots: 0, classCount: 0, teacherCount: 0 })

// ── Load ──
onMounted(loadList)

async function loadList() {
  loading.value = true
  const { data } = await supabase.from('makeup_days').select('*')
    .eq('school_id', schoolId()).order('makeup_date', { ascending: false })
  makeupDays.value = data || []
  loading.value = false
}

// ── Paginate helper ──
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

// ── Load slots for reference day ──
async function loadSlotsForDay(refDay) {
  const tid = schoolStore.currentTerm
  const slots = await paginate((f, t) =>
    supabase.from(slotTable.value)
      .select('class_id,period_number,subject_id,teacher_id,day_of_week,slot_type')
      .eq('school_id', schoolId()).eq('term_id', tid)
      .not('slot_type', 'in', '("activity","manual_lock","homeroom")')
      .range(f, t)
  )
  return slots.filter(s => {
    const d = Number(s.day_of_week) || THAI_DAY_NUM[s.day_of_week] || 0
    return d === refDay
  })
}

// ── Preview ──
async function loadPreview() {
  if (!form.value.reference_day) return
  preview.value = { loaded: true, loading: true, rows: [], totalSlots: 0, classCount: 0, teacherCount: 0 }
  try {
    const slots = await loadSlotsForDay(form.value.reference_day)
    const classes  = new Set(slots.map(s => s.class_id))
    const teachers = new Set(slots.map(s => s.teacher_id).filter(Boolean))
    preview.value = {
      loaded: true, loading: false,
      rows: slots.slice(0, 15),
      totalSlots: slots.length,
      classCount: classes.size,
      teacherCount: teachers.size,
    }
  } catch (e) {
    preview.value.loading = false
    ElMessage.error('โหลด preview ไม่ได้: ' + e.message)
  }
}

// ── Generate teach_actuals for a specific date ──
async function generateForDate(makeupDate, refDay) {
  const tid = schoolStore.currentTerm
  const sid = schoolId()

  const slots = await loadSlotsForDay(refDay)
  if (!slots.length) {
    ElMessage.warning('ไม่พบคาบในตารางวัน' + DAY_NAMES[refDay])
    return 0
  }

  // หา existing teach_actuals ของวันนั้น
  const { data: existing } = await supabase.from('teach_actuals')
    .select('class_id,period_number')
    .eq('school_id', sid).eq('date', makeupDate)
  const existSet = new Set((existing || []).map(r => `${r.class_id}|${r.period_number}`))

  // สร้าง payloads เฉพาะที่ยังไม่มี
  const payloads = slots
    .filter(s => !existSet.has(`${s.class_id}|${s.period_number}`))
    .map(s => ({
      school_id: sid,
      term_id: tid,
      class_id: s.class_id,
      date: makeupDate,
      period_number: Number(s.period_number),
      subject_id: s.subject_id || null,
      planned_teacher_id: s.teacher_id || null,
      actual_teacher_id: null,
      slot_type: s.slot_type || 'normal',
      is_filled: false,
    }))

  // Insert เป็น chunk
  const CHUNK = 400
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const { error } = await supabase.from('teach_actuals')
      .upsert(payloads.slice(i, i + CHUNK), {
        onConflict: 'school_id,term_id,class_id,date,period_number',
        ignoreDuplicates: true,
      })
    if (error) throw error
  }
  return payloads.length
}

// ── Save ──
async function saveItem() {
  const f = form.value
  if (!f.makeup_date) { ElMessage.error('กรุณาเลือกวันที่ชดเชย'); return }
  if (!f.reference_day) { ElMessage.error('กรุณาเลือกวันที่อ้างอิง'); return }

  saving.value = true
  try {
    // 1. บันทึก makeup_day
    const { data: newRow, error: dbErr } = await supabase.from('makeup_days').insert([{
      school_id: schoolId(),
      makeup_date: f.makeup_date,
      reference_day: f.reference_day,
      term_id: schoolStore.currentTerm || '',
      reason: f.reason || null,
      created_by: authStore.profile?.displayName || '',
      actuals_generated: false,
    }]).select('id').single()
    if (dbErr) throw dbErr

    // 2. สร้าง teach_actuals
    const count = await generateForDate(f.makeup_date, f.reference_day)

    // 3. Mark generated
    await supabase.from('makeup_days').update({ actuals_generated: true }).eq('id', newRow.id)

    // 4. ส่งประกาศ
    if (f.sendAnnouncement) {
      await sendAnnouncement(f.makeup_date, f.reference_day, f.reason)
    }

    ElMessage.success(`บันทึกเรียบร้อย · สร้าง ${count} คาบสำหรับ ${fmtDateThai(f.makeup_date)}`)
    createDialog.value = false
    await loadList()
  } catch (e) {
    ElMessage.error('ไม่สำเร็จ: ' + e.message)
  } finally {
    saving.value = false
  }
}

// ── Generate (สำหรับรายการที่ยังไม่ได้ generate) ──
async function generateActuals(item) {
  generating.value = item.id
  try {
    const count = await generateForDate(item.makeup_date, item.reference_day)
    await supabase.from('makeup_days').update({ actuals_generated: true }).eq('id', item.id)
    item.actuals_generated = true
    ElMessage.success(`สร้าง ${count} คาบสำเร็จ`)
  } catch (e) {
    ElMessage.error('ไม่สำเร็จ: ' + e.message)
  } finally {
    generating.value = null
  }
}

// ── Announcement ──
async function sendAnnouncement(makeupDate, refDay, reason) {
  try {
    const content = `📆 แจ้งวันเรียนชดเชย\n` +
      `วันที่ ${fmtDateThai(makeupDate)} (${jsDateDayName(makeupDate)}) ` +
      `ใช้ตารางสอนของวัน${DAY_NAMES[refDay]}` +
      (reason ? `\nเหตุผล: ${reason}` : '')
    await supabase.from('announcements').insert([{
      school_id: schoolId(),
      content,
      type: 'makeup_day',
      author_name: authStore.profile?.displayName || 'Admin',
      author_role: 'admin',
      target_teacher_id: null,
      created_at: new Date().toISOString(),
    }])
  } catch { /* ถ้า announcements table ไม่มี ไม่ต้องหยุด */ }
}

// ── Delete ──
async function deleteItem(item) {
  await ElMessageBox.confirm(
    `ลบวันชดเชย ${fmtDateThai(item.makeup_date)}?\n` +
    (item.actuals_generated ? '⚠️ teach_actuals ที่สร้างไปแล้วจะไม่ถูกลบ' : ''),
    'ยืนยันลบ', { type: 'warning', confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' }
  )
  await supabase.from('makeup_days').delete().eq('id', item.id)
  ElMessage.success('ลบเรียบร้อย')
  await loadList()
}

// ── Open create ──
function openCreate() {
  form.value = { makeup_date: '', reference_day: null, reason: '', sendAnnouncement: true }
  preview.value = { loaded: false, loading: false, rows: [], totalSlots: 0, classCount: 0, teacherCount: 0 }
  createDialog.value = true
}

// ── Utils ──
function fmtDateThai(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}
function dayOf(d) { return d ? new Date(d + 'T00:00:00').getDate() : '' }
function monthOf(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }) : '' }
function jsDateDayName(d) { if (!d) return ''; return JS_DAY_NAMES[new Date(d + 'T00:00:00').getDay()] }
</script>

<style scoped>
.md-page { padding: 24px; max-width: 900px; margin: 0 auto; }

/* Hero */
.md-hero { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,#1e3a5f,#1d4ed8,#3b82f6); border-radius: 16px; padding: 20px 24px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.md-hero-left { display: flex; align-items: center; gap: 14px; }
.md-hero-icon { font-size: 2.2rem; }
.md-title { font-size: 1.4rem; font-weight: 800; color: #fff; margin: 0 0 2px; }
.md-sub   { color: #bfdbfe; font-size: .82rem; margin: 0; }
.md-btn-create { background: #fff; color: #1d4ed8; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 700; cursor: pointer; font-size: .9rem; }

/* Summary */
.md-summary-row { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.md-sc { flex: 1; min-width: 120px; border-radius: 14px; padding: 16px 18px; color: #fff; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,.12); }
.md-sc--blue  { background: linear-gradient(135deg,#3b82f6,#2563eb); }
.md-sc--green { background: linear-gradient(135deg,#22c55e,#16a34a); }
.md-sc--amber { background: linear-gradient(135deg,#f59e0b,#d97706); }
.md-sc-icon { font-size: 1.4rem; }
.md-sc-num  { font-size: 2rem; font-weight: 800; line-height: 1.1; }
.md-sc-label{ font-size: .74rem; opacity: .85; }

/* Empty */
.md-empty { text-align: center; padding: 60px 20px; color: #94a3b8; }
.md-empty-text { margin-top: 8px; }

/* List */
.md-list { display: flex; flex-direction: column; gap: 10px; }
.md-card { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,.07); gap: 16px; flex-wrap: wrap; border-left: 4px solid #3b82f6; }
.md-card-left { display: flex; align-items: center; gap: 16px; flex: 1; }
.md-day-badge { text-align: center; min-width: 54px; padding: 8px 10px; border-radius: 10px; }
.md-day-badge.done    { background: #dcfce7; color: #16a34a; }
.md-day-badge.pending { background: #fef3c7; color: #b45309; }
.md-day-num   { font-size: 1.6rem; font-weight: 800; line-height: 1; }
.md-day-month { font-size: .7rem; margin-top: 2px; }
.md-card-title   { font-weight: 700; color: #1e293b; font-size: .95rem; }
.md-card-dayname { font-weight: 400; color: #64748b; font-size: .85rem; }
.md-card-ref     { font-size: .83rem; color: #3b82f6; font-weight: 600; margin: 2px 0; }
.md-card-reason  { font-size: .78rem; color: #64748b; }
.md-card-by      { font-size: .73rem; color: #94a3b8; margin-top: 2px; }
.md-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.md-badge { font-size: .78rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
.md-badge--green { background: #dcfce7; color: #16a34a; }
.md-badge--amber { background: #fef3c7; color: #b45309; }
.md-card-actions { display: flex; gap: 6px; }
.md-btn-gen { background: linear-gradient(135deg,#f59e0b,#d97706); color: #fff; border: none; border-radius: 7px; padding: 6px 12px; font-size: .8rem; font-weight: 700; cursor: pointer; }
.md-btn-gen:disabled { opacity: .6; cursor: not-allowed; }
.md-btn-del { background: #fee2e2; border: none; color: #dc2626; border-radius: 7px; padding: 6px 10px; cursor: pointer; font-size: .85rem; }

/* Dialog */
.md-dlg-header { display: flex; align-items: center; gap: 12px; }
.md-dlg-header span { font-size: 1.6rem; }
.md-dlg-title { font-size: 1.1rem; font-weight: 800; color: #1e293b; }
.md-dlg-sub { font-size: .78rem; color: #64748b; }
.md-form { display: flex; flex-direction: column; gap: 12px; max-height: 65vh; overflow-y: auto; padding: 2px; }
.md-section { border-radius: 12px; padding: 14px 16px; }
.md-section--blue  { background: linear-gradient(135deg,#eff6ff,#dbeafe); border: 1px solid #bfdbfe; }
.md-section--amber { background: linear-gradient(135deg,#fffbeb,#fef3c7); border: 1px solid #fde68a; }
.md-section--green { background: linear-gradient(135deg,#f0fdf4,#dcfce7); border: 1px solid #bbf7d0; }
.md-section-label { font-size: .8rem; font-weight: 800; color: #374151; margin-bottom: 10px; }
.md-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.md-field { display: flex; flex-direction: column; gap: 5px; }
.md-label { font-size: .78rem; font-weight: 700; color: #374151; }
.md-label .req { color: #dc2626; }
.md-field-hint { font-size: .74rem; color: #3b82f6; }

/* Preview */
.md-preview-loading { color: #64748b; font-size: .85rem; padding: 8px 0; }
.md-preview-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.md-prev-badge { background: #fff; border: 1px solid #bbf7d0; color: #16a34a; font-size: .78rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
.md-preview-table-wrap { max-height: 200px; overflow-y: auto; border-radius: 8px; border: 1px solid #bbf7d0; }
.md-preview-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
.md-preview-table th, .md-preview-table td { border-bottom: 1px solid #f0fdf4; padding: 5px 8px; }
.md-preview-table th { background: #dcfce7; color: #166534; font-weight: 700; position: sticky; top: 0; }
.md-preview-more { text-align: center; color: #64748b; font-style: italic; padding: 8px; }

.md-announce-toggle { padding: 8px 4px; }
.md-dlg-footer { display: flex; justify-content: flex-end; gap: 8px; }
.md-btn-cancel  { background: #f1f5f9; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; color: #475569; }
.md-btn-preview { background: #e0f2fe; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; color: #0369a1; }
.md-btn-preview:disabled { opacity: .5; cursor: not-allowed; }
.md-btn-save    { background: linear-gradient(135deg,#1d4ed8,#2563eb); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 700; cursor: pointer; }
.md-btn-save:disabled { opacity: .5; cursor: not-allowed; }
</style>
