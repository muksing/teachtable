import { supabase } from '@/supabase/client'

export function useExam() {

  // ===== Teacher =====

  async function saveExam(p) {
    const { data, error } = await supabase.rpc('save_exam', {
      p_id: p.id || null,
      p_school_id: p.schoolId,
      p_subject_code: p.subjectCode || null,
      p_subject_name: p.subjectName,
      p_class_ids: p.classIds || [],
      p_title: p.title,
      p_description: p.description || null,
      p_exam_date: p.examDate,
      p_start_time: p.startTime,
      p_end_time: p.endTime,
      p_duration_minutes: Number(p.durationMinutes) || 60,
      p_violation_limit: Number(p.violationLimit) || 3,
      p_shuffle_questions: p.shuffleQuestions ?? true,
      p_created_by: p.createdBy || null,
      p_term_id: p.termId || null,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, id: data }
  }

  async function updateExamSettings(examId, { examType, isActive, antiCheat } = {}) {
    if (isActive !== undefined && isActive !== null) {
      const { error } = await supabase.rpc('toggle_exam_active', {
        p_exam_id: examId, p_is_active: isActive,
      })
      if (error) return { success: false, error: error.message }
    }
    const patch = {}
    if (examType  !== undefined && examType  !== null) patch.exam_type  = examType
    if (antiCheat !== undefined && antiCheat !== null) patch.anti_cheat = antiCheat
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('exams').update(patch).eq('id', examId)
      if (error) return { success: false, error: error.message }
    }
    return { success: true }
  }

  async function deleteExam(id, schoolId) {
    const { error } = await supabase.rpc('delete_exam', { p_id: id, p_school_id: schoolId })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  function parseClassIds(val) {
    if (Array.isArray(val)) return val
    if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
    return []
  }

  function normalizeExam(e) {
    return { ...e, class_ids: parseClassIds(e.class_ids) }
  }

  async function getExams(schoolId, teacherUid = null) {
    let q = supabase.from('exams')
      .select('*')
      .eq('school_id', schoolId)
      .order('exam_date', { ascending: false })
    if (teacherUid) q = q.eq('created_by', teacherUid)
    const { data, error } = await q
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data || []).map(normalizeExam) }
  }

  async function getExamById(id) {
    const { data, error } = await supabase.from('exams').select('*').eq('id', id).single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: normalizeExam(data) }
  }

  async function getQuestions(examId) {
    const { data, error } = await supabase.from('exam_questions')
      .select('*').eq('exam_id', examId).order('order_num')
    if (error) return { success: false, error: error.message }
    return { success: true, data: data || [] }
  }

  async function saveQuestion(p) {
    const { data, error } = await supabase.rpc('save_exam_question', {
      p_id: p.id || null,
      p_exam_id: p.examId,
      p_school_id: p.schoolId,
      p_order_num: Number(p.orderNum) || 1,
      p_question_type: p.questionType || 'choice',
      p_question_text: p.questionText || '',
      p_question_image: p.questionImage || null,
      p_choices: p.choices != null ? JSON.stringify(p.choices) : '[]',
      p_correct_answer: p.correctAnswer || null,
      p_match_pairs: p.matchPairs != null ? JSON.stringify(p.matchPairs) : '[]',
      p_points: Number(p.points) || 1,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, id: data }
  }

  async function deleteQuestion(id) {
    const { error } = await supabase.rpc('delete_exam_question', { p_id: id })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // ===== Proctor =====

  async function getSessions(examId) {
    const { data, error } = await supabase.from('exam_sessions')
      .select('*').eq('exam_id', examId).order('created_at')
    if (error) return { success: false, error: error.message }
    const sessions = data || []

    // Enrich with prefix, first_name, last_name, seat_number from students table
    const codes = [...new Set(sessions.map(s => s.student_code).filter(Boolean))]
    if (codes.length) {
      const { data: studs } = await supabase.from('students')
        .select('student_code, prefix, first_name, last_name, seat_number')
        .in('student_code', codes)
      const stuMap = {}
      for (const st of studs || []) stuMap[st.student_code] = st
      for (const sess of sessions) {
        const st = stuMap[sess.student_code]
        sess.prefix      = st?.prefix      || ''
        sess.first_name  = st?.first_name  || ''
        sess.last_name   = st?.last_name   || ''
        sess.seat_number = st?.seat_number || ''
        sess.display_name = st
          ? [st.prefix, st.first_name, st.last_name].filter(Boolean).join(' ')
          : (sess.student_name || sess.student_code)
      }
    } else {
      for (const sess of sessions) sess.display_name = sess.student_name || sess.student_code
    }

    return { success: true, data: sessions }
  }

  async function approveSession(sessionId, approver, shuffledIds) {
    const { error } = await supabase.rpc('approve_exam_session', {
      p_session_id: sessionId,
      p_approver: approver,
      p_shuffled_ids: JSON.stringify(shuffledIds),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function lockSession(sessionId, locker) {
    const { error } = await supabase.rpc('lock_exam_session', {
      p_session_id: sessionId,
      p_locker: locker,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function unlockSession(sessionId) {
    const { error } = await supabase.rpc('unlock_exam_session', { p_session_id: sessionId })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // ===== Student =====

  async function getExamsForStudent(schoolId, classId) {
    const { data, error } = await supabase.from('exams')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('exam_date')
    if (error) return { success: false, error: error.message }
    // filter client-side to avoid JSONB contains issues
    const all = (data || []).map(normalizeExam)
    const filtered = all.filter(e => e.class_ids.includes(classId))
    return { success: true, data: filtered }
  }

  async function joinExam(examId, schoolId, studentCode, studentName, classId, photoUrl) {
    const { data, error } = await supabase.rpc('student_join_exam', {
      p_exam_id: examId,
      p_school_id: schoolId,
      p_student_code: studentCode,
      p_student_name: studentName,
      p_class_id: classId,
      p_photo_url: photoUrl || null,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data: typeof data === 'string' ? JSON.parse(data) : data }
  }

  async function saveAnswers(sessionId, answers) {
    const { error } = await supabase.rpc('save_exam_answers', {
      p_session_id: sessionId,
      p_answers: answers,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function submitExam(sessionId, answers) {
    const { data, error } = await supabase.rpc('submit_exam_session', {
      p_session_id: sessionId,
      p_answers: answers,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data: typeof data === 'string' ? JSON.parse(data) : data }
  }

  async function logViolation(sessionId, examId, schoolId, studentCode, violationType) {
    const { data, error } = await supabase.rpc('log_exam_violation', {
      p_session_id: sessionId,
      p_exam_id: examId,
      p_school_id: schoolId,
      p_student_code: studentCode,
      p_violation_type: violationType,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data: typeof data === 'string' ? JSON.parse(data) : data }
  }

  async function duplicateExam(examId, schoolId, createdBy) {
    const { data, error } = await supabase.rpc('duplicate_exam', {
      p_exam_id: examId, p_school_id: schoolId, p_created_by: createdBy,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, id: data }
  }

  async function deleteSession(sessionId) {
    const { error } = await supabase.from('exam_sessions').delete().eq('id', sessionId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function allowRetake(sessionId) {
    const { data, error } = await supabase.rpc('allow_exam_retake', { p_session_id: sessionId })
    if (error) return { success: false, error: error.message }
    return { success: true, id: data }
  }

  async function saveManualScores(sessionId, manualScores, finalScore) {
    const { error } = await supabase.rpc('save_manual_scores', {
      p_session_id: sessionId,
      p_manual_scores: manualScores,
      p_final_score: finalScore,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // override getMySession to return latest attempt
  async function getMySession(examId, studentCode) {
    const { data, error } = await supabase.from('exam_sessions')
      .select('*').eq('exam_id', examId).eq('student_code', studentCode)
      .order('attempt_number', { ascending: false })
      .limit(1).maybeSingle()
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  }

  return {
    saveExam, deleteExam, updateExamSettings, getExams, getExamById,
    getQuestions, saveQuestion, deleteQuestion,
    getSessions, approveSession, lockSession,
    getExamsForStudent, joinExam, getMySession,
    saveAnswers, submitExam, logViolation,
    unlockSession, duplicateExam, allowRetake, saveManualScores, deleteSession,
  }
}
