import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { usePricingFormula, calcFormulaMonthly, calcFormulaTotal, getDiscountPercent } from './usePricingFormula'

export function usePackageRenewal() {
  const { getPricingFormula } = usePricingFormula()

  // ดึงสูตรคำนวณปัจจุบันจาก SuperAdmin
  async function getActivePricingFormula() {
    try {
      const result = await getPricingFormula()
      return result.data || {}
    } catch (error) {
      console.error('Error loading pricing formula:', error)
      return {}
    }
  }

  // คำนวณราคาสำหรับแผนอัตโนมัติ (auto runs=5, reset cycles=5 เป็นค่าคงที่)
  function calculateRenewalPrice(params, pricingFormula) {
    const preview = {
      rooms: params.rooms,
      days: params.days,
      periods: params.periods,
      concurrent: params.concurrent,
      teachers: params.teachers,
      autoRuns: 5,
      resetCycles: 5,
      months: params.months || 12,
    }

    const model = calcFormulaMonthly(preview, pricingFormula)
    const discountPercent = getDiscountPercent(preview.months, pricingFormula)
    const totalModel = calcFormulaTotal(model.monthly, preview.months, discountPercent)

    return {
      monthlyPrice: model.monthly,
      totalPrice: totalModel.total,
      discountPercent,
      discount: totalModel.discount,
      preview,
      details: {
        readTotal: model.readTotal,
        writeTotal: model.writeTotal,
        deleteTotal: model.deleteTotal,
        blazeCost: model.blazeCost,
      },
    }
  }

  // สร้างคำขอต่ออายุแพ็คเกจ — บันทึกลง school_requests table
  async function createRenewalRequest(schoolId, renewalData, userId) {
    try {
      const renewalRequest = {
        school_id: schoolId,
        request_type: 'renewal',
        current_plan: renewalData.currentPlan,
        new_plan: renewalData.newPlan,
        calculation_params: {
          rooms: renewalData.rooms,
          days: renewalData.days,
          periods: renewalData.periods,
          concurrent: renewalData.concurrent,
          teachers: renewalData.teachers,
          autoRuns: 5,
          resetCycles: 5,
          months: renewalData.months || 12,
        },
        pricing: {
          monthlyPrice: renewalData.monthlyPrice,
          totalPrice: renewalData.totalPrice,
          discountPercent: renewalData.discountPercent,
          discount: renewalData.discount,
        },
        payment_evidence: {
          slipFile: renewalData.slipFile || null,
          amount: renewalData.paymentAmount || 0,
          transferDate: renewalData.transferDate || null,
        },
        status: 'pending',
        requested_by: userId,
        requested_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
        renewal_type: renewalData.renewalType || 'manual',
        notes: renewalData.notes || '',
      }

      const { data, error } = await supabase
        .from('school_requests')
        .insert(renewalRequest)
        .select()
        .single()

      if (error) throw error
      return { success: true, requestId: data.id, data: renewalRequest }
    } catch (error) {
      console.error('Error creating renewal request:', error)
      return { success: false, error: error.message }
    }
  }

  // ดึงคำขอต่ออายุของโรงเรียน
  async function getRenewalRequests(schoolId, status = null) {
    try {
      let query = supabase
        .from('school_requests')
        .select('*')
        .eq('school_id', schoolId)
        .eq('request_type', 'renewal')
        .order('requested_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error

      const requests = (data || []).map(row => ({
        id: row.id,
        ...row,
        requestedAt: row.requested_at ? new Date(row.requested_at) : null,
        approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      }))

      return { success: true, requests }
    } catch (error) {
      console.error('Error fetching renewal requests:', error)
      return { success: false, error: error.message, requests: [] }
    }
  }

  // ดึงคำขอต่ออายุทั้งหมด (สำหรับ SuperAdmin)
  async function getAllRenewalRequests(status = 'pending') {
    try {
      let query = supabase
        .from('school_requests')
        .select('*')
        .eq('request_type', 'renewal')
        .order('requested_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error

      const requests = (data || []).map(row => ({
        id: row.id,
        ...row,
        requestedAt: row.requested_at ? new Date(row.requested_at) : null,
        approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      }))

      return { success: true, requests }
    } catch (error) {
      return { success: false, error: error.message, requests: [] }
    }
  }

  // ดึงคำขอต่ออายุรายชิ้น
  async function getRenewalRequest(schoolId, requestId) {
    try {
      const { data, error } = await supabase
        .from('school_requests')
        .select('*')
        .eq('id', requestId)
        .eq('school_id', schoolId)
        .single()

      if (error) throw error

      return {
        success: true,
        request: {
          id: data.id,
          ...data,
          requestedAt: data.requested_at ? new Date(data.requested_at) : null,
          approvedAt: data.approved_at ? new Date(data.approved_at) : null,
        },
      }
    } catch (error) {
      console.error('Error fetching renewal request:', error)
      return { success: false, error: error.message }
    }
  }

  // ยืนยันและอนุมัติคำขอต่ออายุ (SuperAdmin)
  async function approveRenewalRequest(schoolId, requestId, superAdminId, duration = 12) {
    try {
      const { data: requestData, error: fetchErr } = await supabase
        .from('school_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (fetchErr) throw fetchErr

      const now = new Date()
      const expiryDate = new Date(now.getTime() + duration * 30 * 24 * 60 * 60 * 1000)

      // อัปเดต renewal request
      const { error: updateReqErr } = await supabase
        .from('school_requests')
        .update({
          status: 'approved',
          approved_by: superAdminId,
          approved_at: now.toISOString(),
        })
        .eq('id', requestId)

      if (updateReqErr) throw updateReqErr

      // อัปเดต school settings.pricing_plan
      const { data: schoolData, error: schoolReadErr } = await supabase
        .from('schools')
        .select('settings')
        .eq('id', schoolId)
        .single()

      if (schoolReadErr) throw schoolReadErr

      const existingSettings = schoolData?.settings || {}
      const { error: schoolUpdateErr } = await supabase
        .from('schools')
        .update({
          settings: {
            ...existingSettings,
            pricing_plan: {
              ...(existingSettings.pricing_plan || {}),
              code: requestData.new_plan,
              expires_at: expiryDate.toISOString(),
              lastRenewalRequest: requestId,
              lastRenewalAt: now.toISOString(),
            },
          },
        })
        .eq('id', schoolId)

      if (schoolUpdateErr) throw schoolUpdateErr

      return {
        success: true,
        message: 'ต่ออายุแพ็คเกจเรียบร้อยแล้ว',
        expiryDate,
      }
    } catch (error) {
      console.error('Error approving renewal request:', error)
      return { success: false, error: error.message }
    }
  }

  // ปฏิเสธคำขอต่ออายุ
  async function rejectRenewalRequest(schoolId, requestId, superAdminId, reason = '') {
    try {
      const { error } = await supabase
        .from('school_requests')
        .update({
          status: 'rejected',
          approved_by: superAdminId,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', requestId)
        .eq('school_id', schoolId)

      if (error) throw error
      return { success: true, message: 'ปฏิเสธคำขอเรียบร้อยแล้ว' }
    } catch (error) {
      console.error('Error rejecting renewal request:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    getActivePricingFormula,
    calculateRenewalPrice,
    createRenewalRequest,
    getRenewalRequests,
    getAllRenewalRequests,
    getRenewalRequest,
    approveRenewalRequest,
    rejectRenewalRequest,
  }
}
