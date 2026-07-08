import { ref } from 'vue'
import { supabase } from '@/supabase/client'
import { useStudentStore } from '@/stores/student'
import { uploadViaGAS } from '@/composables/useStudentUpload'

function thaiToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function getPos(highAccuracy, timeout, maxAge) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout,
      maximumAge: maxAge,
    })
  )
}

export function useCheckin() {
  const studentStore = useStudentStore()

  const status      = ref('idle') // idle | locating | device_check | uploading | selfie | done | error
  const errorMsg    = ref('')
  const todayCheckin = ref(null)
  const gpsAttempt  = ref(0) // 1-3 แสดงใน UI
  const awardedPoints = ref(null) // จำนวนคะแนนที่ได้รับจากเช็คอินครั้งนี้ (null = ไม่ได้รับ/ยังไม่ประมวลผล)

  async function loadTodayCheckin() {
    const { school_id, student_code } = studentStore.session || {}
    if (!school_id || !student_code) return
    const { data } = await supabase
      .from('student_checkins')
      .select('*')
      .eq('school_id', school_id)
      .eq('student_code', student_code)
      .eq('date', thaiToday())
      .maybeSingle()
    todayCheckin.value = data || null
    if (data) status.value = 'done'
  }

  // คืนค่า { lat, lng } หรือ null ถ้า GPS ไม่สำเร็จทุกรอบ
  async function tryGetGPS() {
    if (!navigator.geolocation) return null

    // รอบ 1: ใช้ cache ไม่เกิน 2 นาที — เร็วที่สุด ไม่ต้องรอ GPS ใหม่
    gpsAttempt.value = 1
    try {
      const pos = await getPos(true, 8000, 120000)
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, method: 'gps_cached' }
    } catch { /* ลองรอบ 2 */ }

    // รอบ 2: high accuracy ไม่มี cache รอ 25 วิ
    gpsAttempt.value = 2
    try {
      const pos = await getPos(true, 25000, 0)
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, method: 'gps_high' }
    } catch { /* ลองรอบ 3 */ }

    // รอบ 3: network-based (ไม่ต้องการ GPS chip) รอ 20 วิ
    gpsAttempt.value = 3
    try {
      const pos = await getPos(false, 20000, 30000)
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, method: 'gps_network' }
    } catch { /* ล้มเหลวทั้งหมด */ }

    return null
  }

  async function performCheckin(selfieBlob = null) {
    const sess = studentStore.session || {}
    const { school_id, student_code, class_id } = sess
    if (!school_id || !student_code) {
      status.value = 'error'
      errorMsg.value = 'ไม่พบข้อมูลนักเรียน'
      return
    }

    try {
      // 1. ดึงพิกัด GPS พร้อม retry 3 รอบ
      status.value = 'locating'
      gpsAttempt.value = 0
      const gpsResult = await tryGetGPS()

      // 2. ตรวจสอบระยะจากโรงเรียน (ถ้าได้ GPS)
      status.value = 'device_check'
      let distanceM = null
      let checkinMethod = 'selfie_only' // default ถ้า GPS ไม่ได้

      if (gpsResult) {
        checkinMethod = gpsResult.method

        const { data: schoolData } = await supabase
          .from('schools')
          .select('settings')
          .eq('id', school_id)
          .single()

        const cfg = schoolData?.settings?.checkin_config || {}
        if (cfg.lat && cfg.lng) {
          distanceM = haversineMetres(gpsResult.lat, gpsResult.lng, cfg.lat, cfg.lng)
          // network-based ใช้ radius ใหญ่กว่า (อาจผิดพลาดได้มาก)
          const radius = gpsResult.method === 'gps_network'
            ? Math.max(cfg.radius_meters || 300, 1000)
            : (cfg.radius_meters || 300)
          if (distanceM > radius) {
            status.value = 'error'
            errorMsg.value = `อยู่ห่างจากโรงเรียน ${Math.round(distanceM)} เมตร (ต้องอยู่ภายใน ${radius} เมตร)`
            return
          }
        }
      }
      // ถ้า GPS ไม่ได้เลย → ยังให้เช็คอินได้ แต่ method = selfie_only

      // 3. device id
      let deviceId = localStorage.getItem('student_device_id')
      if (!deviceId) {
        deviceId = crypto.randomUUID()
        localStorage.setItem('student_device_id', deviceId)
      }

      // 4. อัปโหลดเซลฟี่
      status.value = 'uploading'
      let selfieUrl = null
      if (selfieBlob) {
        try {
          const timeHHMM = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).replace(':', '')
          const fileName = `selfie_${student_code}_${thaiToday()}_${timeHHMM}.jpg`
          const file = new File([selfieBlob], fileName, { type: 'image/jpeg' })
          selfieUrl = await uploadViaGAS(file, school_id, 'checkin', fileName)
        } catch (err) {
          console.warn('[Checkin] GAS selfie upload failed:', err.message)
        }
      }

      // 5. บันทึกเช็คอิน
      const { data: record, error: ciErr } = await supabase
        .from('student_checkins')
        .upsert([{
          school_id, student_code, class_id: class_id || null,
          date:          thaiToday(),
          checkin_time:  new Date().toISOString(),
          lat:           gpsResult?.lat ?? null,
          lng:           gpsResult?.lng ?? null,
          distance_m:    distanceM != null ? Math.round(distanceM) : null,
          selfie_url:    selfieUrl,
          device_id:     deviceId,
          checkin_method: checkinMethod,
        }], { onConflict: 'school_id,student_code,date' })
        .select().single()

      if (ciErr) throw ciErr
      todayCheckin.value = record
      status.value = 'done'

      // เพิ่มคะแนนความประพฤติอัตโนมัติ (ถ้าเปิดใช้ในตั้งค่าเช็คอิน)
      try {
        const { data: pts } = await supabase.rpc('award_checkin_points', {
          p_school_id: school_id,
          p_student_code: student_code,
          p_class_id: class_id || null,
        })
        awardedPoints.value = typeof pts === 'number' ? pts : null
      } catch (err) {
        console.warn('[Checkin] award_checkin_points failed:', err.message)
      }
    } catch (err) {
      status.value = 'error'
      if (err.code === 1)      errorMsg.value = 'ไม่อนุญาตให้ใช้ GPS — กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์'
      else                     errorMsg.value = err.message || 'เกิดข้อผิดพลาด'
    }
  }

  return { status, errorMsg, todayCheckin, gpsAttempt, awardedPoints, performCheckin, loadTodayCheckin }
}
