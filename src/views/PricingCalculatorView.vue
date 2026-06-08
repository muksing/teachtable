<template>
  <div class="pricing-page">
    <div class="pricing-glow pricing-glow-a" />
    <div class="pricing-glow pricing-glow-b" />

    <div class="pricing-wrap">
      <section class="hero">
        <p class="hero-kicker">Blaze Cost Estimator</p>
        <h1>คำนวณราคาแพ็กเกจจากการใช้โควต้า Blaze ตามรูปแบบใช้งานจริง</h1>
        <p>
          สูตรนี้ประมาณการจากจำนวนห้องเรียน, วันจัด, คาบที่จัด, จำนวนผู้จัดพร้อมกัน,
          จำนวนครั้งจัดอัตโนมัติ และรอบล้างใหม่จัดใหม่ในเดือนนั้น
        </p>
      </section>

      <section class="panel input-panel">
        <h3>ตัวแปรการใช้งานรอบนี้</h3>
        <el-form label-position="top" class="grid-form">
          <el-form-item label="จำนวนห้องเรียน">
            <el-input-number v-model="input.rooms" :min="1" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="จำนวนวันที่จัดต่อสัปดาห์">
            <el-input-number v-model="input.days" :min="1" :max="7" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="จำนวนคาบที่จัดต่อวัน">
            <el-input-number v-model="input.periods" :min="1" :max="20" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="จำนวนคนที่จัดพร้อมกัน">
            <el-input-number v-model="input.concurrent" :min="1" :max="30" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="จำนวนครูทั้งหมด">
            <el-input-number v-model="input.teachers" :min="1" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="จำนวนครั้งจัดอัตโนมัติในรอบนี้">
            <el-input-number v-model="input.autoRuns" :min="0" :max="100" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="จำนวนรอบล้างใหม่จัดใหม่ในเดือนนี้">
            <el-input-number v-model="input.resetCycles" :min="0" :max="30" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="ระยะเวลาใช้งาน (เดือน)">
            <el-radio-group v-model="input.months" class="month-group">
              <el-radio-button :label="1">1 เดือน</el-radio-button>
              <el-radio-button :label="3">3 เดือน</el-radio-button>
              <el-radio-button :label="6">6 เดือน</el-radio-button>
              <el-radio-button :label="12">12 เดือน</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <el-alert
          v-if="!isLoggedIn"
          type="info"
          :closable="false"
          title="โหมดสาธารณะ: ใช้สูตรตั้งต้น หากต้องการค่าจริงให้ SuperAdmin เข้าระบบและตั้งค่าราคา Blaze"
        />
      </section>

      <section class="panel result-panel">
        <div class="result-head">
          <h3>ผลประมาณการต้นทุนและราคา</h3>
          <el-tag type="warning">Discount {{ discountPercent }}%</el-tag>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span>Slot ประมาณการ</span>
            <strong>{{ number(blaze.slotCount) }}</strong>
          </div>
          <div class="metric-card">
            <span>ครั้งสลับรวม</span>
            <strong>{{ number(blaze.swapEvents) }}</strong>
          </div>
          <div class="metric-card">
            <span>Reads</span>
            <strong>{{ number(blaze.readTotal) }}</strong>
          </div>
          <div class="metric-card">
            <span>Writes</span>
            <strong>{{ number(blaze.writeTotal) }}</strong>
          </div>
          <div class="metric-card">
            <span>Deletes</span>
            <strong>{{ number(blaze.deleteTotal) }}</strong>
          </div>
          <div class="metric-card">
            <span>Blaze Cost / เดือน</span>
            <strong>{{ currency(blaze.blazeCost) }}</strong>
          </div>
          <div class="metric-card metric-card-highlight">
            <span>ราคาขายแนะนำ / เดือน</span>
            <strong>{{ currency(monthlyModel.monthly) }}</strong>
          </div>
          <div class="metric-card metric-card-highlight">
            <span>ยอดสุทธิ {{ input.months }} เดือน</span>
            <strong>{{ currency(totalModel.total) }}</strong>
          </div>
        </div>

        <el-table :data="computedRows" border stripe empty-text="ไม่พบแพ็กเกจที่ใช้งานได้" style="margin-top: 12px">
          <el-table-column label="แพ็กเกจ" min-width="170">
            <template #default="scope">
              <div class="pkg-name">{{ scope.row.name || scope.row.code }}</div>
              <div class="pkg-code">รหัส: {{ scope.row.code }}</div>
            </template>
          </el-table-column>

          <el-table-column label="จัดพร้อมกัน" width="120" align="center">
            <template #default="scope">{{ scope.row.scheduler_limit }} คน</template>
          </el-table-column>

          <el-table-column label="ราคา/เดือน" width="130" align="right">
            <template #default="scope">{{ currency(scope.row.monthly_fee) }}</template>
          </el-table-column>

          <el-table-column label="สถานะเทียบสูตร" width="170" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.compareType">
                {{ scope.row.compareLabel }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSchoolManagement } from '@/composables/useSchoolManagement'
