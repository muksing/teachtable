<template>
  <div class="pricing-settings-page">
    <div class="hero-card">
      <div>
        <p class="hero-kicker">SuperAdmin Pricing Console</p>
        <h1>ตั้งค่าสูตรคำนวณราคาแพ็กเกจ</h1>
        <p class="hero-desc">โครงสร้างสีแยกหมวดชัดเจน อ่านง่าย และเน้นตัวเลขสำคัญสำหรับตัดสินใจเร็ว</p>
      </div>
      <el-button type="primary" size="large" :loading="saving" @click="saveFormula">บันทึกสูตร</el-button>
    </div>

    <div class="sections-grid">
      <el-card class="section-card section-blaze">
        <template #header><div class="section-title">ราคาโควต้า Blaze (บาท / 100k ops)</div></template>
        <el-form label-position="top" class="form-grid">
          <el-form-item label="Read">
            <el-input-number v-model="form.read_price_per_100k" :min="0" :step="0.01" :precision="4" class="full" />
          </el-form-item>
          <el-form-item label="Write">
            <el-input-number v-model="form.write_price_per_100k" :min="0" :step="0.01" :precision="4" class="full" />
          </el-form-item>
          <el-form-item label="Delete">
            <el-input-number v-model="form.delete_price_per_100k" :min="0" :step="0.01" :precision="4" class="full" />
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="section-card section-usage">
        <template #header><div class="section-title">พฤติกรรมการใช้งาน</div></template>
        <el-form label-position="top" class="form-grid">
          <el-form-item label="Slot Fill Rate (0.1 - 1)">
            <el-input-number v-model="form.slot_fill_rate" :min="0.1" :max="1" :step="0.05" :precision="2" class="full" />
          </el-form-item>
          <el-form-item label="สลับเฉลี่ยต่อคาบ">
            <el-input-number v-model="form.swap_per_slot" :min="0" :max="15" :step="1" class="full" />
          </el-form-item>
          <el-form-item label="Auto Place Ratio (0 - 1)">
            <el-input-number v-model="form.auto_place_ratio" :min="0" :max="1" :step="0.05" :precision="2" class="full" />
          </el-form-item>
          <el-form-item label="กิจกรรมต่อครู (เอกสาร/คน)">
            <el-input-number v-model="form.activities_per_teacher" :min="0" :max="10" :step="1" class="full" />
          </el-form-item>
          <el-form-item label="กำกับดูแลต่อครู (เอกสาร/คน)">
            <el-input-number v-model="form.supervision_per_teacher" :min="0" :max="10" :step="1" class="full" />
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="section-card section-sales">
        <template #header><div class="section-title">การตั้งราคาขาย</div></template>
        <el-form label-position="top" class="form-grid">
          <el-form-item label="Ops Fee รายเดือน (บาท)">
            <el-input-number v-model="form.ops_fee_monthly" :min="0" :step="10" class="full" />
          </el-form-item>
          <el-form-item label="Profit Multiplier">
            <el-input-number v-model="form.profit_multiplier" :min="1" :step="0.1" :precision="2" class="full" />
          </el-form-item>
          <el-form-item label="ปัดราคาเป็นขั้น (บาท)">
            <el-select v-model="form.rounding_step" class="full-select">
              <el-option :value="1" label="1" />
              <el-option :value="5" label="5" />
              <el-option :value="10" label="10" />
              <el-option :value="50" label="50" />
              <el-option :value="100" label="100" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="section-card section-discount">
        <template #header><div class="section-title">ส่วนลดระยะเวลา</div></template>
        <el-form label-position="top" class="form-grid">
          <el-form-item label="3 เดือน (%)">
            <el-input-number v-model="form.discount_3m_percent" :min="0" :max="100" :step="1" class="full" />
          </el-form-item>
          <el-form-item label="6 เดือน (%)">
            <el-input-number v-model="form.discount_6m_percent" :min="0" :max="100" :step="1" class="full" />
          </el-form-item>
          <el-form-item label="12 เดือน (%)">
            <el-input-number v-model="form.discount_12m_percent" :min="0" :max="100" :step="1" class="full" />
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card class="section-card preview-card">
      <template #header><div class="section-title">ตัวอย่างผลลัพธ์</div></template>

      <div class="preview-grid">
        <el-form-item label="ห้องเรียน"><el-input-number v-model="preview.rooms" :min="1" :step="1" class="full" /></el-form-item>
        <el-form-item label="วัน/สัปดาห์"><el-input-number v-model="preview.days" :min="1" :max="7" :step="1" class="full" /></el-form-item>
        <el-form-item label="คาบ/วัน"><el-input-number v-model="preview.periods" :min="1" :max="20" :step="1" class="full" /></el-form-item>
        <el-form-item label="คนจัดพร้อมกัน"><el-input-number v-model="preview.concurrent" :min="1" :max="30" :step="1" class="full" /></el-form-item>
        <el-form-item label="จำนวนครู"><el-input-number v-model="preview.teachers" :min="1" :step="1" class="full" /></el-form-item>
        <el-form-item label="Auto runs"><el-input-number v-model="preview.autoRuns" :min="0" :max="100" :step="1" class="full" /></el-form-item>
        <el-form-item label="ล้างใหม่"><el-input-number v-model="preview.resetCycles" :min="0" :max="30" :step="1" class="full" /></el-form-item>
        <el-form-item label="เดือน">
          <el-select v-model="preview.months" class="full-select">
            <el-option :value="1" label="1" />
            <el-option :value="3" label="3" />
            <el-option :value="6" label="6" />
            <el-option :value="12" label="12" />
          </el-select>
        </el-form-item>
      </div>

      <div class="metrics-grid">
        <div class="metric-item reads"><span>Reads</span><strong>{{ number(model.readTotal) }}</strong></div>
        <div class="metric-item writes"><span>Writes</span><strong>{{ number(model.writeTotal) }}</strong></div>
        <div class="metric-item deletes"><span>Deletes</span><strong>{{ number(model.deleteTotal) }}</strong></div>
        <div class="metric-item blaze"><span>Blaze / เดือน</span><strong>{{ currency(model.blazeCost) }}</strong></div>
        <div class="metric-item monthly"><span>ราคาแนะนำ / เดือน</span><strong>{{ currency(model.monthly) }}</strong></div>
        <div class="metric-item total"><span>ยอดสุทธิ {{ preview.months }} เดือน</span><strong>{{ currency(totalModel.total) }}</strong></div>
      </div>

      <div class="summary-bar">
        <el-tag effect="dark" type="success">ส่วนลด {{ discountPercent }}%</el-tag>
        <span>ประหยัด {{ currency(totalModel.discount) }}</span>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  DEFAULT_PRICING_FORMULA,
  usePricingFormula,
  normalizePricingFormula,
  calcFormulaMonthly,
  calcFormulaTotal,
  getDiscountPercent,
} from '@/composables/usePricingFormula'

