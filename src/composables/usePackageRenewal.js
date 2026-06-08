import { ref } from 'vue'
import { getFirestore, collection, doc, getDoc, addDoc, setDoc, query, where, getDocs, updateDoc, Timestamp } from 'firebase/firestore'
import { usePricingFormula, calcFormulaMonthly, calcFormulaTotal, getDiscountPercent } from './usePricingFormula'
import { useSchoolDb } from './useSchoolDb'

export function usePackageRenewal() {
  const db = getFirestore()
  const schoolDb = useSchoolDb()
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
      autoRuns: 5, // ค่าคงที่
      resetCycles: 5, // ค่าคงที่
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

  // สร้างคำขอต่ออายุแพ็คเกจ
  async function createRenewalRequest(schoolId, renewalData, userId) {
    try {
      const renewalRequest = {
        schoolId,
        currentPlan: renewalData.currentPlan,
        newPlan: renewalData.newPlan,
        calculationParams: {
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
        paymentEvidence: {
          slipFile: renewalData.slipFile || null,
          amount: renewalData.paymentAmount || 0,
          transferDate: renewalData.transferDate || null,
        },
        status: 'pending', // pending, approved, rejected, active
        requestedBy: userId,
        requestedAt: Timestamp.now(),
        approvedBy: null,
        approvedAt: null,
        renewalType: renewalData.renewalType || 'manual', // manual or auto
        notes: renewalData.notes || '',
      }

      const renewalRef = collection(db, 'schools', schoolId, 'renewal_requests')
      const docRef = await addDoc(renewalRef, renewalRequest)
      return { success: true, requestId: docRef.id, data: renewalRequest }
    } catch (error) {
      console.error('Error creating renewal request:', error)
      return { success: false, error: error.message }
    }
  }

  // ดึงคำขอต่ออายุของรับ
  async function getRenewalRequests(schoolId, status = null) {
    try {
      const renewalRef = collection(db, 'schools', schoolId, 'renewal_requests')
      let q = renewalRef

      if (status) {
        q = query(renewalRef, where('status', '==', status))
      }

      const querySnapshot = await getDocs(q)
      const requests = []
      querySnapshot.forEach((doc) => {
        requests.push({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate ? doc.data().requestedAt.toDate() : null,
          approvedAt: doc.data().approvedAt?.toDate ? doc.data().approvedAt.toDate() : null,
        })
      })

      return { success: true, requests }
    } catch (error) {
      console.error('Error fetching renewal requests:', error)
      return { success: false, error: error.message, requests: [] }
    }
  }

  // ดึงคำขอต่ออายุทั้งหมดจริง (สำหรับ SuperAdmin)
  async function getAllRenewalRequests(status = 'pending') {
    try {
      const allRequests = []
      // หมายเหตุ: ใน Firestore ไม่สามารถ query ข้ามหลาย subcollections ได้โดยตรง
      // ต้องใช้ Admin SDK หรือหลายคำค้นหา
      // นี่เป็นขีดจำกัดของ client SDK
      console.warn('getAllRenewalRequests requires Admin SDK - use Cloud Function instead')
      return { success: false, error: 'Use admin endpoint', requests: [] }
    } catch (error) {
      return { success: false, error: error.message, requests: [] }
    }
  }

  // ดึงคำขอต่ออายุรายชิ้น
  async function getRenewalRequest(schoolId, requestId) {
    try {
      const docRef = doc(db, 'schools', schoolId, 'renewal_requests', requestId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return { success: false, error: 'Request not found' }
      }

      const data = docSnap.data()
      return {
        success: true,
        request: {
          id: docSnap.id,
          ...data,
          requestedAt: data.requestedAt?.toDate ? data.requestedAt.toDate() : null,
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : null,
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
      const docRef = doc(db, 'schools', schoolId, 'renewal_requests', requestId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return { success: false, error: 'Request not found' }
      }

      const renewalData = docSnap.data()
      const now = new Date()
      const expiryDate = new Date(now.getTime() + duration * 30 * 24 * 60 * 60 * 1000) // ประมาณ duration เดือน

      // อัปเดต renewal request
      await updateDoc(docRef, {
        status: 'approved',
        approvedBy: superAdminId,
        approvedAt: Timestamp.now(),
      })

      // อัปเดต school info ด้วยแผนที่อัปเดต
      const schoolInfoRef = doc(db, 'schools', schoolId, 'school_info', 'main')
      await setDoc(
        schoolInfoRef,
        {
          pricing_plan: {
            code: renewalData.newPlan,
            expires_at: Timestamp.fromDate(expiryDate),
            lastRenewalRequest: requestId,
            lastRenewalAt: Timestamp.now(),
          },
        },
        { merge: true }
      )

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
      const docRef = doc(db, 'schools', schoolId, 'renewal_requests', requestId)
      await updateDoc(docRef, {
        status: 'rejected',
        approvedBy: superAdminId,
        approvedAt: Timestamp.now(),
        rejectionReason: reason,
      })

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
