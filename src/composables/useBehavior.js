// src/composables/useBehavior.js
import { supabase } from '@/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { useSchoolStore } from '@/stores/school'

export function useBehavior() {
  const authStore = useAuthStore()
  const schoolStore = useSchoolStore()
  const schoolId = () => authStore.schoolId
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
   * บันทึก behavior log และอัปเดตคะแนนนักเรียน (Atomic via Supabase RPC หรือลำดับ)
   */
  async function recordBehavior({ student, setting, pointsChange, note, source = 'manual', refTeachingLogId = null, image_urls = [] }) {
    const t = term()
    const sid = schoolId()

    // ดึงคะแนนปัจจุบันของนักเรียน
    const { data: studentData, error: studentErr } = await supabase
      .from('students')
      .select('total_behavior_score, attendance_behavior_score, learning_behavior_score')
      .eq('id', student.student_id)
      .eq('school_id', sid)
      .single()

    if (studentErr) throw studentErr

    const behaviorType = setting.behavior_type
    const scoreField = behaviorType === 'attendance'
      ? 'attendance_behavior_score'
      : behaviorType === 'learning'
        ? 'learning_behavior_score'
        : null

    const scoreBefore = scoreField ? (studentData?.[scoreField] || 0) : 0
    const scoreAfter  = scoreBefore + pointsChange
    const newTotal    = (studentData?.total_behavior_score || 0) + pointsChange

    // 1. บันทึก behavior log
    const logData = {
      term_id: t,
      student_id: student.student_id,
      class_id: student.class_id,
      recorded_by: authStore.profile?.uid || 'system',
      source_type: source,
      source_id: refTeachingLogId || null,
      behavior_type: behaviorType,
      points_change: pointsChange,
      score_after: scoreAfter,
      note: note || '',
      image_urls: Array.isArray(image_urls) ? image_urls : [],
      school_id: sid,
      created_at: new Date().toISOString(),
    }

    const { error: logErr } = await supabase.from('behavior_logs').insert(logData)
    if (logErr) throw logErr

    // 2. อัปเดตคะแนนรวมในตารางนักเรียน
    const updatePayload = { total_behavior_score: newTotal }
    if (scoreField) updatePayload[scoreField] = scoreAfter

    const { error: updateErr } = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', student.student_id)
      .eq('school_id', sid)

    if (updateErr) throw updateErr

    return logData
  }

  /**
   * เช็คชื่อ → บันทึก attendance_record + auto behavior
   */
  async function recordAttendance({ teachingLogId, studentId, statusCode, statusSettings, student }) {
    const t = term()
    const sid = schoolId()
    const status = statusSettings.find(s => s.status_code === statusCode)
    if (!status) throw new Error('ไม่พบสถานะการเข้าเรียน')

    // 1. อัพเดต/สร้าง attendance_record
    const { error: attendErr } = await supabase
      .from('attendance_records')
      .upsert({
        teach_actual_id: teachingLogId,
        student_id: studentId,
        status: statusCode,
        attendance_points: status.points_default || 0,
        learning_points: 0,
        note: '',
      }, { onConflict: 'teach_actual_id,student_id' })

    if (attendErr) throw attendErr

    // 2. ถ้า affects_behavior หรือมีการตั้งคะแนน → สร้าง behavior log อัตโนมัติ
    if (status.affects_behavior || status.points_default !== 0) {
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('total_behavior_score, attendance_behavior_score')
        .eq('id', studentId)
        .eq('school_id', sid)
        .single()

      if (studentErr) throw studentErr

      const scoreBefore = studentData?.attendance_behavior_score || 0
      const scoreAfter  = scoreBefore + status.points_default
      const newTotal    = (studentData?.total_behavior_score || 0) + status.points_default

      const { error: logErr } = await supabase.from('behavior_logs').insert({
        term_id: t,
        student_id: studentId,
        class_id: student.class_id,
        recorded_by: 'system',
        source_type: 'auto_attendance',
        source_id: teachingLogId,
        behavior_type: 'attendance',
        points_change: status.points_default,
        score_after: scoreAfter,
        note: `เช็คชื่อ: ${status.label}`,
        image_urls: [],
        school_id: sid,
        created_at: new Date().toISOString(),
      })

      if (logErr) throw logErr

      const { error: updateErr } = await supabase
        .from('students')
        .update({
          total_behavior_score: newTotal,
          attendance_behavior_score: scoreAfter,
        })
        .eq('id', studentId)
        .eq('school_id', sid)

      if (updateErr) throw updateErr
    }
  }

  /**
   * เช็คชื่อทั้งห้อง — ทำทีละคนตามลำดับ
   */
  async function recordAttendanceBulk({ teachingLogId, attendanceMap, statusSettings, students }) {
    for (const [studentId, statusCode] of Object.entries(attendanceMap)) {
      const student = students.find(s => s.student_id === studentId || s.id === studentId)
      if (student) {
        await recordAttendance({ teachingLogId, studentId, statusCode, statusSettings, student })
      }
    }
  }

  return { recordBehavior, recordAttendance, recordAttendanceBulk }
}
