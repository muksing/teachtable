import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSchoolStore = defineStore('school', () => {
  const schoolInfo = ref(null)
  const currentTerm = ref(null)

  function setSchool(data) { schoolInfo.value = data }
  function setCurrentTerm(term) { currentTerm.value = term }
  function clear() { schoolInfo.value = null; currentTerm.value = null }

  const schoolName        = computed(() => schoolInfo.value?.name || '')
  const isTimetableLocked = computed(() => schoolInfo.value?.timetable_locked === true)
  const featureFlags = computed(() => {
    const raw = schoolInfo.value?.feature_flags
    if (!raw || typeof raw !== 'object') return {}
    return raw
  })

  function isFeatureEnabled(flagName) {
    return featureFlags.value?.[flagName] === true
  }

  const isTeachingLogEnabled = computed(() => isFeatureEnabled('teaching_log_enabled'))
  const isClubModuleEnabled = computed(() => isFeatureEnabled('club_module_enabled'))

  const pricingPlan = computed(() => {
    const raw = schoolInfo.value?.pricing_plan
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

  const schedulerLimit = computed(() => {
    const override = Number(schoolInfo.value?.scheduler_limit_override || 0)
    if (override > 0) return override
    return Number(pricingPlan.value?.scheduler_limit || 0)
  })

  const planNotice = computed(() => {
    const raw = schoolInfo.value?.plan_notice
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
    if (!subscriptionExpiry.value) return false
    return subscriptionExpiry.value.getTime() > Date.now()
  })

  const isExpired = computed(() => !isSubscriptionActive.value)
  const isViewOnlyMode = computed(() => isExpired.value)

  return {
    schoolInfo,
    currentTerm,
    schoolName,
    isTimetableLocked,
    featureFlags,
    isFeatureEnabled,
    isTeachingLogEnabled,
    isClubModuleEnabled,
    pricingPlan,
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