const authStore = useAuthStore()
const { getPricingFormula, savePricingFormula } = usePricingFormula()

const saving = ref(false)
const form = reactive({ ...DEFAULT_PRICING_FORMULA })
const preview = reactive({
  rooms: 12,
  days: 5,
  periods: 8,
  concurrent: 3,
  teachers: 15,
  autoRuns: 2,
  resetCycles: 1,
  months: 6,
})

const normalized = computed(() => normalizePricingFormula(form))
const model = computed(() => calcFormulaMonthly(preview, normalized.value))
const discountPercent = computed(() => getDiscountPercent(preview.months, normalized.value))
const totalModel = computed(() => calcFormulaTotal(model.value.monthly, preview.months, discountPercent.value))

function currency(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท'
}

function number(n) {
  return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

async function loadFormula() {
  const result = await getPricingFormula()
  if (!result.success) {
    ElMessage.error(result.error || 'โหลดสูตรไม่สำเร็จ')
    return
  }
  Object.assign(form, result.data)
}

async function saveFormula() {
  saving.value = true
  try {
    const uid = authStore.profile?.uid || ''
    const result = await savePricingFormula(normalized.value, uid)
    if (!result.success) {
      ElMessage.error(result.error || 'บันทึกสูตรไม่สำเร็จ')
      return
    }
    ElMessage.success('บันทึกสูตรคำนวณเรียบร้อยแล้ว')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadFormula()
})
</script>

<style scoped>
.pricing-settings-page {
  --c-bg: #f4f8ff;
  --c-text: #0f172a;
  --c-muted: #64748b;
  padding: 18px;
  background:
    radial-gradient(circle at 8% 5%, #dbeafe 0%, transparent 28%),
    radial-gradient(circle at 92% 2%, #fde68a 0%, transparent 24%),
    var(--c-bg);
  min-height: 100vh;
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  padding: 18px;
  border-radius: 16px;
  margin-bottom: 14px;
  background: linear-gradient(120deg, #0ea5e9, #2563eb 55%, #1d4ed8);
  color: #fff;
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.25);
}

.hero-kicker {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  opacity: 0.85;
}

.hero-card h1 {
  margin: 3px 0 5px;
  font-size: 28px;
}

.hero-desc {
  margin: 0;
  opacity: 0.95;
}

.sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 12px;
}

.section-card {
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.section-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--c-text);
}

.section-blaze {
  background: linear-gradient(180deg, #f0f9ff, #ffffff 35%);
}

.section-usage {
  background: linear-gradient(180deg, #ecfdf5, #ffffff 35%);
}

.section-sales {
  background: linear-gradient(180deg, #fff7ed, #ffffff 35%);
}

.section-discount {
  background: linear-gradient(180deg, #f5f3ff, #ffffff 35%);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.full,
.full-select {
  width: 100%;
}

.preview-card {
  margin-top: 12px;
  background: linear-gradient(180deg, #f8fafc, #ffffff 25%);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
}

.metrics-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.metric-item {
  border-radius: 12px;
  padding: 10px;
  border: 1px solid #dbeafe;
  background: #fff;
}

.metric-item span {
  display: block;
  font-size: 12px;
  color: var(--c-muted);
}

.metric-item strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  color: var(--c-text);
}

.metric-item.reads {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.metric-item.writes {
  background: #ecfdf5;
  border-color: #86efac;
}

.metric-item.deletes {
  background: #fef2f2;
  border-color: #fecaca;
}

.metric-item.blaze {
  background: #fff7ed;
  border-color: #fdba74;
}

.metric-item.monthly {
  background: #f5f3ff;
  border-color: #c4b5fd;
}

.metric-item.total {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.summary-bar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 600;
}

:deep(.el-form-item__label) {
  color: #334155;
  font-weight: 700;
}

:deep(.el-card__header) {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(99, 102, 241, 0.08));
}

:deep(.el-input-number .el-input__wrapper),
:deep(.el-input .el-input__wrapper),
:deep(.el-select .el-input__wrapper),
:deep(.el-date-editor.el-input .el-input__wrapper),
:deep(.el-textarea__inner) {
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  box-shadow: 0 0 0 1px rgba(191, 219, 254, 0.25) inset;
}

:deep(.el-input-number .el-input-group__prepend),
:deep(.el-input-number .el-input-group__append) {
  background: #e0f2fe;
  border-color: #93c5fd;
  color: #1d4ed8;
}

:deep(.el-input-number .el-input-number__decrease),
:deep(.el-input-number .el-input-number__increase) {
  background: #e0f2fe;
  color: #1d4ed8;
}

:deep(.el-radio__inner) {
  border-color: #60a5fa;
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
  border-color: #2563eb;
  background: #2563eb;
}

:deep(.el-select .el-input.is-focus .el-input__wrapper),
:deep(.el-input-number.is-focus .el-input__wrapper),
:deep(.el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #22c55e, #0ea5e9);
  border-color: transparent;
}

@media (max-width: 1000px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .preview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .hero-card {
    flex-direction: column;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .hero-card h1 {
    font-size: 22px;
  }
}
</style>