import {
  DEFAULT_PRICING_FORMULA,
  usePricingFormula,
  calcFormulaMonthly,
  getDiscountPercent,
  calcFormulaTotal,
  normalizePricingFormula,
} from '@/composables/usePricingFormula'

const FALLBACK_PACKAGES = [
  { id: 'basic-200', code: '200', name: 'แพ็กเกจ 200', monthly_fee: 200, scheduler_limit: 2, is_active: true, sort_order: 1 },
  { id: 'std-300', code: '300', name: 'แพ็กเกจ 300', monthly_fee: 300, scheduler_limit: 3, is_active: true, sort_order: 2 },
  { id: 'pro-500', code: '500', name: 'แพ็กเกจ 500', monthly_fee: 500, scheduler_limit: 5, is_active: true, sort_order: 3 },
]

const authStore = useAuthStore()
const { getPackageCatalog } = useSchoolManagement()
const { getPricingFormula } = usePricingFormula()

const input = reactive({
  rooms: 12,
  days: 5,
  periods: 8,
  concurrent: 3,
  teachers: 15,
  autoRuns: 2,
  resetCycles: 1,
  months: 6,
})

const packages = ref([...FALLBACK_PACKAGES])
const formula = ref({ ...DEFAULT_PRICING_FORMULA })

const isLoggedIn = computed(() => authStore.isLoggedIn)
const normalizedFormula = computed(() => normalizePricingFormula(formula.value))
const blaze = computed(() => calcFormulaMonthly(input, normalizedFormula.value))
const monthlyModel = computed(() => blaze.value)
const discountPercent = computed(() => getDiscountPercent(input.months, normalizedFormula.value))
const totalModel = computed(() => calcFormulaTotal(monthlyModel.value.monthly, input.months, discountPercent.value))

const computedRows = computed(() => {
  const target = Number(monthlyModel.value.monthly || 0)
  return [...packages.value]
    .filter((p) => p.is_active !== false)
    .sort((a, b) => Number(a.monthly_fee || 0) - Number(b.monthly_fee || 0))
    .map((p) => {
      const monthly = Number(p.monthly_fee || 0)
      const supports = Number(p.scheduler_limit || 0) >= Number(input.concurrent || 1)
      const enoughPrice = monthly >= target
      let compareLabel = 'ต่ำกว่าสูตร'
      let compareType = 'danger'
      if (supports && enoughPrice) {
        compareLabel = 'ผ่านแนะนำ'
        compareType = 'success'
      } else if (supports) {
        compareLabel = 'รองรับคนจัด แต่ราคาต่ำ'
        compareType = 'warning'
      } else if (enoughPrice) {
        compareLabel = 'ราคาพอ แต่สิทธิ์ไม่พอ'
        compareType = 'warning'
      }
      return {
        ...p,
        monthly_fee: monthly,
        compareLabel,
        compareType,
      }
    })
})

function currency(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท'
}

function number(n) {
  return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

async function loadPackages() {
  if (!isLoggedIn.value) return
  const result = await getPackageCatalog(true)
  if (result.success && Array.isArray(result.data) && result.data.length) {
    packages.value = result.data
  }
}

async function loadFormula() {
  if (!isLoggedIn.value) return
  const result = await getPricingFormula()
  if (result.success && result.data) {
    formula.value = result.data
  }
}

onMounted(() => {
  loadPackages()
  loadFormula()
})
</script>

<style scoped>
.pricing-page {
  min-height: 100dvh;
  background: radial-gradient(circle at 10% 18%, #67e8f9 0%, transparent 35%),
    radial-gradient(circle at 88% 12%, #fdba74 0%, transparent 30%),
    linear-gradient(145deg, #164e63 0%, #155e75 52%, #0f172a 100%);
  padding: 28px 14px 40px;
  position: relative;
  overflow: hidden;
}

.pricing-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.35;
}

.pricing-glow-a {
  width: 320px;
  height: 320px;
  left: -100px;
  bottom: -120px;
  background: #f59e0b;
}

.pricing-glow-b {
  width: 260px;
  height: 260px;
  right: -70px;
  top: -90px;
  background: #22d3ee;
}

.pricing-wrap {
  max-width: 1120px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
  display: grid;
  gap: 14px;
}

.hero {
  border-radius: 20px;
  padding: 24px;
  color: #ffffff;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08));
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.hero-kicker {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.88;
}

.hero h1 {
  margin: 8px 0 10px;
  font-size: clamp(24px, 4vw, 36px);
  line-height: 1.15;
}

.hero p {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  opacity: 0.95;
}

.panel {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.65);
  padding: 16px;
  box-shadow: 0 14px 30px rgba(2, 6, 23, 0.16);
}

.grid-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.month-group {
  display: flex;
  flex-wrap: wrap;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  background: #f8fafc;
}

.metric-card span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.metric-card strong {
  display: block;
  margin-top: 3px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 800;
}

.metric-card-highlight {
  background: #ecfeff;
  border-color: #67e8f9;
}

.pkg-name {
  font-weight: 700;
  color: #0f172a;
}

.pkg-code {
  font-size: 12px;
  color: #64748b;
}

@media (max-width: 980px) {
  .grid-form {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .result-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
