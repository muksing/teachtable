// src/composables/useSchoolManagement.js
// ===== School Management for SuperAdmin =====
import { ref } from 'vue'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, serverTimestamp, deleteField, getCountFromServer } from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db, auth, firebaseConfig } from '@/firebase/db'
import { SCHOOL_REQUEST_STATUS, SCHOOL_SCHEMA, USER_ROLES, generateSchoolId } from '@/firebase/masterSchema'

const PLAN_MAP = {
  '200': { code: '200', monthly_fee: 200, scheduler_limit: 2 },
  '300': { code: '300', monthly_fee: 300, scheduler_limit: 3 },
  '500': { code: '500', monthly_fee: 500, scheduler_limit: 5 },
}

async function fetchPlanFromCatalog(planCode) {
  try {
    const snap = await getDocs(query(collection(db, 'package_catalog'), where('code', '==', String(planCode))))
    if (!snap.empty) {
      const d = snap.docs[0].data()
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

function resolveNextExpiry(prevExpiry, options = {}) {
  const now = new Date()
  const baseDate = prevExpiry && prevExpiry > now ? prevExpiry : now
  const mode = String(options.expiryMode || 'auto_months')

  if (mode === 'manual_date') {
    const manualDate = toDateValue(options.manualDate)
    if (!manualDate) throw new Error('Invalid manual expiry date')
    return manualDate
  }

  if (mode === 'auto_days') {
    const days = Number(options.planDays || 0)
    if (days < 1) throw new Error('Invalid auto days')
    return addDays(baseDate, days)
  }

  const months = Number(options.planMonths || 1)
  if (months < 1) throw new Error('Invalid auto months')
  return addMonths(baseDate, months)
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
    const buildRenewalQuery = (ref) => {
      if (status) {
        return query(ref, where('status', '==', status), orderBy('created_at', 'desc'))
      }
      return query(ref, orderBy('created_at', 'desc'))
    }

    const merged = new Map()

    const rootSnapshot = await getDocs(buildRenewalQuery(collection(db, 'renewal_requests')))
    rootSnapshot.forEach((snap) => {
      const item = mapRenewalRequest(snap.id, snap.data())
      merged.set(`${item.school_id}:${snap.id}`, item)
    })

    const schoolsSnapshot = await getDocs(collection(db, 'schools'))
    const subSnapshots = await Promise.all(
      schoolsSnapshot.docs.map(async (schoolSnap) => {
        const schoolId = schoolSnap.id
        const renewalRef = collection(doc(db, 'schools', schoolId), 'renewal_requests')
        const snapshot = await getDocs(buildRenewalQuery(renewalRef))
        return { schoolId, snapshot }
      })
    )

    subSnapshots.forEach(({ schoolId, snapshot }) => {
      snapshot.forEach((snap) => {
        const item = mapRenewalRequest(snap.id, snap.data(), schoolId)
        const key = `${item.school_id}:${snap.id}`
        if (!merged.has(key)) {
          merged.set(key, item)
        }
      })
    })

    return Array.from(merged.values()).sort((a, b) => {
      const aTime = a.created_at?.getTime?.() || 0
      const bTime = b.created_at?.getTime?.() || 0
      return bTime - aTime
    })
  }

  // ===== Get School Requests =====
  async function getSchoolRequests(status = null) {
    loading.value = true
    error.value = null

    try {
      let q
      
      if (status) {
        q = query(
          collection(db, 'school_requests'),
          where('status', '==', status),
          orderBy('submittedAt', 'desc')
        )
      } else {
        q = query(
          collection(db, 'school_requests'),
          orderBy('submittedAt', 'desc')
        )
      }

      console.log('Fetching school requests with status:', status)
      const snapshot = await getDocs(q)
      const requests = []

      console.log('Found', snapshot.size, 'requests')

      snapshot.forEach(doc => {
        const data = doc.data()
        console.log('Request:', doc.id, data)
        requests.push({
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt?.toDate(),
          reviewedAt: data.reviewedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate()
        })
      })

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

      // 1. Get request data
      const requestDoc = await getDoc(doc(db, 'school_requests', requestId))
      if (!requestDoc.exists()) throw new Error('School request not found in database.')
      
      const requestData = requestDoc.data()
      console.log('Approve processing for:', requestData.schoolName)

      if (requestData.status === SCHOOL_REQUEST_STATUS.APPROVED) {
        throw new Error('This school request has already been approved.')
      }
      // Robust Trim and Validation
      const adminEmail = String(requestData.adminEmail || '').trim()
      const adminPassword = String(requestData.adminPassword || '').trim()

      if (!adminEmail) throw new Error('Admin Email is missing in the registration request data.')
      if (!adminPassword) throw new Error('Admin Password is missing in the registration request data.')
      if (adminPassword.length < 6) throw new Error('Admin Password must be at least 6 characters for security.')

      // 2. Generate / reuse school ID
      const schoolId = requestData.schoolId || generateSchoolId(requestData.schoolName)

      // 3. Create Auth account using SECONDARY APP (to avoid logging out SuperAdmin)
      const secondaryApp = getApps().find(a => a.name === 'approval-app') || initializeApp(firebaseConfig, 'approval-app')
      const secondaryAuth = getAuth(secondaryApp)

      let userCred
      try {
        userCred = await createUserWithEmailAndPassword(
          secondaryAuth,
          adminEmail,
          adminPassword
        )
      } catch (authError) {
        if (authError?.code === 'auth/email-already-in-use') {
          throw new Error('An account with this admin email already exists. Please use a different email.')
        }
        throw authError
      }
      const newUser = userCred.user

      // Sign out from secondary app immediately to keep auth clean
      await signOut(secondaryAuth)

      // 4. Create school document in main DB (SuperAdmin is still authed here)
      const schoolData = {
        ...SCHOOL_SCHEMA,
        schoolId: schoolId,
        schoolName: requestData.schoolName,
        schoolAddress: requestData.schoolAddress || '',
        schoolPhone: requestData.schoolPhone || '',
        schoolEmail: requestData.schoolEmail || '',
        adminUid: newUser.uid,
        adminEmail: adminEmail,
        currentTerm: '2568_1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        subscriptionStatus: 'active'
      }
      await setDoc(doc(db, 'schools', schoolId), schoolData)

      // 5. Create user document
      const userData = {
        uid: newUser.uid,
        email: adminEmail,
        displayName: requestData.contactName,
        role: USER_ROLES.SCHOOL_ADMIN,
        schoolId: schoolId,
        schoolRole: 'admin',
        isActive: true,
        createdAt: serverTimestamp()
      }
      await setDoc(doc(db, 'users', newUser.uid), userData)

      // 6. Queue Approval Email (Do this BEFORE deleting password from request)
      await addDoc(collection(db, 'email_queue'), {
        to: adminEmail,
        subject: `ยินดีด้วย! โรงเรียน ${requestData.schoolName} ได้รับการอนุมัติเข้าใช้งานแล้ว`,
        htmlBody: `
          <h3>การสมัครใช้งานได้รับการอนุมัติ</h3>
          <p>สวัสดีคุณ ${requestData.contactName},</p>
          <p>โรงเรียน <b>${requestData.schoolName}</b> ของคุณได้รับการอนุมัติให้ใช้งานระบบ Master-teachtable เรียบร้อยแล้ว</p>
          <p><b>ข้อมูลการเข้าสู่ระบบ:</b></p>
          <ul>
            <li>อีเมล: ${adminEmail}</li>
            <li>รหัสผ่านชั่วคราว: ${adminPassword}</li>
          </ul>
          <p>คุณสามารถเข้าสู่ระบบได้ที่: <a href="https://master-teachtable.web.app/login">https://master-teachtable.web.app/login</a></p>
          <p><i>* กรุณาเปลี่ยนรหัสผ่านทันทีหลังจากเข้าสู่ระบบครั้งแรก</i></p>
        `,
        status: 'pending',
        createdAt: serverTimestamp()
      })

      // 7. Update request status and DELETE password (Final step)
      await updateDoc(doc(db, 'school_requests', requestId), {
        status: SCHOOL_REQUEST_STATUS.APPROVED,
        schoolId: schoolId,
        reviewedAt: serverTimestamp(),
        reviewedBy: superAdminUid,
        approvedAt: serverTimestamp(),
        adminPassword: deleteField(),
        approvalToken: deleteField(),
        tokenCreatedAt: deleteField()
      })

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
        getCountFromServer(query(collection(db, 'schools'), where('isActive', '==', true))),
        getCountFromServer(query(collection(db, 'school_requests'), where('status', '==', 'pending'))),
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(query(collection(db, 'users'), where('isActive', '==', true))),
        getDocs(collection(db, 'users')),
        fetchRenewalRequestsRaw('pending'),
      ])

      const warnings = []

      const totalSchools = schoolsCountResult.status === 'fulfilled'
        ? Number(schoolsCountResult.value.data().count || 0)
        : 0
      if (schoolsCountResult.status === 'rejected') {
        warnings.push(`totalSchools: ${schoolsCountResult.reason?.message || 'unknown error'}`)
      }

      const pendingRequests = requestsCountResult.status === 'fulfilled'
        ? Number(requestsCountResult.value.data().count || 0)
        : 0
      if (requestsCountResult.status === 'rejected') {
        warnings.push(`pendingRequests: ${requestsCountResult.reason?.message || 'unknown error'}`)
      }

      const usersFromSnapshot = usersSnapshotResult.status === 'fulfilled'
        ? usersSnapshotResult.value.docs.map((snap) => snap.data() || {})
        : []

      const totalUsersFromSnapshot = usersFromSnapshot.length
      const activeUsersFromSnapshot = usersFromSnapshot.filter((u) => u?.isActive === true || u?.is_active === true).length

      const totalUsers = usersCountResult.status === 'fulfilled'
        ? Number(usersCountResult.value.data().count || 0)
        : totalUsersFromSnapshot
      if (usersCountResult.status === 'rejected') {
        warnings.push(`totalUsers: ${usersCountResult.reason?.message || 'unknown error'}`)
      }

      const activeUsers = activeUsersCountResult.status === 'fulfilled'
        ? Math.max(Number(activeUsersCountResult.value.data().count || 0), activeUsersFromSnapshot)
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
      const requestDoc = await getDoc(doc(db, 'school_requests', requestId))
      if (!requestDoc.exists()) throw new Error('School request not found')
      const requestData = requestDoc.data()

      await updateDoc(doc(db, 'school_requests', requestId), {
        status: SCHOOL_REQUEST_STATUS.REJECTED,
        rejectionReason: reason,
        reviewedAt: serverTimestamp(),
        reviewedBy: superAdminUid,
        approvalToken: deleteField(),
        tokenCreatedAt: deleteField()
      })

      // Queue Rejection Email
      await addDoc(collection(db, 'email_queue'), {
        to: requestData.contactEmail,
        subject: `แจ้งผลการสมัครใช้งานระบบ Master-teachtable - ${requestData.schoolName}`,
        htmlBody: `
          <h3>แจ้งผลการพิจารณาการสมัคร</h3>
          <p>สวัสดีคุณ ${requestData.contactName},</p>
          <p>ตามที่ท่านได้ยื่นคำขอสมัครใช้งานสำหรับ <b>${requestData.schoolName}</b></p>
          <p>ทางทีมงานขอแจ้งให้ทราบว่าคำขอของท่านได้รับการ <b>ปฏิเสธ</b></p>
          <p><b>สาเหตุ:</b> ${reason}</p>
          <p>ท่านสามารถสอบถามข้อมูลเพิ่มเติมหรือยื่นเรื่องใหม่ได้หากมีการแก้ไขข้อมูลตามที่แจ้งข้างต้น</p>
        `,
        status: 'pending',
        createdAt: serverTimestamp()
      })

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
      const q = query(
        collection(db, 'schools'),
        orderBy('createdAt', 'desc')
      )

      const snapshot = await getDocs(q)
      const schools = []

      const schoolRows = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate()
      }))

      const infoDocs = await Promise.all(
        schoolRows.map(async (s) => {
          const infoSnap = await getDoc(doc(db, 'schools', s.id, 'school_info', 'main'))
          return { schoolId: s.id, data: infoSnap.exists() ? infoSnap.data() : null }
        })
      )

      const infoMap = Object.fromEntries(infoDocs.map(x => [x.schoolId, x.data]))

      schoolRows.forEach((s) => {
        const info = infoMap[s.id] || null
        const plan = info?.pricing_plan || null
        const override = Number(info?.scheduler_limit_override || 0)
        const defaultLimit = Number(plan?.scheduler_limit || 0)
        schools.push({
          ...s,
          feature_flags: info?.feature_flags || {},
          pricing_plan: plan,
          plan_notice: info?.plan_notice || null,
          latest_renewal_approval: info?.latest_renewal_approval || null,
          scheduler_limit_override: override > 0 ? override : null,
          scheduler_limit_effective: override > 0 ? override : defaultLimit,
          limit_source: override > 0 ? 'override' : 'package',
          schoolInfoUpdatedAt: info?.updated_at?.toDate?.() || null,
        })
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
      const schoolDoc = await getDoc(doc(db, 'schools', schoolId))
      if (!schoolDoc.exists()) {
        throw new Error('School not found')
      }

      await updateDoc(doc(db, 'schools', schoolId), {
        isActive: isActive,
        updatedAt: serverTimestamp()
      })

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
      let q
      if (activeOnly) {
        q = query(collection(db, 'package_catalog'), where('is_active', '==', true), orderBy('sort_order', 'asc'))
      } else {
        q = query(collection(db, 'package_catalog'), orderBy('sort_order', 'asc'))
      }
      const snap = await getDocs(q)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      return { success: true, data }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function createPackage(data, superAdminUid) {
    loading.value = true
    error.value = null
    try {
      const code = String(data.code || '').trim()
      if (!code) throw new Error('กรุณากรอกรหัสแพ็กเกจ')
      const docRef = doc(collection(db, 'package_catalog'))
      await setDoc(docRef, {
        code,
        name: String(data.name || code).trim(),
        monthly_fee: Number(data.monthly_fee || 0),
        scheduler_limit: Number(data.scheduler_limit || 1),
        duration_months: Number(data.duration_months || 1),
        is_active: data.is_active !== false,
        sort_order: Number(data.sort_order || 99),
        created_at: serverTimestamp(),
        created_by: superAdminUid || null,
        updated_at: serverTimestamp(),
        updated_by: superAdminUid || null,
      })
      return { success: true, id: docRef.id }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function updatePackage(packageId, data, superAdminUid) {
    loading.value = true
    error.value = null
    try {
      if (!packageId) throw new Error('packageId is required')
      const payload = {
        updated_at: serverTimestamp(),
        updated_by: superAdminUid || null,
      }
      if (data.name !== undefined) payload.name = String(data.name || '').trim()
      if (data.monthly_fee !== undefined) payload.monthly_fee = Number(data.monthly_fee || 0)
      if (data.scheduler_limit !== undefined) payload.scheduler_limit = Number(data.scheduler_limit || 1)
      if (data.duration_months !== undefined) payload.duration_months = Number(data.duration_months || 1)
      if (data.sort_order !== undefined) payload.sort_order = Number(data.sort_order || 99)
      await updateDoc(doc(db, 'package_catalog', packageId), payload)
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function togglePackageActive(packageId, isActive, superAdminUid) {
    loading.value = true
    error.value = null
    try {
      if (!packageId) throw new Error('packageId is required')
      await updateDoc(doc(db, 'package_catalog', packageId), {
        is_active: Boolean(isActive),
        updated_at: serverTimestamp(),
        updated_by: superAdminUid || null,
      })
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
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

      const schoolDocRef = doc(db, 'schools', schoolId)
      const schoolInfoRef = doc(db, 'schools', schoolId, 'school_info', 'main')
      const [schoolSnap, infoSnap] = await Promise.all([getDoc(schoolDocRef), getDoc(schoolInfoRef)])

      if (!schoolSnap.exists()) {
        throw new Error('School not found')
      }

      const info = infoSnap.exists() ? infoSnap.data() : {}
      const prevPlan = info?.pricing_plan || null
      const prevExpiry = toDateValue(prevPlan?.expires_at)
      const nextExpiry = resolveNextExpiry(prevExpiry, options)
      const expiryMode = String(options.expiryMode || 'auto_months')

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
        updated_at: serverTimestamp(),
        updated_by: superAdminUid || null,
      }

      const noticeSuffix = schedulerLimitOverride
        ? ` (กำหนดเอง ${schedulerLimitOverride} คน)`
        : ''

      const writePayload = {
        pricing_plan: pricingPlan,
        limit_source: schedulerLimitOverride ? 'override' : 'package',
        plan_notice: {
          title: 'อัปเดตแพ็กเกจการใช้งาน',
          message: `แพ็กเกจใหม่ ${displayFee} บาท/เดือน ใช้งานจัดตารางพร้อมกันได้ ${selected.scheduler_limit} คน${noticeSuffix}`,
          unread: true,
          updated_at: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
      }

      if (schedulerLimitOverride) {
        writePayload.scheduler_limit_override = schedulerLimitOverride
      } else {
        writePayload.scheduler_limit_override = deleteField()
      }

      await setDoc(schoolInfoRef, writePayload, { merge: true })

      await addDoc(collection(db, 'plan_change_logs'), {
        schoolId,
        schoolName: schoolSnap.data()?.schoolName || '',
        old_plan: prevPlan || null,
        new_plan: {
          ...selected,
          monthly_fee: displayFee,
          expiry_mode: expiryMode,
          months: Number(options.planMonths || 0),
          days: Number(options.planDays || 0),
          manual_date: options.manualDate || null,
          scheduler_limit_effective: effectiveLimit,
          scheduler_limit_override: schedulerLimitOverride,
          expires_at: nextExpiry,
        },
        note: options.note || '',
        changed_by: superAdminUid || null,
        changed_at: serverTimestamp(),
        createdAt: serverTimestamp(),
      })

      return {
        success: true,
        data: {
          pricing_plan: {
            ...selected,
            monthly_fee: displayFee,
            expires_at: nextExpiry,
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

      const infoRef = doc(db, 'schools', schoolId, 'school_info', 'main')
      const infoSnap = await getDoc(infoRef)
      const existing = infoSnap.exists() ? infoSnap.data() : {}

      await setDoc(infoRef, {
        feature_flags: {
          ...(existing.feature_flags || {}),
          ...flags,
        },
        updated_at: serverTimestamp(),
        updated_by: superAdminUid || null,
      }, { merge: true })

      return {
        success: true,
        data: {
          feature_flags: {
            ...(existing.feature_flags || {}),
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

      const rootRef = doc(db, 'renewal_requests', requestId)
      const schoolRef = doc(db, 'schools', schoolId, 'renewal_requests', requestId)
      const [rootSnap, schoolSnap] = await Promise.all([getDoc(rootRef), getDoc(schoolRef)])
      const requestData = rootSnap.exists() ? rootSnap.data() : schoolSnap.exists() ? schoolSnap.data() : null

      if (!requestData) throw new Error('Renewal request not found')
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
        const schoolInfoSnap = await getDoc(doc(db, 'schools', schoolId, 'school_info', 'main'))
        planCode = String(schoolInfoSnap.data()?.pricing_plan?.code || '')
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

      const reviewPayload = {
        status: 'approved',
        reviewed_at: serverTimestamp(),
        reviewed_by: superAdminUid,
        approved_at: serverTimestamp(),
        approved_plan_code: planCode,
        applied_scheduler_limit: schedulerLimitOverride || Number(result.data?.scheduler_limit_effective || 0),
        applied_calculated_monthly: calculatedMonthly,
        applied_calculated_total: calculatedTotal,
        rejection_reason: deleteField(),
      }

      const schoolInfoPatch = {
        latest_renewal_approval: {
          request_id: requestId,
          renewal_mode: renewalMode,
          approved_at: serverTimestamp(),
          approved_by: superAdminUid,
          months,
          amount_paid: paidAmount,
          calculated_monthly: calculatedMonthly,
          calculated_total: calculatedTotal,
          calculation_input: calculationInput,
          scheduler_limit_applied: schedulerLimitOverride || Number(result.data?.scheduler_limit_effective || 0),
          plan_code: planCode,
        },
      }

      await Promise.all([
        setDoc(rootRef, reviewPayload, { merge: true }),
        setDoc(schoolRef, reviewPayload, { merge: true }),
        setDoc(doc(db, 'schools', schoolId, 'school_info', 'main'), schoolInfoPatch, { merge: true }),
        addDoc(collection(db, 'email_queue'), {
          to: requestData.contact_email || '',
          subject: `อนุมัติต่ออายุแพ็กเกจเรียบร้อย - ${requestData.school_name || schoolId}`,
          htmlBody: `
            <h3>คำขอต่ออายุได้รับการอนุมัติแล้ว</h3>
            <p><b>โรงเรียน:</b> ${requestData.school_name || schoolId}</p>
            <p><b>แพ็กเกจ:</b> ${planCode}</p>
            <p><b>จำนวนเดือน:</b> ${months}</p>
            <p>ระบบได้ต่ออายุการใช้งานให้เรียบร้อยแล้ว กรุณาเข้าสู่ระบบเพื่อตรวจสอบอีกครั้ง</p>
          `,
          status: 'pending',
          createdAt: serverTimestamp(),
        }),
      ])

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

      const rootRef = doc(db, 'renewal_requests', requestId)
      const schoolRef = doc(db, 'schools', schoolId, 'renewal_requests', requestId)
      const [rootSnap, schoolSnap] = await Promise.all([getDoc(rootRef), getDoc(schoolRef)])
      const requestData = rootSnap.exists() ? rootSnap.data() : schoolSnap.exists() ? schoolSnap.data() : null

      if (!requestData) throw new Error('Renewal request not found')

      const reviewPayload = {
        status: 'rejected',
        rejection_reason: String(reason).trim(),
        reviewed_at: serverTimestamp(),
        reviewed_by: superAdminUid,
        approved_at: deleteField(),
      }

      await Promise.all([
        setDoc(rootRef, reviewPayload, { merge: true }),
        setDoc(schoolRef, reviewPayload, { merge: true }),
        addDoc(collection(db, 'email_queue'), {
          to: requestData.contact_email || '',
          subject: `ผลการพิจารณาคำขอต่ออายุ - ${requestData.school_name || schoolId}`,
          htmlBody: `
            <h3>คำขอต่ออายุยังไม่ได้รับการอนุมัติ</h3>
            <p><b>โรงเรียน:</b> ${requestData.school_name || schoolId}</p>
            <p><b>เหตุผล:</b> ${String(reason).trim()}</p>
            <p>กรุณาตรวจสอบข้อมูลการโอนเงินและส่งคำขอใหม่อีกครั้ง</p>
          `,
          status: 'pending',
          createdAt: serverTimestamp(),
        }),
      ])

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
      await deleteDoc(doc(db, 'renewal_requests', requestId))
      if (schoolId) {
        try {
          await deleteDoc(doc(db, 'schools', schoolId, 'renewal_requests', requestId))
        } catch {}
      }
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
    getPackageCatalog,
    createPackage,
    updatePackage,
    togglePackageActive,
  }
}