import { ref } from 'vue'
import { db } from '@/supabase/db'
import { doc, getDoc, setDoc, serverTimestamp } from '@/supabase/firestore'

const PRICING_DOC_REF = doc(db, 'system_config', 'pricing_formula')

export const DEFAULT_PRICING_FORMULA = {
  read_price_per_100k: 0.22,
  write_price_per_100k: 0.72,
  delete_price_per_100k: 0.08,
  slot_fill_rate: 0.9,
  swap_per_slot: 5,
  auto_place_ratio: 0.9,
  activities_per_teacher: 2,
  supervision_per_teacher: 2,
  ops_fee_monthly: 120,
  profit_multiplier: 2.0,
  rounding_step: 10,
  discount_3m_percent: 3,
  discount_6m_percent: 7,
  discount_12m_percent: 15,
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizePricingFormula(raw = {}) {
  return {
    read_price_per_100k: Math.max(0, num(raw.read_price_per_100k, DEFAULT_PRICING_FORMULA.read_price_per_100k)),
    write_price_per_100k: Math.max(0, num(raw.write_price_per_100k, DEFAULT_PRICING_FORMULA.write_price_per_100k)),
    delete_price_per_100k: Math.max(0, num(raw.delete_price_per_100k, DEFAULT_PRICING_FORMULA.delete_price_per_100k)),
    slot_fill_rate: Math.min(1, Math.max(0.1, num(raw.slot_fill_rate, DEFAULT_PRICING_FORMULA.slot_fill_rate))),
    swap_per_slot: Math.max(0, num(raw.swap_per_slot, DEFAULT_PRICING_FORMULA.swap_per_slot)),
    auto_place_ratio: Math.min(1, Math.max(0, num(raw.auto_place_ratio, DEFAULT_PRICING_FORMULA.auto_place_ratio))),
    activities_per_teacher: Math.max(0, num(raw.activities_per_teacher, DEFAULT_PRICING_FORMULA.activities_per_teacher)),
    supervision_per_teacher: Math.max(0, num(raw.supervision_per_teacher, DEFAULT_PRICING_FORMULA.supervision_per_teacher)),
    ops_fee_monthly: Math.max(0, num(raw.ops_fee_monthly, DEFAULT_PRICING_FORMULA.ops_fee_monthly)),
    profit_multiplier: Math.max(1, num(raw.profit_multiplier, DEFAULT_PRICING_FORMULA.profit_multiplier)),
    rounding_step: Math.max(1, num(raw.rounding_step, DEFAULT_PRICING_FORMULA.rounding_step)),
    discount_3m_percent: Math.max(0, num(raw.discount_3m_percent, DEFAULT_PRICING_FORMULA.discount_3m_percent)),
    discount_6m_percent: Math.max(0, num(raw.discount_6m_percent, DEFAULT_PRICING_FORMULA.discount_6m_percent)),
    discount_12m_percent: Math.max(0, num(raw.discount_12m_percent, DEFAULT_PRICING_FORMULA.discount_12m_percent)),
  }
}

export function getDiscountPercent(months, formula) {
  const m = Number(months || 1)
  if (m >= 12) return Number(formula.discount_12m_percent || 0)
  if (m >= 6) return Number(formula.discount_6m_percent || 0)
  if (m >= 3) return Number(formula.discount_3m_percent || 0)
  return 0
}

export function roundUp(value, step = 10) {
  const safeStep = Math.max(1, Number(step || 1))
  return Math.ceil(Number(value || 0) / safeStep) * safeStep
}

function pricePerUnit(per100k) {
  return Number(per100k || 0) / 100000
}

export function calcBlazeEstimate(input = {}, formulaInput = {}) {
  const formula = normalizePricingFormula(formulaInput)
  const rooms = Math.max(1, Number(input.rooms || 1))
  const days = Math.max(1, Number(input.days || 5))
  const periods = Math.max(1, Number(input.periods || 8))
  const concurrent = Math.max(1, Number(input.concurrent || 1))
  const teachers = Math.max(1, Number(input.teachers || 15))
  const autoRuns = Math.max(0, Number(input.autoRuns || 0))
  const resetCycles = Math.max(0, Number(input.resetCycles || 0))

  const slotCount = Math.max(1, Math.round(rooms * days * periods * formula.slot_fill_rate))
  const swapEvents = slotCount * formula.swap_per_slot * (1 + resetCycles)

  const writesSwap = 4 * swapEvents
  const deletesSwap = 2 * swapEvents

  const activityDocs = teachers * formula.activities_per_teacher
  const supervisionDocs = teachers * formula.supervision_per_teacher
  const readsAutoQuery = autoRuns * (slotCount + activityDocs + supervisionDocs)
  const writesAuto = autoRuns * slotCount * formula.auto_place_ratio

  const readsClear = resetCycles * slotCount
  const deletesClear = resetCycles * slotCount

  const readsRealtime = concurrent * (writesSwap + writesAuto + deletesClear)

  const readTotal = readsAutoQuery + readsClear + readsRealtime
  const writeTotal = writesSwap + writesAuto
  const deleteTotal = deletesSwap + deletesClear

  const readCost = readTotal * pricePerUnit(formula.read_price_per_100k)
  const writeCost = writeTotal * pricePerUnit(formula.write_price_per_100k)
  const deleteCost = deleteTotal * pricePerUnit(formula.delete_price_per_100k)
  const blazeCost = readCost + writeCost + deleteCost

  return {
    slotCount,
    swapEvents,
    readTotal,
    writeTotal,
    deleteTotal,
    readCost,
    writeCost,
    deleteCost,
    blazeCost,
  }
}

export function calcFormulaMonthly(input = {}, formulaInput = {}) {
  const formula = normalizePricingFormula(formulaInput)
  const estimate = calcBlazeEstimate(input, formula)
  const base = estimate.blazeCost + formula.ops_fee_monthly
  const target = base * formula.profit_multiplier
  const monthly = roundUp(target, formula.rounding_step)

  return {
    ...estimate,
    base,
    target,
    monthly,
  }
}

export function calcFormulaTotal(monthly, months, discountPercent = 0) {
  const m = Math.max(1, Number(months || 1))
  const subTotal = Number(monthly || 0) * m
  const discount = subTotal * (Math.max(0, Number(discountPercent || 0)) / 100)
  return {
    subTotal,
    discount,
    total: Math.max(0, subTotal - discount),
  }
}

export function usePricingFormula() {
  const loading = ref(false)
  const error = ref(null)

  async function getPricingFormula() {
    loading.value = true
    error.value = null
    try {
      const snap = await getDoc(PRICING_DOC_REF)
      if (!snap.exists()) {
        return { success: true, data: { ...DEFAULT_PRICING_FORMULA }, fromDefault: true }
      }
      return { success: true, data: normalizePricingFormula(snap.data()), fromDefault: false }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function savePricingFormula(payload, uid = '') {
    loading.value = true
    error.value = null
    try {
      const formula = normalizePricingFormula(payload)
      await setDoc(PRICING_DOC_REF, {
        ...formula,
        updated_at: serverTimestamp(),
        updated_by: uid || null,
      }, { merge: true })
      return { success: true, data: formula }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getPricingFormula,
    savePricingFormula,
  }
}
