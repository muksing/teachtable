// src/composables/useSchoolManagement.js
// ===== School Management for SuperAdmin =====
import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { createClient } from '@supabase/supabase-js'
import { SCHOOL_REQUEST_STATUS, SCHOOL_SCHEMA, USER_ROLES, generateSchoolId } from '@/supabase/schema'

const PLAN_MAP = {
  '200': { code: '200', monthly_fee: 200, scheduler_limit: 2 },
  '300': { code: '300', monthly_fee: 300, scheduler_limit: 3 },
  '500': { code: '500', monthly_fee: 500, scheduler_limit: 5 },
}

async function fetchPlanFromCatalog(planCode) {
  try {
    const { data: d, error } = await supabase.from('package_catalog').select('*').eq('code', String(planCode)).single()
    if (d && !error) {
      return {
        code: d.code,
        name: d.name || d.code,
        monthly_fee: Number(d.monthly_fee || 0),
        scheduler_limit: Number(d.scheduler_limit || 1),
        duration_months: Number(d.duration_months || 1),
        is_active: d.is_active !== false,
      }
    }
  } catch {}
  return null
}

function addMonths(baseDate, months) {
  const d = new Date(baseDate)
  d.setMonth(d.getMonth() + Number(months || 0))
  return d
}

function addDays(baseDate, days) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + Number(days || 0))
  return d
}

function toDateValue(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveNextExpiry(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + Number(months || 1))
  return d
}

function toDateOrNull(value) {
  return toDateValue(value)
}

function mapRenewalRequest(docId, data = {}, schoolIdFallback = '') {
  return {
    id: docId,
    ...data,
    school_id: data.school_id || schoolIdFallback || '',
    school_name: data.school_name || data.schoolName || '',
    contact_email: data.contact_email || '',
    contact_name: data.contact_name || '',
    created_at: toDateOrNull(data.created_at),
    reviewed_at: toDateOrNull(data.reviewed_at),
    approved_at: toDateOrNull(data.approved_at),
    payment_date: toDateOrNull(data.payment_date),
  }
}

