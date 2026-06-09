// src/composables/useBehavior.js
import {
  doc, getDoc, setDoc, updateDoc,
  collection, writeBatch, serverTimestamp
} from '@/supabase/firestore'
import { getSchoolDb } from '@/supabase/db'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

export function useBehavior() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const db = () => getSchoolDb()
  const batchDb = () => db().firestore || db()
  const term = () => schoolStore.currentTerm || '2568_1'

  function getBehaviorTypeLabel(type) {
    const labels = {
      general: 'ความประพฤติทั่วไป',
      attendance: 'พฤติกรรมการมาเรียน',
      learning: 'พฤติกรรมในห้องเรียน'
    }
    return labels[type] || type
  }

  /**
   * บันทึก behavior log — Batch Write (Atomic)
   */
  async function recordBehavior({ student, setting, pointsChange, note, source = 'manual', refTeachingLogId = null, image_urls = [] }) {
    const t = term()
    const logRef = doc(collection(db(), `terms/${t}/behavior_logs`))
    const logId = logRef.id

    // ดึง summary ปัจจุบัน
    const summarySnap = await getDoc(doc(db(), `terms/${t}/behavior_summary`, student.student_id))
    const summary = summarySnap.exists() ? summarySnap.data() : {
      total_score: 0, general_score: 0, attendance_score: 0, learning_score: 0
    }

    const typeKey = `${setting.behavior_type}_score`
    const scoreBefore = summary[typeKey] || 0
    const scoreAfter  = scoreBefore + pointsChange
    const newTotal    = (summary.total_score || 0) + pointsChange

    // Snapshot pattern
    const logData = {
      log_id: logId,
      student_id: student.student_id,
      class_id: student.class_id,
      behavior_type: setting.behavior_type,
      source,
      ref_teaching_log_id: refTeachingLogId || null,
      setting_id: setting.setting_id,
      label_snapshot: setting.label,
      behavior_type_label_snapshot: getBehaviorTypeLabel(setting.behavior_type),
      points_policy_snapshot: setting.points_default,
      points_change: pointsChange,
      score_before: scoreBefore,
      score_after: scoreAfter,
      recorded_by: authStore.profile?.uid || 'system',
      recorded_by_name_snapshot: authStore.profile?.displayName || 'ระบบ',
      date: new Date().toISOString().split('T')[0],
      note: note || '',
      image_urls: Array.isArray(image_urls) ? image_urls : [],
      can_delete: false,
      updated_at: serverTimestamp()
    }

    // Batch Write — Atomic
    const batch = writeBatch(batchDb())
    batch.set(logRef, logData)
    batch.set(
      doc(db(), `terms/${t}/behavior_summary`, student.student_id),
      {
        total_score: newTotal,
        [typeKey]: scoreAfter,
        last_updated: serverTimestamp()
      },
      { merge: true }
    )

    // อัปเดตคะแนนรวมกลับไปที่ตารางนักเรียน เพื่อให้หน้านักเรียนเห็นค่าล่าสุดทันที
    batch.update(doc(db(), `terms/${t}/students`, student.student_id), {
      total_behavior_score: newTotal,
      [`${setting.behavior_type}_behavior_score`]: scoreAfter
    })

    await batch.commit()
    return logId
  }

  /**
   * เช็คชื่อ → บันทึก teaching_log + auto behavior (Batch Atomic)
   */
  async function recordAttendance({ teachingLogId, studentId, statusCode, statusSettings, student }) {
    const t = term()
    const status = statusSettings.find(s => s.status_code === statusCode)
    if (!status) throw new Error('ไม่พบสถานะการเข้าเรียน')

    const batch = writeBatch(batchDb())

    // 1. อัพเดต attendance ใน teaching_log
    batch.update(
      doc(db(), `terms/${t}/teaching_logs`, teachingLogId),
      {
        [`attendance.${studentId}`]: statusCode,
        updated_by: authStore.profile?.uid,
        updated_at: serverTimestamp()
      }
    )

    // 2. ถ้า affects_behavior หรือมีการตั้งคะแนน (ไม่เท่ากับ 0) → สร้าง behavior log อัตโนมัติ
    if (status.affects_behavior || status.points_default !== 0) {
        const summarySnap = await getDoc(
          doc(db(), `terms/${t}/behavior_summary`, studentId)
        )
        const summary = summarySnap.exists() ? summarySnap.data() : {
          total_score: 0, attendance_score: 0
        }

        const scoreBefore = summary.attendance_score || 0
        const scoreAfter  = scoreBefore + status.points_default
        const newTotal    = (summary.total_score || 0) + status.points_default

        const logRef = doc(collection(db(), `terms/${t}/behavior_logs`))
        batch.set(logRef, {
          log_id: logRef.id,
          student_id: studentId,
          class_id: student.class_id,
          behavior_type: 'attendance',
          source: 'auto_attendance',
          ref_teaching_log_id: teachingLogId,
          setting_id: status.status_code,
          label_snapshot: status.label,
          behavior_type_label_snapshot: 'พฤติกรรมการมาเรียน',
          points_policy_snapshot: status.points_default,
          points_change: status.points_default,
          score_before: scoreBefore,
          score_after: scoreAfter,
          recorded_by: 'system',
          recorded_by_name_snapshot: 'ระบบอัตโนมัติ',
          date: new Date().toISOString().split('T')[0],
          note: `เช็คชื่อ: ${status.label}`,
          can_delete: false,
          updated_at: serverTimestamp()
        })

        batch.set(
          doc(db(), `terms/${t}/behavior_summary`, studentId),
          {
            total_score: newTotal,
            attendance_score: scoreAfter,
            last_updated: serverTimestamp()
          },
          { merge: true }
        )

        // อัปเดตคะแนนรวมกลับไปที่ตารางนักเรียน เพื่อให้หน้านักเรียนเห็นค่าล่าสุดทันที
        batch.update(doc(db(), `terms/${t}/students`, studentId), {
          total_behavior_score: newTotal,
          attendance_behavior_score: scoreAfter
        })
    }

    await batch.commit()
  }

  /**
   * เช็คชื่อทั้งห้อง — Batch ทีเดียว
   */
  async function recordAttendanceBulk({ teachingLogId, attendanceMap, statusSettings, students }) {
    // attendanceMap = { student_id: status_code, ... }
    for (const [studentId, statusCode] of Object.entries(attendanceMap)) {
      const student = students.find(s => s.student_id === studentId)
      if (student) {
        await recordAttendance({ teachingLogId, studentId, statusCode, statusSettings, student })
      }
    }
  }

  return { recordBehavior, recordAttendance, recordAttendanceBulk }
}
