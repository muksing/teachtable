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

  function localDateStr() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  async function recorderName() {
    const p = authStore.profile
    if (!p) return ''
    const teacherCode = p.teacher_id || p.teacherId
    if (teacherCode) {
      const { data } = await supabase
        .from('teachers')
        .select('prefix, first_name, last_name')
        .eq('school_id', schoolId())
        .eq('teacher_code', teacherCode)
        .maybeSingle()
      if (data) return [data.prefix, data.first_name, data.last_name].filter(Boolean).join(' ')
    }
    return p.displayName || p.email || ''
  }

  /**
   * บันทึก behavior log และอัปเดตคะแนนนักเรียน
   */
  async function recordBehavior({ student, setting, pointsChange, note, source = 'manual', refTeachingLogId = null, image_urls = [] }) {
    const t = term()
    const sid = schoolId()

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const recordedById = authUser?.id || null

    // ดึงคะแนนปัจจุบันของนักเรียน (รวม carry_over)
    const { data: studentData, error: studentErr } = await supabase
      .from('students')
      .select('behavior_carry_over, total_behavior_score, general_behavior_score, attendance_behavior_score, learning_behavior_score')
      .eq('student_code', student.student_id)
      .eq('school_id', sid)
      .single()

    if (studentErr) throw studentErr

    const behaviorType = setting.behavior_type
    const scoreField = behaviorType === 'attendance'
      ? 'attendance_behavior_score'
      : behaviorType === 'learning'
        ? 'learning_behavior_score'
        : 'general_behavior_score'

    const scoreBefore = studentData?.[scoreField] ?? 0
    const scoreAfter  = scoreBefore + pointsChange

    // total = carry_over + ผลรวมทุกประเภท
    const carryOver    = studentData?.behavior_carry_over ?? 0
    const newGeneral   = scoreField === 'general_behavior_score'   ? scoreAfter : (studentData?.general_behavior_score   ?? 0)
    const newAttend    = scoreField === 'attendance_behavior_score' ? scoreAfter : (studentData?.attendance_behavior_score ?? 0)
    const newLearning  = scoreField === 'learning_behavior_score'   ? scoreAfter : (studentData?.learning_behavior_score   ?? 0)
    const newTotal     = carryOver + newGeneral + newAttend + newLearning

    const logData = {
      term_id:                      t,
      student_id:                   student.student_id,
      class_id:                     student.class_id,
      recorded_by:                  recordedById,
      recorded_by_name_snapshot:    await recorderName(),
      source_type:                  source,
      source_id:                    refTeachingLogId || null,
      behavior_type:                behaviorType,
      behavior_type_label_snapshot: getBehaviorTypeLabel(behaviorType),
      label_snapshot:               setting.label || setting.name || getBehaviorTypeLabel(behaviorType),
      points_change:                pointsChange,
      score_after:                  scoreAfter,
      note:                         note || '',
      image_urls:                   Array.isArray(image_urls) ? image_urls : [],
      school_id:                    sid,
      date:                         localDateStr(),
      created_at:                   new Date().toISOString(),
    }

    const { error: logErr } = await supabase.from('behavior_logs').insert(logData)
    if (logErr) throw logErr

    const { error: updateErr } = await supabase
      .from('students')
      .update({ total_behavior_score: newTotal, [scoreField]: scoreAfter })
      .eq('student_code', student.student_id)
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

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const recordedById = authUser?.id || null

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

    // 2. ถ้า affects_behavior หรือมีการตั้งคะแนน → สร้าง behavior log
    if (status.affects_behavior || status.points_default !== 0) {
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('behavior_carry_over, total_behavior_score, general_behavior_score, attendance_behavior_score, learning_behavior_score')
        .eq('student_code', studentId)
        .eq('school_id', sid)
        .single()

      if (studentErr) throw studentErr

      const scoreBefore  = studentData?.attendance_behavior_score ?? 0
      const scoreAfter   = scoreBefore + status.points_default
      const carryOver    = studentData?.behavior_carry_over   ?? 0
      const newGeneral   = studentData?.general_behavior_score   ?? 0
      const newLearning  = studentData?.learning_behavior_score   ?? 0
      const newTotal     = carryOver + newGeneral + scoreAfter + newLearning

      const { error: logErr } = await supabase.from('behavior_logs').insert({
        term_id:                      t,
        student_id:                   studentId,
        class_id:                     student.class_id,
        recorded_by:                  recordedById,
        recorded_by_name_snapshot:    await recorderName(),
        source_type:                  'auto_attendance',
        source_id:                    teachingLogId,
        behavior_type:                'attendance',
        behavior_type_label_snapshot: 'พฤติกรรมการมาเรียน',
        label_snapshot:               `เช็คชื่อ: ${status.label}`,
        points_change:                status.points_default,
        score_after:                  scoreAfter,
        note:                         `เช็คชื่อ: ${status.label}`,
        image_urls:                   [],
        school_id:                    sid,
        date:                         localDateStr(),
        created_at:                   new Date().toISOString(),
      })

      if (logErr) throw logErr

      const { error: updateErr } = await supabase
        .from('students')
        .update({ total_behavior_score: newTotal, attendance_behavior_score: scoreAfter })
        .eq('student_code', studentId)
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