export function useSchoolManagement() {
  const loading = ref(false)
  const error = ref(null)

  async function fetchRenewalRequestsRaw(status = null) {
    let query = supabase.from('renewal_requests').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data } = await query
    return (data || []).map(d => mapRenewalRequest(d.id, d))
  }

  // ===== Get School Requests =====
  async function getSchoolRequests(status = null) {
    loading.value = true
    error.value = null

    try {
      let query = supabase.from('school_requests').select('*').order('submittedAt', { ascending: false })
      if (status) query = query.eq('status', status)
      
      const { data, error: err } = await query
      if (err) throw err
      
      const requests = data.map(d => ({
        id: d.id,
        ...d,
        submittedAt: d.submittedAt ? new Date(d.submittedAt) : null,
        reviewedAt: d.reviewedAt ? new Date(d.reviewedAt) : null,
        approvedAt: d.approvedAt ? new Date(d.approvedAt) : null
      }))

      return { success: true, data: requests }

    } catch (err) {
      console.error('Error fetching school requests:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ===== Approve School Request (Client-side via Secondary App) =====
  async function approveSchoolRequest(requestId, superAdminUid) {
    loading.value = true
    error.value = null

    try {
      if (!requestId) throw new Error('requestId is required')
      if (!superAdminUid) throw new Error('superAdminUid is required')

      // 1. Get request
      const { data: requestData, error: reqErr } = await supabase.from('school_requests').select('*').eq('id', requestId).single()
      if (reqErr || !requestData) throw new Error('School request not found in database.')

      if (requestData.status === SCHOOL_REQUEST_STATUS.APPROVED) {
        throw new Error('This school request has already been approved.')
      }
      // Robust Trim and Validation
      const adminEmail = String(requestData.adminEmail || '').trim()
      const adminPassword = String(requestData.adminPassword || '').trim()

      if (!adminEmail) throw new Error('Admin Email is missing in the registration request data.')
      if (!adminPassword) throw new Error('Admin Password is missing in the registration request data.')
      if (adminPassword.length < 6) throw new Error('Admin Password must be at least 6 characters for security.')

      // 2. Auth: Create via secondary Supabase client so Superadmin session is not destroyed
      const adminSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      
      const { data: authData, error: authError } = await adminSupabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
      })
      if (authError) throw new Error(authError.message)
      const newUid = authData.user.id

      // 3. Create school
      const schoolData = {
        name: requestData.schoolName,
        code: 'SCH' + Math.floor(1000 + Math.random() * 9000),
        is_active: true
      }
      const { data: insertedSchool, error: schoolErr } = await supabase.from('schools').insert([schoolData]).select().single()
      if (schoolErr) throw schoolErr
      const schoolId = insertedSchool.id

      // 4. Create user
      const userData = {
        id: newUid,
        email: adminEmail,
        "displayName": requestData.contactName,
        "firstName": "Admin",
        "lastName": requestData.schoolName,
        role: USER_ROLES.SCHOOL_ADMIN,
        roles: [USER_ROLES.SCHOOL_ADMIN],
        "schoolId": schoolId,
        "school_id": schoolId,
        "isActive": true,
        is_active: true
      }
      await supabase.from('users').insert([userData])

      // 5. Update request status
      await supabase.from('school_requests').update({
        status: SCHOOL_REQUEST_STATUS.APPROVED,
        "schoolId": schoolId,
        "reviewedAt": new Date().toISOString(),
        "approvedAt": new Date().toISOString(),
        "adminPassword": null
      }).eq('id', requestId)

      return { success: true, data: { schoolId } }

    } catch (err) {
      console.error('Error approving school request:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ===== Get SuperAdmin Stats (Client-side fetching) =====
  async function getSuperAdminStats() {
    loading.value = true
    error.value = null

    try {
      const [schoolsCountResult, requestsCountResult, usersCountResult, activeUsersCountResult, usersSnapshotResult, renewalsResult] = await Promise.allSettled([
        supabase.from('schools').select('id', { count: 'exact', head: true }).or('isActive.eq.true,is_active.eq.true'),
        supabase.from('school_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).or('isActive.eq.true,is_active.eq.true'),
        supabase.from('users').select('*'),
        fetchRenewalRequestsRaw('pending'),
      ])

      const warnings = []

      const totalSchools = schoolsCountResult.status === 'fulfilled'
        ? Number(schoolsCountResult.value.count || 0)
        : 0
      if (schoolsCountResult.status === 'rejected') {
        warnings.push(`totalSchools: ${schoolsCountResult.reason?.message || 'unknown error'}`)
      }

      const pendingRequests = requestsCountResult.status === 'fulfilled'
        ? Number(requestsCountResult.value.count || 0)
        : 0
      if (requestsCountResult.status === 'rejected') {
        warnings.push(`pendingRequests: ${requestsCountResult.reason?.message || 'unknown error'}`)
      }

      const usersFromSnapshot = usersSnapshotResult.status === 'fulfilled'
        ? (usersSnapshotResult.value.data || [])
        : []

      const totalUsersFromSnapshot = usersFromSnapshot.length
      const activeUsersFromSnapshot = usersFromSnapshot.filter((u) => u?.isActive === true || u?.is_active === true).length

      const totalUsers = usersCountResult.status === 'fulfilled'
        ? Number(usersCountResult.value.count || 0)
        : totalUsersFromSnapshot
      if (usersCountResult.status === 'rejected') {
        warnings.push(`totalUsers: ${usersCountResult.reason?.message || 'unknown error'}`)
      }

      const activeUsers = activeUsersCountResult.status === 'fulfilled'
        ? Math.max(Number(activeUsersCountResult.value.count || 0), activeUsersFromSnapshot)
        : activeUsersFromSnapshot
      if (activeUsersCountResult.status === 'rejected') {
        warnings.push(`activeUsers: ${activeUsersCountResult.reason?.message || 'unknown error'}`)
      }

      if (usersSnapshotResult.status === 'rejected') {
        warnings.push(`usersSnapshot: ${usersSnapshotResult.reason?.message || 'unknown error'}`)
      }

      const pendingRenewals = renewalsResult.status === 'fulfilled'
        ? Number(renewalsResult.value.length || 0)
        : 0
      if (renewalsResult.status === 'rejected') {
        warnings.push(`pendingRenewals: ${renewalsResult.reason?.message || 'unknown error'}`)
      }

      if (warnings.length > 0) {
        console.warn('SuperAdmin stats loaded with partial failures:', warnings)
      }

      return {
        success: true,
        data: {
          totalSchools,
          pendingRequests,
          pendingRenewals,
          totalUsers,
          activeUsers,
          totalPendingItems: pendingRequests + pendingRenewals,
          hasPartialFailure: warnings.length > 0,
          warnings,
        }
      }

    } catch (err) {
      console.error('Error getting stats:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ===== Reject School Request =====

  async function rejectSchoolRequest(requestId, reason, superAdminUid) {
    loading.value = true
    error.value = null

    try {
      await supabase.from('school_requests').update({
        status: SCHOOL_REQUEST_STATUS.REJECTED,
        "rejectionReason": reason,
        "reviewedAt": new Date().toISOString()
      }).eq('id', requestId)

      return { success: true }

    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ===== Get All Schools =====
  async function getSchools() {
    loading.value = true
    error.value = null

    try {
      const { data: schoolsData, error: err } = await supabase.from('schools').select('*').order('created_at', { ascending: false })
      if (err) throw err

      const schools = schoolsData.map((s) => {
        const info = s.settings || {}
        const plan = info.pricing_plan || null
        const override = Number(info?.scheduler_limit_override || 0)
        const defaultLimit = Number(plan?.scheduler_limit || 0)
        return {
          ...s,
          schoolName: s.name,
          isActive: s.is_active,
          createdAt: s.created_at ? new Date(s.created_at) : null,
          feature_flags: info.feature_flags || {},
          pricing_plan: plan,
          plan_notice: info.plan_notice || null,
          scheduler_limit_override: override > 0 ? override : null,
          scheduler_limit_effective: override > 0 ? override : defaultLimit,
          limit_source: override > 0 ? 'override' : 'package',
          schoolInfoUpdatedAt: toDateValue(info?.updated_at),
        }
      })

      return { success: true, data: schools }

    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ===== Suspend/Reactivate School =====
  async function toggleSchoolStatus(schoolId, isActive) {
    loading.value = true
    error.value = null

    try {
      const { error: err } = await supabase.from('schools').update({
        is_active: isActive
      }).eq('id', schoolId)
      if (err) throw err

      return { success: true }

    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function getPackageCatalog(activeOnly = false) {
    loading.value = true
    error.value = null
    try {
      let query = supabase.from('package_catalog').select('*').order('sort_order', { ascending: true })
      if (activeOnly) query = query.eq('is_active', true)
      
      const { data, error: err } = await query
      if (err) throw err
      return { success: true, data: data.map(d => ({ ...d, id: d.code })) }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function createPackage(data) {
    try {
      const code = String(data.code || '').trim()
      if (!code) throw new Error('กรุณากรอกรหัสแพ็กเกจ')
      const { error: err } = await supabase.rpc('upsert_package', {
        p_code: code,
        p_name: String(data.name || code).trim(),
        p_annual_fee: Number(data.monthly_fee || 0),
        p_sort_order: Number(data.sort_order || 99),
        p_is_active: data.is_active !== false,
      })
      if (err) throw err
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function updatePackage(packageCode, data) {
    try {
      if (!packageCode) throw new Error('packageCode is required')
      const { error: err } = await supabase.rpc('upsert_package', {
        p_code: packageCode,
        p_name: String(data.name || '').trim(),
        p_annual_fee: Number(data.monthly_fee || 0),
        p_sort_order: Number(data.sort_order || 99),
        p_is_active: true,
      })
      if (err) throw err
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function togglePackageActive(packageCode, isActive) {
    try {
      if (!packageCode) throw new Error('packageCode is required')
      const { error: err } = await supabase.rpc('toggle_package_active', {
        p_code: packageCode,
        p_is_active: Boolean(isActive),
      })
      if (err) throw err
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function deletePackage(packageCode) {
    try {
      if (!packageCode) throw new Error('packageCode is required')
      const { error: err } = await supabase.rpc('delete_package_by_code', { p_code: packageCode })
      if (err) throw err
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function updateSchoolPricingPlan(schoolId, planCode, superAdminUid, options = {}) {
    loading.value = true
    error.value = null

    try {
      const fromCatalog = await fetchPlanFromCatalog(planCode)
      const selected = fromCatalog || PLAN_MAP[String(planCode || '')]
      if (!selected) {
        throw new Error('Invalid plan code')
      }

      const { data: schoolData, error: schoolErr } = await supabase.from('schools').select('*').eq('id', schoolId).single()
      if (schoolErr || !schoolData) {
        throw new Error('School not found')
      }

      const info = schoolData.settings || {}
      const prevPlan = info?.pricing_plan || null
      const prevExpiry = toDateValue(prevPlan?.expires_at)
      const nextExpiry = resolveNextExpiry(options.planMonths || 1)

      const overrideValue = Number(options.schedulerLimitOverride || 0)
      const schedulerLimitOverride = overrideValue > 0 ? overrideValue : null
      const effectiveLimit = schedulerLimitOverride || selected.scheduler_limit
      const monthlyFeeOverride = Number(options.monthlyFeeOverride || 0)
      const displayFee = monthlyFeeOverride > 0 ? monthlyFeeOverride : selected.monthly_fee

      const pricingPlan = {
        code: selected.code,
        monthly_fee: displayFee,
        scheduler_limit: selected.scheduler_limit,
        expires_at: nextExpiry,
      }

      info.pricing_plan = pricingPlan
      if (schedulerLimitOverride) {
        info.scheduler_limit_override = schedulerLimitOverride
      } else {
        delete info.scheduler_limit_override
      }

      const { error: updateErr } = await supabase.from('schools').update({ settings: info }).eq('id', schoolId)
      if (updateErr) throw updateErr

      return {
        success: true,
        data: {
          pricing_plan: {
            ...selected,
            monthly_fee: displayFee,
          },
          scheduler_limit_effective: effectiveLimit,
          scheduler_limit_override: schedulerLimitOverride,
        },
      }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function updateSchoolFeatureFlags(schoolId, flags = {}, superAdminUid) {
    loading.value = true
    error.value = null

    try {
      if (!schoolId) throw new Error('schoolId is required')
      if (!flags || typeof flags !== 'object') throw new Error('flags object is required')

      const { data: schoolData, error: getErr } = await supabase.from('schools').select('settings').eq('id', schoolId).single()
      if (getErr) throw getErr
      
      const settings = schoolData.settings || {}
      settings.feature_flags = { ...(settings.feature_flags || {}), ...flags }
      
      const { error: updateErr } = await supabase.from('schools').update({ settings }).eq('id', schoolId)
      if (updateErr) throw updateErr

      return {
        success: true,
        data: {
          feature_flags: {
            ...(settings.feature_flags || {}),
            ...flags,
          }
        }
      }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function getRenewalRequests(status = null) {
    loading.value = true
    error.value = null

    try {
      const requests = await fetchRenewalRequestsRaw(status)
      return { success: true, data: requests }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function approveRenewalRequest(requestId, schoolId, superAdminUid) {
    loading.value = true
    error.value = null

    try {
      if (!requestId) throw new Error('requestId is required')
      if (!schoolId) throw new Error('schoolId is required')
      if (!superAdminUid) throw new Error('superAdminUid is required')

      const { data: requestData, error: reqErr } = await supabase.from('renewal_requests').select('*').eq('id', requestId).single()
      if (reqErr || !requestData) throw new Error('Renewal request not found')
      
      if (requestData.status === 'approved') throw new Error('Renewal request has already been approved')

      let planCode = String(requestData.plan_code || requestData.current_plan_code || '')
      const months = Number(requestData.months || 1)
      const renewalMode = String(requestData.renewal_mode || 'manual')
      const calculatedTotal = Number(requestData.calculated_total || 0)
      const calculatedMonthly = Number(requestData.calculated_monthly || 0)
      const paidAmount = Number(requestData.amount || 0)
      const calculationInput = requestData.calculation_input && typeof requestData.calculation_input === 'object'
        ? requestData.calculation_input
        : {}
      const requestedConcurrent = Number(calculationInput.concurrent || 0)
      const schedulerLimitOverride = requestedConcurrent > 0
        ? Math.max(1, Math.round(requestedConcurrent))
        : null

      // รองรับคำขอใหม่ที่ไม่ส่ง plan_code โดยต่อจากแพ็กเกจปัจจุบันของโรงเรียน
      if (!planCode) {
        const { data: schoolData, error: schoolErr } = await supabase
          .from('schools')
          .select('settings')
          .eq('id', schoolId)
          .single()
        if (schoolErr) throw schoolErr
        planCode = String(schoolData?.settings?.pricing_plan?.code || '')
      }

      if (!planCode) {
        throw new Error('ไม่พบรหัสแพ็กเกจปัจจุบันของโรงเรียน ไม่สามารถอนุมัติคำขอต่ออายุได้')
      }

      if (renewalMode === 'auto' && calculatedTotal > 0 && paidAmount < calculatedTotal) {
        throw new Error(`ยอดโอนยังไม่ครบสำหรับต่ออายุอัตโนมัติ (ต้องโอนอย่างน้อย ${calculatedTotal.toLocaleString('th-TH')} บาท)`)
      }

      const result = await updateSchoolPricingPlan(schoolId, planCode, superAdminUid, {
        expiryMode: 'auto_months',
        planMonths: months,
        schedulerLimitOverride,
        monthlyFeeOverride: calculatedMonthly > 0 ? calculatedMonthly : 0,
        note: requestData.note || 'Approved via renewal request',
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to update pricing plan')
      }

      await supabase.from('renewal_requests').update({
        status: 'approved',
        reviewed_at: new Date().toISOString()
      }).eq('id', requestId)

      return { success: true, data: result.data }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function rejectRenewalRequest(requestId, schoolId, reason, superAdminUid) {
    loading.value = true
    error.value = null

    try {
      if (!requestId) throw new Error('requestId is required')
      if (!schoolId) throw new Error('schoolId is required')
      if (!reason || !String(reason).trim()) throw new Error('reason is required')
      if (!superAdminUid) throw new Error('superAdminUid is required')

      await supabase.from('renewal_requests').update({
        status: 'rejected',
        note: String(reason).trim(),
        reviewed_at: new Date().toISOString()
      }).eq('id', requestId)

      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function deleteRenewalRequest(requestId, schoolId) {
    loading.value = true
    error.value = null
    try {
      const { error: err } = await supabase.from('renewal_requests').delete().eq('id', requestId)
      if (err) throw err
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function deleteSchool(schoolId) {
    loading.value = true
    error.value = null
    try {
      // ลองใช้ RPC cascade ก่อน (ถ้ามี)
      const { error: rpcErr } = await supabase.rpc('delete_school_cascade', { p_school_id: schoolId })
      if (!rpcErr) return { success: true }

      // Fallback: ลบเป็นลำดับ (child tables ก่อน)
      const tables = [
        'student_health_records', 'student_good_deeds', 'student_gratitude',
        'behavior_logs', 'score_records', 'teach_actuals', 'timetable_slots',
        'students', 'teachers', 'subjects', 'classes', 'terms', 'renewal_requests',
      ]
      for (const t of tables) {
        await supabase.from(t).delete().eq('school_id', schoolId)
      }
      const { error: delErr } = await supabase.from('schools').delete().eq('id', schoolId)
      if (delErr) throw delErr
      return { success: true }
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
    getSchoolRequests,
    getSuperAdminStats,
    getRenewalRequests,
    approveSchoolRequest,
    approveRenewalRequest,
    rejectSchoolRequest,
    rejectRenewalRequest,
    getSchools,
    toggleSchoolStatus,
    updateSchoolPricingPlan,
    updateSchoolFeatureFlags,
    deleteRenewalRequest,
    deleteSchool,
    getPackageCatalog,
    createPackage,
    updatePackage,
    togglePackageActive,
    deletePackage,
  }
}
