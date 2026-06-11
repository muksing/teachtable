import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSchoolStore = defineStore('school', () => {
  const schoolInfo = ref(null)
  const currentTerm = ref(null)

  function setSchool(data) { schoolInfo.value = data }
  function setCurrentTerm(term) { currentTerm.value = term }
  function clear() { schoolInfo.value = null; currentTerm.value = null }

  const schoolName = computed(() => schoolInfo.value?.name || schoolInfo.value?.schoolName || '')
  const schoolId = computed(() => schoolInfo.value?.id || schoolInfo.value?.schoolId || schoolInfo.value?.school_id || null)
  
  // รองรับข้อมูล Settings ที่ซ้อนอยู่ใน Supabase (settings JSONB) หรือแบบเดิม
  const settingsObj = computed(() => ({
    ...(schoolInfo.value || {}),
    ...((schoolInfo.value?.settings && typeof schoolInfo.value.settings === 'object') ? schoolInfo.value.settings : {}),
  }))
  
  const isTimetableLocked = computed(() => settingsObj.value.timetable_locked === true)
  const featureFlags = computed(() => {
    const raw = settingsObj.value.feature_flags
    const nested = raw && typeof raw === 'object' ? raw : {}
    return {
      ...nested,
      teaching_log_enabled:
        nested.teaching_log_enabled ??
        schoolInfo.value?.teaching_log_enabled ??
        schoolInfo.value?.teachingLogEnabled ??
        settingsObj.value?.teaching_log_enabled ??
        settingsObj.value?.teachingLogEnabled,
      behavior_system_enabled:
        nested.behavior_system_enabled ??
        schoolInfo.value?.behavior_system_enabled ??
        schoolInfo.value?.behaviorSystemEnabled ??
        settingsObj.value?.behavior_system_enabled ??
        settingsObj.value?.behaviorSystemEnabled,
      club_module_enabled:
        nested.club_module_enabled ??
        schoolInfo.value?.club_module_enabled ??
        schoolInfo.value?.clubModuleEnabled ??
        settingsObj.value?.club_module_enabled ??
        settingsObj.value?.clubModuleEnabled,
    }
  })

  function isFeatureEnabled(flagName) {
    return featureFlags.value?.[flagName] === true
  }

  const isTeachingLogEnabled = computed(() => isFeatureEnabled('teaching_log_enabled'))
  const isClubModuleEnabled = computed(() => isFeatureEnabled('club_module_enabled'))

  const pricingPlan = computed(() => {
    const raw = settingsObj.value.pricing_plan || schoolInfo.value?.pricing_plan
    if (!raw || typeof raw !== 'object') return null
    return {
      code: raw.code || '',
      monthly_fee: Number(raw.monthly_fee || 0),
      scheduler_limit: Number(raw.scheduler_limit || 0),
      expires_at: raw.expires_at || null,
      updated_at: raw.updated_at || null,
      updated_by: raw.updated_by || null,
    }
  })

  const subscriptionStatus = computed(() => {
    return (
      settingsObj.value.subscription_status ||
      settingsObj.value.subscriptionStatus ||
      schoolInfo.value?.subscription_status ||
      schoolInfo.value?.subscriptionStatus ||
      'active'
    )
  })

  const schedulerLimit = computed(() => {
    const override = Number(settingsObj.value.scheduler_limit_override || 0)
    if (override > 0) return override
    return Number(pricingPlan.value?.scheduler_limit || 0)
  })

  const planNotice = computed(() => {
    const raw = settingsObj.value.plan_notice
    if (!raw || typeof raw !== 'object') return null
    return {
      title: raw.title || '',
      message: raw.message || '',
      unread: raw.unread === true,
      updated_at: raw.updated_at || null,
    }
  })

  const subscriptionExpiry = computed(() => {
    const v = pricingPlan.value?.expires_at
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  })

  const isSubscriptionActive = computed(() => {
    if (schoolInfo.value?.is_active === false || schoolInfo.value?.isActive === false) return false
    if (['expired', 'suspended', 'cancelled', 'inactive'].includes(String(subscriptionStatus.value || '').toLowerCase())) {
      return false
    }
    if (!subscriptionExpiry.value) return true
    return subscriptionExpiry.value.getTime() > Date.now()
  })

  const isExpired = computed(() => !isSubscriptionActive.value)
  const isViewOnlyMode = computed(() => isExpired.value)

  // ปีการศึกษา/ภาคเรียน จากข้อมูลพื้นฐานโรงเรียน (settings.school_info)
  const termYear = computed(() => {
    const info = settingsObj.value?.school_info || {}
    return info.year || schoolInfo.value?.year || null
  })
  const termSemester = computed(() => {
    const info = settingsObj.value?.school_info || {}
    return info.semester || null
  })
  const termLabel = computed(() => {
    const y = termYear.value
    const s = termSemester.value
    if (y && s) return `ปีการศึกษา ${y} ภาคเรียนที่ ${s}`
    // fallback: parse currentTerm text
    const t = currentTerm.value || schoolInfo.value?.current_term || ''
    if (t && t.includes('_')) {
      const [yr, sm] = t.split('_')
      if (yr && sm) return `ปีการศึกษา ${yr} ภาคเรียนที่ ${sm}`
    }
    return t || '-'
  })

  return {
    schoolInfo,
    currentTerm,
    schoolName,
    schoolId,
    termYear,
    termSemester,
    termLabel,
    isTimetableLocked,
    featureFlags,
    isFeatureEnabled,
    isTeachingLogEnabled,
    isClubModuleEnabled,
    pricingPlan,
    subscriptionStatus,
    schedulerLimit,
    planNotice,
    subscriptionExpiry,
    isSubscriptionActive,
    isExpired,
    isViewOnlyMode,
    setSchool,
    setCurrentTerm,
    clear,
  }
})
