<template>
  <div>
    <h2 class="page-title">💪 สุขภาพและการเติบโต</h2>

    <div class="intro-card">
      <div class="intro-icon">🌱</div>
      <div class="intro-text">
        <div class="intro-heading">ทำไมต้องติดตามสุขภาพ?</div>
        <div class="intro-body">การรู้จักร่างกายตัวเองเป็นก้าวแรกของการดูแลตัวเอง บันทึกน้ำหนักและส่วนสูงสม่ำเสมอช่วยให้เห็นพัฒนาการการเติบโต และค่า BMI ช่วยบอกว่าน้ำหนักของเราอยู่ในเกณฑ์ที่เหมาะสมหรือไม่ เพื่อให้มีสุขภาพที่แข็งแรงในระยะยาว</div>
      </div>
    </div>

    <!-- บันทึกวันนี้ -->
    <div class="record-card">
      <div class="record-title">📋 บันทึกวันนี้ — {{ todayThai }}</div>
      <div class="record-fields">
        <div class="field-wrap">
          <label class="field-lbl">น้ำหนัก (กก.)</label>
          <input v-model="form.weight" type="number" step="0.1" min="1" max="300" class="field-input" placeholder="เช่น 45.5" />
        </div>
        <div class="field-wrap">
          <label class="field-lbl">ส่วนสูง (ซม.)</label>
          <input v-model="form.height" type="number" step="0.1" min="50" max="250" class="field-input" placeholder="เช่น 160.0" />
        </div>
      </div>

      <!-- BMI preview -->
      <div v-if="previewBmi" class="bmi-preview">
        <div class="bmi-preview-row">
          <span class="bmi-num">{{ previewBmi }}</span>
          <span class="bmi-result" :style="{ color: bmiColor(previewBmi) }">{{ bmiLabel(previewBmi) }}</span>
        </div>
        <div class="bmi-bar-wrap">
          <div class="bmi-bar-bg">
            <div class="bmi-bar-marker" :style="{ left: bmiMarkerPct(previewBmi) + '%' }"></div>
          </div>
          <div class="bmi-bar-labels">
            <span>น้อย</span><span>ปกติ</span><span>เกิน</span><span>อ้วน</span>
          </div>
        </div>
      </div>

      <button class="save-btn" :disabled="saving || !form.weight || !form.height" @click="saveRecord">
        {{ saving ? 'กำลังบันทึก...' : '💾 บันทึก' }}
      </button>
    </div>

    <!-- ประวัติการเติบโต -->
    <div class="history-card">
      <div class="history-title">📈 พัฒนาการการเติบโต</div>
      <div v-if="!records.length" class="empty-text">ยังไม่มีข้อมูล</div>
      <div v-else>
        <!-- Mini chart (text-based) -->
        <div class="chart-area">
          <div class="chart-legend">
            <span class="leg leg--weight">⬤ น้ำหนัก (กก.)</span>
            <span class="leg leg--height">⬤ ส่วนสูง (ซม.)</span>
          </div>
          <div class="chart-bars">
            <div v-for="r in records.slice().reverse()" :key="r.id" class="chart-col">
              <div class="chart-date">{{ shortDate(r.recorded_date) }}</div>
              <div class="bar-weight-wrap">
                <div class="bar-weight" :style="{ height: weightBarH(r.weight) + 'px' }">
                  <span class="bar-tip">{{ r.weight }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="history-table">
          <div class="ht-header">
            <span>วันที่</span><span>น้ำหนัก</span><span>ส่วนสูง</span><span>BMI</span><span>ผล</span>
          </div>
          <div v-for="r in records" :key="r.id" class="ht-row">
            <span>{{ formatDate(r.recorded_date) }}</span>
            <span>{{ r.weight }} กก.</span>
            <span>{{ r.height }} ซม.</span>
            <span class="bmi-cell" :style="{ color: bmiColor(r.bmi) }">{{ r.bmi }}</span>
            <span class="bmi-result-sm" :style="{ color: bmiColor(r.bmi) }">{{ bmiLabel(r.bmi) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'

const studentStore = useStudentStore()
const session = computed(() => studentStore.session || {})
const records = ref([])
const saving = ref(false)
const form = ref({ weight: '', height: '' })

const today = new Date()
const todayStr = today.toISOString().split('T')[0]
const todayThai = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()+543}`

const previewBmi = computed(() => {
  const w = Number(form.value.weight)
  const h = Number(form.value.height)
  if (!w || !h) return null
  return +(w / ((h / 100) ** 2)).toFixed(1)
})

function bmiLabel(bmi) {
  if (!bmi) return ''
  if (bmi < 18.5) return 'น้ำหนักน้อย'
  if (bmi < 23)   return 'น้ำหนักปกติ'
  if (bmi < 25)   return 'น้ำหนักเกิน'
  return 'อ้วน'
}
function bmiColor(bmi) {
  if (!bmi) return '#6b7280'
  if (bmi < 18.5) return '#2563eb'
  if (bmi < 23)   return '#16a34a'
  if (bmi < 25)   return '#d97706'
  return '#dc2626'
}
function bmiMarkerPct(bmi) {
  // scale: 10 → 35 = 0 → 100%
  return Math.min(100, Math.max(0, ((bmi - 10) / 25) * 100))
}
function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${Number(y)+543}`
}
function shortDate(d) {
  if (!d) return ''
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}
function weightBarH(w) {
  if (!w) return 4
  const maxW = Math.max(...records.value.map(r => r.weight || 0), 1)
  return Math.max(8, (w / maxW) * 80)
}

async function loadRecords() {
  const { school_id, student_code } = session.value
  if (!school_id || !student_code) return
  const { data } = await supabase
    .from('student_health_records')
    .select('id, recorded_date, weight, height, bmi')
    .eq('school_id', school_id).eq('student_code', student_code)
    .order('recorded_date', { ascending: false })
    .limit(20)
  records.value = data || []
}

async function saveRecord() {
  const { school_id, student_code } = session.value
  const bmi = previewBmi.value
  saving.value = true
  try {
    await supabase.from('student_health_records').insert({
      school_id, student_code,
      recorded_date: todayStr,
      weight: Number(form.value.weight),
      height: Number(form.value.height),
      bmi,
    })
    form.value = { weight: '', height: '' }
    await loadRecords()
  } finally {
    saving.value = false
  }
}

onMounted(loadRecords)
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 12px; }
.intro-card {
  display: flex; gap: 12px; background: linear-gradient(135deg,#f0fdf4,#dcfce7);
  border-radius: 14px; padding: 14px; margin-bottom: 14px;
  border-left: 4px solid #22c55e;
}
.intro-icon { font-size: 28px; flex-shrink: 0; }
.intro-heading { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 4px; }
.intro-body { font-size: 13px; color: #15803d; line-height: 1.6; }

.record-card {
  background: white; border-radius: 18px; padding: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07); margin-bottom: 14px;
}
.record-title { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 14px; }
.record-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.field-wrap { display: flex; flex-direction: column; gap: 5px; }
.field-lbl { font-size: 13px; font-weight: 600; color: #6b7280; }
.field-input {
  padding: 11px 12px; border: 1.5px solid #d1d5db; border-radius: 10px;
  font-size: 16px; font-family: inherit; outline: none;
}
.field-input:focus { border-color: #6366f1; }

.bmi-preview {
  background: #f0fdf4; border-radius: 12px; padding: 14px; margin-bottom: 14px;
}
.bmi-preview-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.bmi-num { font-size: 36px; font-weight: 900; color: #1f2937; }
.bmi-result { font-size: 16px; font-weight: 700; }


.bmi-bar-bg {
  position: relative; height: 12px;
  background: linear-gradient(90deg, #3b82f6 0%, #22c55e 30%, #f59e0b 65%, #ef4444 100%);
  border-radius: 99px; margin-bottom: 4px;
}
.bmi-bar-marker {
  position: absolute; top: -3px; width: 18px; height: 18px;
  background: white; border: 3px solid #1f2937; border-radius: 50%;
  transform: translateX(-50%); transition: left .3s;
}
.bmi-bar-labels { display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }

.save-btn {
  width: 100%; padding: 13px; background: linear-gradient(135deg,#6366f1,#8b5cf6);
  color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.save-btn:disabled { opacity: .5; cursor: not-allowed; }

.history-card {
  background: white; border-radius: 18px; padding: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
}
.history-title { font-size: 15px; font-weight: 700; color: #374151; margin-bottom: 14px; }
.empty-text { text-align: center; color: #9ca3af; padding: 20px 0; font-size: 14px; }

.chart-area { margin-bottom: 16px; overflow-x: auto; }
.chart-legend { display: flex; gap: 14px; font-size: 11px; color: #6b7280; margin-bottom: 8px; }
.leg--weight { color: #6366f1; }
.leg--height { color: #10b981; }
.chart-bars { display: flex; gap: 10px; align-items: flex-end; min-height: 100px; padding-bottom: 20px; }
.chart-col { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 44px; }
.chart-date { font-size: 10px; color: #9ca3af; }
.bar-weight-wrap { display: flex; align-items: flex-end; height: 80px; }
.bar-weight {
  width: 28px; background: linear-gradient(180deg,#8b5cf6,#6366f1);
  border-radius: 6px 6px 0 0; position: relative; display: flex; align-items: flex-start;
  justify-content: center; transition: height .4s;
}
.bar-tip { font-size: 9px; color: white; font-weight: 700; padding-top: 3px; }

.history-table { font-size: 13px; }
.ht-header {
  display: grid; grid-template-columns: 1.5fr 1fr 1fr .7fr 1.2fr;
  padding: 8px 6px; background: #f8fafc; border-radius: 8px;
  font-weight: 700; color: #374151; margin-bottom: 4px; font-size: 12px;
}
.ht-row {
  display: grid; grid-template-columns: 1.5fr 1fr 1fr .7fr 1.2fr;
  padding: 10px 6px; border-bottom: 1px solid #f3f4f6;
  color: #374151;
}
.bmi-cell { font-weight: 800; }
.bmi-result-sm { font-weight: 700; font-size: 12px; }
</style>
